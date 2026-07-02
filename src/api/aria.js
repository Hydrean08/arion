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
  const { aria, apiKey } = await getConfig();
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['X-API-Key'] = apiKey;
  const options = { method, headers: h, timeout: opts.timeout };
  if (body) options.body = JSON.stringify(body);

  const r = await fetchWithRetry(aria + path, options);

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

  if (method === 'GET' && !opts.skipCache) {
    setLastKnown('aria', path, data);
  }
  return data;
}

export { ApiError };
export const aria = {
  // Returns { ok, checks: { cycle: { status, age_seconds, interval },
  // db: { status }, ollama: { status } } }. Always uncached — staleness
  // here defeats the purpose. 503 is a valid response shape ("degraded")
  // — accept it so the UI can render the structured body instead of
  // treating it as a network error.
  health:          ()                              => req('/health', 'GET', null, { skipCache: true, acceptedStatuses: [503] }),
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
  // `types` (optional array like ['album','ep','single']) scopes the bulk
  // action to those release types — used by the Download Discography picker.
  setAllWanted:    (artistId, wanted, types)       => {
    const q = types && types.length ? `&types=${encodeURIComponent(types.join(','))}` : '';
    return req(`/api/artists/${artistId}/albums/wanted?wanted=${wanted}${q}`, 'PATCH');
  },
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
  // Live download activity feed → { active, items: [{ id, kind, artist,
  // album, title, source, state, error, at }] }. Uncached so progress is
  // always fresh while a download is in flight.
  downloads:          ()                              => req('/api/downloads', 'GET', null, { skipCache: true }),

  runCycle:        ()                              => req('/api/cycle/run', 'POST'),
  // Walks MUSIC_DIR + marks already-on-disk albums complete. Returns
  // { scanned_artists, matched_albums, unmatched_dirs }.
  scanExisting:    ()                              => req('/api/scan-existing', 'POST'),

  // ── AI (GLM-4 powered) ────────────────────────────────────────────────
  aiSuggestions:   ()                              => req('/api/ai-suggestions'),
  dismissSuggestion: (id)                          => req(`/api/ai-suggestions/${id}`, 'DELETE'),
  aiPlaylists:     ()                              => req('/api/ai-playlists'),
  deletePlaylist:  (id)                            => req(`/api/ai-playlists/${id}`, 'DELETE'),
  generatePlaylist:    ()                          => req('/api/ai-playlists/generate', 'POST'),
  generateMoodPlaylist: (mood)                     => req('/api/ai-playlists/mood', 'POST', { mood }),
  aiReleases:      ()                              => req('/api/ai-releases'),
  dismissRelease:  (id)                            => req(`/api/ai-releases/${id}`, 'DELETE'),
  refreshReleases: ()                              => req('/api/ai-releases/refresh', 'POST'),
  aiDigest:        ()                              => req('/api/ai-digest', 'GET', null, { skipCache: true }),
  lyricSearch:     (query)                         => req('/api/ai-lyric-search', 'POST', { query }),
  autoGenres:      (artistId)                      => req(`/api/artists/${artistId}/auto-genres`, 'POST'),
};
