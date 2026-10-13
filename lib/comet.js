import { buildMagnet, normalizeInfoHash, infoHashFromMagnet, rankMovieReleases, rankEpisodeReleases } from './prowlarr.js';

// Comet puts the seeder count in the stream text, not in a field: "👤 120" in its default format,
// "Seeders: 120" in the plain one, "S:120" in the compact one. null when it doesn't say.
export function cometSeeders(stream) {
  const text = [stream?.name, stream?.title, stream?.description].filter(value => typeof value === 'string').join('\n');
  const match = /👤\s*([\d,]+)/u.exec(text) || /\bSeeders:\s*([\d,]+)/i.exec(text) || /(?:^|[\s|·•\]])S:\s*(\d+)\b/.exec(text);
  if (!match) return null;
  const seeders = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(seeders) ? seeders : null;
}

// Only the operator supplies this URL; never accept addon URLs from viewer requests.
export function createCometClient(config = {}) {
  const base = String(config.url || '').trim().replace(/\/manifest\.json\/?$/i, '').replace(/\/+$/, '');
  if (base) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
      throw new Error('COMET_URL must be an HTTP(S) addon base or manifest URL without query, fragment or basic credentials.');
    }
  }
  const timeout = Math.max(500, Math.min(30000, Number(config.timeoutMs) || 5000));
  const cacheMs = Math.max(0, Math.min(3600000, Number(config.cacheMs) || 60000));
  const fetcher = config.fetch || fetch;
  const cache = new Map();
  const pending = new Map();
  async function releases(type, media, season, episode) {
    if (!base || !/^tt\d+$/i.test(media.imdbId || '')) return [];
    const id = type === 'movie' ? media.imdbId : `${media.imdbId}:${season}:${episode}`;
    const key = `${type}/${id}`;
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    if (pending.has(key)) return pending.get(key);
    // Bound in-flight unique titles as well as retained cache entries.
    if (pending.size >= 32) throw new Error('Comet search capacity reached');
    const task = (async () => {
      const response = await fetcher(`${base}/stream/${type}/${encodeURIComponent(id)}.json`, {
        signal: AbortSignal.timeout(timeout), redirect: 'error', headers: { accept: 'application/json' }
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Comet HTTP ${response.status}`); }
      let bytes = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) throw new Error('Comet response too large');
        chunks.push(Buffer.from(chunk));
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(data.streams)) throw new Error('Invalid Comet stream response');
      const seen = new Set();
      const value = [];
      for (const stream of data.streams.slice(0, 200)) {
        if (!stream || typeof stream !== 'object') continue;
        const hash = normalizeInfoHash(stream.infoHash) || infoHashFromMagnet(stream.url || '');
        if (!hash || seen.has(hash)) continue;
        const title = String(stream.behaviorHints?.filename || stream.title || stream.description || '').split('\n')[0].trim();
        if (!title) continue;
        seen.add(hash);
        value.push({ title, infoHash: hash, magnetUrl: buildMagnet(hash, title), indexer: 'Comet',
          protocol: 'torrent', imdbId: Number(media.imdbId.slice(2)), seeders: cometSeeders(stream),
          size: Number(stream.behaviorHints?.videoSize) || 0 });
      }
      if (cache.size >= 500) cache.delete(cache.keys().next().value);
      cache.set(key, { until: Date.now() + (value.length ? cacheMs : 5000), value });
      return value;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  return {
    configured: Boolean(base),
    async findMovie(media, options = {}) {
      const rows = await releases('movie', media);
      return { total: rows.length, ...rankMovieReleases(rows, media, { ...config, ...options, anime: media.isAnime }) };
    },
    async findEpisode(media, season, episode, options = {}) {
      const rows = await releases('series', media, season, episode);
      const ranked = rankEpisodeReleases(rows, media, season, episode, { ...config, ...options, anime: media.isAnime });
      // Never promote an unlabeled or wrong episode merely because the addon returned it.
      return { total: rows.length, ...ranked, loose: [] };
    }
  };
}

export function withComet(prowlarr, comet) {
  if (!comet.configured) return prowlarr;
  const search = async (method, args) => {
    const clients = [comet, ...(prowlarr.configured ? [prowlarr] : [])];
    const results = [];
    try {
      return await Promise.any(clients.map(async client => {
        const result = await client[method](...args);
        results.push(result);
        const quality = args.at(-1)?.preferredQuality;
        if (!result.accepted.some(row => !quality || row.info.quality === quality)) throw new Error('No requested-quality results');
        return result;
      }));
    } catch {
      // Both providers settled: retain other qualities for the existing fallback policy.
      if (results.length) return {
        total: results.reduce((n, row) => n + row.total, 0),
        accepted: results.flatMap(row => row.accepted), rejected: results.flatMap(row => row.rejected || []),
        loose: results.flatMap(row => row.loose || [])
      };
      throw new Error('Comet and Prowlarr searches failed; check upstream connectivity.');
    }
  };
  return { ...prowlarr, configured: true,
    findMovie: (...args) => search('findMovie', args),
    findEpisode: (...args) => search('findEpisode', args) };
}
