// TorrentFlxi: free movie and TV catalog, streaming through your own player, and torrent search.
// Node 22, no dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createTmdb } from './lib/tmdb.js';
import { createProwlarrClient } from './lib/prowlarr.js';
import { createCometClient } from './lib/comet.js';
import { createSubtitleService, languageName } from './lib/subtitles.js';
import { createTorrentSearch } from './lib/torrents.js';
import { translator, pickLanguage, LANGS } from './lib/i18n.js';
import { idFromSlug, parseCookies, clampInt, TtlCache, h } from './lib/util.js';
import * as views from './lib/views.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const truthy = value => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());

const PORT = Number(env.PORT || 3000);
const HOST = env.HOST || '0.0.0.0';
const site = {
  name: env.SITE_NAME || 'TorrentFlxi',
  url: String(env.SITE_URL || `http://localhost:${PORT}`).replace(/\/+$/, ''),
  playerUrl: String(env.PLAYER_URL || '').replace(/\/+$/, ''),
  contact: env.CONTACT_EMAIL || '',
  version: '1.0.0'
};
const REGION = String(env.WATCH_REGION || 'US').toUpperCase();
const ADS_ENABLED = !/^(0|false|no|off)$/i.test(String(env.ADS_ENABLED ?? 'true'));
const TORRENT_RATE_LIMIT = Math.max(0, Number(env.TORRENT_RATE_LIMIT ?? 30)); // searches per IP per minute

const tmdb = createTmdb({ apiKey: env.TMDB_API_KEY, readToken: env.TMDB_READ_TOKEN, baseUrl: env.TMDB_BASE_URL });
const prowlarrConfig = {
  url: env.PROWLARR_URL || '',
  apiKey: env.PROWLARR_API_KEY || '',
  timeoutMs: Number(env.PROWLARR_TIMEOUT_MS || 30000),
  settleMs: Number(env.PROWLARR_SETTLE_MS || 4000),
  cacheSeconds: Number(env.PROWLARR_CACHE_SECONDS ?? 1800),
  indexerIds: String(env.PROWLARR_INDEXER_IDS || '').split(',').map(v => Number(v.trim())).filter(Boolean),
  roles: {
    movie: env.INDEXER_MOVIES || 'YTS',
    tv: env.INDEXER_TV || 'EZTV',
    anime: env.INDEXER_ANIME || 'Nyaa',
    backup: env.INDEXER_BACKUP || 'Knaben,The Pirate Bay,LimeTorrents'
  },
  // A listing wants every indexer, not just the first good answer.
  backupAfterMs: Number(env.BACKUP_AFTER_MS ?? 0),
  minSeeders: Math.max(0, Number(env.MIN_SEEDERS ?? 1)),
  maxSizeGb: Math.max(1, Number(env.MAX_MOVIE_SIZE_GB || 120)),
  maxEpisodeSizeGb: Math.max(1, Number(env.MAX_EPISODE_SIZE_GB || 30)),
  seasonPacks: !/^(0|false|no|off)$/i.test(String(env.PROWLARR_SEASON_PACKS ?? 'true')),
  userAgent: 'TorrentFlxi/1.0'
};
const prowlarr = createProwlarrClient(prowlarrConfig);
const comet = createCometClient({ url: env.COMET_URL, timeoutMs: env.COMET_TIMEOUT_MS || 8000, maxSizeGb: prowlarrConfig.maxSizeGb, maxEpisodeSizeGb: prowlarrConfig.maxEpisodeSizeGb });
const torrents = createTorrentSearch({ prowlarr, comet, prowlarrConfig });
const subtitles = createSubtitleService({ enabled: !/^(0|false|no|off)$/i.test(String(env.SUBTITLES_ENABLED ?? 'true')), languages: env.SUBTITLE_LANGS || 'en', perLanguage: 3, maxTotal: 80 });

