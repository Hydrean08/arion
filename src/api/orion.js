import { getConfig, setLastKnown } from './config';

const DEFAULT_TIMEOUT = 12000;
const MAX_RETRIES = 1;

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
  const started = Date.now();

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - started;
    const detail = `URL: ${url}\nElapsed: ${elapsed}ms\nName: ${err?.name}\nMessage: ${err?.message}`;
    const isOffline = !navigator?.onLine || err.name === 'AbortError' || err.message?.includes('Network');
    if (retries > 0) {
      await sleep(1000 * (MAX_RETRIES - retries + 1));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw new ApiError(detail, 0, isOffline);
  }
}

async function req(path, method = 'GET', body = null, opts = {}) {
  const { orion, apiKey } = await getConfig();
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['X-API-Key'] = apiKey;
  const options = { method, headers: h, timeout: opts.timeout };
  if (body) options.body = JSON.stringify(body);

  const r = await fetchWithRetry(orion + path, options);

  // opts.acceptedStatuses lets a caller treat specific error codes as
  // "service responded with a structured body" rather than a thrown error.
  // /health uses this so a 503 (degraded) is parsed and displayed instead
  // of bubbled up as a raw error string in the UI.
  const accepted = opts.acceptedStatuses ?? [];
  if (!r.ok && !accepted.includes(r.status)) {
    const text = await r.text().catch(() => 'Unknown error');
    throw new ApiError(text.slice(0, 200), r.status, false);
  }
  if (r.status === 204) return null;
  const data = await r.json();

  // Cache successful GETs for offline resilience
  if (method === 'GET' && !opts.skipCache) {
    setLastKnown('orion', path, data);
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

  // Returns { ok, checks: { cycle: { status, age_seconds, poll_interval },
  // predictor_db: { status, feature_kinds }, tmdb_cache: { entries, ttl_seconds } } }.
  // Always uncached — staleness here would defeat the entire purpose.
  // 503 is a valid response shape ("degraded") — accept it so the UI can
  // render the structured body instead of treating it as a network error.
  health: () => req('/health', 'GET', null, { skipCache: true, acceptedStatuses: [503] }),

  // Predictor diagnostics: top dead-rate features (release groups, hashes,
  // CDN hosts). Useful for "why isn't this episode resolving" debugging.
  predictorDiag: (minSamples = 1, limit = 20) =>
    req(`/api/diag/failure-predictor?min_samples=${minSamples}&limit=${limit}`),
};
