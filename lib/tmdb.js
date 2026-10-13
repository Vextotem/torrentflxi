// TMDB client: titles, lists, people and watch providers (JustWatch data), cached in memory.
import { TtlCache, memoize, slugify } from './util.js';
import { normalizeTitle } from './prowlarr.js';

const IMG = 'https://image.tmdb.org/t/p';
export const img = (path, size = 'w342') => (path ? `${IMG}/${size}${path}` : null);

const HOUR = 60 * 60 * 1000;

export function createTmdb(config = {}) {
  const apiKey = String(config.apiKey || '').trim();
  const readToken = String(config.readToken || '').trim();
  // baseUrl may point at your own TMDB proxy (for example Moviepire's), which adds the key itself.
  const base = String(config.baseUrl || 'https://api.themoviedb.org/3').replace(/\/+$/, '');
  const usesProxy = !/^https:\/\/api\.themoviedb\.org\//i.test(`${base}/`);
  const fetchImpl = config.fetch || fetch;
  const configured = Boolean(apiKey || readToken || usesProxy);
  const cached = memoize(new TtlCache(config.cacheEntries || 3000), value => (value?.__ttl ?? HOUR));

  async function get(path, params = {}, ttl = HOUR) {
    if (!configured) throw Object.assign(new Error('TMDB_API_KEY (or TMDB_BASE_URL for a TMDB proxy) is not set.'), { statusCode: 503 });
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    if (apiKey && !readToken) url.searchParams.set('api_key', apiKey);
    const key = url.href;
    return cached(key, async () => {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json', ...(readToken ? { authorization: `Bearer ${readToken}` } : {}) },
        signal: AbortSignal.timeout(Number(config.timeoutMs || 10000))
      });
      if (response.status === 404) throw Object.assign(new Error('Not found'), { statusCode: 404 });
      if (!response.ok) throw Object.assign(new Error(`TMDB answered HTTP ${response.status}`), { statusCode: 502 });
      const body = await response.json();
      Object.defineProperty(body, '__ttl', { value: ttl, enumerable: false });
      return body;
    });
  }

  // __type: the media type of every result (lists that aren't "multi" don't say it per item).
  const list = async (path, params = {}, ttl = HOUR) => {
    const { __type, ...query } = params;
    const data = await get(path, query, ttl);
    return {
      page: Number(data.page || 1),
      totalPages: Math.min(500, Number(data.total_pages || 1)),
      totalResults: Number(data.total_results || 0),
      results: (data.results || []).map(item => card(item, __type || null)).filter(Boolean)
    };
  };

  // type: 'movie' | 'tv'
  return {
    configured,
    get,
    trending: (type, lang, window = 'week', page = 1) => list(`/trending/${type}/${window}`, { language: lang, page, __type: type }),
    popular: (type, lang, page = 1) => list(`/${type}/popular`, { language: lang, page, __type: type }),
    topRated: (type, lang, page = 1) => list(`/${type}/top_rated`, { language: lang, page, __type: type }, 6 * HOUR),
    nowPlaying: (lang, page = 1, region) => list('/movie/now_playing', { language: lang, page, region, __type: 'movie' }),
    upcoming: (lang, page = 1, region) => list('/movie/upcoming', { language: lang, page, region, __type: 'movie' }),
    airingToday: (lang, page = 1) => list('/tv/airing_today', { language: lang, page, __type: 'tv' }),
    onTheAir: (lang, page = 1) => list('/tv/on_the_air', { language: lang, page, __type: 'tv' }),
    discover: (type, lang, filters = {}) => list(`/discover/${type}`, { language: lang, include_adult: false, ...filters, __type: type }),
    search: (query, lang, page = 1) => list('/search/multi', { query, language: lang, page, include_adult: false }, 30 * 60 * 1000),
    genres: async (type, lang) => (await get(`/genre/${type}/list`, { language: lang }, 24 * HOUR)).genres || [],
    collection: async (id, lang) => {
      const data = await get(`/collection/${id}`, { language: lang }, 24 * HOUR);
      return {
        id: data.id,
        name: data.name,
        overview: data.overview || '',
        poster: img(data.poster_path, 'w500'),
        backdrop: img(data.backdrop_path, 'w1280'),
        parts: (data.parts || []).map(item => card(item, 'movie')).filter(Boolean)
          .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')))
      };
    },
    details: async (type, id, lang) => details(await get(`/${type}/${id}`, {
      language: lang,
      append_to_response: 'credits,videos,external_ids,alternative_titles,recommendations,similar,images,release_dates,content_ratings,keywords',
      include_image_language: `${String(lang || 'en').slice(0, 2)},en,null`
    }, 6 * HOUR), type),
    season: async (id, season, lang) => {
      const data = await get(`/tv/${id}/season/${season}`, { language: lang }, 3 * HOUR);
      return {
        season: Number(data.season_number),
        name: data.name,
        overview: data.overview || '',
        airDate: data.air_date || null,
        poster: img(data.poster_path, 'w342'),
        episodes: (data.episodes || []).map(ep => ({
          episode: Number(ep.episode_number),
          season: Number(ep.season_number),
          name: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview || '',
          airDate: ep.air_date || null,
          runtime: Number(ep.runtime || 0),
          rating: Number(ep.vote_average || 0),
          still: img(ep.still_path, 'w300')
        }))
      };
    },
    providers: async (type, id, region) => {
      const data = await get(`/${type}/${id}/watch/providers`, {}, 12 * HOUR);
      const entry = data.results?.[region] || data.results?.US || null;
      if (!entry) return null;
      const map = list => (list || []).map(p => ({ name: p.provider_name, logo: img(p.logo_path, 'w92') }));
      return {
        link: entry.link || null,
        stream: map(entry.flatrate),
        free: map([...(entry.free || []), ...(entry.ads || [])]),
        rent: map(entry.rent),
        buy: map(entry.buy)
      };
    }
  };
}

