import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Image, RefreshControl, Alert, AppState, ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme';
import { aria, ApiError } from '../../api/aria';
import { getLastKnown } from '../../api/config';
import { SkeletonArtistList } from '../../components/Skeleton';
import { AriaHealthIndicator } from '../../components/AriaHealthIndicator';
import AriaAITab from './AriaAITab';

const LOG_LEVEL_COLOR = { error: colors.red, warn: colors.yellow, info: colors.accent2 };

const FILTER_TO_STATUS = {
  done:    'complete',
  partial: 'partial',
  pending: 'pending',   // pseudo-status on the backend: wanted + monitored + missing
  active:  'downloading',
  failed:  'error',
};

// Human labels for the active-filter header, so the album sub-view names itself.
const FILTER_LABEL = {
  done: 'Done', partial: 'Partial', pending: 'Pending', active: 'Active', failed: 'Failed',
};

// Break a library artist's releases into "12 albums · 2 EPs · 65 singles",
// omitting zero types — so the list stops calling 65 singles "albums". Falls
// back to the old N/total count when the per-type fields aren't present.
function releaseSummary(item) {
  const nA = item.n_albums ?? 0, nE = item.n_eps ?? 0, nS = item.n_singles ?? 0;
  if (nA + nE + nS === 0) {
    return `${item.album_done ?? 0}/${item.album_total ?? 0} releases`;
  }
  const parts = [];
  if (nA) parts.push(`${nA} album${nA === 1 ? '' : 's'}`);
  if (nE) parts.push(`${nE} EP${nE === 1 ? '' : 's'}`);
  if (nS) parts.push(`${nS} single${nS === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export default function MusicHomeScreen() {
  const navigation = useNavigation();
  const [tab,             setTab]             = useState('artists');
  const [stats,           setStats]           = useState(null);
  const [myArtists,       setMyArtists]       = useState([]);
  const [logs,            setLogs]            = useState([]);
  const [logFilter,       setLogFilter]       = useState('all');
  const [albumFilter,     setAlbumFilter]     = useState(null);
  const [filteredAlbums,  setFilteredAlbums]  = useState([]);
  const [loadingAlbums,   setLoadingAlbums]   = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [error,           setError]           = useState(null);
  const [offline,         setOffline]         = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const [s, a, l] = await Promise.all([
        aria.stats().catch(() => null),
        aria.artists().catch(() => []),
        aria.logs().catch(() => []),
      ]);
      setStats(s);
      setMyArtists(a);
      setLogs(l);
    } catch (e) {
      if (e instanceof ApiError && e.isOffline) {
        setOffline(true);
        const cached = getLastKnown('aria');
        if (cached) {
          const { path, data } = cached;
          if (path === '/api/artists' && Array.isArray(data)) setMyArtists(data);
          else if (path === '/api/stats' && data) setStats(data);
          else if (path === '/api/logs' && Array.isArray(data)) setLogs(data);
        }
      } else {
        setError(e.message || 'Failed to load music library');
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    intervalRef.current = setInterval(() => {
      if (AppState.currentState === 'active') load(true);
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [load]));

  useEffect(() => {
    if (!albumFilter) { setFilteredAlbums([]); return; }
    setLoadingAlbums(true);
    aria.albumsByStatus(FILTER_TO_STATUS[albumFilter])
      .then(setFilteredAlbums)
      .catch(() => setFilteredAlbums([]))
      .finally(() => setLoadingAlbums(false));
  }, [albumFilter]);

  const openArtist = useCallback((artistId) => {
    const artist = myArtists.find(a => a.id === artistId);
    if (artist) navigation.navigate('ArtistDetail', { artist });
  }, [navigation, myArtists]);

  const deleteArtist = useCallback((artist) => {
    Alert.alert(
      'Remove Artist',
      `Remove ${artist.name} and stop monitoring their releases?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await aria.removeArtist(artist.id);
              setMyArtists(prev => prev.filter(a => a.id !== artist.id));
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  }, []);

  const retryAlbum = useCallback(async (albumId) => {
    try {
      await aria.retryAlbum(albumId);
      const updated = await aria.albumsByStatus(FILTER_TO_STATUS[albumFilter]);
      setFilteredAlbums(updated);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, [albumFilter]);

  // Switching tabs clears any active album filter so the status pills (which
  // belong to My Artists) never leak their selection into the AI/Logs tabs.
  const selectTab = (t) => { setTab(t); setAlbumFilter(null); };

  if (loading) return <SkeletonArtistList showStats />;

  const showAlbumList = tab === 'artists' && albumFilter !== null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {offline && (
        <View style={styles.bannerOffline}>
          <Text style={styles.bannerText}>⚠ Aria is unreachable. Showing last known data.</Text>
        </View>
      )}
      {error && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)} style={styles.bannerRetry}>
            <Text style={styles.bannerRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Library status filters — belong to My Artists only, so they don't
          bleed into the AI/Logs tabs. Tapping one filters the album list. */}
      {stats && tab === 'artists' && (
        <View style={styles.statsRow}>
          <StatPill label="Done"    value={stats.complete}    active={albumFilter === 'done'}    onPress={() => setAlbumFilter(f => f === 'done'    ? null : 'done')} />
          <StatPill label="Partial" value={stats.partial}     active={albumFilter === 'partial'} onPress={() => setAlbumFilter(f => f === 'partial' ? null : 'partial')} warn />
          <StatPill label="Pending" value={stats.pending}     active={albumFilter === 'pending'} onPress={() => setAlbumFilter(f => f === 'pending' ? null : 'pending')} warn />
          <StatPill label="Active"  value={stats.downloading} active={albumFilter === 'active'}  onPress={() => setAlbumFilter(f => f === 'active'  ? null : 'active')} />
          <StatPill label="Failed"  value={stats.error}       active={albumFilter === 'failed'}  onPress={() => setAlbumFilter(f => f === 'failed'  ? null : 'failed')} err />
        </View>
      )}

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'artists' && styles.tabPillActive]}
          onPress={() => selectTab('artists')}
        >
          <Text style={[styles.tabPillText, tab === 'artists' && styles.tabPillTextActive]}>My Artists</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'ai' && styles.tabPillActive]}
          onPress={() => selectTab('ai')}
        >
          <Text style={[styles.tabPillText, tab === 'ai' && styles.tabPillTextActive]}>AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'logs' && styles.tabPillActive]}
          onPress={() => selectTab('logs')}
        >
          <Text style={[styles.tabPillText, tab === 'logs' && styles.tabPillTextActive]}>Logs</Text>
        </TouchableOpacity>
        {/* Mirrors the dot on Library (Orion side). Green = cycle healthy,
            amber = warming/stale, red = unreachable. */}
        <View style={{ marginLeft: 'auto' }}>
          <AriaHealthIndicator compact />
        </View>
      </View>

      {tab === 'artists' ? (
        showAlbumList ? (
          <>
            <View style={styles.filterHeader}>
              <Text style={styles.filterHeaderText}>
                {FILTER_LABEL[albumFilter]}
                {!loadingAlbums ? ` · ${filteredAlbums.length} ${filteredAlbums.length === 1 ? 'album' : 'albums'}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setAlbumFilter(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear filter"
              >
                <Text style={styles.filterHeaderClear}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
            {loadingAlbums
              ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
              : <FlashList
                  data={filteredAlbums}
                  estimatedItemSize={68}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.listContent}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
                  ListEmptyComponent={<Text style={styles.empty}>No albums with this status.</Text>}
                  renderItem={({ item }) => (
                    <AlbumRow
                      album={item}
                      onPress={() => openArtist(item.artist_id)}
                      onRetry={albumFilter === 'failed' || albumFilter === 'partial' ? retryAlbum : null}
                    />
                  )}
                />}
          </>
        ) : (
          <FlashList
            data={myArtists}
            estimatedItemSize={72}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
            ListEmptyComponent={
              <Text style={styles.empty}>No artists yet.{'\n'}Search in the Discover tab to add some.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.artistRow} onPress={() => openArtist(item.id)} activeOpacity={0.8}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={styles.artistThumb} />
                  : <View style={[styles.artistThumb, styles.artistThumbFallback]}><Text style={styles.artistEmoji}>♪</Text></View>
                }
                <View style={styles.artistInfo}>
                  <Text style={styles.artistName}>{item.name}</Text>
                  <Text style={styles.artistMeta}>
                    {releaseSummary(item)}
                    {item.monitored ? '' : ' · unmonitored'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteArtist(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )
      ) : tab === 'ai' ? (
        <AriaAITab />
      ) : (
        <>
          <View style={styles.logFilterRow}>
            {['all', 'info', 'warn', 'error'].map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.logFilterPill, logFilter === level && styles.logFilterPillActive]}
                onPress={() => setLogFilter(level)}
              >
                <Text style={[styles.logFilterText, logFilter === level && styles.logFilterTextActive]}>
                  {level.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlashList
            data={logFilter === 'all' ? logs : logs.filter(l => l.level?.toLowerCase() === logFilter)}
            estimatedItemSize={64}
            keyExtractor={(item, i) => item.at ?? String(i)}
            contentContainerStyle={styles.logsContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
            ListEmptyComponent={<Text style={styles.empty}>No logs yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.logRow}>
                <Text style={[styles.logLevel, { color: LOG_LEVEL_COLOR[item.level] ?? colors.muted }]}>
                  {item.level?.toUpperCase()}
                </Text>
                <View style={styles.logBody}>
                  <Text style={styles.logMsg} numberOfLines={3}>{item.message}</Text>
                  <Text style={styles.logAt}>{item.at}</Text>
                </View>
              </View>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function AlbumRow({ album, onPress, onRetry }) {
  return (
    <TouchableOpacity style={styles.albumRow} onPress={onPress} activeOpacity={0.8}>
      {album.cover_url
        ? <Image source={{ uri: album.cover_url }} style={styles.albumCover} />
        : <View style={[styles.albumCover, styles.albumCoverFallback]}><Text style={styles.albumEmoji}>♫</Text></View>
      }
      <View style={styles.albumInfo}>
        <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
        <Text style={styles.albumArtist} numberOfLines={1}>{album.artist_name}</Text>
        {album.year ? <Text style={styles.albumMeta}>{album.year}{album.record_type !== 'album' ? ` · ${album.record_type}` : ''}</Text> : null}
        {album.error ? <Text style={styles.albumError} numberOfLines={2}>{album.error}</Text> : null}
      </View>
      {onRetry && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => onRetry(album.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retry album"
        >
          <Text style={styles.retryBtnText}>↺</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function StatPill({ label, value, warn, err, onPress, active }) {
  const valueColor = active ? '#fff' : err ? colors.red : warn ? colors.yellow : colors.accent2;
  return (
    <TouchableOpacity
      style={[styles.stat, active && styles.statActive]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <Text style={[styles.statNum, { color: valueColor }]}>{value ?? '—'}</Text>
      <Text style={[styles.statLabel, active && styles.statLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: colors.bg },
  bannerOffline:     { backgroundColor: '#2d2a00', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bannerError:       { backgroundColor: '#3d1515', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerText:        { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  bannerRetry:       { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  bannerRetryText:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  statsRow:          { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, gap: 8 },
  stat:              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center', flex: 1, minWidth: 52 },
  statActive:        { backgroundColor: colors.accent, borderColor: colors.accent },
  statNum:           { fontSize: 18, fontWeight: '700' },
  statLabel:         { fontSize: 9, color: colors.muted, marginTop: 2, textTransform: 'uppercase' },
  statLabelActive:   { color: 'rgba(255,255,255,0.75)' },
  tabRow:            { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, marginBottom: 4, gap: 8 },
  tabPill:           { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabPillActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  tabPillText:       { color: colors.muted, fontSize: 14, fontWeight: '600' },
  tabPillTextActive: { color: '#fff' },
  listContent:       { paddingBottom: 20 },
  empty:             { color: colors.muted, textAlign: 'center', padding: 40, lineHeight: 22 },

  // Header for the filtered album sub-view — makes it read as its own section
  // distinct from the artist list, with a clear way back.
  filterHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginTop: 6, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  filterHeaderText:  { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterHeaderClear: { color: colors.accent2, fontSize: 13, fontWeight: '700' },

  // Artist rows
  artistRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  artistThumb:       { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card },
  artistThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  artistEmoji:       { fontSize: 20, color: colors.muted },
  artistInfo:        { flex: 1 },
  artistName:        { fontSize: 14, fontWeight: '600', color: colors.text },
  artistMeta:        { fontSize: 11, color: colors.muted, marginTop: 2 },
  deleteBtn:         { paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtnText:     { color: colors.muted, fontSize: 16, fontWeight: '700' },

  // Album rows
  albumRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  albumCover:        { width: 48, height: 48, borderRadius: 6, backgroundColor: colors.card },
  albumCoverFallback:{ alignItems: 'center', justifyContent: 'center' },
  albumEmoji:        { fontSize: 20, color: colors.muted },
  albumInfo:         { flex: 1 },
  albumTitle:        { fontSize: 14, fontWeight: '600', color: colors.text },
  albumArtist:       { fontSize: 12, color: colors.muted, marginTop: 1 },
  albumMeta:         { fontSize: 11, color: colors.muted, marginTop: 1 },
  albumError:        { fontSize: 11, color: colors.red, marginTop: 3, lineHeight: 15 },
  retryBtn:          { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1a2d1a', alignItems: 'center', justifyContent: 'center' },
  retryBtnText:      { color: colors.green, fontSize: 18, fontWeight: '700' },

  logFilterRow:      { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 6, flexWrap: 'wrap' },
  logFilterPill:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  logFilterPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  logFilterText:     { color: colors.muted, fontSize: 13 },
  logFilterTextActive: { color: '#fff' },
  logsContent:       { padding: 12 },
  logRow:            { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  logLevel:          { fontSize: 10, fontWeight: '700', width: 40, paddingTop: 2 },
  logBody:           { flex: 1 },
  logMsg:            { fontSize: 12, color: colors.text, lineHeight: 17 },
  logAt:             { fontSize: 10, color: colors.muted, marginTop: 3 },
});
