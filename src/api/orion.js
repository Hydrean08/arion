import { getConfig, setLastKnown } from './config';

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 2;

class ApiError extends Error {
  constructor(message, status, isOffline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isOffline = isOffline;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    const isOffline = !navigator?.onLine || err.name === 'AbortError' || err.message?.includes('Network');
    if (retries > 0) {
      await sleep(1000 * (MAX_RETRIES - retries + 1));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw new ApiError(err.message, 0, isOffline);
  }
}

async function req(path, method = 'GET', body = null, opts = {}) {
  const { orion, apiKey } = await getConfig();
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['X-API-Key'] = apiKey;
  const options = { method, headers: h, timeout: opts.timeout };
  if (body) options.body = JSON.stringify(body);

  const r = await fetchWithRetry(orion + path, options);

  if (!r.ok) {
    const text = await r.text().catch(() => 'Unknown error');
    throw new ApiError(text.slice(0, 200), r.status, false);
  }
  if (r.status === 204) return null;
  const data = await r.json();

  // Cache successful GETs for offline resilience
  if (method === 'GET' && !opts.skipCache) {
    setLastKnown('orion', { path, data, at: Date.now() });
  }
  return data;
}

export { ApiError };
export const orion = {
  stats:       ()               => req('/api/stats'),
  items:       ()               => req('/api/items'),
  episodes:    (id)             => req(`/api/items/${id}/episodes`),
  addItem:     (item, seasons)   => req('/api/items', 'POST', seasons?.length ? { ...item, seasons } : item),
  retryItem:   (id)             => req(`/api/items/${id}/retry`, 'POST'),
  deleteItem:  (id)             => req(`/api/items/${id}`, 'DELETE'),
  search:      (q, page, type)  => req(`/api/search?q=${encodeURIComponent(q)}&page=${page}${type ? '&type=' + type : ''}`),
  discover:    (category)       => req(`/api/discover?category=${category}`),
  tmdb:        (tmdbId, type)   => req(`/api/tmdb/${tmdbId}?type=${type}`),
  scan:        ()               => req('/api/scan', 'POST'),
  runCycle:    ()               => req('/api/cycle/run', 'POST'),
  logs:        ()               => req('/api/logs'),
  retryEpisode: (itemId, season, episode) =>
    req(`/api/items/${itemId}/episodes/${season}/${episode}/retry`, 'POST'),
  retryAllFailed: () => req('/api/retry/failed', 'POST'),
};
