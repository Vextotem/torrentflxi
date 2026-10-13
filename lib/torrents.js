// Torrent listings for a title: Prowlarr and Comet searched together, merged by info hash, and every
// release described (quality, codec, source, audio, HDR, languages, subtitles, seeders, size, score).
import { createHash, randomBytes } from 'node:crypto';
import { buildMagnet, normalizeInfoHash, parseRelease } from './prowlarr.js';
import { TtlCache, memoize } from './util.js';

const LANGUAGE_TOKENS = [
  ['multi', /\bmulti(?:[ ._-]?(?:lang|audio))?\b/],
  ['dual', /\bdual(?:[ ._-]?audio)?\b/],
  ['en', /\b(?:eng|english)\b/],
  ['es', /\b(?:spa|spanish|esp|espanol|castellano|latino|lat)\b/],
  ['fr', /\b(?:fre|french|vff|vfq|vf2|truefrench|vfi)\b/],
  ['de', /\b(?:ger|german|deutsch)\b/],
  ['it', /\b(?:ita|italian)\b/],
  ['pt', /\b(?:por|portuguese|dublado|ptbr|pt br)\b/],
  ['ru', /\b(?:rus|russian)\b/],
  ['hi', /\b(?:hin|hindi)\b/],
  ['ta', /\b(?:tam|tamil)\b/],
  ['te', /\b(?:tel|telugu)\b/],
  ['ml', /\b(?:mal|malayalam)\b/],
  ['kn', /\bkannada\b/],
  ['bn', /\bbengali\b/],
  ['ko', /\b(?:kor|korean)\b/],
  ['ja', /\b(?:jap|jpn|japanese)\b/],
  ['zh', /\b(?:chi|chinese|mandarin|cantonese)\b/],
  ['ar', /\b(?:ara|arabic)\b/],
  ['tr', /\b(?:tur|turkish)\b/],
  ['pl', /\b(?:pol|polish|lektor)\b/],
  ['nl', /\b(?:dut|dutch)\b/],
  ['uk', /\b(?:ukr|ukrainian)\b/],
  ['th', /\bthai\b/],
  ['vi', /\bvietnamese\b/],
  ['id', /\bindonesian\b/]
];

export function describeRelease(title) {
  const raw = String(title || '');
  // Dots, underscores and hyphens are separators in release names ("WEB-DL", "DTS-HD.MA").
  const lower = raw.toLowerCase().replace(/[._-]+/g, ' ');
  const info = parseRelease(raw);

  let source = null;
  if (info.cam || /\b(?:hdcam|camrip|cam|hdts|telesync|ts|tc|telecine)\b/.test(lower)) source = 'CAM';
  else if (info.remux || /\bremux\b/.test(lower)) source = 'REMUX';
  else if (/\b(?:blu ?ray|bdrip|brrip|bd25|bd50|bluray)\b/.test(lower)) source = 'BluRay';
  else if (/\bweb ?dl\b|\bwebdl\b/.test(lower)) source = 'WEB-DL';
  else if (/\bweb ?rip\b/.test(lower)) source = 'WEBRip';
  else if (/\bweb\b/.test(lower)) source = 'WEB';
  else if (/\bhdtv\b/.test(lower)) source = 'HDTV';
  else if (/\bhdrip\b/.test(lower)) source = 'HDRip';
  else if (/\bdvd ?rip\b|\bdvd\b/.test(lower)) source = 'DVD';

  const audio = [];
  if (/\batmos\b/.test(lower)) audio.push('Atmos');
  if (/\btrue ?hd\b/.test(lower)) audio.push('TrueHD');
  if (/\bdts ?hd\b|\bdts ?ma\b/.test(lower)) audio.push('DTS-HD');
  else if (/\bdts ?x\b/.test(lower)) audio.push('DTS:X');
  else if (/\bdts\b/.test(lower)) audio.push('DTS');
  // Channel counts are often glued on: "DDP5.1", "DD5.1", "AAC2.0".
  if (/\b(?:ddp|dd\+|e ?ac ?3|eac3)(?![a-z])|dd\+/.test(lower)) audio.push('DD+');
  else if (/\b(?:dd|ac3|dolby digital)(?![a-z])/.test(lower)) audio.push('DD');
  if (/\baac(?![a-z])/.test(lower)) audio.push('AAC');
  if (/\bopus\b/.test(lower)) audio.push('Opus');
  if (/\bflac\b/.test(lower)) audio.push('FLAC');
  const channels = /(?:^|[^0-9])([257]) ([01])(?:ch)?(?![0-9])/.exec(lower);

  const languages = LANGUAGE_TOKENS.filter(([, re]) => re.test(lower)).map(([code]) => code);
  const subtitles = /\b(?:e ?subs?|m ?subs?|multi ?subs?|subs?|subbed|vostfr|hardsub|softsub)\b/.test(lower);

  return {
    quality: info.quality,
    codec: info.codec ? { hevc: 'HEVC', h264: 'H.264', av1: 'AV1', xvid: 'XviD' }[info.codec] : null,
    source,
    audio,
    channels: channels ? `${channels[1]}.${channels[2]}` : null,
    hdr: info.hdr || /\bhdr10\+?\b|\bhdr\b/.test(lower),
    dolbyVision: info.dolbyVision,
    tenBit: info.tenBit,
    threeD: info.threeD,
    cam: source === 'CAM',
    languages,
    subtitles
  };
}