// ---------- static files and ads ----------
const STATIC_DIR = path.join(__dirname, 'public');
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const ADS_FILE = path.join(__dirname, 'ads.js');
let adsCache = { mtime: 0, text: '' };
function adsHtml() {
  if (!ADS_ENABLED) return '';
  try {
    const stat = fs.statSync(ADS_FILE);
    if (stat.mtimeMs !== adsCache.mtime) adsCache = { mtime: stat.mtimeMs, text: fs.readFileSync(ADS_FILE, 'utf8') };
    return adsCache.text;
  } catch {
    return '';
  }
}

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'interest-cohort=()',
    ...headers
  });
  res.end(body);
}
const html = (res, body, status = 200, cache = 'public, max-age=120, s-maxage=600') => send(res, status, body, { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache });
const json = (res, data, status = 200, cache = 'no-store') => send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache });
const redirect = (res, location, status = 301) => send(res, status, '', { location });

const rate = new TtlCache(20000);
function overLimit(ip) {
  if (!TORRENT_RATE_LIMIT) return false;
  const key = `r:${ip}`;
  const entry = rate.get(key) || { n: 0 };
  entry.n += 1;
  rate.set(key, entry, 60000);
  return entry.n > TORRENT_RATE_LIMIT;
}
const clientIp = req => String(req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '');

async function settle(promises) {
  const out = await Promise.allSettled(promises);
  return out.map(result => (result.status === 'fulfilled' ? result.value : null));
}
const emptyList = { page: 1, totalPages: 1, totalResults: 0, results: [] };

// ---------- pages ----------
async function homeRoute(ctx) {
  const L = ctx.tmdbLang;
  const [trendingMovies, trendingTv, nowPlaying, popularTv, topMovies, airingToday] = await settle([
    tmdb.trending('movie', L), tmdb.trending('tv', L), tmdb.nowPlaying(L, 1, REGION), tmdb.popular('tv', L), tmdb.topRated('movie', L), tmdb.airingToday(L)
  ]);
  const pick = list => list?.results || [];
  const hero = pick(trendingMovies).find(item => item.backdrop && item.overview) || null;
  return views.homePage(ctx, {
    hero,
    trendingMovies: pick(trendingMovies), trendingTv: pick(trendingTv), nowPlaying: pick(nowPlaying),
    popularTv: pick(popularTv), topMovies: pick(topMovies), airingToday: pick(airingToday)
  });
}

