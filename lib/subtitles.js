// Subtitles: files shipped inside the torrent (perfectly in sync with the release) plus online
// providers looked up by TMDB/IMDb id. Everything is served to the browser as WebVTT from our own
// domain, so <track> works without CORS and viewers never see where it came from.

const PROVIDERS = [
  {
    name: 'vdrk-v1',
    base: 'https://sub.vdrk.site/v1',
    path: m => (m.mediaType === 'movie' ? `/movie/${m.tmdbId}` : `/tv/${m.tmdbId}/${m.season}/${m.episode}`)
  },
  {
    name: 'vdrk-v2',
    base: 'https://sub.vdrk.site/v2',
    path: m => (m.mediaType === 'movie' ? `/movie/${m.tmdbId}` : `/tv/${m.tmdbId}/${m.season}/${m.episode}`)
  },
  {
    name: 'opensubtitles',
    base: 'https://opensubtitles-v3.strem.io',
    path: m => {
      if (!m.imdbId) return null;
      return m.mediaType === 'movie'
        ? `/subtitles/movie/${m.imdbId}.json`
        : `/subtitles/series/${m.imdbId}:${m.season}:${m.episode}.json`;
    }
  }
];

const LANG3 = {
  eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', por: 'pt', pob: 'pt',
  rus: 'ru', ara: 'ar', tur: 'tr', dut: 'nl', nld: 'nl', pol: 'pl', swe: 'sv', nor: 'no', dan: 'da',
  fin: 'fi', gre: 'el', ell: 'el', heb: 'he', hin: 'hi', ind: 'id', may: 'ms', msa: 'ms', tha: 'th',
  vie: 'vi', chi: 'zh', zho: 'zh', jpn: 'ja', kor: 'ko', ukr: 'uk', rum: 'ro', ron: 'ro', hun: 'hu',
  cze: 'cs', ces: 'cs', bul: 'bg', hrv: 'hr', srp: 'sr', per: 'fa', fas: 'fa', ben: 'bn', tam: 'ta',
  tel: 'te', urd: 'ur', fil: 'tl', tgl: 'tl', slv: 'sl', slo: 'sk', slk: 'sk', est: 'et', lav: 'lv',
  lit: 'lt', cat: 'ca', baq: 'eu', eus: 'eu', glg: 'gl', mal: 'ml', kan: 'kn', mar: 'mr', swa: 'sw'
};

const displayNames = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }); } catch { return null; }
})();
const NAME_TO_CODE = new Map();
for (const code of new Set(Object.values(LANG3))) {
  const name = displayNames?.of(code);
  if (name) NAME_TO_CODE.set(name.toLowerCase(), code);
}
NAME_TO_CODE.set('brazilian', 'pt');
NAME_TO_CODE.set('portuguese (brazil)', 'pt');
NAME_TO_CODE.set('farsi', 'fa');

export function languageCode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'und';
  if (/^[a-z]{2}$/.test(raw)) return raw;
  if (/^[a-z]{2}[-_][a-z]{2,4}$/.test(raw)) return raw.slice(0, 2);
  if (LANG3[raw]) return LANG3[raw];
  if (NAME_TO_CODE.has(raw)) return NAME_TO_CODE.get(raw);
  const firstWord = raw.split(/[^a-z]+/)[0];
  if (NAME_TO_CODE.has(firstWord)) return NAME_TO_CODE.get(firstWord);
  if (LANG3[firstWord]) return LANG3[firstWord];
  return 'und';
}

export function languageName(code) {
  if (!code || code === 'und') return 'Unknown';
  try { return displayNames?.of(code) || code.toUpperCase(); } catch { return code.toUpperCase(); }
}

// ---------- Format conversion ----------

export function decodeSubtitle(buffer) {
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('\uFFFD')) {
    // Older .srt files are often Windows-1252, not UTF-8.
    try { text = new TextDecoder('windows-1252').decode(buffer); } catch { text = Buffer.from(buffer).toString('latin1'); }
  }
  return text.replace(/^\uFEFF/, '');
}