// 0-100: what most viewers want — a clean source, sensible size, and a healthy swarm.
export function qualityScore(item) {
  let score = { '2160p': 72, '1080p': 78, '720p': 66, '480p': 40 }[item.quality] ?? 38;
  score += { REMUX: 10, BluRay: 9, 'WEB-DL': 8, WEB: 6, WEBRip: 4, HDTV: 1, HDRip: 0, DVD: -6, CAM: -45 }[item.source] ?? 0;
  if (item.codec === 'XviD') score -= 10;
  if (item.dolbyVision || item.hdr) score += 2;
  if (item.audio.includes('Atmos') || item.audio.includes('TrueHD')) score += 2;
  const seeders = Number(item.seeders);
  if (Number.isFinite(seeders)) score += seeders <= 0 ? -25 : Math.min(14, Math.log10(seeders + 1) * 7) - 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Info hash of a .torrent file: SHA-1 of its bencoded "info" dictionary.
export function torrentInfoHash(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer[0] !== 0x64) return null;
  const skip = at => {
    const c = buffer[at];
    if (c === 0x69) { const end = buffer.indexOf(0x65, at); if (end < 0) throw new Error('bad int'); return end + 1; }
    if (c === 0x6c || c === 0x64) {
      let i = at + 1;
      while (buffer[i] !== 0x65) { if (i >= buffer.length) throw new Error('bad list'); i = skip(i); }
      return i + 1;
    }
    if (c >= 0x30 && c <= 0x39) {
      const colon = buffer.indexOf(0x3a, at);
      if (colon < 0) throw new Error('bad string');
      const length = Number(buffer.subarray(at, colon).toString('latin1'));
      if (!Number.isInteger(length) || length < 0) throw new Error('bad length');
      return colon + 1 + length;
    }
    throw new Error('bad token');
  };
  try {
    let i = 1;
    while (i < buffer.length && buffer[i] !== 0x65) {
      const keyEnd = skip(i);
      const key = buffer.subarray(buffer.indexOf(0x3a, i) + 1, keyEnd).toString('latin1');
      const valueEnd = skip(keyEnd);
      if (key === 'info') return createHash('sha1').update(buffer.subarray(keyEnd, valueEnd)).digest('hex');
      i = valueEnd;
    }
  } catch {}
  return null;
}