const SORTS = new Set(['popularity.desc', 'vote_average.desc', 'primary_release_date.desc', 'first_air_date.desc', 'vote_count.desc']);
async function discoverRoute(ctx, type) {
  const q = ctx.query;
  const filters = {
    genre: /^\d{1,6}$/.test(q.genre || '') ? q.genre : '',
    year: /^\d{4}$/.test(q.year || '') ? q.year : '',
    sort: SORTS.has(q.sort) ? q.sort : 'popularity.desc'
  };
  const page = clampInt(q.page, 1, 500, 1);
  const params = {
    page,
    sort_by: filters.sort,
    with_genres: filters.genre || undefined,
    // Highest-rated lists need enough votes to mean anything.
    'vote_count.gte': filters.sort === 'vote_average.desc' ? 300 : undefined
  };
  if (filters.year) params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = filters.year;
  if (filters.sort.endsWith('date.desc')) params[type === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = new Date().toISOString().slice(0, 10);
  const [genres, list] = await Promise.all([tmdb.genres(type, ctx.tmdbLang).catch(() => []), tmdb.discover(type, ctx.tmdbLang, params)]);
  return views.discoverPage(ctx, { type, genres, filters, list });
}

async function topRoute(ctx) {
  const type = ctx.query.type === 'tv' ? 'tv' : 'movie';
  const page = clampInt(ctx.query.page, 1, 500, 1);
  const list = await tmdb.topRated(type, ctx.tmdbLang, page);
  const { t } = ctx;
  return views.listPage(ctx, {
    heading: `${t('top')} · ${type === 'movie' ? t('movies') : t('tv')}`,
    list, baseUrl: '/top', query: { type },
    tabs: views.tabs([['/top?type=movie', t('movies'), 'movie'], ['/top?type=tv', t('tv'), 'tv']], type)
  });
}

async function upcomingRoute(ctx) {
  const page = clampInt(ctx.query.page, 1, 500, 1);
  const tab = ctx.query.tab === 'now' ? 'now' : 'upcoming';
  const list = tab === 'now' ? await tmdb.nowPlaying(ctx.tmdbLang, page, REGION) : await tmdb.upcoming(ctx.tmdbLang, page, REGION);
  const { t } = ctx;
  return views.listPage(ctx, {
    heading: tab === 'now' ? t('nowPlaying') : t('upcoming'),
    list, baseUrl: '/upcoming', query: tab === 'now' ? { tab } : {},
    tabs: views.tabs([['/upcoming', t('upcoming'), 'upcoming'], ['/upcoming?tab=now', t('nowPlaying'), 'now']], tab)
  });
}

async function calendarRoute(ctx) {
  const [today, week] = await settle([tmdb.airingToday(ctx.tmdbLang), tmdb.onTheAir(ctx.tmdbLang)]);
  return views.calendarPage(ctx, { today: today || emptyList, week: week || emptyList });
}

async function genresRoute(ctx) {
  const [movie, tv] = await Promise.all([tmdb.genres('movie', ctx.tmdbLang), tmdb.genres('tv', ctx.tmdbLang)]);
  return views.genresPage(ctx, { movie, tv });
}

async function genreRoute(ctx, type, slug) {
  const id = Number(String(slug).split('-')[0]);
  if (!Number.isInteger(id) || id <= 0) return null;
  const genres = await tmdb.genres(type, ctx.tmdbLang);
  const genre = genres.find(g => g.id === id);
  if (!genre) return null;
  const page = clampInt(ctx.query.page, 1, 500, 1);
  const list = await tmdb.discover(type, ctx.tmdbLang, { page, with_genres: id, sort_by: 'popularity.desc' });
  return views.listPage(ctx, { heading: `${genre.name} · ${type === 'movie' ? ctx.t('movies') : ctx.t('tv')}`, list, baseUrl: `/genre/${type}/${slug}` });
}

async function searchRoute(ctx) {
  const q = String(ctx.query.q || '').trim().slice(0, 120);
  const page = clampInt(ctx.query.page, 1, 100, 1);
  const list = q ? await tmdb.search(q, ctx.tmdbLang, page) : emptyList;
  return views.searchPage(ctx, { q, list });
}

async function collectionRoute(ctx, slug) {
  const id = idFromSlug(slug);
  if (!id) return null;
  return views.collectionPage(ctx, await tmdb.collection(id, ctx.tmdbLang));
}

async function movieRoute(ctx, slug, res) {
  const id = idFromSlug(slug);
  if (!id) return null;
  const [d, providers] = await Promise.all([tmdb.details('movie', id, ctx.tmdbLang), tmdb.providers('movie', id, REGION).catch(() => null)]);
  if (`/movies/${slug}` !== d.url) { redirect(res, d.url + ctx.search); return true; }
  return views.moviePage(ctx, { d, providers });
}

async function showRoute(ctx, slug, res) {
  const id = idFromSlug(slug);
  if (!id) return null;
  const [d, providers] = await Promise.all([tmdb.details('tv', id, ctx.tmdbLang), tmdb.providers('tv', id, REGION).catch(() => null)]);
  if (`/tv/${slug}` !== d.url) { redirect(res, d.url + ctx.search); return true; }
  const numbers = d.seasons.filter(s => s.episodeCount > 0).map(s => s.seasonNumber);
  const wanted = Number(ctx.query.season);
  const seasonNumber = numbers.includes(wanted) ? wanted : (numbers.find(n => n > 0) ?? numbers[0]);
  const season = seasonNumber === undefined ? null : await tmdb.season(id, seasonNumber, ctx.tmdbLang).catch(() => null);
  return views.showPage(ctx, { d, providers, season, seasonNumber });
}

async function episodeRoute(ctx, slug, s, e, res) {
  const id = idFromSlug(slug);
  const seasonNumber = Number(s);
  const episodeNumber = Number(e);
  if (!id || !Number.isInteger(seasonNumber) || seasonNumber < 0 || !Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  const [d, season, providers] = await Promise.all([
    tmdb.details('tv', id, ctx.tmdbLang), tmdb.season(id, seasonNumber, ctx.tmdbLang), tmdb.providers('tv', id, REGION).catch(() => null)
  ]);
  const ep = season.episodes.find(item => item.episode === episodeNumber);
  if (!ep) return null;
  const canonical = `${d.url}/season/${seasonNumber}/episode/${episodeNumber}`;
  if (`/tv/${slug}/season/${s}/episode/${e}` !== canonical) { redirect(res, canonical + ctx.search); return true; }
  return views.episodePage(ctx, { d, season, ep, providers });
}

function staticPage(ctx, key) {
  const { t } = ctx;
  const contact = site.contact ? `<a href="mailto:${h(site.contact)}">${h(site.contact)}</a>` : 'the contact address published on this site';
  const pages = {
    about: [t('about'), `<p>${h(site.name)} is a free catalog of movies and TV shows. Every title page has a player, where-to-watch information, subtitles and a searchable list of torrents with full details. There is no account and no subscription.</p><p>Title information and images come from TMDB; streaming availability comes from JustWatch through TMDB.</p>`],
    legal: [t('legal'), `<p>${h(t('legalNote'))}</p><p>${h(site.name)} does not host, upload or store video files. Torrent listings are search results from public indexers and point to files held by third parties. Where a title is available from a licensed service, it is listed under “${h(t('whereToWatch'))}”.</p>`],
    dmca: [t('dmca'), `<p>If you believe a listing on ${h(site.name)} infringes your copyright, send a notice to ${contact} with: your contact details; the work you own; the exact ${h(site.name)} URL(s); a statement that you have a good-faith belief the use is not authorised; and a statement, under penalty of perjury, that the information is accurate and that you are the owner or authorised to act for the owner. Listings named in valid notices are removed promptly.</p>`],
    terms: [t('terms'), `<p>By using ${h(site.name)} you agree to use it lawfully and at your own risk. The service is provided “as is”, without warranties. You are responsible for complying with the copyright laws of your country. We may change or end the service at any time.</p>`],
    privacy: [t('privacy'), `<p>${h(site.name)} has no accounts. “My list” and your language choice are stored only in your own browser. Our servers keep standard technical logs (IP address, pages requested) for security and to keep the service running, and do not sell personal data. Advertising partners shown on the site may set their own cookies under their own policies.</p>`]
  };
  const page = pages[key];
  return page ? views.textPage(ctx, { title: page[0], html: page[1], canonical: `/${key}` }) : null;
}

// ---------- API ----------
async function torrentsApi(req, res, type, id, s, e) {
  if (!torrents.configured) return json(res, { items: [], configured: false });
  if (overLimit(clientIp(req))) return json(res, { error: 'Too many searches. Please wait a minute.' }, 429);
  // English titles match release names best.
  const media = await tmdb.details(type, id, 'en-US');
  const items = await torrents.list(media, type === 'tv' ? Number(s) : null, type === 'tv' ? Number(e) : null);
  json(res, { items }, 200, 'public, max-age=300');
}

// Subtitle files are served from this site (converted to WebVTT); the provider URLs stay on the server.
const subtitleRefs = new TtlCache(20000);
async function subtitlesApi(res, type, id, s, e) {
  const d = await tmdb.details(type, id, 'en-US');
  const list = await subtitles.findOnline({ mediaType: type, tmdbId: d.id, imdbId: d.imdbId, season: s ? Number(s) : null, episode: e ? Number(e) : null });
  const items = list.map(item => {
    const ref = createHash('sha256').update(item.url).digest('base64url').slice(0, 22);
    subtitleRefs.set(ref, item.url, 6 * 60 * 60 * 1000);
    return { lang: item.lang, label: languageName(item.lang) || item.lang, url: `/api/subtitle/${ref}.vtt` };
  });
  json(res, { items }, 200, 'public, max-age=3600');
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://local');
  const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(url.searchParams);
  const cookies = parseCookies(req.headers.cookie);
  const lang = pickLanguage(query.lang, cookies.lang, req.headers['accept-language']);
  if (query.lang && LANGS[query.lang]) {
    res.setHeader('set-cookie', `lang=${query.lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
    url.searchParams.delete('lang');
    const rest = url.searchParams.toString();
    return redirect(res, `${pathname}${rest ? `?${rest}` : ''}`, 302);
  }
  const ctx = { t: translator(lang), lang, tmdbLang: LANGS[lang].tmdb, site, path: pathname, query, search: url.search, ads: adsHtml() };

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { allow: 'GET, HEAD' });

  // static
  if (pathname.startsWith('/static/')) {
    const file = path.join(STATIC_DIR, path.basename(pathname));
    if (!file.startsWith(STATIC_DIR) || !fs.existsSync(file)) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(file), { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' });
  }
  if (pathname === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /search\nSitemap: ${site.url}/sitemap.xml\n`, { 'content-type': 'text/plain; charset=utf-8' });
  if (pathname === '/healthz') return send(res, 200, 'ok', { 'content-type': 'text/plain', 'cache-control': 'no-store' });
  if (pathname === '/favicon.ico') return redirect(res, `/static/favicon.svg?v=${site.version}`);
  if (pathname === '/sitemap.xml') {
    const [m, tv] = await settle([tmdb.popular('movie', 'en-US'), tmdb.popular('tv', 'en-US')]);
    const urls = ['/', '/movies', '/tv', '/top', '/genres', '/upcoming', '/calendar', ...(m?.results || []).map(i => i.url), ...(tv?.results || []).map(i => i.url)];
    return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${h(site.url + u)}</loc></url>`).join('')}</urlset>`, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' });
  }

  // API
  let m;
  if ((m = /^\/api\/torrents\/movie\/(\d{1,9})$/.exec(pathname))) return torrentsApi(req, res, 'movie', Number(m[1]));
  if ((m = /^\/api\/torrents\/tv\/(\d{1,9})\/(\d{1,3})\/(\d{1,4})$/.exec(pathname))) return torrentsApi(req, res, 'tv', Number(m[1]), m[2], m[3]);
  if ((m = /^\/api\/subtitles\/movie\/(\d{1,9})$/.exec(pathname))) return subtitlesApi(res, 'movie', Number(m[1]));
  if ((m = /^\/api\/subtitles\/tv\/(\d{1,9})\/(\d{1,3})\/(\d{1,4})$/.exec(pathname))) return subtitlesApi(res, 'tv', Number(m[1]), m[2], m[3]);
  if ((m = /^\/api\/subtitle\/([A-Za-z0-9_-]{1,400})\.vtt$/.exec(pathname))) {
    const source = subtitleRefs.get(m[1]);
    if (!source) return send(res, 404, 'Not found');
    const vtt = await subtitles.fetchVtt(source);
    return send(res, 200, vtt, { 'content-type': 'text/vtt; charset=utf-8', 'content-disposition': 'attachment; filename="subtitles.vtt"', 'cache-control': 'public, max-age=86400' });
  }
  if ((m = /^\/api\/magnet\/([A-Za-z0-9_-]{6,40})$/.exec(pathname))) {
    const magnet = await torrents.magnet(m[1]).catch(() => null);
    return magnet ? json(res, { magnet }) : json(res, { error: 'Magnet unavailable for this release.' }, 404);
  }
  if ((m = /^\/api\/torrent\/([A-Za-z0-9_-]{6,40})$/.exec(pathname))) {
    const file = await torrents.torrentFile(m[1]).catch(() => null);
    if (!file) return send(res, 404, 'Torrent file unavailable');
    if (file.magnet) return redirect(res, file.magnet, 302);
    return send(res, 200, file.torrent, { 'content-type': 'application/x-bittorrent', 'content-disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`, 'cache-control': 'no-store' });
  }
  if (pathname.startsWith('/api/')) return json(res, { error: 'Not found' }, 404);

  // pages
  let page = null;
  if (pathname === '/') page = await homeRoute(ctx);
  else if (pathname === '/movies') page = await discoverRoute(ctx, 'movie');
  else if (pathname === '/tv') page = await discoverRoute(ctx, 'tv');
  else if (pathname === '/top') page = await topRoute(ctx);
  else if (pathname === '/upcoming') page = await upcomingRoute(ctx);
  else if (pathname === '/calendar') page = await calendarRoute(ctx);
  else if (pathname === '/genres') page = await genresRoute(ctx);
  else if (pathname === '/search') page = await searchRoute(ctx);
  else if (pathname === '/my-list') page = views.myListPage(ctx);
  else if (['/about', '/legal', '/dmca', '/terms', '/privacy'].includes(pathname)) page = staticPage(ctx, pathname.slice(1));
  else if ((m = /^\/genre\/(movie|tv)\/([\w-]{1,80})$/.exec(pathname))) page = await genreRoute(ctx, m[1], m[2]);
  else if ((m = /^\/collection\/([\w-]{1,120})$/.exec(pathname))) page = await collectionRoute(ctx, m[1]);
  else if ((m = /^\/movies\/([\w-]{1,120})$/.exec(pathname))) page = await movieRoute(ctx, m[1], res);
  else if ((m = /^\/tv\/([\w-]{1,120})$/.exec(pathname))) page = await showRoute(ctx, m[1], res);
  else if ((m = /^\/tv\/([\w-]{1,120})\/season\/(\d{1,3})\/episode\/(\d{1,4})$/.exec(pathname))) page = await episodeRoute(ctx, m[1], m[2], m[3], res);

  if (page === true) return; // redirected
  if (!page) return html(res, views.errorPage(ctx, 404, ctx.t('noResults')), 404, 'no-store');
  const personal = ['/my-list', '/search'].includes(pathname);
  return html(res, page, 200, personal ? 'private, no-store' : undefined);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    const status = error.statusCode === 404 ? 404 : error.statusCode === 503 ? 503 : 500;
    if (status === 500) console.error(error);
    if (res.headersSent) return res.destroy();
    const lang = pickLanguage(null, parseCookies(req.headers.cookie).lang, req.headers['accept-language']);
    const ctx = { t: translator(lang), lang, tmdbLang: LANGS[lang].tmdb, site, path: '/', query: {}, ads: '' };
    if (String(req.url).startsWith('/api/')) return json(res, { error: status === 404 ? 'Not found' : 'Something went wrong.' }, status);
    const message = status === 404 ? ctx.t('noResults') : status === 503 ? 'The catalog is not configured yet (TMDB).' : 'Something went wrong. Please try again.';
    html(res, views.errorPage(ctx, status, message), status, 'no-store');
  });
});
server.requestTimeout = 120000;
server.headersTimeout = 30000;

export { server, handle };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => {
    console.log(`${site.name} listening on http://${HOST}:${PORT}`);
    console.log(`TMDB: ${tmdb.configured ? 'configured' : 'NOT configured (set TMDB_API_KEY or TMDB_BASE_URL)'}`);
    console.log(`Player: ${site.playerUrl || 'NOT configured (set PLAYER_URL)'}`);
    console.log(`Torrents: Prowlarr ${prowlarr.configured ? 'on' : 'off'}, Comet ${comet.configured ? 'on' : 'off'}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

