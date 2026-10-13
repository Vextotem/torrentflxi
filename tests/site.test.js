// End-to-end: the real server against fake TMDB, Prowlarr, Comet and subtitle hosts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);
const movieItem = { id: 550, title: 'Fight Club', release_date: '1999-10-15', vote_average: 8.4, poster_path: '/p.jpg', backdrop_path: '/b.jpg', overview: 'An insomniac office worker <b>and</b> a soap maker.' };
const tvItem = { id: 1396, name: 'Breaking Bad', first_air_date: '2008-01-20', vote_average: 8.9, poster_path: '/bb.jpg', backdrop_path: '/bbb.jpg', overview: 'A chemistry teacher.' };
const list = items => ({ page: 1, total_pages: 3, total_results: 60, results: items });
const movieDetails = {
  ...movieItem, original_title: 'Fight Club', runtime: 139, status: 'Released', tagline: 'Mischief. Mayhem. Soap.', vote_count: 30000,
  genres: [{ id: 18, name: 'Drama' }], imdb_id: 'tt0137523', external_ids: { imdb_id: 'tt0137523' },
  credits: { cast: [{ name: 'Edward Norton', character: 'Narrator', profile_path: '/en.jpg' }], crew: [{ job: 'Director', name: 'David Fincher' }] },
  videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc123', official: true, name: 'Trailer' }] },
  alternative_titles: { titles: [] }, recommendations: { results: [tvItem] }, similar: { results: [] }, images: { backdrops: [{ file_path: '/s1.jpg' }] },
  release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'R' }] }] }, keywords: { keywords: [{ name: 'dual identity' }] },
  belongs_to_collection: null, production_companies: [{ name: 'Fox 2000' }], spoken_languages: [{ english_name: 'English' }], production_countries: [{ iso_3166_1: 'US' }]
};
const tvDetails = {
  ...tvItem, original_name: 'Breaking Bad', episode_run_time: [47], status: 'Ended', vote_count: 15000, genres: [{ id: 18, name: 'Drama' }],
  external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189 }, credits: { cast: [], crew: [] }, videos: { results: [] }, alternative_titles: { results: [] },
  recommendations: { results: [] }, similar: { results: [] }, images: { backdrops: [] }, content_ratings: { results: [] }, keywords: { results: [] },
  number_of_seasons: 5, number_of_episodes: 62, networks: [{ name: 'AMC' }], created_by: [{ name: 'Vince Gilligan' }],
  seasons: [{ season_number: 0, name: 'Specials', episode_count: 2 }, { season_number: 1, name: 'Season 1', episode_count: 2 }],
  last_episode_to_air: { season_number: 5, episode_number: 16 }
};
const season1 = { season_number: 1, name: 'Season 1', episodes: [
  { episode_number: 1, season_number: 1, name: 'Pilot', overview: 'Walter starts.', air_date: '2008-01-20', runtime: 58 },
  { episode_number: 2, season_number: 1, name: "Cat's in the Bag...", overview: 'Cleanup.', air_date: '2008-01-27', runtime: 48 }
] };
const prowlarrReleases = [
  { title: 'Fight.Club.1999.1080p.BluRay.x264.DTS-HD.MA.5.1-GRP', size: 12e9, seeders: 120, leechers: 10, indexer: 'The Pirate Bay', infoHash: HASH_A, publishDate: '2020-01-01T00:00:00Z', categories: [{ id: 2040 }] },
  { title: 'Fight Club 1999 720p WEB-DL AAC MULTi', size: 2e9, seeders: 40, leechers: 3, indexer: 'Knaben', downloadUrl: 'PROWLARR/download/1', categories: [{ id: 2030 }] },
  { title: 'Fight.Club.1999.HDCAM', size: 1e9, seeders: 5, indexer: 'X', infoHash: 'c'.repeat(40), categories: [{ id: 2000 }] },
  { title: 'Some Other Movie 2004 1080p', size: 3e9, seeders: 90, indexer: 'X', infoHash: 'd'.repeat(40), categories: [{ id: 2000 }] }
];
const cometStreams = [
  { infoHash: HASH_A, description: '👤 300', behaviorHints: { filename: 'Fight.Club.1999.1080p.BluRay.x264.DTS-HD.MA.5.1-GRP.mkv' } },
  { infoHash: HASH_B, description: '👤 77', behaviorHints: { filename: 'Fight.Club.1999.2160p.UHD.BluRay.HEVC.HDR.DV.Atmos.mkv' } }
];
// A minimal .torrent: d4:infod4:name1:x6:lengthi1eee
const TORRENT = Buffer.from('d8:announce3:url4:infod6:lengthi1e4:name1:xee');