export function createTorrentSearch({ prowlarr, comet, prowlarrConfig = {}, fetch: fetchImpl = fetch, logger = console }) {
  const refs = new TtlCache(50000);
  const cached = memoize(new TtlCache(2000), list => (list.length ? 15 : 3) * 60 * 1000);
  const prowlarrOrigin = prowlarrConfig.url ? new URL(prowlarrConfig.url).origin : null;
  const configured = Boolean(prowlarr?.configured || comet?.configured);

  function item(candidate, from) {
    const release = candidate.release || {};
    const infoHash = normalizeInfoHash(release.infoHash) || normalizeInfoHash(candidate.infoHash);
    const described = describeRelease(release.title);
    const ref = randomBytes(9).toString('base64url');
    refs.set(ref, { release, from, infoHash }, 3 * 60 * 60 * 1000);
    const seeders = Number.isFinite(Number(release.seeders)) && release.seeders !== null ? Number(release.seeders) : null;
    const entry = {
      ref,
      title: String(release.title || ''),
      ...described,
      quality: candidate.info?.quality || described.quality,
      coverage: candidate.coverage || null,
      size: Number(release.size || 0) || null,
      seeders,
      leechers: Number.isFinite(Number(release.leechers)) && release.leechers !== null ? Number(release.leechers) : null,
      indexer: String(release.indexer || (from === 'comet' ? 'Comet' : '')),
      published: release.publishDate || null,
      infoHash: infoHash || null,
      magnet: infoHash ? buildMagnet(infoHash, release.title) : null,
      torrentFile: Boolean(from === 'prowlarr' && release.downloadUrl)
    };
    entry.score = qualityScore(entry);
    return entry;
  }

  async function search(client, method, args, from) {
    if (!client?.configured) return [];
    try {
      const result = await client[method](...args);
      return (result.accepted || []).map(candidate => item(candidate, from));
    } catch (error) {
      logger.warn?.(`[torrents] ${from} search failed: ${error.message}`);
      return [];
    }
  }

  // media: TMDB details (lib/tmdb.js details()). season/episode for TV.
  async function list(media, season = null, episode = null) {
    const key = media.type === 'movie' ? `movie:${media.id}` : `tv:${media.id}:${season}:${episode}`;
    return cached(key, async () => {
      const method = media.type === 'movie' ? 'findMovie' : 'findEpisode';
      const args = media.type === 'movie' ? [media] : [media, season, episode];
      const lists = await Promise.all([search(prowlarr, method, args, 'prowlarr'), search(comet, method, args, 'comet')]);
      // Same torrent from several places: keep the one with the most seeders and the most details.
      const byKey = new Map();
      for (const entry of lists.flat()) {
        const id = entry.infoHash || `${entry.title.toLowerCase()}|${entry.size || ''}`;
        const previous = byKey.get(id);
        if (!previous) { byKey.set(id, entry); continue; }
        const best = (entry.seeders ?? -1) > (previous.seeders ?? -1) ? entry : previous;
        byKey.set(id, { ...best, torrentFile: entry.torrentFile || previous.torrentFile, indexer: best.indexer || previous.indexer });
      }
      return [...byKey.values()].sort((a, b) => b.score - a.score || (b.seeders ?? -1) - (a.seeders ?? -1));
    });
  }

  // A magnet for a listed release; releases without an info hash are resolved through Prowlarr.
  async function magnet(ref) {
    const entry = refs.get(String(ref || ''));
    if (!entry) return null;
    if (entry.infoHash) return buildMagnet(entry.infoHash, entry.release.title);
    if (entry.from !== 'prowlarr' || !prowlarr?.configured) return null;
    const link = await prowlarr.resolveLink(entry.release);
    if (link.magnet) return link.magnet;
    const infoHash = torrentInfoHash(link.torrent);
    if (!infoHash) return null;
    entry.infoHash = infoHash;
    return buildMagnet(infoHash, entry.release.title);
  }

  // The .torrent file of a listed Prowlarr release. Prowlarr's link carries its API key, so it is fetched here.
  async function torrentFile(ref, hops = 0, url = null) {
    const entry = refs.get(String(ref || ''));
    if (!entry || entry.from !== 'prowlarr') return null;
    const link = url || entry.release.downloadUrl;
    if (!/^https?:\/\//i.test(String(link || ''))) return null;
    const target = new URL(link);
    const headers = { accept: 'application/x-bittorrent,*/*' };
    if (prowlarrOrigin && target.origin === prowlarrOrigin) headers['X-Api-Key'] = prowlarrConfig.apiKey;
    const response = await fetchImpl(target, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || '';
      if (/^magnet:/i.test(location)) return { magnet: location };
      if (hops >= 4 || !location) return null;
      return torrentFile(ref, hops + 1, new URL(location, target).href);
    }
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) return null;
    if (/^magnet:/i.test(buffer.subarray(0, 8).toString('latin1'))) return { magnet: buffer.toString('utf8').trim() };
    if (buffer[0] !== 0x64 || !buffer.includes('4:info')) return null;
    const name = String(entry.release.title || 'download').replace(/[^\w.() -]+/g, '_').slice(0, 120);
    return { torrent: buffer, filename: `${name}.torrent` };
  }

  return { configured, list, magnet, torrentFile };
}
