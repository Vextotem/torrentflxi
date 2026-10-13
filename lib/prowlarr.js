// Prowlarr search, release ranking and torrent file matching.
// Pure helpers are exported so they can be unit-tested without WebTorrent.

export const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://open.demonii.com:1337/announce',
  'https://tracker.moeblog.cn:443/announce',
  'udp://open.dstud.io:6969/announce',
  'udp://tracker.srv00.com:6969/announce'
];

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg|ts|m2ts)$/i;
const GB = 1024 ** 3;
const YEAR_RE = /^(19|20)\d\d$/;
const COUNTRY_TOKENS = new Set(['us', 'uk', 'au', 'nz', 'ca', 'ie']);

// Words that may legitimately follow a title in a release name.
const MARKER_RE = /^(?:s\d{1,2}(?:e\d{1,4})*|\d{1,2}x\d{1,3}|e\d{1,4}|season|seasons|series|complete|\d{3,4}[pi]|4k|8k|uhd|hd|sd|fhd|web|webrip|webdl|dl|bluray|blu|bdrip|brrip|bdremux|remux|hdrip|dvdrip|dvd|dvdr|hdtv|pdtv|sdtv|x264|x265|h264|h265|h|hevc|avc|av1|xvid|divx|10bit|8bit|hdr|hdr10|dv|proper|repack|rerip|internal|extended|unrated|uncut|remastered|directors|dc|theatrical|imax|limited|multi|dual|dubbed|subbed|mkv|mp4|avi|amzn|nf|dsnp|hmax|max|atvp|hulu|pcok|pmtp|stan|crav|yts|yify|rarbg|eztv|ita|eng|english|french|hindi|german|spanish|korean|japanese|tamil|telugu|part|pt|vol|volume|cam|camrip|hdcam|ts|hdts|telesync|tc|scr|screener|dvdscr|aac|ac3|dd|ddp|dts|truehd|atmos|opus|flac|episode|ep|special|specials|ova|batch|miniseries)$/;

const CAM_TOKENS = new Set(['cam', 'camrip', 'hdcam', 'hqcam', 'ts', 'hdts', 'telesync', 'tc', 'hdtc', 'telecine', 'scr', 'screener', 'dvdscr', 'bdscr', 'workprint', 'r5', 'predvd']);
const DISC_TOKENS = new Set(['iso', 'bdmv', 'bd25', 'bd50', 'bd66', 'bd100', 'avchd']);
const HEAVY_AUDIO_TOKENS = new Set(['truehd', 'dts', 'dtshd', 'dtsx', 'atmos']);

// ---------- Generic helpers ----------

export function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:[a-z] ){2,}[a-z]\b/g, run => run.replace(/ /g, '')) // S.H.I.E.L.D. -> shield
    .replace(/\s+/g, ' ')
    .trim();
}

function base32ToHex(value) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '';
  for (const char of value.toLowerCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) return null;
    bits += index.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex.slice(0, 40);
}

export function normalizeInfoHash(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (/^[a-f0-9]{40}$/.test(raw)) return raw;
  if (/^[a-z2-7]{32}$/.test(raw)) return base32ToHex(raw);
  return null;
}

export function infoHashFromMagnet(magnet) {
  const match = /xt=urn(?::|%3a)btih(?::|%3a)([a-z0-9]+)/i.exec(String(magnet || ''));
  return match ? normalizeInfoHash(match[1]) : null;
}

export function withTrackers(magnet, trackers = PUBLIC_TRACKERS) {
  const text = String(magnet || '');
  const present = new Set();
  for (const match of text.matchAll(/[?&]tr=([^&]*)/g)) {
    try { present.add(decodeURIComponent(match[1])); } catch { present.add(match[1]); }
  }
  const extra = trackers.filter(tracker => !present.has(tracker)).map(tracker => `tr=${encodeURIComponent(tracker)}`);
  if (!extra.length) return text;
  return `${text}${text.includes('?') ? '&' : '?'}${extra.join('&')}`;
}

export function buildMagnet(infoHash, name, trackers = PUBLIC_TRACKERS) {
  const hash = normalizeInfoHash(infoHash);
  if (!hash) throw new Error('Invalid torrent info hash.');
  const parts = [`xt=urn:btih:${hash}`];
  if (name) parts.push(`dn=${encodeURIComponent(name)}`);
  for (const tracker of trackers) parts.push(`tr=${encodeURIComponent(tracker)}`);
  return `magnet:?${parts.join('&')}`;
}

export function normalizeQuality(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === '4k' || v === 'uhd' || v === '2160' || v === '2160p') return '2160p';
  if (v === '1080' || v === '1080p' || v === 'fhd') return '1080p';
  if (v === '720' || v === '720p' || v === 'hd') return '720p';
  if (v === '480' || v === '480p' || v === 'sd') return '480p';
  return v;
}

function pad2(value) {
  return String(Number(value)).padStart(2, '0');
}

function imdbNumber(imdbId) {
  const match = /^tt0*(\d+)$/i.exec(String(imdbId || ''));
  return match ? Number(match[1]) : null;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return null;
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  return `${(n / 1024 ** 2).toFixed(0)} MB`;
}

// ---------- Release parsing ----------

const isYearNumber = n => n >= 1900 && n <= 2099;