let upstream;
let site;
let base;
const seen = [];

before(async () => {
  upstream = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    seen.push(url.pathname + url.search);
    const send = (body, status = 200, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
    const p = url.pathname;
    // TMDB
    if (/^\/tmdb\/trending\/movie\//.test(p) || p === '/tmdb/movie/now_playing' || p === '/tmdb/movie/top_rated' || p === '/tmdb/movie/upcoming' || p === '/tmdb/movie/popular' || p === '/tmdb/discover/movie') return send(list([movieItem]));
    if (/^\/tmdb\/trending\/tv\//.test(p) || p === '/tmdb/tv/popular' || p === '/tmdb/tv/airing_today' || p === '/tmdb/tv/on_the_air' || p === '/tmdb/tv/top_rated' || p === '/tmdb/discover/tv') return send(list([tvItem]));
    if (p === '/tmdb/search/multi') return send(list([{ ...movieItem, media_type: 'movie' }, { ...tvItem, media_type: 'tv' }, { id: 9, media_type: 'person', name: 'Someone' }]));
    if (/^\/tmdb\/genre\/(movie|tv)\/list$/.test(p)) return send({ genres: [{ id: 18, name: 'Drama' }, { id: 35, name: 'Comedy' }] });
    if (p === '/tmdb/movie/550') return send(movieDetails);
    if (p === '/tmdb/tv/1396') return send(tvDetails);
    if (p === '/tmdb/tv/1396/season/1') return send(season1);
    if (/watch\/providers$/.test(p)) return send({ results: { US: { link: 'https://www.themoviedb.org/movie/550/watch', flatrate: [{ provider_name: 'Prime', logo_path: '/pr.jpg' }], rent: [{ provider_name: 'Apple TV', logo_path: '/a.jpg' }] } } });
    if (p === '/tmdb/collection/10') return send({ id: 10, name: 'Star Saga', overview: 'Space.', parts: [movieItem] });
    if (p.startsWith('/tmdb/')) return send({ status_message: 'nope' }, 404);
    // Prowlarr
    if (p === '/prowlarr/api/v1/indexer') return send({ message: 'no' }, 500);
    if (p === '/prowlarr/api/v1/search') return send(prowlarrReleases);
    if (p === '/prowlarr/download/1') return send(TORRENT, 200, 'application/x-bittorrent');
    // Comet
    if (/^\/comet\/stream\/movie\//.test(p)) return send({ streams: cometStreams });
    if (/^\/comet\/stream\/series\//.test(p)) return send({ streams: [] });
    send('not found', 404, 'text/plain');
  });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  const up = `http://127.0.0.1:${upstream.address().port}`;
  prowlarrReleases[1].downloadUrl = `${up}/prowlarr/download/1`;
  Object.assign(process.env, {
    TMDB_BASE_URL: `${up}/tmdb`, TMDB_API_KEY: '', PROWLARR_URL: `${up}/prowlarr`, PROWLARR_API_KEY: 'k', COMET_URL: `${up}/comet`,
    PLAYER_URL: 'https://player.example', SITE_URL: 'https://torrentflxi.example', SUBTITLES_ENABLED: 'false', PROWLARR_SETTLE_MS: '1000',
    CONTACT_EMAIL: 'dmca@torrentflxi.example', ADS_ENABLED: 'false'
  });
  site = (await import('../server.js')).server;
  await new Promise(r => site.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${site.address().port}`;
});
after(() => { site?.close(); upstream?.close(); });

const get = (p, init) => fetch(base + p, { redirect: 'manual', ...init });
const page = async p => {
  const res = await get(p);
  return { status: res.status, headers: res.headers, body: await res.text() };
};

test('home page: hero, rows, header, footer, no raw HTML from TMDB', async () => {
  const r = await page('/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(r.body, /<title>TorrentFlxi: /);
  assert.match(r.body, /Fight Club/);
  assert.match(r.body, /Breaking Bad/);
  assert.match(r.body, /href="\/movies\/fight-club-1999-550"/);
  assert.match(r.body, /href="\/tv\/breaking-bad-2008-1396"/);
  assert.ok(!r.body.includes('<b>and</b>'), 'TMDB text is escaped');
  assert.match(r.body, /&lt;b&gt;and&lt;\/b&gt;/);
  assert.match(r.body, /This product uses the TMDB API/);
});

test('movie page: details, player on demand, torrents and subtitles hooks, providers, JSON-LD, canonical', async () => {
  const r = await page('/movies/fight-club-1999-550');
  assert.equal(r.status, 200);
  assert.match(r.body, /<h1>Fight Club <span class="muted">\(1999\)<\/span><\/h1>/);
  assert.match(r.body, /data-embed="https:\/\/player.example\/embed\/movie\/550\?autoplay=true"/);
  assert.ok(!r.body.includes('<iframe'), 'the player iframe is only created when the viewer presses play');
  assert.match(r.body, /data-api="\/api\/torrents\/movie\/550"/);
  assert.match(r.body, /data-api="\/api\/subtitles\/movie\/550"/);
  assert.match(r.body, /David Fincher/);
  assert.match(r.body, /Edward Norton/);
  assert.match(r.body, /data-trailer="abc123"/);
  assert.match(r.body, /imdb.com\/title\/tt0137523/);
  assert.match(r.body, /alt="Prime"/);
  assert.match(r.body, /Streaming data by JustWatch/);
  assert.match(r.body, /"@type":"Movie"/);
  assert.match(r.body, /<link rel="canonical" href="https:\/\/torrentflxi.example\/movies\/fight-club-1999-550">/);
  assert.match(r.body, /class="cert">R</);
});

test('wrong slug redirects to the canonical movie URL', async () => {
  const res = await get('/movies/whatever-550');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), '/movies/fight-club-1999-550');
});

test('torrents API: Prowlarr + Comet merged by hash, details parsed, wrong titles dropped, sorted by score', async () => {
  const res = await get('/api/torrents/movie/550');
  assert.equal(res.status, 200);
  const { items } = await res.json();
  const titles = items.map(i => i.title);
  assert.ok(!titles.some(t => t.startsWith('Some Other Movie')), 'another title is not listed');
  const a = items.find(i => i.infoHash === HASH_A);
  assert.ok(a, 'Prowlarr/Comet release listed');
  assert.equal(items.filter(i => i.infoHash === HASH_A).length, 1, 'merged by info hash');
  assert.equal(a.seeders, 300, 'the higher seeder count wins');
  assert.equal(a.quality, '1080p');
  assert.equal(a.source, 'BluRay');
  assert.equal(a.codec, 'H.264');
  assert.ok(a.audio.includes('DTS-HD'));
  assert.equal(a.channels, '5.1');
  assert.match(a.magnet, /^magnet:\?xt=urn:btih:a{40}/);
  const uhd = items.find(i => i.infoHash === HASH_B);
  assert.equal(uhd.quality, '2160p');
  assert.equal(uhd.hdr, true);
  assert.equal(uhd.dolbyVision, true);
  assert.ok(uhd.audio.includes('Atmos'));
  const web = items.find(i => /720p WEB-DL/.test(i.title));
  assert.equal(web.magnet, null, 'no hash yet');
  assert.equal(web.torrentFile, true);
  assert.deepEqual(web.languages, ['multi']);
  const cam = items.find(i => /HDCAM/.test(i.title));
  if (cam) assert.equal(cam.cam, true);
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].score >= items[i].score, 'sorted by score');
  assert.ok(!JSON.stringify(items).includes('/prowlarr/'), 'Prowlarr links and API keys are never sent to browsers');
});

test('magnet and .torrent for a release without an info hash are resolved on the server', async () => {
  const { items } = await (await get('/api/torrents/movie/550')).json();
  const web = items.find(i => /720p WEB-DL/.test(i.title));
  const magnet = await (await get(`/api/magnet/${web.ref}`)).json();
  assert.match(magnet.magnet, /^magnet:\?xt=urn:btih:[0-9a-f]{40}/);
  const file = await get(`/api/torrent/${web.ref}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/x-bittorrent');
  assert.match(file.headers.get('content-disposition'), /attachment; filename=".*\.torrent"/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), TORRENT);
  assert.ok(seen.some(s => s.startsWith('/prowlarr/download/1')));
  assert.equal((await get('/api/magnet/nosuchref')).status, 404);
});

test('TV show page: seasons, episodes, player for the first episode', async () => {
  const r = await page('/tv/breaking-bad-2008-1396');
  assert.equal(r.status, 200);
  assert.match(r.body, /Vince Gilligan/);
  assert.match(r.body, /Pilot/);
  assert.match(r.body, /href="\/tv\/breaking-bad-2008-1396\/season\/1\/episode\/2"/);
  assert.match(r.body, /data-embed="https:\/\/player.example\/embed\/tv\/1396\/1\/1\?autoplay=true"/);
  assert.match(r.body, /Specials/);
});

test('episode page: player for that episode, episode torrents API, prev/next', async () => {
  const r = await page('/tv/breaking-bad-2008-1396/season/1/episode/2');
  assert.equal(r.status, 200);
  assert.match(r.body, /Breaking Bad S01E02/);
  assert.match(r.body, /data-embed="https:\/\/player.example\/embed\/tv\/1396\/1\/2\?autoplay=true"/);
  assert.match(r.body, /data-api="\/api\/torrents\/tv\/1396\/1\/2"/);
  assert.match(r.body, /href="\/tv\/breaking-bad-2008-1396\/season\/1\/episode\/1"/);
  assert.equal((await page('/tv/breaking-bad-2008-1396/season/1/episode/9')).status, 404);
  const tvTorrents = await (await get('/api/torrents/tv/1396/1/2')).json();
  assert.ok(Array.isArray(tvTorrents.items));
});

test('listing pages: movies with filters, tv, top tabs, upcoming, calendar, genres, genre, collection, search, my list', async () => {
  const movies = await page('/movies?genre=18&year=1999&sort=vote_average.desc');
  assert.equal(movies.status, 200);
  assert.match(movies.body, /<option value="18" selected>Drama/);
  assert.match(movies.body, /rel="next"/);
  assert.ok(seen.some(s => s.startsWith('/tmdb/discover/movie') && s.includes('with_genres=18') && s.includes('primary_release_year=1999') && s.includes('vote_count.gte=300')));
  for (const p of ['/tv', '/top', '/top?type=tv', '/upcoming', '/upcoming?tab=now', '/calendar', '/genres', '/genre/movie/18-drama', '/collection/star-saga-10', '/my-list', '/about', '/legal', '/dmca', '/terms', '/privacy']) {
    const res = await page(p);
    assert.equal(res.status, 200, p);
  }
  const s = await page('/search?q=fight');
  assert.match(s.body, /Fight Club/);
  assert.ok(!s.body.includes('Someone'), 'people are not shown as titles');
  assert.equal((await page('/genre/movie/999-nope')).status, 404);
  assert.match((await page('/dmca')).body, /dmca@torrentflxi.example/);
});

test('language: ?lang= sets a cookie and redirects; pages and TMDB requests follow it', async () => {
  const res = await get('/movies?lang=es&page=2');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/movies?page=2');
  assert.match(res.headers.get('set-cookie'), /lang=es/);
  const es = await (await get('/', { headers: { cookie: 'lang=es' } })).text();
  assert.match(es, /<html lang="es">/);
  assert.match(es, /Películas/);
  assert.ok(seen.some(s => s.includes('language=es-ES')));
});

test('robots, sitemap, health, 404s and API errors', async () => {
  assert.match((await page('/robots.txt')).body, /Disallow: \/api\//);
  assert.match((await page('/sitemap.xml')).body, /<loc>https:\/\/torrentflxi.example\/movies\/fight-club-1999-550<\/loc>/);
  assert.equal((await page('/healthz')).body, 'ok');
  assert.equal((await page('/nope')).status, 404);
  assert.equal((await page('/movies/nothing-999999')).status, 404);
  assert.equal((await get('/api/nope')).status, 404);
  assert.equal((await get('/', { method: 'POST' })).status, 405);
  const css = await get('/static/site.css?v=1');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('cache-control'), /immutable/);
  assert.equal((await get('/static/..%2fserver.js')).status, 404);
});