export function toVtt(text) {
  const body = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT/.test(body)) return `${body}\n`;
  const converted = body
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2')
    .replace(/\{\\[^}]*\}/g, '') // ASS-style override tags such as {\an8}
    .replace(/<\/?font[^>]*>/gi, '');
  return `WEBVTT\n\n${converted}\n`;
}

// ---------- Provider lookups ----------

function parseProvider(provider, data) {
  if (provider.name === 'opensubtitles') {
    return (Array.isArray(data?.subtitles) ? data.subtitles : [])
      .filter(sub => sub?.url)
      .map(sub => ({
        url: sub.url,
        format: /\.vtt(\?|$)/i.test(sub.url) ? 'vtt' : 'srt',
        lang: languageCode(sub.lang),
        provider: provider.name
      }));
  }
  return (Array.isArray(data) ? data : [])
    .filter(sub => sub?.file || sub?.url)
    .map(sub => {
      const url = sub.file || sub.url;
      return {
        url,
        format: /\.srt(\?|$)/i.test(url) ? 'srt' : 'vtt',
        lang: languageCode(sub.lang || sub.language || sub.label),
        provider: provider.name
      };
    });
}

export function createSubtitleService(config = {}) {
  const fetchImpl = config.fetch || fetch;
  const userAgent = config.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const preferred = String(config.languages || 'en').split(',').map(languageCode).filter(code => code !== 'und');
  const perLanguage = Math.max(1, Number(config.perLanguage || 2));
  const maxTotal = Math.max(1, Number(config.maxTotal || 40));
  const enabled = config.enabled !== false;
  const listCache = new Map();
  const fileCache = new Map();

  async function getJson(url) {
    const response = await fetchImpl(url, { headers: { 'user-agent': userAgent, accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) {
      response.body?.cancel?.();
      return null;
    }
    return response.json();
  }

  // media: { mediaType, tmdbId, imdbId, season, episode }
  async function findOnline(media) {
    if (!enabled) return [];
    const key = [media.mediaType, media.tmdbId, media.season ?? '', media.episode ?? ''].join(':');
    const hit = listCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.items;

    const settled = await Promise.all(PROVIDERS.map(async provider => {
      const path = provider.path(media);
      if (!path) return [];
      try {
        return parseProvider(provider, await getJson(`${provider.base}${path}`));
      } catch {
        return [];
      }
    }));

    // Preferred languages first, a few per language, no duplicates.
    const seen = new Set();
    const byLang = new Map();
    for (const item of settled.flat()) {
      if (!/^https?:\/\//i.test(item.url) || seen.has(item.url)) continue;
      seen.add(item.url);
      if (!byLang.has(item.lang)) byLang.set(item.lang, []);
      const list = byLang.get(item.lang);
      if (list.length < perLanguage) list.push(item);
    }
    const order = [...byLang.keys()].sort((a, b) => {
      const pa = preferred.indexOf(a);
      const pb = preferred.indexOf(b);
      if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return languageName(a).localeCompare(languageName(b));
    });
    const items = order.flatMap(lang => byLang.get(lang)).slice(0, maxTotal);

    listCache.set(key, { items, expiresAt: Date.now() + (items.length ? 6 : 1) * 60 * 60 * 1000 });
    if (listCache.size > 500) listCache.delete(listCache.keys().next().value);
    return items;
  }

  async function fetchVtt(url) {
    const hit = fileCache.get(url);
    if (hit) {
      fileCache.delete(url);
      fileCache.set(url, hit);
      return hit;
    }
    const response = await fetchImpl(url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Subtitle download failed (HTTP ${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Subtitle file is too large');
    const vtt = toVtt(decodeSubtitle(buffer));
    fileCache.set(url, vtt);
    if (fileCache.size > 200) fileCache.delete(fileCache.keys().next().value);
    return vtt;
  }

  return { enabled, preferred, findOnline, fetchVtt };
}