// Anime releases: "[SubsPlease] Sousou no Frieren - 12 (1080p)", "Show S2 - 03", "Show 2nd Season - 03",
// "[Group] Show (01-28) [Batch]", "Show E12". Season is null when the number is absolute.
function parseAnimeEpisode(raw, lite) {
  let season = null;
  let m = /(?<![a-z0-9])(\d{1,2})(?:st|nd|rd|th) season(?![a-z])/.exec(lite)
    || /(?<![a-z0-9])season ?(\d{1,2})(?!\d)/.exec(lite)
    || /(?<![a-z0-9])s(\d{1,2})(?![a-z0-9])/.exec(lite);
  if (m) season = Number(m[1]);

  // Batch: "(01-28)", "[01~12]", or a range next to the word "batch"
  m = /[\[(]\s*0*(\d{1,4})\s?[-~]\s?0*(\d{1,4})\s*[\])]/.exec(String(raw).toLowerCase());
  if (!m && /(?<![a-z])batch(?![a-z])/.test(lite)) m = /(?<![a-z0-9])0*(\d{1,4}) ?[-~] ?0*(\d{1,4})(?![\dp])/.exec(lite);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b > a && !isYearNumber(a) && !isYearNumber(b) && b - a <= 1500) {
      return { kind: 'episode', season, episodeStart: a, episodeEnd: b, anime: true };
    }
  }

  m = / - 0*(\d{1,4})(?:v\d+)?(?![\dp])/.exec(lite)
    || /(?<![a-z0-9])(?:e|ep|episode) ?0*(\d{1,4})(?:v\d+)?(?![\dp])/.exec(lite);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n <= 1500 && !isYearNumber(n)) return { kind: 'episode', season, episodeStart: n, episodeEnd: n, anime: true };
  }
  return null;
}

export function parseTvInfo(title, options = {}) {
  const lite = String(title || '').toLowerCase().replace(/[._()[\]{}+]+/g, ' ').replace(/\s+/g, ' ');
  let m;

  // S01E01, S01E01E02, S01E01-E03, S01E01-03
  m = /(?<![a-z0-9])s(\d{1,2}) ?e(\d{1,4})((?:-?e\d{1,4}|-\d{1,3}(?![\dp]))*)(?!\d)/.exec(lite);
  if (m) {
    const first = Number(m[2]);
    const tail = [...m[3].matchAll(/\d{1,4}/g)].map(x => Number(x[0]));
    const last = tail.length ? Math.max(first, ...tail) : first;
    return { kind: 'episode', season: Number(m[1]), episodeStart: first, episodeEnd: last - first <= 60 ? last : first };
  }

  // Season 1 Episode 1
  m = /(?<![a-z0-9])season ?(\d{1,2}) ?(?:episode|ep) ?(\d{1,4})(?!\d)/.exec(lite);
  if (m) return { kind: 'episode', season: Number(m[1]), episodeStart: Number(m[2]), episodeEnd: Number(m[2]) };

  // 1x01, 1x01-02
  m = /(?<![0-9a-z])(\d{1,2})x(\d{2,3})(?:-(\d{2,3}))?(?!\d)/.exec(lite);
  if (m) {
    const first = Number(m[2]);
    const last = m[3] ? Math.max(first, Number(m[3])) : first;
    return { kind: 'episode', season: Number(m[1]), episodeStart: first, episodeEnd: last };
  }

  // S01-S05, S01-05, S01 to S05
  m = /(?<![a-z0-9])s(\d{1,2})(?:-s?|\s?-\s?s|\sto\ss?)(\d{1,2})(?!\d)/.exec(lite);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b > a) return { kind: 'seasons', seasonStart: a, seasonEnd: b };
  }

  // Seasons 1-5, Season 1 to 5
  m = /(?<![a-z0-9])seasons? ?(\d{1,2})(?:-| to | and | & )(?:seasons? ?)?(\d{1,2})(?!\d)/.exec(lite);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b > a) return { kind: 'seasons', seasonStart: a, seasonEnd: b };
  }

  if (options.anime) {
    const anime = parseAnimeEpisode(title, lite);
    if (anime) return anime;
    m = /(?<![a-z0-9])(\d{1,2})(?:st|nd|rd|th) season(?![a-z])/.exec(lite);
    if (m) return { kind: 'season', season: Number(m[1]) };
  }

  // S01 / Season 1
  m = /(?<![a-z0-9])s(\d{1,2})(?![a-z0-9])/.exec(lite) || /(?<![a-z0-9])season ?(\d{1,2})(?!\d)/.exec(lite);
  if (m) return { kind: 'season', season: Number(m[1]) };

  if (/(?<![a-z])(?:complete series|complete collection|all seasons|complete)(?![a-z])/.test(lite)) {
    return { kind: 'series' };
  }

  return { kind: null };
}

export function parseRelease(title, options = {}) {
  const raw = String(title || '');
  const lower = raw.toLowerCase();
  const normalized = normalizeTitle(raw);
  const words = normalized.split(' ').filter(Boolean);
  const set = new Set(words);

  let quality = null;
  if (set.has('2160p') || set.has('4k') || set.has('uhd')) quality = '2160p';
  else if (set.has('1080p') || set.has('1080i')) quality = '1080p';
  else if (set.has('720p')) quality = '720p';
  else if (set.has('576p') || set.has('480p') || set.has('360p') || set.has('dvdrip')) quality = '480p';

  let codec = null;
  if (/\b(?:x|h)\.?265\b|\bhevc\b/.test(lower)) codec = 'hevc';
  else if (/\bav1\b/.test(lower)) codec = 'av1';
  else if (/\b(?:x|h)\.?264\b|\bavc\b/.test(lower)) codec = 'h264';
  else if (/\bxvid\b|\bdivx\b/.test(lower)) codec = 'xvid';

  return {
    quality,
    codec,
    cam: words.some(word => CAM_TOKENS.has(word)),
    remux: set.has('remux') || set.has('bdremux'),
    disc: words.some(word => DISC_TOKENS.has(word)) || /\bcomplete (?:uhd )?bluray\b/.test(normalized),
    hdr: words.some(word => /^hdr/.test(word)),
    dolbyVision: set.has('dv') || set.has('dovi') || /\bdolby vision\b/.test(normalized),
    heavyAudio: words.some(word => HEAVY_AUDIO_TOKENS.has(word)),
    tenBit: set.has('10bit') || set.has('hi10p') || set.has('hi10') || /\b10[ -]?bit\b/.test(lower),
    aac: words.some(word => /^aac/.test(word)),
    mp4: set.has('mp4'),
    threeD: set.has('3d') || set.has('hsbs') || set.has('hou'),
    yts: set.has('yts') || set.has('yify'),
    years: words.filter(word => YEAR_RE.test(word)).map(Number),
    tv: parseTvInfo(raw, options)
  };
}

// ---------- Title matching ----------

