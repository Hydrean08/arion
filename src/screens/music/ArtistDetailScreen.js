import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, TextInput,
  StyleSheet, ScrollView, Dimensions, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../theme';
import { aria } from '../../api/aria';
import { AlbumCard } from '../../components/AlbumCard';
import { FullSpinner } from '../../components/Spinner';
import AlbumTracksModal from '../../components/AlbumTracksModal';

const W          = Dimensions.get('window').width;
const ALBUM_COLS = Math.floor(W / 160);
const ALBUM_W    = (W - 32 - (ALBUM_COLS - 1) * 10) / ALBUM_COLS;

const DISC_FILTERS = ['All', 'Albums', 'EPs', 'Singles', 'Variants'];
// [record_type, count-key in discCounts] for the Download Discography picker.
const TYPE_ROWS    = [['album', 'Albums'], ['ep', 'EPs'], ['single', 'Singles']];
const TABS         = [
  { key: 'tracks',      label: 'Tracks' },
  { key: 'discography', label: 'Discography' },
  { key: 'related',     label: 'Related' },
];

const isLibraryArtist = (artist) => artist.album_total !== undefined;

export default function ArtistDetailScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { params: { artist } } = useRoute();

  const fromLibrary     = isLibraryArtist(artist);
  const artistSpotifyId = artist.spotify_id;

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [activeTab,    setActiveTab]    = useState('tracks');
  const [topTracks,    setTopTracks]    = useState([]);
  const [albums,       setAlbums]       = useState([]);
  const [related,      setRelated]      = useState([]);
  const [discFilter,   setDiscFilter]   = useState('All');
  const [discSearch,   setDiscSearch]   = useState('');
  const [trackModal,   setTrackModal]   = useState(null);
  const [modalTracks,  setModalTracks]  = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [downloading,  setDownloading]  = useState(new Set());
  const [syncing,      setSyncing]      = useState(false);
  const [following,    setFollowing]    = useState(false);
  const [discModal,    setDiscModal]    = useState(false);
  const [discSel,      setDiscSel]      = useState({ album: true, ep: true, single: true });
  const [discQueuing,  setDiscQueuing]  = useState(false);

  useEffect(() => { setDiscSearch(''); setActiveTab('tracks'); }, [artist.id]);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      if (fromLibrary) {
        const [tracks, albs, rel] = await Promise.all([
          aria.topTracks(artist.id).catch(() => []),
          aria.albums(artist.id).catch(() => []),
          aria.relatedArtists(artist.id).catch(() => []),
        ]);
        setTopTracks(tracks.slice(0, 10));
        setAlbums(albs);
        setRelated(rel.slice(0, 10));
      } else {
        let spotifyId = artistSpotifyId;
        if (!spotifyId) {
          const results = await aria.searchArtists(artist.name).catch(() => []);
          const match = results.find(r =>
            r.name.toLowerCase() === artist.name.toLowerCase()
          ) ?? results[0];
          spotifyId = match?.spotify_id;
        }
        if (spotifyId) {
          const [tracks, albs, rel] = await Promise.all([
            aria.spotifyTopTracks(spotifyId).catch(() => []),
            aria.spotifyAlbums(spotifyId).catch(() => []),
            aria.spotifyRelated(spotifyId).catch(() => []),
          ]);
          setTopTracks(tracks.slice(0, 10));
          setAlbums(albs);
          setRelated(rel.slice(0, 10));
        }
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [artist.id, fromLibrary, artistSpotifyId, artist.name]);

  useEffect(() => { loadData(); }, [artist.id]);

  const typeOf = (a) => a.record_type || a.type;
  const filteredAlbums = albums.filter(a => {
    const t = typeOf(a);
    if (discFilter === 'Variants') { if (!a.is_variant) return false; }
    else {
      if (a.is_variant) return false;   // alternates/remixes/features live under Variants
      if (discFilter === 'Albums'  && t !== 'album')  return false;
      if (discFilter === 'EPs'     && t !== 'ep')     return false;
      if (discFilter === 'Singles' && t !== 'single') return false;
    }
    if (discSearch) return a.title.toLowerCase().includes(discSearch.toLowerCase());
    return true;
  });

  // Counts per release type for the filter pills (monochrome-style "Albums (12)").
  // Primary counts exclude variants; Variants gets its own bucket.
  const primary = albums.filter(a => !a.is_variant);
  const discCounts = {
    All:      primary.length,
    Albums:   primary.filter(a => typeOf(a) === 'album').length,
    EPs:      primary.filter(a => typeOf(a) === 'ep').length,
    Singles:  primary.filter(a => typeOf(a) === 'single').length,
    Variants: albums.filter(a => a.is_variant).length,
  };

  const openAlbum = useCallback(async (album) => {
    setTrackModal(album);
    setModalLoading(true);
    setModalTracks([]);
    try {
      const tracks = album.id
        ? await aria.albumTracks(album.id)
        : await aria.spotifyAlbumTracks(album.spotify_id);
      setModalTracks(tracks);
    } catch {
      setModalTracks([]);
    } finally { setModalLoading(false); }
  }, []);

  const closeModal = useCallback(() => {
    setTrackModal(null);
    setModalTracks([]);
  }, []);

  const downloadTrack = useCallback(async (track) => {
    if (downloading.has(track.id)) return;
    setDownloading(prev => new Set([...prev, track.id]));
    try {
      await aria.downloadTrack(
        track.id, track.title, artist.name,
        track.album || trackModal?.title || '',
        track.year  || trackModal?.year  || '',
      );
      Alert.alert('Queued', `"${track.title}" queued for download.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setDownloading(prev => { const s = new Set(prev); s.delete(track.id); return s; });
    }
  }, [downloading, artist.name, trackModal]);

  const syncArtist = useCallback(async () => {
    setSyncing(true);
    try {
      await aria.syncArtist(artist.id);
      Alert.alert('Synced', 'Artist library refresh queued.');
      loadData(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSyncing(false); }
  }, [artist.id, loadData]);

  const followArtist = useCallback(async () => {
    setFollowing(true);
    try {
      await aria.addArtist(artist.name);
      Alert.alert('Following', `${artist.name} added to your library.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to follow artist.');
    } finally { setFollowing(false); }
  }, [artist.name]);

  const downloadDiscography = useCallback(async () => {
    const types = ['album', 'ep', 'single'].filter(t => discSel[t]);
    if (!types.length) return;
    setDiscQueuing(true);
    try {
      const res = await aria.setAllWanted(artist.id, true, types);
      aria.runCycle().catch(() => {});   // kick a cycle so it starts now, not next hour
      setAlbums(prev => prev.map(a =>
        (!a.is_variant && types.includes(a.record_type || a.type)) ? { ...a, wanted: true } : a));
      setDiscModal(false);
      Alert.alert('Queued', `${res.updated ?? 0} release${res.updated === 1 ? '' : 's'} queued for download.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setDiscQueuing(false); }
  }, [artist.id, discSel]);

  const wantAlbum = useCallback(async (albumId, currentWanted) => {
    const newWanted = !currentWanted;
    setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, wanted: newWanted } : a));
    try {
      await aria.setAlbumWanted(albumId, newWanted);
    } catch (e) {
      setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, wanted: currentWanted } : a));
      Alert.alert('Error', e.message);
    }
  }, []);

  const retryAlbum = useCallback(async (albumId) => {
    try { await aria.retryAlbum(albumId); }
    catch (e) { Alert.alert('Error', e.message); }
  }, []);

  const fabBottom = insets.bottom + 12;

  if (loading) return <FullSpinner />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.inner}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.accent} />
          }
        >
          {/* Hero */}
          <View style={styles.hero}>
            {artist.image_url
              ? <Image source={{ uri: artist.image_url }} style={styles.heroImg} resizeMode="cover" />
              : <View style={[styles.heroImg, styles.heroFallback]}><Text style={styles.heroEmoji}>♪</Text></View>
            }
            <View style={styles.heroFade} />
            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{artist.name}</Text>
              {artist.genres?.length > 0 && (
                <Text style={styles.heroGenres}>{artist.genres.slice(0, 4).join(' · ')}</Text>
              )}
            </View>
          </View>

          {/* Library quick-action: monochrome-style discography picker */}
          {fromLibrary && (
            <TouchableOpacity style={styles.wantAllBtn} onPress={() => setDiscModal(true)}>
              <Text style={styles.wantAllText}>⤓ Download Discography</Text>
            </TouchableOpacity>
          )}

          {/* Tab Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabPill, activeTab === t.key && styles.tabPillActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab: Tracks */}
          {activeTab === 'tracks' && (
            topTracks.length === 0
              ? <Text style={styles.empty}>No tracks available.</Text>
              : topTracks.map((track, i) => (
                  <View key={i} style={styles.trackRow}>
                    <Text style={styles.trackNum}>{i + 1}</Text>
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackName} numberOfLines={1}>{track.title}</Text>
                      {track.album && <Text style={styles.trackAlbum} numberOfLines={1}>{track.album}</Text>}
                    </View>
                    <TouchableOpacity
                      style={[styles.dlBtn, downloading.has(track.id) && styles.dlBtnActive]}
                      onPress={() => downloadTrack(track)}
                      disabled={downloading.has(track.id)}
                    >
                      <Text style={styles.dlBtnText}>{downloading.has(track.id) ? '…' : '↓'}</Text>
                    </TouchableOpacity>
                  </View>
                ))
          )}

          {/* Tab: Discography */}
          {activeTab === 'discography' && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.discSearchInput}
                placeholder="Search albums…"
                placeholderTextColor={colors.muted}
                value={discSearch}
                onChangeText={setDiscSearch}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {DISC_FILTERS.filter(f => f !== 'Variants' || discCounts.Variants > 0).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterPill, discFilter === f && styles.filterPillActive]}
                    onPress={() => setDiscFilter(f)}
                  >
                    <Text style={[styles.filterText, discFilter === f && styles.filterTextActive]}>{f} ({discCounts[f] ?? 0})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {filteredAlbums.length === 0
                ? <Text style={styles.empty}>No releases found.</Text>
                : (
                  <View style={styles.albumGrid}>
                    {filteredAlbums.map((album, i) => (
                      <AlbumCard
                        key={i}
                        album={album}
                        width={ALBUM_W}
                        onPress={() => openAlbum(album)}
                        onWant={fromLibrary && album.status !== 'complete' ? () => wantAlbum(album.id, album.wanted) : undefined}
                        onRetry={album.status === 'error' ? () => retryAlbum(album.id) : undefined}
                      />
                    ))}
                  </View>
                )
              }
            </View>
          )}

          {/* Tab: Related */}
          {activeTab === 'related' && (
            related.length === 0
              ? <Text style={styles.empty}>No related artists found.</Text>
              : (
                <View style={styles.relatedGrid}>
                  {related.map((rel, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.relatedCard}
                      onPress={() => navigation.push('ArtistDetail', { artist: rel })}
                      activeOpacity={0.8}
                    >
                      {rel.image_url
                        ? <Image source={{ uri: rel.image_url }} style={styles.relatedImg} />
                        : <View style={[styles.relatedImg, styles.relatedImgFallback]}><Text style={styles.heroEmoji}>♪</Text></View>
                      }
                      <Text style={styles.relatedName} numberOfLines={2}>{rel.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
          )}

          <View style={{ height: fabBottom + 56 + 12 }} />
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, { bottom: fabBottom }]}
          onPress={fromLibrary ? syncArtist : followArtist}
          disabled={syncing || following}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>
            {fromLibrary
              ? (syncing   ? '…' : '↺  Sync')
              : (following ? '…' : '+ Follow')}
          </Text>
        </TouchableOpacity>
      </View>

      <AlbumTracksModal
        album={trackModal}
        tracks={modalTracks}
        loading={modalLoading}
        downloading={downloading}
        onClose={closeModal}
        onDownload={downloadTrack}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: colors.bg },
  inner:            { flex: 1 },
  hero:             { width: W, height: W * 0.65, position: 'relative' },
  heroImg:          { width: W, height: W * 0.65 },
  heroFallback:     { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  heroEmoji:        { fontSize: 48, color: colors.muted },
  heroFade:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: 'rgba(15,15,19,0.85)' },
  closeBtn:         { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,.6)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  heroInfo:         { position: 'absolute', bottom: 16, left: 16, right: 16 },
  heroName:         { fontSize: 26, fontWeight: '900', color: colors.text, lineHeight: 30 },
  heroGenres:       { fontSize: 12, color: colors.muted, marginTop: 4 },
  // Want All inline button
  wantAllBtn:       { marginHorizontal: 16, marginTop: 14, marginBottom: 4, backgroundColor: '#1e1a3d', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  wantAllText:      { color: colors.accent2, fontWeight: '700', fontSize: 13 },
  // Tab pills
  tabRow:           { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  tabPill:          { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 8 },
  tabPillActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText:          { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive:    { color: '#fff' },
  // Tracks
  trackRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  trackNum:         { color: colors.muted, fontSize: 13, width: 24, textAlign: 'center' },
  trackInfo:        { flex: 1 },
  trackName:        { fontSize: 14, fontWeight: '500', color: colors.text },
  trackAlbum:       { fontSize: 11, color: colors.muted, marginTop: 2 },
  dlBtn:            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dlBtnActive:      { borderColor: colors.accent },
  dlBtnText:        { color: colors.accent, fontSize: 16, fontWeight: '700' },
  // Discography
  discSearchInput:  { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text, fontSize: 14 },
  filterRow:        { paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  filterPill:       { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  filterPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText:       { color: colors.muted, fontSize: 13 },
  filterTextActive: { color: '#fff' },
  albumGrid:        { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  // Related
  relatedGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  relatedCard:      { width: 90, alignItems: 'center', gap: 6 },
  relatedImg:       { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.card },
  relatedImgFallback: { alignItems: 'center', justifyContent: 'center' },
  relatedName:      { fontSize: 11, color: colors.text, textAlign: 'center', fontWeight: '500' },
  // FAB
  fab:              { position: 'absolute', alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 99, paddingHorizontal: 32, paddingVertical: 14, elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  fabText:          { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Shared
  empty:            { color: colors.muted, textAlign: 'center', padding: 40, marginHorizontal: 16 },
});
