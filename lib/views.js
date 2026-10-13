// HTML pages. Everything from TMDB or the request goes through h() before it reaches the page.
import { h, formatRuntime } from './util.js';
import { LANGS, clientStrings } from './i18n.js';
import { episodeUrl } from './tmdb.js';

const asset = (name, version) => `/static/${name}?v=${version}`;

export function layout(ctx, { title, description = '', body, image = null, canonical = null, jsonLd = null, noindex = false }) {
  const { t, lang, site, path, ads } = ctx;
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name}: ${t('tagline')}`;
  const url = canonical ? `${site.url}${canonical}` : null;
  const langLinks = Object.entries(LANGS).map(([code, info]) =>
    `<option value="${code}"${code === lang ? ' selected' : ''}>${h(info.name)}</option>`).join('');
  return `<!doctype html>
<html lang="${h(lang)}">
<head>
<meta charset="utf-8">
${ads || ''}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0b0d12">
<title>${h(fullTitle)}</title>
<meta name="description" content="${h(description || t('tagline'))}">
${url ? `<link rel="canonical" href="${h(url)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${h(site.name)}">
<meta property="og:title" content="${h(fullTitle)}">
<meta property="og:description" content="${h(description || t('tagline'))}">
${image ? `<meta property="og:image" content="${h(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
${url ? `<meta property="og:url" content="${h(url)}">` : ''}
<link rel="icon" href="${asset('favicon.svg', site.version)}" type="image/svg+xml">
<link rel="preconnect" href="https://image.tmdb.org">
<link rel="stylesheet" href="${asset('site.css', site.version)}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="logo" href="/" aria-label="${h(site.name)} home"><span class="logo-mark" aria-hidden="true">▶</span><span>Torrent<b>Flxi</b></span></a>
    <nav class="nav" aria-label="Main">
      <a href="/movies"${path.startsWith('/movies') ? ' aria-current="page"' : ''}>${h(t('movies'))}</a>
      <a href="/tv"${path.startsWith('/tv') ? ' aria-current="page"' : ''}>${h(t('tv'))}</a>
      <a href="/top"${path.startsWith('/top') ? ' aria-current="page"' : ''}>${h(t('top'))}</a>
      <a href="/genres"${path.startsWith('/genre') ? ' aria-current="page"' : ''}>${h(t('genres'))}</a>
      <a href="/upcoming"${path.startsWith('/upcoming') ? ' aria-current="page"' : ''}>${h(t('upcoming'))}</a>
      <a href="/calendar"${path.startsWith('/calendar') ? ' aria-current="page"' : ''}>${h(t('calendar'))}</a>
      <a href="/my-list"${path.startsWith('/my-list') ? ' aria-current="page"' : ''}>${h(t('myList'))}</a>
    </nav>
    <form class="search" action="/search" role="search">
      <input type="search" name="q" placeholder="${h(t('search'))}" aria-label="${h(t('search'))}" value="${h(ctx.query?.q || '')}" maxlength="120">
    </form>
    <form class="lang" method="get" action="${h(path)}">
      <label class="sr" for="lang-select">Language</label>
      <select id="lang-select" name="lang" onchange="this.form.submit()">${langLinks}</select>
    </form>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  <div class="wrap footer-grid">
    <div>
      <a class="logo" href="/"><span class="logo-mark" aria-hidden="true">▶</span><span>Torrent<b>Flxi</b></span></a>
      <p class="muted">${h(t('freeForever'))}</p>
      <p class="muted small">${h(t('tmdbNotice'))}</p>
    </div>
    <div><h2>${h(t('discover'))}</h2><a href="/movies">${h(t('movies'))}</a><a href="/tv">${h(t('tv'))}</a><a href="/top">${h(t('top'))}</a><a href="/upcoming">${h(t('upcoming'))}</a><a href="/calendar">${h(t('calendar'))}</a><a href="/genres">${h(t('genres'))}</a></div>
    <div><h2>${h(t('site'))}</h2><a href="/about">${h(t('about'))}</a><a href="/my-list">${h(t('myList'))}</a><a href="/legal">${h(t('legal'))}</a><a href="/dmca">${h(t('dmca'))}</a><a href="/terms">${h(t('terms'))}</a><a href="/privacy">${h(t('privacy'))}</a></div>
  </div>
  <div class="wrap small muted legal-line">${h(t('legalNote'))}</div>
</footer>
<script>window.TFX=${JSON.stringify({ t: clientStrings(lang), player: site.playerUrl }).replace(/</g, '\\u003c')};</script>
<script src="${asset('app.js', site.version)}" defer></script>
</body>
</html>`;
}

const stars = rating => (rating > 0 ? `<span class="rating" title="TMDB">★ ${rating.toFixed(1)}</span>` : '');

export function posterCard(item, t) {
  const label = item.type === 'movie' ? t('moviesLabel') : t('tvLabel');
  return `<a class="card" href="${h(item.url)}">
  <div class="poster">${item.poster ? `<img src="${h(item.poster)}" alt="" loading="lazy" decoding="async">` : `<span class="noposter">${h(item.title)}</span>`}
  ${item.rating > 0 ? `<span class="badge">★ ${item.rating.toFixed(1)}</span>` : ''}</div>
  <span class="card-title">${h(item.title)}</span>
  <span class="card-meta">${item.year ? h(item.year) : ''}${item.year ? ' · ' : ''}${h(label)}</span>
</a>`;
}

export const grid = (items, t) => (items.length
  ? `<div class="grid">${items.map(item => posterCard(item, t)).join('')}</div>`
  : `<p class="empty">${h(t('noResults'))}</p>`);

export function row(title, items, t, moreUrl = null) {
  if (!items?.length) return '';
  return `<section class="row">
  <div class="row-head"><h2>${h(title)}</h2>${moreUrl ? `<a href="${h(moreUrl)}">${h(t('seeAll'))} →</a>` : ''}</div>
  <div class="scroller">${items.map(item => posterCard(item, t)).join('')}</div>
</section>`;
}

export function pager(t, { page, totalPages, baseUrl, query = {} }) {
  if (totalPages <= 1) return '';
  const link = p => {
    const params = new URLSearchParams({ ...query, page: String(p) });
    return `${baseUrl}?${params}`;
  };
  return `<nav class="pager" aria-label="${h(t('page'))}">
  ${page > 1 ? `<a href="${h(link(page - 1))}" rel="prev">← ${h(t('previous'))}</a>` : '<span></span>'}
  <span class="muted">${h(t('page'))} ${page} / ${totalPages}</span>
  ${page < totalPages ? `<a href="${h(link(page + 1))}" rel="next">${h(t('next'))} →</a>` : '<span></span>'}
</nav>`;
}

export function homePage(ctx, data) {
  const { t } = ctx;
  const hero = data.hero;
  const heroHtml = hero ? `<section class="hero" style="--bg-img:url('${h(hero.backdrop || '')}')">
  <div class="wrap hero-inner">
    <p class="eyebrow">${h(t('trendingMovies'))}</p>
    <h1>${h(hero.title)}</h1>
    <p class="hero-meta">${hero.year ? h(hero.year) : ''} ${stars(hero.rating)}</p>
    <p class="hero-overview">${h(hero.overview.slice(0, 260))}${hero.overview.length > 260 ? '…' : ''}</p>
    <div class="actions"><a class="btn primary" href="${h(hero.url)}">▶ ${h(t('watchNow'))}</a></div>
  </div>
</section>` : '';
  return layout(ctx, {
    title: '',
    description: t('tagline'),
    canonical: '/',
    image: hero?.backdrop,
    body: `${heroHtml}
<div class="wrap">
  <form class="big-search" action="/search" role="search"><input type="search" name="q" placeholder="${h(t('search'))}" aria-label="${h(t('search'))}" maxlength="120"><button class="btn primary" type="submit">⌕</button></form>
  ${row(t('trendingMovies'), data.trendingMovies, t, '/movies?sort=popularity.desc')}
  ${row(t('trendingTv'), data.trendingTv, t, '/tv?sort=popularity.desc')}
  ${row(t('nowPlaying'), data.nowPlaying, t, '/upcoming')}
  ${row(t('popularTv'), data.popularTv, t, '/tv')}
  ${row(t('top'), data.topMovies, t, '/top')}
  ${row(t('airingToday'), data.airingToday, t, '/calendar')}
</div>`
  });
}

export function discoverPage(ctx, { type, genres, filters, list }) {
  const { t } = ctx;
  const heading = type === 'movie' ? t('movies') : t('tv');
  const year = new Date().getUTCFullYear();
  const years = Array.from({ length: 80 }, (_, i) => year + 1 - i);
  const sorts = [['popularity.desc', t('sortPopular')], ['vote_average.desc', t('sortRating')], [type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc', t('sortNewest')], ['vote_count.desc', t('sortVotes')]];
  const base = type === 'movie' ? '/movies' : '/tv';
  const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return layout(ctx, {
    title: heading,
    description: `${heading} — ${t('tagline')}`,
    canonical: base,
    body: `<div class="wrap page">
  <h1>${h(heading)}</h1>
  <form class="filters" method="get" action="${base}">
    <label>${h(t('genre'))}<select name="genre"><option value="">${h(t('any'))}</option>${genres.map(g => `<option value="${g.id}"${String(g.id) === String(filters.genre) ? ' selected' : ''}>${h(g.name)}</option>`).join('')}</select></label>
    <label>${h(t('year'))}<select name="year"><option value="">${h(t('any'))}</option>${years.map(y => `<option${String(y) === String(filters.year) ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <label>${h(t('sort'))}<select name="sort">${sorts.map(([v, l]) => `<option value="${v}"${v === filters.sort ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
    <button class="btn" type="submit">${h(t('filter'))}</button>
  </form>
  ${grid(list.results, t)}
  ${pager(t, { page: list.page, totalPages: list.totalPages, baseUrl: base, query })}
</div>`
  });
}

export function listPage(ctx, { heading, description = '', list, baseUrl, query = {}, intro = '', tabs = '' }) {
  const { t } = ctx;
  return layout(ctx, {
    title: heading,
    description: description || heading,
    canonical: baseUrl,
    body: `<div class="wrap page"><h1>${h(heading)}</h1>${intro}${tabs}${grid(list.results, t)}${pager(t, { page: list.page, totalPages: list.totalPages, baseUrl, query })}</div>`
  });
}

export const tabs = (items, active) => `<div class="tabs">${items.map(([href, label, key]) =>
  `<a href="${h(href)}"${key === active ? ' aria-current="page"' : ''}>${h(label)}</a>`).join('')}</div>`;

export function genresPage(ctx, { movie, tv }) {
  const { t } = ctx;
  const list = (items, type) => `<div class="chips">${items.map(g =>
    `<a class="chip" href="/genre/${type}/${g.id}-${encodeURIComponent(g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${h(g.name)}</a>`).join('')}</div>`;
  return layout(ctx, {
    title: t('genres'),
    canonical: '/genres',
    body: `<div class="wrap page"><h1>${h(t('genres'))}</h1><h2>${h(t('movies'))}</h2>${list(movie, 'movie')}<h2>${h(t('tv'))}</h2>${list(tv, 'tv')}</div>`
  });
}

function providersBlock(t, providers) {
  if (!providers) return '';
  const group = (label, items) => (items.length ? `<div class="prov-group"><span class="prov-label">${h(label)}</span>${items.map(p =>
    `<span class="prov" title="${h(p.name)}">${p.logo ? `<img src="${h(p.logo)}" alt="${h(p.name)}" loading="lazy">` : h(p.name)}</span>`).join('')}</div>` : '');
  const body = group(t('stream'), providers.stream) + group(t('free'), providers.free) + group(t('rent'), providers.rent) + group(t('buy'), providers.buy);
  if (!body) return '';
  return `<section class="box"><h2>${h(t('whereToWatch'))}</h2>${body}<p class="small muted">${providers.link ? `<a href="${h(providers.link)}" rel="noopener nofollow" target="_blank">${h(t('poweredByJustWatch'))}</a>` : h(t('poweredByJustWatch'))}</p></section>`;
}

function factsBlock(t, d) {
  const facts = [
    [t('released'), d.date],
    [t('runtime'), formatRuntime(d.runtime)],
    [t('status'), d.status],
    [t('director'), d.directors.join(', ')],
    [t('creators'), d.creators.join(', ')],
    [t('writers'), d.writers.join(', ')],
    [t('network'), d.networks.join(', ')],
    [t('studio'), d.studios.join(', ')],
    [t('country'), d.countries.join(', ')],
    [t('language'), d.spokenLanguages.join(', ')],
    [t('seasons'), d.type === 'tv' ? `${d.numberOfSeasons} · ${d.numberOfEpisodes} ${t('episodes').toLowerCase()}` : '']
  ].filter(([, v]) => v);
  return `<dl class="facts">${facts.map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join('')}</dl>`;
}

function playerBlock(t, embedUrl, backdrop, label) {
  return `<section class="player" data-embed="${h(embedUrl)}" style="--bg-img:url('${h(backdrop || '')}')">
  <button class="play-big" type="button" aria-label="${h(t('play'))} ${h(label)}"><span aria-hidden="true">▶</span></button>
  <p class="player-note">${h(t('watchNow'))}</p>
</section>`;
}

function torrentsBlock(t, apiUrl) {
  return `<section class="box" id="torrents" data-api="${h(apiUrl)}">
  <h2>${h(t('torrents'))} <span class="count muted"></span></h2>
  <form class="tfilters" onsubmit="return false">
    <div class="seg" role="group" aria-label="${h(t('quality'))}" data-filter="quality">
      <button type="button" data-value="" aria-pressed="true">${h(t('all'))}</button><button type="button" data-value="2160p" aria-pressed="false">4K</button><button type="button" data-value="1080p" aria-pressed="false">1080p</button><button type="button" data-value="720p" aria-pressed="false">720p</button><button type="button" data-value="480p" aria-pressed="false">SD</button>
    </div>
    <label>${h(t('keyword'))}<input type="search" data-filter="text" maxlength="60"></label>
    <label>${h(t('source'))}<select data-filter="source"><option value="">${h(t('all'))}</option><option>REMUX</option><option>BluRay</option><option>WEB-DL</option><option>WEBRip</option><option>WEB</option><option>HDTV</option><option>HDRip</option><option>DVD</option><option>CAM</option></select></label>
    <label>${h(t('codec'))}<select data-filter="codec"><option value="">${h(t('all'))}</option><option>H.264</option><option>HEVC</option><option>AV1</option><option>XviD</option></select></label>
    <label>${h(t('audio'))}<select data-filter="audio"><option value="">${h(t('all'))}</option><option>Atmos</option><option>TrueHD</option><option>DTS-HD</option><option>DTS</option><option>DD+</option><option>DD</option><option>AAC</option><option>Opus</option><option>FLAC</option></select></label>
    <label>${h(t('audioLanguage'))}<select data-filter="lang"><option value="">${h(t('all'))}</option><option value="en">English</option><option value="multi">Multi / Dual</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="pt">Português</option><option value="ru">Русский</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option><option value="ml">മലയാളം</option><option value="ko">한국어</option><option value="ja">日本語</option><option value="zh">中文</option><option value="ar">العربية</option><option value="tr">Türkçe</option><option value="pl">Polski</option></select></label>
    <label>${h(t('minSeeders'))}<input type="number" min="0" step="1" data-filter="minSeeders" inputmode="numeric"></label>
    <label>${h(t('maxSize'))}<input type="number" min="0" step="0.5" data-filter="maxSize" inputmode="decimal"></label>
    <label>${h(t('sortBy'))}<select data-filter="sort"><option value="score">${h(t('score'))}</option><option value="seeders">${h(t('seeders'))}</option><option value="size-desc">${h(t('size'))} ↓</option><option value="size-asc">${h(t('size'))} ↑</option><option value="newest">${h(t('published'))}</option></select></label>
    <label class="check"><input type="checkbox" data-filter="hdr"> ${h(t('hdr'))}</label>
    <label class="check"><input type="checkbox" data-filter="subs"> ${h(t('subtitles'))}</label>
    <label class="check"><input type="checkbox" data-filter="hideCam" checked> ${h(t('hideCam'))}</label>
  </form>
  <div class="tlist" aria-live="polite"><p class="muted">${h(t('loadingTorrents'))}</p></div>
  <noscript><p class="muted">JavaScript is needed to list torrents.</p></noscript>
</section>`;
}

const subtitlesBlock = (t, apiUrl) => `<section class="box" id="subtitles" data-api="${h(apiUrl)}"><h2>${h(t('subtitlesAvailable'))}</h2><div class="sublist"><p class="muted">…</p></div></section>`;

function headerBlock(t, d, extra = '') {
  return `<section class="title-head" style="--bg-img:url('${h(d.backdrop || '')}')">
  <div class="wrap title-grid">
    <div class="title-poster">${d.poster ? `<img src="${h(d.poster)}" alt="${h(d.title)}" width="300" height="450">` : ''}</div>
    <div class="title-info">
      ${extra}
      <h1>${h(d.title)} ${d.year ? `<span class="muted">(${h(d.year)})</span>` : ''}</h1>
      ${d.tagline ? `<p class="tagline">${h(d.tagline)}</p>` : ''}
      <p class="meta-line">${stars(d.rating)} ${d.certification ? `<span class="cert">${h(d.certification)}</span>` : ''} ${d.runtime ? `<span>${h(formatRuntime(d.runtime))}</span>` : ''} ${d.genres.map(g => `<a class="chip small" href="/genre/${d.type}/${g.id}-${encodeURIComponent(g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${h(g.name)}</a>`).join(' ')}</p>
      <p class="overview">${h(d.overview)}</p>
      <div class="actions">
        <a class="btn primary" href="#watch">▶ ${h(t('watchNow'))}</a>
        <button class="btn" type="button" data-mylist='${h(JSON.stringify({ type: d.type, id: d.id, title: d.title, year: d.year, poster: d.posterSmall, url: d.url }))}'>＋ ${h(t('addToList'))}</button>
        ${d.trailer ? `<button class="btn" type="button" data-trailer="${h(d.trailer.key)}">${h(t('trailer'))}</button>` : ''}
        ${d.imdbId ? `<a class="btn ghost" href="https://www.imdb.com/title/${h(d.imdbId)}/" rel="noopener nofollow" target="_blank">IMDb</a>` : ''}
        <a class="btn ghost" href="https://www.themoviedb.org/${d.type}/${d.id}" rel="noopener nofollow" target="_blank">TMDB</a>
      </div>
      ${d.collection ? `<p class="small">${h(t('partOf'))} <a href="${h(d.collection.url)}">${h(d.collection.name)}</a></p>` : ''}
    </div>
  </div>
</section>`;
}

function castBlock(t, d) {
  if (!d.cast.length) return '';
  return `<section class="row"><div class="row-head"><h2>${h(t('cast'))}</h2></div><div class="scroller people">${d.cast.map(p =>
    `<div class="person">${p.photo ? `<img src="${h(p.photo)}" alt="" loading="lazy">` : '<span class="nophoto" aria-hidden="true">👤</span>'}<b>${h(p.name)}</b><span class="muted small">${h(p.character)}</span></div>`).join('')}</div></section>`;
}

function imagesBlock(t, d) {
  if (!d.images.length) return '';
  return `<section class="row"><div class="row-head"><h2>${h(t('images'))}</h2></div><div class="scroller shots">${d.images.map(i =>
    `<a href="${h(i.large)}" target="_blank" rel="noopener"><img src="${h(i.small)}" alt="" loading="lazy"></a>`).join('')}</div></section>`;
}

function movieJsonLd(site, d) {
  return {
    '@context': 'https://schema.org',
    '@type': d.type === 'movie' ? 'Movie' : 'TVSeries',
    name: d.title,
    description: d.overview,
    image: d.poster,
    datePublished: d.date,
    genre: d.genres.map(g => g.name),
    url: `${site.url}${d.url}`,
    ...(d.voteCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: d.rating.toFixed(1), ratingCount: d.voteCount, bestRating: 10 } } : {})
  };
}

export function moviePage(ctx, { d, providers }) {
  const { t, site } = ctx;
  return layout(ctx, {
    title: `${d.title}${d.year ? ` (${d.year})` : ''}`,
    description: d.overview.slice(0, 160),
    canonical: d.url,
    image: d.backdrop || d.poster,
    jsonLd: movieJsonLd(site, d),
    body: `${headerBlock(t, d, `<nav class="crumbs small"><a href="/">${h(t('home'))}</a> › <a href="/movies">${h(t('movies'))}</a>${d.genres[0] ? ` › <a href="/genre/movie/${d.genres[0].id}">${h(d.genres[0].name)}</a>` : ''}</nav>`)}
<div class="wrap columns">
  <div class="col-main">
    <div id="watch">${playerBlock(t, `${site.playerUrl}/embed/movie/${d.id}?autoplay=true`, d.backdrop, d.title)}</div>
    ${torrentsBlock(t, `/api/torrents/movie/${d.id}`)}
    ${subtitlesBlock(t, `/api/subtitles/movie/${d.id}`)}
    ${castBlock(t, d)}
    ${imagesBlock(t, d)}
  </div>
  <aside class="col-side">
    ${providersBlock(t, providers)}
    <section class="box"><h2>${h(t('details'))}</h2>${factsBlock(t, d)}${d.keywords.length ? `<div class="chips small-chips">${d.keywords.map(k => `<span class="chip small">${h(k)}</span>`).join('')}</div>` : ''}</section>
  </aside>
</div>
<div class="wrap">${row(t('related'), d.related, t)}</div>`
  });
}

function seasonsNav(t, d, current) {
  const seasons = d.seasons.filter(s => s.episodeCount > 0);
  return `<div class="tabs seasons">${seasons.map(s =>
    `<a href="${h(d.url)}?season=${s.seasonNumber}#episodes"${s.seasonNumber === current ? ' aria-current="page"' : ''}>${h(s.seasonNumber === 0 ? s.name : `${t('season')} ${s.seasonNumber}`)}</a>`).join('')}</div>`;
}

function episodeList(t, d, season) {
  if (!season) return '';
  const today = new Date().toISOString().slice(0, 10);
  return `<ol class="episodes">${season.episodes.map(ep => {
    const aired = !ep.airDate || ep.airDate <= today;
    return `<li class="episode${aired ? '' : ' future'}">
    <a href="${h(episodeUrl(d, ep.season, ep.episode))}">
      <span class="ep-still">${ep.still ? `<img src="${h(ep.still)}" alt="" loading="lazy">` : ''}<span class="ep-num">${ep.episode}</span></span>
      <span class="ep-body"><b>${h(ep.episode)}. ${h(ep.name)}</b><span class="muted small">${ep.airDate ? h(ep.airDate) : ''}${ep.runtime ? ` · ${h(formatRuntime(ep.runtime))}` : ''}${aired ? '' : ` · ${h(t('comingSoon'))}`}</span><span class="small ep-over">${h(ep.overview.slice(0, 180))}</span></span>
    </a></li>`;
  }).join('')}</ol>`;
}

export function showPage(ctx, { d, providers, season, seasonNumber }) {
  const { t, site } = ctx;
  const firstEp = season?.episodes?.[0];
  const next = d.nextAir ? `<p class="small">${h(t('nextEpisode'))}: S${d.nextAir.season}E${d.nextAir.episode} · ${h(d.nextAir.date || '')}</p>` : '';
  return layout(ctx, {
    title: `${d.title}${d.year ? ` (${d.year})` : ''}`,
    description: d.overview.slice(0, 160),
    canonical: d.url,
    image: d.backdrop || d.poster,
    jsonLd: movieJsonLd(site, d),
    body: `${headerBlock(t, d, `<nav class="crumbs small"><a href="/">${h(t('home'))}</a> › <a href="/tv">${h(t('tv'))}</a></nav>`)}
<div class="wrap columns">
  <div class="col-main">
    <div id="watch">${firstEp ? playerBlock(t, `${site.playerUrl}/embed/tv/${d.id}/${firstEp.season}/${firstEp.episode}?autoplay=true`, d.backdrop, `${d.title} S${firstEp.season}E${firstEp.episode}`) : ''}</div>
    <section class="box" id="episodes"><h2>${h(t('episodes'))}</h2>${next}${seasonsNav(t, d, seasonNumber)}${episodeList(t, d, season)}</section>
    ${castBlock(t, d)}
    ${imagesBlock(t, d)}
  </div>
  <aside class="col-side">
    ${providersBlock(t, providers)}
    <section class="box"><h2>${h(t('details'))}</h2>${factsBlock(t, d)}</section>
  </aside>
</div>
<div class="wrap">${row(t('related'), d.related, t)}</div>`
  });
}

export function episodePage(ctx, { d, season, ep, providers }) {
  const { t, site } = ctx;
  const index = season.episodes.findIndex(item => item.episode === ep.episode);
  const prev = season.episodes[index - 1];
  const nextEp = season.episodes[index + 1];
  const label = `${d.title} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`;
  return layout(ctx, {
    title: `${label} · ${ep.name}`,
    description: (ep.overview || d.overview).slice(0, 160),
    canonical: episodeUrl(d, ep.season, ep.episode),
    image: ep.still || d.backdrop,
    jsonLd: { '@context': 'https://schema.org', '@type': 'TVEpisode', name: ep.name, episodeNumber: ep.episode, partOfSeason: { '@type': 'TVSeason', seasonNumber: ep.season }, partOfSeries: { '@type': 'TVSeries', name: d.title, url: `${site.url}${d.url}` }, datePublished: ep.airDate || undefined },
    body: `<div class="wrap page">
  <nav class="crumbs small"><a href="/">${h(t('home'))}</a> › <a href="/tv">${h(t('tv'))}</a> › <a href="${h(d.url)}">${h(d.title)}</a> › <a href="${h(d.url)}?season=${ep.season}#episodes">${h(t('season'))} ${ep.season}</a></nav>
  <h1>${h(label)} <span class="muted">· ${h(ep.name)}</span></h1>
  <p class="meta-line">${stars(ep.rating)} ${ep.airDate ? `<span>${h(t('airDate'))}: ${h(ep.airDate)}</span>` : ''} ${ep.runtime ? `<span>${h(formatRuntime(ep.runtime))}</span>` : ''}</p>
  <div class="ep-nav">${prev ? `<a class="btn" href="${h(episodeUrl(d, prev.season, prev.episode))}">← ${h(t('episode'))} ${prev.episode}</a>` : '<span></span>'}
    <button class="btn" type="button" data-mylist='${h(JSON.stringify({ type: 'tv', id: d.id, title: d.title, year: d.year, poster: d.posterSmall, url: d.url }))}'>＋ ${h(t('addToList'))}</button>
    ${nextEp ? `<a class="btn" href="${h(episodeUrl(d, nextEp.season, nextEp.episode))}">${h(t('episode'))} ${nextEp.episode} →</a>` : '<span></span>'}</div>
</div>
<div class="wrap columns">
  <div class="col-main">
    <div id="watch">${playerBlock(t, `${site.playerUrl}/embed/tv/${d.id}/${ep.season}/${ep.episode}?autoplay=true`, ep.still || d.backdrop, label)}</div>
    ${ep.overview ? `<section class="box"><h2>${h(t('overview'))}</h2><p>${h(ep.overview)}</p></section>` : ''}
    ${torrentsBlock(t, `/api/torrents/tv/${d.id}/${ep.season}/${ep.episode}`)}
    ${subtitlesBlock(t, `/api/subtitles/tv/${d.id}/${ep.season}/${ep.episode}`)}
    <section class="box"><h2>${h(t('episodes'))}</h2>${seasonsNav(t, d, ep.season)}${episodeList(t, d, season)}</section>
  </div>
  <aside class="col-side">
    ${providersBlock(t, providers)}
    <section class="box"><a href="${h(d.url)}">${d.posterSmall ? `<img class="side-poster" src="${h(d.posterSmall)}" alt="${h(d.title)}" loading="lazy">` : ''}<b>${h(d.title)}</b></a>${factsBlock(t, d)}</section>
  </aside>
</div>`
  });
}

export function collectionPage(ctx, c) {
  const { t } = ctx;
  return layout(ctx, {
    title: c.name,
    description: c.overview.slice(0, 160),
    canonical: `/collection/${c.id}`,
    image: c.backdrop,
    body: `<section class="title-head" style="--bg-img:url('${h(c.backdrop || '')}')"><div class="wrap title-grid"><div class="title-poster">${c.poster ? `<img src="${h(c.poster)}" alt="">` : ''}</div><div class="title-info"><p class="eyebrow">${h(t('collection'))}</p><h1>${h(c.name)}</h1><p class="overview">${h(c.overview)}</p></div></div></section>
<div class="wrap page">${grid(c.parts, t)}</div>`
  });
}

export function calendarPage(ctx, { today, week }) {
  const { t } = ctx;
  return layout(ctx, {
    title: t('calendar'),
    canonical: '/calendar',
    body: `<div class="wrap page"><h1>${h(t('calendar'))}</h1>${row(t('airingToday'), today.results, t)}${row(t('onTheAir'), week.results, t)}</div>`
  });
}

export function searchPage(ctx, { q, list }) {
  const { t } = ctx;
  return layout(ctx, {
    title: q ? `${t('searchResults')} “${q}”` : t('search'),
    noindex: true,
    body: `<div class="wrap page"><h1>${q ? `${h(t('searchResults'))} “${h(q)}”` : h(t('search'))}</h1>
  <form class="big-search" action="/search" role="search"><input type="search" name="q" value="${h(q)}" placeholder="${h(t('search'))}" aria-label="${h(t('search'))}" maxlength="120"><button class="btn primary" type="submit">⌕</button></form>
  ${q ? grid(list.results, t) : ''}${q ? pager(t, { page: list.page, totalPages: list.totalPages, baseUrl: '/search', query: { q } }) : ''}</div>`
  });
}

export function myListPage(ctx) {
  const { t } = ctx;
  return layout(ctx, {
    title: t('myList'),
    noindex: true,
    body: `<div class="wrap page"><h1>${h(t('myList'))}</h1><div id="mylist" class="grid"></div><p class="empty" id="mylist-empty" hidden>${h(t('emptyList'))}</p></div>`
  });
}

export function textPage(ctx, { title, html, canonical }) {
  return layout(ctx, { title, canonical, body: `<div class="wrap page prose"><h1>${h(title)}</h1>${html}</div>` });
}

export function errorPage(ctx, status, message) {
  const { t } = ctx;
  return layout(ctx, {
    title: String(status),
    noindex: true,
    body: `<div class="wrap page center"><h1>${status}</h1><p>${h(message)}</p><p><a class="btn primary" href="/">${h(t('home'))}</a></p></div>`
  });
}