export function titleVariants(media) {
  const list = [
    media?.title,
    media?.originalTitle,
    ...(Array.isArray(media?.alternativeTitles) ? media.alternativeTitles : []),
    ...(Array.isArray(media?.romajiTitles) ? media.romajiTitles : [])
  ];
  const out = new Set();
  for (const title of list) {
    const n = normalizeTitle(title);
    if (!n) continue;
    out.add(n);
    if (n.startsWith('the ') && n.length > 6) out.add(n.slice(4));
  }
  return [...out];
}

const ANIME_MARKER_RE = /^(?:\d{1,4}|\d{1,2}(?:st|nd|rd|th)|v\d|bd|tv|cour|movie|raw|raws|sub|subs|uncensored)$/;

function isMarker(word, anime = false) {
  return MARKER_RE.test(word) || (anime && ANIME_MARKER_RE.test(word));
}

export function matchTitle(releaseTitle, wanted, options = {}) {
  const words = normalizeTitle(releaseTitle).split(' ').filter(Boolean);
  for (const want of wanted) {
    const target = want.split(' ').filter(Boolean);
    if (!target.length) continue;
    const maxStart = Math.min(3, words.length - target.length);
    for (let i = 0; i <= maxStart; i++) {
      if (!target.every((word, j) => words[i + j] === word)) continue;
      let k = i + target.length;
      let yearAfterTitle = null;
      while (k < words.length && (COUNTRY_TOKENS.has(words[k]) || YEAR_RE.test(words[k]))) {
        if (yearAfterTitle === null && YEAR_RE.test(words[k])) yearAfterTitle = Number(words[k]);
        k++;
      }
      if (k >= words.length || isMarker(words[k], options.anime)) return { matched: want, yearAfterTitle };
    }
  }
  return null;
}

function categoryOk(release) {
  const ids = (Array.isArray(release?.categories) ? release.categories : [])
    .map(category => Number(category?.id))
    .filter(id => id > 0 && id < 100000);
  if (!ids.length) return true;
  // Movies, TV, and "Other" (8000), where several public indexers file video.
  return ids.some(id => (id >= 2000 && id < 3000) || (id >= 5000 && id < 6000) || (id >= 8000 && id < 9000));
}

// ---------- Scoring ----------

function qualityScore(quality, preferred) {
  const base = { '1080p': 40, '720p': 32, '2160p': 16, '480p': 10 };
  let score = quality ? (base[quality] ?? 5) : 12;
  if (preferred && quality === preferred) score += 25;
  return score;
}

// Start-up speed matters most, so releases the browser can play as-is win:
// MP4 + H.264 plays directly; MKV + H.264 only needs a quick repackage (seconds);
// HEVC/x265 and 10-bit video need a full re-encode, which is slow and uses a lot of CPU.
function commonScore(release, info, preferred) {
  let score = qualityScore(info.quality, preferred);
  if (info.codec === 'h264') score += 20;
  else if (info.codec === 'hevc') score -= 25;
  else if (info.codec === 'av1') score -= 10;
  else if (info.codec === 'xvid') score -= 10;
  if (info.tenBit) score -= 15;
  if (info.mp4) score += 12;
  if (info.yts || /yts/i.test(String(release.indexer || ''))) score += 10;
  if (info.aac) score += 4;
  if (info.heavyAudio) score -= 3; // only the audio is converted, which is cheap
  if (info.remux) score -= 40;
  if (info.dolbyVision) score -= 15;
  else if (info.hdr) score -= 8;
  if (info.threeD) score -= 30;
  const seeders = Number(release.seeders);
  if (Number.isFinite(seeders)) score += Math.min(45, Math.log10(seeders + 1) * 18);
  return score;
}

// Lower bitrates start faster and stall less over torrent swarms.
function bitrateScore(sizeBytes, runtimeMinutes) {
  const size = Number(sizeBytes || 0);
  const minutes = Number(runtimeMinutes || 0);
  if (!size || !minutes) return 0;
  const mbps = (size * 8) / (minutes * 60) / 1e6;
  if (mbps <= 6) return 8;
  if (mbps <= 10) return 4;
  if (mbps <= 15) return 0;
  if (mbps <= 25) return -10;
  return -20;
}

function baseRejection(release, { minSeeders }) {
  if (!release || !release.title) return 'missing title';
  if (release.protocol && String(release.protocol).toLowerCase() !== 'torrent') return 'not a torrent';
  if (!release.magnetUrl && !release.downloadUrl && !normalizeInfoHash(release.infoHash)) return 'no download link';
  if (!categoryOk(release)) return 'not a video category';
  const seeders = Number(release.seeders);
  if (release.seeders !== null && release.seeders !== undefined && Number.isFinite(seeders) && seeders < minSeeders) return `only ${seeders} seeders`;
  return null;
}

export function summarizeCandidate(candidate) {
  const { release, info } = candidate;
  return {
    title: release.title,
    indexer: release.indexer || null,
    quality: info.quality,
    codec: info.codec,
    heavyAudio: Boolean(info.heavyAudio),
    seeders: Number.isFinite(Number(release.seeders)) ? Number(release.seeders) : null,
    leechers: Number.isFinite(Number(release.leechers)) ? Number(release.leechers) : null,
    size: formatBytes(release.size),
    sizeBytes: Number(release.size || 0) || null,
    coverage: candidate.coverage || 'movie',
    ...(candidate.matchNote ? { matchNote: candidate.matchNote } : {}),
    infoHash: candidate.infoHash || null,
    publishDate: release.publishDate || null,
    score: Math.round(candidate.score * 10) / 10,
    ...(candidate.rejected ? { rejected: candidate.rejected } : {})
  };
}