// A poster card for lists and carousels.
export function card(item, forcedType = null) {
  if (!item || !item.id) return null;
  const type = forcedType || item.media_type;
  if (type !== 'movie' && type !== 'tv') return null;
  const title = type === 'movie' ? item.title || item.original_title : item.name || item.original_name;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  const year = date ? Number(String(date).slice(0, 4)) || null : null;
  return {
    type,
    id: item.id,
    title: title || 'Untitled',
    year,
    date: date || null,
    rating: Number(item.vote_average || 0),
    poster: img(item.poster_path, 'w342'),
    backdrop: img(item.backdrop_path, 'w780'),
    overview: item.overview || '',
    url: titleUrl(type, item.id, title, year)
  };
}

export function titleUrl(type, id, title, year) {
  const slug = slugify(`${title || ''}${year ? ` ${year}` : ''}`);
  return `/${type === 'movie' ? 'movies' : 'tv'}/${slug}-${id}`;
}

export function episodeUrl(show, season, episode) {
  return `${titleUrl('tv', show.id, show.title, show.year)}/season/${season}/episode/${episode}`;
}

// Full title details, in the shape the release ranking (prowlarr.js) expects plus what the pages show.
export function details(raw, type) {
  const isMovie = type === 'movie';
  const date = isMovie ? raw.release_date : raw.first_air_date;
  const year = date ? Number(String(date).slice(0, 4)) || null : null;
  const title = isMovie ? raw.title : raw.name;
  const genres = (raw.genres || []).map(g => ({ id: g.id, name: g.name }));
  const genreIds = genres.map(g => Number(g.id));
  const altSource = isMovie ? raw.alternative_titles?.titles : raw.alternative_titles?.results;
  const countries = [...(raw.origin_country || []), ...(raw.production_countries || []).map(c => c.iso_3166_1)];
  const isAnime = genreIds.includes(16) && (raw.original_language === 'ja' || countries.includes('JP'));
  const romajiTitles = isAnime
    ? [...new Set((altSource || [])
      .filter(t => t?.iso_3166_1 === 'JP' && /^[\x20-\x7EÀ-ſ]+$/.test(String(t.title || '')))
      .map(t => String(t.title).trim()).filter(t => normalizeTitle(t)))].slice(0, 4)
    : [];
  const alternativeTitles = [...new Set((altSource || [])
    .filter(t => ['US', 'GB', 'CA', 'AU', 'IE', 'NZ'].includes(t?.iso_3166_1))
    .map(t => String(t.title || '').trim()).filter(Boolean))].slice(0, 8);
  const videos = raw.videos?.results || [];
  const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
    || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
    || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser') || null;
  const crew = raw.credits?.crew || [];
  const certification = isMovie
    ? (raw.release_dates?.results || []).find(r => r.iso_3166_1 === 'US')?.release_dates?.find(d => d.certification)?.certification || null
    : (raw.content_ratings?.results || []).find(r => r.iso_3166_1 === 'US')?.rating || null;
  const recommendations = (raw.recommendations?.results || []).map(item => card(item, item.media_type || type)).filter(Boolean);
  const similar = (raw.similar?.results || []).map(item => card(item, item.media_type || type)).filter(Boolean);
  const seen = new Set();
  const related = [...recommendations, ...similar].filter(item => !seen.has(item.id) && seen.add(item.id)).slice(0, 18);

  return {
    type,
    mediaType: type,
    id: raw.id,
    imdbId: raw.external_ids?.imdb_id || raw.imdb_id || null,
    tvdbId: raw.external_ids?.tvdb_id || null,
    title: title || 'Untitled',
    originalTitle: isMovie ? raw.original_title : raw.original_name,
    alternativeTitles,
    romajiTitles,
    isAnime,
    tagline: raw.tagline || '',
    overview: raw.overview || '',
    year,
    date: date || null,
    runtime: isMovie ? Number(raw.runtime || 0) : Number(raw.episode_run_time?.[0] || 0),
    rating: Number(raw.vote_average || 0),
    voteCount: Number(raw.vote_count || 0),
    status: raw.status || null,
    certification,
    genres,
    poster: img(raw.poster_path, 'w500'),
    posterSmall: img(raw.poster_path, 'w342'),
    backdrop: img(raw.backdrop_path, 'w1280'),
    originalLanguage: raw.original_language || null,
    spokenLanguages: (raw.spoken_languages || []).map(l => l.english_name || l.name).filter(Boolean),
    countries: [...new Set(countries)],
    collection: raw.belongs_to_collection
      ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name, url: `/collection/${slugify(raw.belongs_to_collection.name)}-${raw.belongs_to_collection.id}` }
      : null,
    numberOfSeasons: Number(raw.number_of_seasons || 0),
    numberOfEpisodes: Number(raw.number_of_episodes || 0),
    lastAired: raw.last_episode_to_air
      ? { season: Number(raw.last_episode_to_air.season_number), episode: Number(raw.last_episode_to_air.episode_number) }
      : null,
    nextAir: raw.next_episode_to_air
      ? { season: Number(raw.next_episode_to_air.season_number), episode: Number(raw.next_episode_to_air.episode_number), date: raw.next_episode_to_air.air_date }
      : null,
    seasons: (raw.seasons || []).map(s => ({
      seasonNumber: Number(s.season_number),
      name: s.name,
      episodeCount: Number(s.episode_count || 0),
      airDate: s.air_date || null,
      poster: img(s.poster_path, 'w185')
    })),
    networks: (raw.networks || []).map(n => n.name),
    studios: (raw.production_companies || []).slice(0, 4).map(c => c.name),
    creators: (raw.created_by || []).map(c => c.name),
    directors: crew.filter(p => p.job === 'Director').slice(0, 3).map(p => p.name),
    writers: crew.filter(p => ['Screenplay', 'Writer'].includes(p.job)).slice(0, 3).map(p => p.name),
    cast: (raw.credits?.cast || []).slice(0, 14).map(p => ({ name: p.name, character: p.character || '', photo: img(p.profile_path, 'w185') })),
    trailer: trailer ? { key: trailer.key, name: trailer.name } : null,
    images: (raw.images?.backdrops || []).slice(0, 8).map(b => ({ small: img(b.file_path, 'w780'), large: img(b.file_path, 'original') })),
    keywords: (raw.keywords?.keywords || raw.keywords?.results || []).slice(0, 12).map(k => k.name),
    related,
    url: titleUrl(type, raw.id, title, year)
  };
}
