import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Dimensions, RefreshControl, Modal, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../theme';
import { orion } from '../../api/orion';
import { StatusBadge } from '../../components/StatusBadge';
import { DiscoverCard } from '../../components/PosterCard';
import { Spinner } from '../../components/Spinner';

const W = Dimensions.get('window').width;

export default function ItemDetailScreen() {
  const navigation = useNavigation();
  const { params: { item } } = useRoute();
  const insets = useSafeAreaInsets();

  const [tmdb,             setTmdb]             = useState(null);
  const [episodes,         setEps]              = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [libraryItem,      setLibraryItem]      = useState(null);
  const [libraryIds,       setLibraryIds]       = useState(new Set());
  const [adding,           setAdding]           = useState(false);
  const [retryingEps,      setRetryingEps]      = useState(new Set());
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [selectedSeasons,  setSelectedSeasons]  = useState(new Set());

  const fabBottom = insets.bottom + 12;

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [all, tmdbData] = await Promise.all([
        orion.items(),
        item.tmdb_id ? orion.tmdb(item.tmdb_id, item.type) : Promise.resolve(null),
      ]);
      const found = all.find(i => i.tmdb_id === item.tmdb_id) ?? null;
      setLibraryItem(found);
      setLibraryIds(new Set(all.filter(i => i.tmdb_id).map(i => i.tmdb_id)));
      setTmdb(tmdbData);

      if (item.type === 'show' && found?.id) {
        const eps = await orion.episodes(found.id);
        setEps(eps);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [item]);

  useEffect(() => { loadData(); }, [loadData]);

  const addToLibrary = useCallback(async (seasons) => {
    setAdding(true);
    try {
      await orion.addItem(item, seasons);
      await loadData();
    } catch {
      Alert.alert('Error', 'Failed to add. Check Orion connection.');
    } finally {
      setAdding(false);
    }
  }, [item, loadData]);

  const handleAddPress = useCallback(() => {
    if (item.type === 'show' && tmdb?.seasons?.length > 0) {
      const all = new Set(tmdb.seasons.map(s => s.season_number));
      setSelectedSeasons(all);
      setShowSeasonPicker(true);
    } else {
      addToLibrary();
    }
  }, [item.type, tmdb?.seasons, addToLibrary]);

  const confirmSeasons = useCallback(() => {
    setShowSeasonPicker(false);
    addToLibrary(selectedSeasons.size > 0 ? [...selectedSeasons] : undefined);
  }, [selectedSeasons, addToLibrary]);

  const toggleSeason = useCallback((num) => {
    setSelectedSeasons(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  }, []);

  const toggleAllSeasons = useCallback(() => {
    if (!tmdb?.seasons) return;
    const all = tmdb.seasons.map(s => s.season_number);
    setSelectedSeasons(prev => prev.size === all.length ? new Set() : new Set(all));
  }, [tmdb?.seasons]);

  const retry = useCallback(async () => {
    if (!libraryItem?.id) return;
    try {
      await orion.retryItem(libraryItem.id);
      Alert.alert('Queued', 'Retry has been queued.');
    } catch (e) { Alert.alert('Error', e.message); }
  }, [libraryItem]);

  const remove = useCallback(() => {
    if (!libraryItem?.id) return;
    Alert.alert('Remove', `Remove "${item.title}" and delete stream files?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await orion.deleteItem(libraryItem.id);
            navigation.goBack();
          } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }, [libraryItem, item, navigation]);

  const retryEpisode = useCallback(async (ep) => {
    if (retryingEps.has(ep.id) || !libraryItem?.id) return;
    setRetryingEps(prev => new Set([...prev, ep.id]));
    try { await orion.retryEpisode(libraryItem.id, ep.season, ep.episode); }
    catch {}
    finally {
      setRetryingEps(prev => { const s = new Set(prev); s.delete(ep.id); return s; });
    }
  }, [retryingEps, libraryItem]);

  const addRec = useCallback(async (rec) => {
    try {
      await orion.addItem(rec);
      setLibraryIds(prev => new Set([...prev, rec.tmdb_id]));
    } catch {}
  }, []);

  const backdrop = tmdb?.backdrop_url;
  const poster   = tmdb?.poster_url ?? item.poster_url;
  const genres   = tmdb?.genres?.slice(0, 4) ?? [];
  const runtime  = tmdb?.runtime;
  const rating   = tmdb?.rating;
  const overview = tmdb?.overview ?? '';
  const recs     = tmdb?.recommendations ?? [];

  const seasonGroups = {};
  episodes.forEach(ep => { (seasonGroups[ep.season] = seasonGroups[ep.season] || []).push(ep); });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Backdrop */}
        <View style={styles.backdropWrap}>
          {backdrop
            ? <Image source={{ uri: backdrop }} style={styles.backdrop} resizeMode="cover" />
            : <View style={styles.backdropFallback} />
          }
          <View style={styles.backdropFade} />
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Header row: poster + info */}
        <View style={styles.headerRow}>
          {poster
            ? <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
            : <View style={[styles.poster, styles.posterFallback]}><Text style={styles.posterEmoji}>🎬</Text></View>
          }
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.metaRow}>
              {item.year ? <Text style={styles.meta}>{item.year}</Text> : null}
              {runtime   ? <Text style={styles.meta}>{Math.floor(runtime / 60)}h {runtime % 60}m</Text> : null}
              {rating    ? <Text style={[styles.meta, styles.rating]}>★ {rating}</Text> : null}
            </View>
            <View style={styles.genreRow}>
              {genres.map(g => <View key={g} style={styles.pill}><Text style={styles.pillText}>{g}</Text></View>)}
            </View>
            {libraryItem?.status ? <StatusBadge status={libraryItem.status} /> : null}
          </View>
        </View>

        {/* Overview */}
        {overview ? <Text style={styles.overview}>{overview}</Text> : null}

        {/* Error */}
        {libraryItem?.last_error ? <Text style={styles.error}>{libraryItem.last_error}</Text> : null}

        {/* Episodes (shows) */}
        {item.type === 'show' && !loading && Object.entries(seasonGroups).map(([s, eps]) => (
          <View key={s} style={styles.season}>
            <Text style={styles.seasonTitle}>Season {s}</Text>
            {eps.map(ep => (
              <View key={ep.id} style={styles.epRow}>
                <Text style={styles.epNum}>E{String(ep.episode).padStart(2, '0')}</Text>
                <Text style={styles.epTitle} numberOfLines={1}>{ep.title || `Episode ${ep.episode}`}</Text>
                <StatusBadge status={ep.status} />
                {ep.status !== 'resolved' && (
                  <TouchableOpacity style={styles.epRetryBtn} onPress={() => retryEpisode(ep)}>
                    <Text style={styles.epRetryText}>{retryingEps.has(ep.id) ? '…' : '↻'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ))}

        {loading && <Spinner style={{ paddingVertical: 30 }} />}

        {/* Recommendations */}
        {recs.length > 0 && (
          <View style={styles.recSection}>
            <Text style={styles.recTitle}>You Might Also Like</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
              {recs.map((rec, i) => (
                <DiscoverCard
                  key={i}
                  item={rec}
                  width={100}
                  onAdd={() => addRec(rec)}
                  added={libraryIds.has(rec.tmdb_id)}
                  onPress={() => navigation.push('ItemDetail', { item: rec })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Spacer so content clears the FAB */}
        <View style={{ height: fabBottom + 56 + 12 }} />
      </ScrollView>

      {/* Floating action bar */}
      <View style={[styles.fabBar, { bottom: fabBottom }]}>
        {libraryItem ? (
          <>
            <TouchableOpacity style={styles.fabRetry} onPress={retry}>
              <Text style={styles.fabRetryText}>↺  Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabRemove} onPress={remove}>
              <Text style={styles.fabRemoveText}>🗑  Remove</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.fabAdd, adding && styles.fabDisabled]}
            onPress={handleAddPress}
            disabled={adding}
          >
            <Text style={styles.fabAddText}>{adding ? '…' : '+ Add to Library'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Season picker modal */}
      <Modal
        visible={showSeasonPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSeasonPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Seasons</Text>
              <TouchableOpacity onPress={toggleAllSeasons}>
                <Text style={styles.modalToggleAll}>
                  {selectedSeasons.size === (tmdb?.seasons?.length ?? 0) ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={tmdb?.seasons ?? []}
              keyExtractor={s => String(s.season_number)}
              renderItem={({ item: s }) => {
                const checked = selectedSeasons.has(s.season_number);
                return (
                  <TouchableOpacity
                    style={styles.seasonRow}
                    onPress={() => toggleSeason(s.season_number)}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.seasonInfo}>
                      <Text style={styles.seasonName}>
                        {s.name || `Season ${s.season_number}`}
                      </Text>
                      {s.episode_count > 0 && (
                        <Text style={styles.seasonEpCount}>{s.episode_count} episodes</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={styles.seasonList}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSeasonPicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, selectedSeasons.size === 0 && styles.fabDisabled]}
                onPress={confirmSeasons}
                disabled={selectedSeasons.size === 0}
              >
                <Text style={styles.modalConfirmText}>
                  Add {selectedSeasons.size > 0 ? `(${selectedSeasons.size})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const BACKDROP_H = W * (9 / 16);

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: colors.surface },

  backdropWrap:     { width: W, height: BACKDROP_H, position: 'relative' },
  backdrop:         { width: W, height: BACKDROP_H },
  backdropFallback: { width: W, height: BACKDROP_H, backgroundColor: colors.card },
  backdropFade:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: BACKDROP_H * 0.5, backgroundColor: 'rgba(15,15,19,0.6)' },
  closeBtn:         { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,.6)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  headerRow:        { flexDirection: 'row', gap: 14, padding: 16, marginTop: -50 },
  poster:           { width: 90, height: 135, borderRadius: 8, zIndex: 1 },
  posterFallback:   { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  posterEmoji:      { fontSize: 28 },
  headerInfo:       { flex: 1, paddingTop: 54, gap: 6 },
  title:            { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 24 },
  metaRow:          { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  meta:             { fontSize: 13, color: colors.muted },
  rating:           { color: colors.yellow, fontWeight: '600' },
  genreRow:         { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill:             { backgroundColor: colors.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  pillText:         { fontSize: 11, color: colors.muted },

  overview:         { fontSize: 14, color: colors.muted, lineHeight: 21, marginHorizontal: 16, marginBottom: 16 },
  error:            { fontSize: 12, color: colors.red, marginHorizontal: 16, marginBottom: 12 },

  season:           { marginHorizontal: 16, marginBottom: 16 },
  seasonTitle:      { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  epRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  epNum:            { color: colors.muted, fontSize: 12, width: 42 },
  epTitle:          { flex: 1, fontSize: 13, color: colors.text },
  epRetryBtn:       { width: 28, height: 28, borderRadius: 6, backgroundColor: '#1a2d1a', alignItems: 'center', justifyContent: 'center' },
  epRetryText:      { color: colors.green, fontSize: 14, fontWeight: '700' },

  recSection:       { marginTop: 8 },
  recTitle:         { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 12 },
  recRow:           { paddingHorizontal: 16, gap: 10 },

  // Floating action bar
  fabBar:           { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10 },
  fabAdd:           { flex: 1, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabAddText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
  fabRetry:         { flex: 1, backgroundColor: '#1a2d1a', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabRetryText:     { color: colors.green, fontWeight: '700', fontSize: 15 },
  fabRemove:        { flex: 1, backgroundColor: '#3d1515', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabRemoveText:    { color: colors.red, fontWeight: '700', fontSize: 15 },
  fabDisabled:      { opacity: 0.4 },

  // Season picker modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, maxHeight: '80%' },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: colors.text },
  modalToggleAll:   { fontSize: 14, color: colors.accent, fontWeight: '600' },
  seasonList:       { maxHeight: 360 },
  seasonRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:  { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark:        { color: '#fff', fontSize: 13, fontWeight: '700' },
  seasonInfo:       { flex: 1 },
  seasonName:       { fontSize: 15, color: colors.text, fontWeight: '600' },
  seasonEpCount:    { fontSize: 12, color: colors.muted, marginTop: 2 },
  modalActions:     { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  modalCancel:      { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCancelText:  { color: colors.muted, fontWeight: '600', fontSize: 14 },
  modalConfirm:     { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