export function rankMovieReleases(results, media, options = {}) {
  const anime = Boolean(options.anime);
  const preferred = normalizeQuality(options.preferredQuality);
  const minSeeders = Number(options.minSeeders ?? 1);
  const maxBytes = Number(options.maxSizeGb || 20) * GB;
  const wanted = titleVariants(media);
  const imdb = imdbNumber(media?.imdbId);
  const accepted = [];
  const rejected = [];

  for (const release of results) {
    const info = parseRelease(release?.title);
    const infoHash = normalizeInfoHash(release?.infoHash);
    const candidate = { release, info, infoHash, coverage: 'movie', score: 0 };
    const reject = reason => rejected.push({ ...candidate, rejected: reason });

    const base = baseRejection(release, { minSeeders });
    if (base) { reject(base); continue; }
    if (info.tv.kind === 'episode' || info.tv.kind === 'season' || info.tv.kind === 'seasons') { reject('tv release'); continue; }

    const idMatch = Boolean((imdb && Number(release.imdbId) === imdb) || (media?.id && Number(release.tmdbId) === Number(media.id)));
    const match = matchTitle(release.title, wanted, { anime });
    if (!idMatch && !match) { reject('title mismatch'); continue; }

    if (media?.year && info.years.length && !idMatch && !info.years.some(year => Math.abs(year - media.year) <= 1)) {
      reject('year mismatch');
      continue;
    }
    if (info.cam) { reject('cam/telesync'); continue; }
    if (info.disc) { reject('disc image'); continue; }
    const size = Number(release.size || 0);
    if (size && size > maxBytes) { reject(`larger than ${options.maxSizeGb || 20} GB`); continue; }

    let score = commonScore(release, info, preferred);
    if (idMatch) score += 8;
    if (!info.years.length && !idMatch) score -= 8;
    if (size) {
      if (size >= 0.7 * GB && size <= 6 * GB) score += 5;
      else if (size > 12 * GB) score -= 8;
      else if (size < 0.4 * GB) score -= 10;
    }
    score += bitrateScore(size, media?.runtime);
    candidate.score = score;
    accepted.push(candidate);
  }

  accepted.sort((a, b) => b.score - a.score);
  return { accepted, rejected };
}

export function absoluteEpisodeNumber(media, season, episode) {
  const s = Number(season);
  const e = Number(episode);
  if (!(s > 1) || !Array.isArray(media?.seasons)) return e;
  const before = media.seasons
    .filter(item => Number(item.seasonNumber) > 0 && Number(item.seasonNumber) < s)
    .reduce((sum, item) => sum + Number(item.episodeCount || 0), 0);
  return before + e;
}

export function episodeCoverage(tv, season, episode, absolute = null) {
  const s = Number(season);
  const e = Number(episode);
  if (!tv?.kind) return null;
  if (tv.kind === 'episode') {
    const inRange = n => n >= tv.episodeStart && n <= tv.episodeEnd;
    let hit;
    if (tv.season === null || tv.season === undefined) {
      // No season in the name: anime absolute numbering (or season 1).
      hit = (absolute !== null && inRange(absolute)) || (s === 1 && inRange(e));
    } else {
      hit = tv.season === s && inRange(e);
    }
    if (!hit) return null;
    return tv.episodeEnd - tv.episodeStart >= 3 ? 'season' : 'episode';
  }
  if (tv.kind === 'season') return tv.season === s ? 'season' : null;
  if (tv.kind === 'seasons') return s >= tv.seasonStart && s <= tv.seasonEnd ? 'seasons' : null;
  if (tv.kind === 'series') return 'series';
  return null;
}

export function rankEpisodeReleases(results, media, season, episode, options = {}) {
  const preferred = normalizeQuality(options.preferredQuality);
  const minSeeders = Number(options.minSeeders ?? 1);
  const maxEpisodeBytes = Number(options.maxEpisodeSizeGb || 6) * GB;
  const wanted = titleVariants(media);
  const imdb = imdbNumber(media?.imdbId);
  const tvdb = Number(media?.tvdbId || 0) || null;
  const s = Number(season);
  const e = Number(episode);
  const anime = Boolean(options.anime);
  const absolute = anime ? Number(options.absolute ?? absoluteEpisodeNumber(media, season, episode)) : null;
  const accepted = [];
  const loose = [];
  const rejected = [];

  for (const release of results) {
    const info = parseRelease(release?.title, { anime });
    const infoHash = normalizeInfoHash(release?.infoHash);
    const coverage = episodeCoverage(info.tv, season, episode, absolute);
    const candidate = { release, info, infoHash, coverage, score: 0 };
    const reject = reason => rejected.push({ ...candidate, rejected: reason });

    const base = baseRejection(release, { minSeeders });
    if (base) { reject(base); continue; }

    const idMatch = Boolean((imdb && Number(release.imdbId) === imdb) || (tvdb && Number(release.tvdbId) === tvdb));
    const match = matchTitle(release.title, wanted, { anime });
    if (!idMatch && !match) { reject('title mismatch'); continue; }
    if (!idMatch && match?.yearAfterTitle && media?.year && Math.abs(match.yearAfterTitle - media.year) > 1) {
      reject('different show (year)');
      continue;
    }
    if (info.cam) { reject('cam/telesync'); continue; }
    if (info.disc) { reject('disc image'); continue; }
    if (info.tv.kind === null && info.years.length && media?.year && !info.years.some(year => Math.abs(year - media.year) <= 1) && !idMatch) {
      reject('different year');
      continue;
    }

    let score = commonScore(release, info, preferred);
    if (idMatch) score += 6;
    const size = Number(release.size || 0);

    if (!coverage) {
      // Same show, but not this exact episode. Kept as a last resort ("closest match").
      let note;
      if (info.tv.kind === null) {
        score += 10;
        note = 'episode not labelled in this release';
      } else if (info.tv.kind === 'episode' && (info.tv.season === s || info.tv.season === null)) {
        score += 5 - Math.min(20, Math.abs(info.tv.episodeStart - e));
        note = info.tv.season === null ? `closest available: episode ${info.tv.episodeStart}` : `closest available: S${info.tv.season}E${info.tv.episodeStart}`;
      } else if (info.tv.kind === 'episode') {
        score -= 10 + Math.abs(Number(info.tv.season) - s) * 5;
        note = `closest available: S${info.tv.season}E${info.tv.episodeStart}`;
      } else {
        score -= 15;
        note = 'closest available season';
      }
      loose.push({ ...candidate, coverage: 'loose', loose: true, matchNote: note, score });
      rejected.push({ ...candidate, rejected: 'does not contain this episode' });
      continue;
    }

    if (coverage === 'episode' && size && size > maxEpisodeBytes) { reject(`episode larger than ${options.maxEpisodeSizeGb || 6} GB`); continue; }

    if (coverage === 'episode') {
      score += info.tv.episodeEnd > info.tv.episodeStart ? 28 : 35;
      score += bitrateScore(size, media?.runtime || 45);
    } else if (coverage === 'season') score += 15;
    else if (coverage === 'seasons') score += 6;
    candidate.score = score;
    accepted.push(candidate);
  }

  accepted.sort((a, b) => b.score - a.score);
  loose.sort((a, b) => b.score - a.score);
  return { accepted, loose, rejected };
}

