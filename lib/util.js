// Small helpers shared by the server and the views.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapes text for HTML (element content and quoted attributes).
export function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);
}

export function slugify(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'title';
}

// "/movies/obsession-2026-175943" -> 175943 (the TMDB id is always the last number).
export function idFromSlug(value) {
  const match = /(?:^|-)(\d{1,10})$/.exec(String(value || ''));
  return match ? Number(match[1]) : null;
}

export function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!(n > 0)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value >= 100 || unit < 2 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function formatRuntime(minutes) {
  const m = Number(minutes || 0);
  if (!(m > 0)) return '';
  const hours = Math.floor(m / 60);
  return hours ? `${hours}h ${m % 60}m` : `${m}m`;
}

// A Map with per-entry expiry and a size cap (oldest entries go first).
export class TtlCache {
  constructor(max = 1000) {
    this.max = max;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttlMs) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    return value;
  }
}

// Runs producer once per key at a time and caches the result. Failures are not cached.
export function memoize(cache, ttlMs) {
  const pending = new Map();
  return async (key, producer) => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const value = await producer();
      const ttl = typeof ttlMs === 'function' ? ttlMs(value) : ttlMs;
      if (ttl > 0) cache.set(key, value, ttl);
      return value;
    })();
    pending.set(key, task);
    try {
      return await task;
    } finally {
      pending.delete(key);
    }
  };
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    const key = part.slice(0, at).trim();
    try { out[key] = decodeURIComponent(part.slice(at + 1).trim()); } catch { out[key] = part.slice(at + 1).trim(); }
  }
  return out;
}

export const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
