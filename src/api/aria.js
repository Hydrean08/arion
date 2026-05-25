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
  const { aria, apiKey } = await getConfig();
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['X-API-Key'] = apiKey;
  const options = { method, headers: h, timeout: opts.timeout };
  if (body) options.body = JSON.stringify(body);

  const r = await fetchWithRetry(aria + path, options);

  if (!r.ok) {
    const text = await r.text().catch(() => 'Unknown error');
    throw new ApiError(text.slice(0, 200), r.status, false);
  }
  if (r.status === 204) return null;
  const data = await r.json();

  if (method === 'GET' && !opts.skipCache) {
    setLastKnown('aria', { path, data, at: Date.now() });
  }
  return data;
}

export { ApiError };
export const aria = {
  stats:           ()                              => req('/api/stats'),
  logs:            ()                              => req('/api/logs'),
  charts:          ()                              => req('/api/charts'),
  genreCharts:     ()                              => req('/api/charts/genres'),
  recent:          ()                              => req('/api/recent'),
  discover:        ()                              => req('/api/discover'),
  searchArtists:   (q)                             => req(`/api/search/artists?q=${encodeURIComponent(q)}`),

  artists:         ()                              => req('/api/artists'),
  addArtist:       (name)                          => req('/api/artists', 'POST', { name }),
  removeArtist:    (id)                            => req(`/api/artists/${id}`, 'DELETE'),
  syncArtist:      (id)                            => req(`/api/artists/${id}/sync`, 'POST'),
  setMonitored:    (id, monitored)                 => req(`/api/artists/${id}/monitor?monitored=${monitored}`, 'PATCH'),

  albums:          (artistId)                      => req(`/api/artists/${artistId}/albums`),
  albumsByStatus:  (status)                        => req(`/api/albums?status=${encodeURIComponent(status)}`),
  addAlbum:        (artistId, title, year)         => req(`/api/artists/${artistId}/albums`, 'POST', { title, year }),
  setAlbumWanted:  (albumId, wanted)               => req(`/api/albums/${albumId}/wanted?wanted=${wanted}`, 'PATCH'),
  setAllWanted:    (artistId, wanted)              => req(`/api/artists/${artistId}/albums/wanted?wanted=${wanted}`, 'PATCH'),
  retryAlbum:      (albumId)                       => req(`/api/albums/${albumId}/retry`, 'POST'),
  albumTracks:     (albumId)                       => req(`/api/albums/${albumId}/tracks`),

  topTracks:          (artistId)                      => req(`/api/artists/${artistId}/top-tracks`),
  relatedArtists:     (artistId)                      => req(`/api/artists/${artistId}/related`),
  spotifyTopTracks:   (spotifyId)                     => req(`/api/spotify/${spotifyId}/top-tracks`),
  spotifyRelated:     (spotifyId)                     => req(`/api/spotify/${spotifyId}/related`),
  spotifyAlbums:      (spotifyId)                     => req(`/api/spotify/${spotifyId}/albums`),
  spotifyAlbumTracks: (spotifyAlbumId)                => req(`/api/spotify/album/${spotifyAlbumId}/tracks`),
  downloadTrack:      (trackId, title, artist, album, year) =>
    req('/api/tracks/download', 'POST', { track_id: trackId, title, artist, album, year }),

  runCycle:        ()                              => req('/api/cycle/run', 'POST'),
};