// ---------- Torrent file selection ----------

function stripExt(name) {
  return String(name || '').replace(/\.[a-z0-9]{2,4}$/i, '');
}

function parentDir(filePath) {
  const parts = String(filePath || '').split(/[\\/]/).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

export function isSampleFile(file) {
  const target = String(file?.path || file?.name || '');
  return /(^|[\\/ ._\-[(])sample([\\/ ._\-\])]|$)/i.test(target) && Number(file?.length || 0) < 500 * 1024 ** 2;
}

function playableVideos(files) {
  return files.filter(file => VIDEO_EXT.test(file.name) && !isSampleFile(file));
}

function largest(files) {
  return [...files].sort((a, b) => Number(b.length || 0) - Number(a.length || 0))[0] || null;
}

export function chooseMovieFileIndex(files) {
  return largest(playableVideos(files))?.index ?? null;
}

export function chooseEpisodeFileIndex(files, season, episode, options = {}) {
  const s = Number(season);
  const e = Number(episode);
  const anime = Boolean(options.anime);
  const absolute = options.absolute === undefined || options.absolute === null ? null : Number(options.absolute);
  const videos = playableVideos(files);
  if (!videos.length) return null;

  const exact = [];
  const ranged = [];
  const byFolder = [];
  const byNumberOnly = [];
  let anyEpisodeInfo = false;

  const leadingNumber = new RegExp(`^0*${e}(?!\\d)`);
  const episodeWord = new RegExp(`(?:^|[^a-z0-9])(?:e|ep|episode)[ ._-]*0*${e}(?!\\d)`, 'i');
  const dashNumber = new RegExp(` - 0*${e}(?:v\\d)?(?!\\d)`);
  const seeNumber = s > 0 && s < 10 ? new RegExp(`(?:^|[^0-9])${s}${pad2(e)}(?:[^0-9p]|$)`, 'i') : null;

  for (const file of videos) {
    const nameInfo = parseTvInfo(stripExt(file.name), { anime });
    const dirInfo = parseTvInfo(parentDir(file.path), { anime });
    const dirSeason = dirInfo.kind === 'season' ? dirInfo.season
      : dirInfo.kind === 'episode' && Number.isInteger(dirInfo.season) && dirInfo.episodeEnd - dirInfo.episodeStart >= 3 ? dirInfo.season
        : null;

    if (nameInfo.kind === 'episode') {
      anyEpisodeInfo = true;
      const inRange = n => n >= nameInfo.episodeStart && n <= nameInfo.episodeEnd;
      const fileSeason = Number.isInteger(nameInfo.season) ? nameInfo.season : dirSeason;
      const hit = Number.isInteger(fileSeason)
        ? fileSeason === s && (inRange(e) || (absolute !== null && nameInfo.anime && inRange(absolute)))
        : (absolute !== null && inRange(absolute)) || (s === 1 && inRange(e)) || (options.seasonPack && inRange(e));
      if (hit) (nameInfo.episodeStart === nameInfo.episodeEnd ? exact : ranged).push(file);
      continue;
    }

    const bare = stripExt(file.name);
    const numbered = leadingNumber.test(bare) || episodeWord.test(bare) || dashNumber.test(bare);
    if (dirInfo.kind === 'season' && dirInfo.season === s) {
      if (numbered) byFolder.push(file);
    } else if (options.seasonPack && dirInfo.kind !== 'season' && (numbered || seeNumber?.test(bare))) {
      // Release is a pack for this season but files carry no season marker: "01 - Pilot.mkv", "Show 101.mkv".
      byNumberOnly.push(file);
    }
  }

  const pick = largest(exact) || largest(ranged) || largest(byFolder) || (anyEpisodeInfo ? null : largest(byNumberOnly));
  if (pick) return pick.index;

  // Anime-style absolute numbering: "[Group] Show - 01 [1080p].mkv"
  if (!anyEpisodeInfo && (s <= 1 || absolute !== null)) {
    const n = absolute !== null ? absolute : e;
    const pattern = new RegExp(` - 0*${n}(?:v\\d)?(?!\\d)`);
    const match = largest(videos.filter(file => pattern.test(stripExt(file.name))));
    if (match) return match.index;
  }

  if (options.singleEpisode) return largest(videos)?.index ?? null;
  return null;
}

// ---------- Prowlarr API client ----------

export function createProwlarrClient(config = {}) {
  const baseUrl = String(config.url || '').trim().replace(/\/+$/, '');
  const apiKey = String(config.apiKey || '').trim();
  const configured = Boolean(baseUrl && apiKey);
  const baseOrigin = configured ? new URL(baseUrl).origin : null;
  const timeoutMs = Math.max(5000, Number(config.timeoutMs || 45000));
  const downloadTimeoutMs = Math.max(5000, Number(config.downloadTimeoutMs || 20000));
  const cacheMs = Math.max(0, Number(config.cacheSeconds ?? 900)) * 1000;
  const settleMs = Math.max(1000, Number(config.settleMs || 3000));
  // Used for links that leave Prowlarr (e.g. a redirect to an indexer's .torrent URL).
  const externalFetch = typeof config.externalFetch === 'function' ? config.externalFetch : fetch;
  const indexerIds = Array.isArray(config.indexerIds) ? config.indexerIds : [];
  const maxTorrentBytes = Math.max(1, Number(config.maxTorrentFileMb || 10)) * 1024 ** 2;
  const userAgent = config.userAgent || 'TorrentDirectPlayer/3.1';
  const cache = new Map();

  function requireConfigured() {
    if (!configured) {
      throw Object.assign(new Error('Prowlarr is not configured. Set PROWLARR_URL and PROWLARR_API_KEY.'), { statusCode: 503 });
    }
  }

  async function withTimeout(ms, run) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await run(controller.signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`Request timed out after ${ms}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function search({ query, type = 'search', categories = [], indexers = null }) {
    requireConfigured();
    const url = new URL(`${baseUrl}/api/v1/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('type', type);
    url.searchParams.set('limit', '100');
    url.searchParams.set('offset', '0');
    for (const category of categories) url.searchParams.append('categories', String(category));
    for (const id of indexers || indexerIds) url.searchParams.append('indexerIds', String(id));

    const key = url.toString();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await withTimeout(timeoutMs, async signal => {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'X-Api-Key': apiKey, 'user-agent': userAgent },
        signal
      });
      const text = await response.text();
      if (!response.ok) {
        let reason = `HTTP ${response.status}`;
        try { reason = JSON.parse(text)?.message || reason; } catch {}
        if (response.status === 401) reason = 'Prowlarr rejected the API key (401).';
        throw new Error(reason);
      }
      const body = text ? JSON.parse(text) : [];
      return Array.isArray(body) ? body : [];
    });

    if (cacheMs > 0) {
      cache.set(key, { value, expiresAt: Date.now() + cacheMs });
      if (cache.size > 400) {
        const now = Date.now();
        for (const [cacheKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(cacheKey);
      }
    }
    return value;
  }

  function dedupe(list) {
    const seen = new Map();
    for (const release of list) {
      const key = normalizeInfoHash(release?.infoHash) || release?.guid || `${release?.title}|${release?.size}`;
      const previous = seen.get(key);
      if (!previous || (Number(release.seeders) || 0) > (Number(previous.seeders) || 0)) seen.set(key, release);
    }
    return [...seen.values()];
  }

  // ----- Per-indexer searching -----
  // Prowlarr answers a search only when its slowest indexer has answered (FlareSolverr sites can take
  // 10-20 s). Asking each indexer separately lets fast indexers' results be used straight away.
  // Each media type has a primary indexer that is asked first (YTS for movies, EZTV for TV, Nyaa for
  // anime); the backup (The Pirate Bay) is only asked if the primary hasn't produced a good result
  // within backupAfterMs, or comes back empty.
  const splitIndexers = config.splitIndexers !== false;
  const backupAfterMs = Math.max(0, Number(config.backupAfterMs ?? 2500));
  const roleNames = value => (Array.isArray(value) ? value : String(value || '').split(','))
    .map(item => normalizeTitle(item))
    .filter(Boolean);
  const roles = {
    movie: roleNames(config.roles?.movie ?? 'YTS'),
    tv: roleNames(config.roles?.tv ?? 'EZTV'),
    anime: roleNames(config.roles?.anime ?? 'Nyaa'),
    backup: roleNames(config.roles?.backup ?? 'Knaben,The Pirate Bay,LimeTorrents')
  };
  let indexerList = { at: 0, list: null };

  function supportsIds(indexer, kind) {
    const caps = indexer?.capabilities;
    const params = kind === 'tv' ? caps?.tvSearchParams : caps?.movieSearchParams;
    if (!Array.isArray(params)) return true; // unknown: try it
    return params.some(param => /imdb|tvdb|tmdb/i.test(String(param)));
  }

  async function enabledIndexers() {
    if (!splitIndexers) return null;
    if (indexerList.list && Date.now() - indexerList.at < 10 * 60 * 1000) return indexerList.list;
    try {
      const wanted = new Set(indexerIds.map(Number));
      const list = (await api('GET', '/api/v1/indexer') || [])
        .filter(item => item.enable !== false && String(item.protocol || 'torrent').toLowerCase() === 'torrent')
        .filter(item => !wanted.size || wanted.has(Number(item.id)))
        .map(item => ({
          id: item.id,
          name: item.name,
          key: normalizeTitle(item.name),
          tvIds: supportsIds(item, 'tv'),
          movieIds: supportsIds(item, 'movie')
        }));
      indexerList = { at: Date.now(), list };
      return list;
    } catch {
      return null; // fall back to one combined search
    }
  }

  // kind: 'movie' | 'tv' | 'anime-tv' | 'anime-movie'
  async function indexerPlan(kind) {
    const list = await enabledIndexers();
    if (!list?.length) return null;
    const pick = names => list.filter(indexer => names.some(name => indexer.key.includes(name)));
    const primaryNames = kind === 'movie' ? roles.movie
      : kind === 'tv' ? roles.tv
        : kind === 'anime-movie' ? [...roles.anime, ...roles.movie]
          : roles.anime;
    const primary = pick(primaryNames);
    if (!primary.length) return { primary: list, backup: [] }; // roles not found: ask everything at once
    const backup = pick(roles.backup).filter(indexer => !primary.includes(indexer));
    return { primary, backup };
  }

  // Turns searches into one request per indexer. scope: 'primary' | 'backup' | 'both' (default).
  async function planSearches(list, kind) {
    const plan = await indexerPlan(kind);
    if (!plan) return list.map(params => ({ ...params, phase: 0 }));
    const idKind = kind.endsWith('movie') ? 'movie' : 'tv';
    const hasIdSearch = list.some(params => params.idSearch);
    const supports = indexer => (idKind === 'tv' ? indexer.tvIds : indexer.movieIds);
    const out = [];
    for (const params of list) {
      const scope = params.scope || 'both';
      const groups = [];
      if (scope !== 'backup') groups.push([plan.primary, 0]);
      if (scope !== 'primary') groups.push([plan.backup, 1]);
      for (const [indexers, phase] of groups) {
        for (const indexer of indexers) {
          if (params.idSearch && !supports(indexer)) continue;
          // Fewer requests to the primary indexer (some are rate-limited): if it can search by
          // IMDb/TVDB ID, it gets the ID search first and the text search only if that finds nothing
          // good (same moment the backups are asked). New titles often aren't matched by ID yet.
          const deferred = params.textFallback && phase === 0 && hasIdSearch && supports(indexer);
          out.push({ ...params, indexers: [indexer.id], phase: deferred ? 1 : phase });
        }
      }
    }
    return out.length ? out : list.map(params => ({ ...params, phase: 0 }));
  }

  // Runs the primary searches (phase 0) right away and the backup searches (phase 1) only when the
  // primary results aren't good enough after backupAfterMs, or every primary search has answered.
  // Finishes shortly after results are good enough, settleMs after the first results of the current
  // phase, or when everything has answered. Late answers still fill the cache for next time.
  async function runSearches(list, { goodEnough = null, graceMs = 700 } = {}) {
    if (!list.length) return [];
    let primary = list.filter(params => !params.phase);
    let backup = list.filter(params => params.phase === 1);
    if (!primary.length) { primary = backup; backup = []; }

    const collected = [];
    const errors = [];
    let launched = 0;
    let answered = 0;

    await new Promise(resolve => {
      let done = false;
      let good = false;
      let backupStarted = false;
      let graceTimer = null;
      let settleTimer = null;
      let backupTimer = null;

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(graceTimer);
        clearTimeout(settleTimer);
        clearTimeout(backupTimer);
        clearTimeout(hardTimer);
        resolve();
      };
      const hardTimer = setTimeout(finish, timeoutMs + backupAfterMs + 1000);

      const startBackup = () => {
        if (done || backupStarted || good) return;
        backupStarted = true;
        clearTimeout(backupTimer);
        if (!backup.length) {
          if (answered === launched) finish();
          return;
        }
        clearTimeout(settleTimer); // give the backup its own settle window
        settleTimer = null;
        backup.forEach(launch);
      };

      function launch(params) {
        launched += 1;
        search(params)
          .then(value => {
            if (done) return;
            collected.push(...value);
            if (!value.length) return; // an empty answer must not cut off slower indexers
            if (!settleTimer) settleTimer = setTimeout(finish, settleMs);
            if (!good && goodEnough && goodEnough(dedupe(collected))) {
              good = true;
              clearTimeout(backupTimer);
              graceTimer = setTimeout(finish, graceMs);
            }
          }, error => {
            errors.push(error);
          })
          .finally(() => {
            answered += 1;
            if (done || answered < launched) return;
            if (!backupStarted && !good) startBackup();
            else finish();
          });
      }

      primary.forEach(launch);
      backupTimer = setTimeout(startBackup, backupAfterMs);
    });

    if (!collected.length && errors.length && errors.length === launched) {
      const reason = errors[0];
      throw Object.assign(new Error(`Prowlarr search failed: ${reason?.message || 'no search finished in time'}`), { statusCode: reason?.statusCode || 502 });
    }
    return dedupe(collected);
  }

  function searchText(title) {
    return normalizeTitle(title) || String(title || '').trim();
  }

  // English title first for normal shows; for anime the romanised Japanese title(s) come first.
  function searchTitles(media) {
    const list = [...(media.isAnime ? media.romajiTitles || [] : []), media.title];
    return [...new Set(list.map(searchText).filter(Boolean))].slice(0, 3);
  }

  const seeded = (candidate, min) => Number(candidate.release.seeders || 0) >= min;

  async function findMovie(media, options = {}) {
    requireConfigured();
    const anime = Boolean(media.isAnime);
    const rankOptions = { ...config, ...options, anime };
    const ids = [];
    if (media.imdbId) ids.push(`{ImdbId:${media.imdbId}}`);
    if (media.id) ids.push(`{TmdbId:${media.id}}`);
    const searches = [];
    if (ids.length) searches.push({ query: ids.join(''), type: 'movie', categories: [2000], idSearch: true });
    searches.push({ query: [searchText(media.title), media.year].filter(Boolean).join(' '), type: 'search', categories: anime ? [] : [2000], textFallback: true });
    if (anime) {
      // Anime movies are usually named by their romanised title without a year, and Nyaa files them as anime.
      for (const title of searchTitles(media)) searches.push({ query: title, type: 'search', categories: [] });
    }
    const planned = await planSearches(searches, anime ? 'anime-movie' : 'movie');
    const results = await runSearches(planned, {
      goodEnough: found => rankMovieReleases(found, media, rankOptions).accepted.some(candidate => seeded(candidate, 10))
    });
    return { total: results.length, ...rankMovieReleases(results, media, rankOptions) };
  }

  async function findEpisode(media, season, episode, options = {}) {
    requireConfigured();
    const anime = Boolean(media.isAnime);
    const absolute = anime ? absoluteEpisodeNumber(media, season, episode) : null;
    const rankOptions = { ...config, ...options, anime, absolute };
    const kind = anime ? 'anime-tv' : 'tv';
    const ids = [];
    if (media.imdbId) ids.push(`{ImdbId:${media.imdbId}}`);
    if (media.tvdbId) ids.push(`{TvdbId:${media.tvdbId}}`);
    const titles = searchTitles(media);
    const title = searchText(media.title);
    const se = `S${pad2(season)}E${pad2(episode)}`;
    const goodEnough = found => {
      const { accepted } = rankEpisodeReleases(found, media, season, episode, rankOptions);
      return accepted.some(candidate => candidate.coverage === 'episode' && seeded(candidate, 3))
        || accepted.filter(candidate => seeded(candidate, 10)).length >= 2;
    };

    // Pass 1: ID search plus text searches without a category filter (several indexers file TV
    // under "Other" or nothing).
    const first = [];
    if (ids.length) first.push({ query: `${ids.join('')}{Season:${season}}{Episode:${episode}}`, type: 'tvsearch', categories: [5000], idSearch: true });
    if (anime) {
      // Anime groups name episodes "Title - 12" (often counted from the first season).
      for (const name of titles.slice(0, 2)) {
        first.push({ query: `${name} ${pad2(episode)}`, type: 'search', categories: [] });
        if (absolute !== Number(episode)) first.push({ query: `${name} ${absolute}`, type: 'search', categories: [] });
      }
      first.push({ query: `${title} ${se}`, type: 'search', categories: [], scope: 'backup' });
    } else {
      first.push({ query: `${title} ${se}`, type: 'search', categories: [], textFallback: true });
      if (config.seasonPacks !== false) first.push({ query: `${title} S${pad2(season)}`, type: 'search', categories: [], scope: 'backup' });
    }

    let results = [];
    let firstError = null;
    try {
      results = await runSearches(await planSearches(first, kind), { goodEnough });
    } catch (error) {
      firstError = error;
    }
    let ranked = rankEpisodeReleases(results, media, season, episode, rankOptions);

    // Pass 2: still nothing usable. Bare titles catch packs and batches ("Season 1", "Complete", "01-28").
    if (!ranked.accepted.length) {
      const second = titles.map(name => ({ query: name, type: 'search', categories: [] }));
      second.push({ query: `${title} season ${season}`, type: 'search', categories: [] });
      if (anime) second.push({ query: `${title} S${pad2(season)}`, type: 'search', categories: [] });
      else if (media.year) second.push({ query: `${title} ${media.year}`, type: 'search', categories: [] });
      try {
        const more = await runSearches(await planSearches(second, kind), { goodEnough });
        results = dedupe([...results, ...more]);
        ranked = rankEpisodeReleases(results, media, season, episode, rankOptions);
      } catch (error) {
        if (firstError) throw firstError;
      }
    }

    return { total: results.length, ...ranked };
  }

  async function fetchDownload(link, hops = 0) {
    const target = new URL(link);
    const headers = { accept: '*/*', 'user-agent': userAgent };
    if (target.origin === baseOrigin) headers['X-Api-Key'] = apiKey;

    const doFetch = target.origin === baseOrigin ? fetch : externalFetch;
    return withTimeout(downloadTimeoutMs, async signal => {
      const response = await doFetch(target, { redirect: 'manual', headers, signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Redirect without a location (HTTP ${response.status}).`);
        if (/^magnet:/i.test(location)) return { magnet: withTrackers(location) };
        if (hops >= 5) throw new Error('Too many redirects while resolving the download link.');
        return fetchDownload(new URL(location, target).href, hops + 1);
      }
      if (!response.ok) throw new Error(`Download link returned HTTP ${response.status}.`);
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > maxTorrentBytes) throw new Error('Torrent file is too large.');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxTorrentBytes) throw new Error('Torrent file is too large.');
      const head = buffer.subarray(0, 16).toString('latin1');
      if (/^magnet:/i.test(head)) return { magnet: withTrackers(buffer.toString('utf8').trim()) };
      if (head.startsWith('d') && buffer.includes('4:info')) return { torrent: buffer };
      throw new Error('Download link did not return a torrent file or magnet.');
    });
  }

  async function resolveLink(release) {
    const links = [release?.magnetUrl, release?.downloadUrl].filter(link => typeof link === 'string' && link);
    const direct = links.find(link => /^magnet:/i.test(link));
    if (direct) return { magnet: withTrackers(direct) };

    // An info hash is instant; fetching through Prowlarr's download proxy can take a while.
    const hash = normalizeInfoHash(release?.infoHash);
    if (hash) return { magnet: buildMagnet(hash, release.title) };

    let lastError = null;
    for (const link of links) {
      if (!/^https?:\/\//i.test(link)) continue;
      try {
        return await fetchDownload(link);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Release has no usable magnet, torrent file or info hash.');
  }

  async function api(method, pathname, body, query = {}) {
    requireConfigured();
    const url = new URL(`${baseUrl}${pathname}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    return withTimeout(timeoutMs, async signal => {
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-Api-Key': apiKey,
          'user-agent': userAgent
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!response.ok) {
        const reason = Array.isArray(data)
          ? data.map(item => item?.errorMessage || item?.message).filter(Boolean).join('; ')
          : (data?.message || data?.error);
        throw new Error(reason || `Prowlarr API returned HTTP ${response.status}`);
      }
      return data;
    });
  }

  // Creates or updates an HTTP/SOCKS indexer proxy in Prowlarr. With no tag it applies to every indexer.
  async function syncIndexerProxy(proxy, { name = 'Direct Player proxy', tag = '' } = {}) {
    const implementation = { http: 'Http', https: 'Http', socks4: 'Socks4', socks5: 'Socks5' }[proxy.protocol];
    if (!implementation) throw new Error(`Prowlarr does not support ${proxy.protocol} proxies.`);

    const schemas = await api('GET', '/api/v1/indexerproxy/schema');
    const template = (Array.isArray(schemas) ? schemas : [])
      .find(item => String(item.implementation).toLowerCase() === implementation.toLowerCase());
    if (!template) throw new Error(`This Prowlarr version has no ${implementation} proxy type.`);

    let tags = [];
    const label = String(tag || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (label) {
      const existingTags = await api('GET', '/api/v1/tag');
      let found = (existingTags || []).find(item => String(item.label).toLowerCase() === label);
      if (!found) found = await api('POST', '/api/v1/tag', { label });
      tags = [found.id];
    }

    const values = {
      host: proxy.host,
      hostname: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password
    };
    const fields = (template.fields || []).map(field => {
      const key = String(field.name || '').toLowerCase();
      return Object.prototype.hasOwnProperty.call(values, key) ? { ...field, value: values[key] } : field;
    });

    const current = (await api('GET', '/api/v1/indexerproxy') || []).find(item => item.name === name);
    const body = { ...template, name, fields, tags };
    delete body.presets;

    if (current) {
      await api('PUT', `/api/v1/indexerproxy/${current.id}`, { ...body, id: current.id }, { forceSave: true });
      return { action: 'updated', implementation, tags };
    }
    await api('POST', '/api/v1/indexerproxy', body, { forceSave: true });
    return { action: 'created', implementation, tags };
  }

  return { configured, baseUrl, search, findMovie, findEpisode, resolveLink, syncIndexerProxy };
}
