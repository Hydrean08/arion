/**
 * AI tab content for the Music screen — surfaces all of Aria's GLM-4-powered
 * features in one place: library digest, AI artist suggestions, new-release
 * highlights, weekly + on-demand playlists, and lyric/description search.
 *
 * Stays separate from MusicHomeScreen so the parent doesn't grow past ~400
 * lines with five overlapping state machines.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { aria, ApiError } from '../../api/aria';
import { colors } from '../../theme';

export default function AriaAITab() {
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [releases, setReleases] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  // Set of lowercased artist names already in the library — used to gray
  // out suggestions for artists Chuck is already following so he doesn't
  // see "+ Add" on duplicates.
  const [libraryArtists, setLibraryArtists] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal state — kept local to this tab.
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodValue, setMoodValue] = useState('');
  const [moodSubmitting, setMoodSubmitting] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistViewing, setPlaylistViewing] = useState(null);

  const [refreshingReleases, setRefreshingReleases] = useState(false);

  const loadAll = useCallback(async (forceDigest = false) => {
    setRefreshing(true);
    try {
      const [s, r, p, libArtists] = await Promise.all([
        aria.aiSuggestions().catch(() => []),
        aria.aiReleases().catch(() => []),
        aria.aiPlaylists().catch(() => []),
        aria.artists().catch(() => []),
      ]);
      setSuggestions(s); setReleases(r); setPlaylists(p);
      setLibraryArtists(new Set((libArtists || []).map(a => (a.name || '').toLowerCase().trim())));
      if (forceDigest || digest == null) {
        setDigestLoading(true);
        aria.aiDigest()
          .then(d => setDigest(d?.digest || null))
          .catch(() => setDigest(null))
          .finally(() => setDigestLoading(false));
      }
    } finally {
      setRefreshing(false); setLoading(false);
    }
  }, [digest]);

  useEffect(() => { loadAll(false); }, [loadAll]);

  const dismissSuggestion = async (id) => {
    setSuggestions(prev => prev.filter(x => x.id !== id));
    try { await aria.dismissSuggestion(id); } catch {}
  };

  const addSuggestion = async (s) => {
    try {
      await aria.addArtist(s.artist_name);
      Alert.alert('Added', `${s.artist_name} added to library.`);
      // Auto-dismiss the suggestion since it's no longer relevant.
      dismissSuggestion(s.id);
    } catch (e) {
      Alert.alert('Could not add', e?.message || String(e));
    }
  };

  const dismissRelease = async (id) => {
    setReleases(prev => prev.filter(x => x.id !== id));
    try { await aria.dismissRelease(id); } catch {}
  };

  const refreshReleases = async () => {
    setRefreshingReleases(true);
    try {
      await aria.refreshReleases();
      Alert.alert('Refreshing', 'AI is picking new releases. This takes ~30-60s — pull-to-refresh in a moment.');
    } catch (e) {
      Alert.alert('Failed', e?.message || String(e));
    } finally {
      setRefreshingReleases(false);
    }
  };

  const submitMood = async () => {
    const m = moodValue.trim();
    if (!m) return;
    setMoodSubmitting(true);
    try {
      await aria.generateMoodPlaylist(m);
      setMoodOpen(false);
      setMoodValue('');
      Alert.alert('Queued', 'Mood playlist is generating. It will appear in the list in ~10-30s — pull to refresh.');
    } catch (e) {
      Alert.alert('Failed', e?.message || String(e));
    } finally {
      setMoodSubmitting(false);
    }
  };

  const submitSearch = async () => {
    const q = searchValue.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const { results } = await aria.lyricSearch(q);
      setSearchResults(results || []);
    } catch (e) {
      Alert.alert('Search failed', e?.message || String(e));
    } finally {
      setSearchLoading(false);
    }
  };

  const deletePlaylist = async () => {
    if (!playlistViewing) return;
    Alert.alert('Delete playlist?', playlistViewing.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await aria.deletePlaylist(playlistViewing.id);
          setPlaylists(prev => prev.filter(x => x.id !== playlistViewing.id));
          setPlaylistOpen(false); setPlaylistViewing(null);
        }
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator color={colors.accent2} style={{ marginTop: 40 }} />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.text} />}
      >
        {/* ── Library digest ── */}
        <Text style={styles.sectionHead}>Library Digest</Text>
        <TouchableOpacity onPress={() => loadAll(true)} style={styles.digestCard} accessibilityRole="button" accessibilityLabel="Refresh digest">
          {digestLoading
            ? <ActivityIndicator color={colors.accent2} />
            : digest
              ? <Text style={styles.digestText}>{digest}</Text>
              : <Text style={styles.emptyText}>Tap to generate a fresh AI overview of your library.</Text>}
        </TouchableOpacity>

        {/* ── Quick actions ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setMoodOpen(true)}>
            <Text style={styles.actionIcon}>🎯</Text>
            <Text style={styles.actionLabel}>Mood playlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setSearchOpen(true)}>
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionLabel}>Find by description</Text>
          </TouchableOpacity>
        </View>

        {/* ── Suggested artists ── */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionHead}>Suggested Artists</Text>
          <Text style={styles.sectionSub}>{suggestions.length}</Text>
        </View>
        {suggestions.length === 0 ? (
          <Text style={styles.emptyText}>No suggestions yet — refreshes weekly.</Text>
        ) : (
          suggestions.map(s => {
            const inLib = libraryArtists.has((s.artist_name || '').toLowerCase().trim());
            return (
              <View key={s.id} style={styles.suggCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggName}>{s.artist_name}</Text>
                  <Text style={styles.suggReason}>{s.reason}</Text>
                  {s.source_artist ? <Text style={styles.suggSource}>Like {s.source_artist}</Text> : null}
                </View>
                <View style={styles.suggActions}>
                  {inLib ? (
                    <View style={styles.inLibTag}>
                      <Text style={styles.inLibTagText}>✓ In library</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => addSuggestion(s)}>
                      <Text style={styles.addBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.dismissBtn} onPress={() => dismissSuggestion(s.id)}>
                    <Text style={styles.dismissBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* ── New releases ── */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionHead}>New Releases</Text>
          <TouchableOpacity onPress={refreshReleases} disabled={refreshingReleases}>
            <Text style={styles.sectionAction}>{refreshingReleases ? '…' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
        {releases.length === 0 ? (
          <Text style={styles.emptyText}>Tap Refresh to ask AI for new-release highlights from your monitored artists.</Text>
        ) : (
          releases.map(r => (
            <View key={r.id} style={styles.releaseCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.releaseTitle}>{r.album_title}</Text>
                <Text style={styles.releaseArtist}>{r.artist_name}{r.year ? ` · ${r.year}` : ''}</Text>
                <Text style={styles.releaseReason}>{r.reason}</Text>
              </View>
              <TouchableOpacity style={styles.dismissBtn} onPress={() => dismissRelease(r.id)}>
                <Text style={styles.dismissBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── Playlists ── */}
        <Text style={styles.sectionHead}>AI Playlists</Text>
        {playlists.length === 0 ? (
          <Text style={styles.emptyText}>No playlists yet — generate one with Mood above, or wait for the weekly cycle.</Text>
        ) : (
          playlists.map(p => (
            <TouchableOpacity
              key={p.id}
              style={styles.playlistRow}
              onPress={() => { setPlaylistViewing(p); setPlaylistOpen(true); }}
            >
              <Text style={styles.playlistName}>{p.name}</Text>
              {p.description ? <Text style={styles.playlistDesc}>{p.description}</Text> : null}
              <Text style={styles.playlistMeta}>{p.tracks?.length ?? 0} tracks · {p.created_at}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ── Mood playlist modal ── */}
      <Modal visible={moodOpen} animationType="slide" transparent onRequestClose={() => setMoodOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mood playlist</Text>
            <Text style={styles.modalSub}>Describe a mood, vibe, or occasion. AI picks 12 tracks.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. rainy Sunday, workout pump"
              placeholderTextColor={colors.muted}
              value={moodValue}
              onChangeText={setMoodValue}
              autoFocus
              onSubmitEditing={submitMood}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setMoodOpen(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={submitMood} disabled={moodSubmitting}>
                <Text style={styles.modalBtnText}>{moodSubmitting ? 'Generating…' : 'Generate'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Lyric / description search modal ── */}
      <Modal visible={searchOpen} animationType="slide" transparent onRequestClose={() => setSearchOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Find tracks by description</Text>
            <Text style={styles.modalSub}>e.g. "songs about heartbreak" or "instrumental jazz with sax solos"</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Describe what you're looking for…"
              placeholderTextColor={colors.muted}
              value={searchValue}
              onChangeText={setSearchValue}
              autoFocus
              onSubmitEditing={submitSearch}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setSearchOpen(false)}>
                <Text style={styles.modalBtnGhostText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={submitSearch} disabled={searchLoading}>
                <Text style={styles.modalBtnText}>{searchLoading ? 'Searching…' : 'Search'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop: 12, flexGrow: 0 }}>
              {searchResults.map((t, i) => (
                <View key={i} style={styles.trackRow}>
                  <Text style={styles.trackArtistTitle}>
                    <Text style={styles.trackArtist}>{t.artist}</Text>
                    <Text style={styles.trackSep}> — </Text>
                    <Text style={styles.trackTitle}>{t.title}</Text>
                  </Text>
                  {t.reason ? <Text style={styles.trackReason}>{t.reason}</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Playlist viewer modal ── */}
      <Modal visible={playlistOpen} animationType="slide" transparent onRequestClose={() => setPlaylistOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>{playlistViewing?.name ?? ''}</Text>
            {playlistViewing?.description
              ? <Text style={styles.modalSub}>{playlistViewing.description}</Text>
              : null}
            <ScrollView style={{ marginTop: 8, flexGrow: 1 }}>
              {(playlistViewing?.tracks ?? []).map((t, i) => (
                <View key={i} style={styles.trackRow}>
                  <Text style={styles.trackN}>{i + 1}.</Text>
                  <Text style={styles.trackArtistTitle}>
                    <Text style={styles.trackArtist}>{t.artist || '?'}</Text>
                    <Text style={styles.trackSep}> — </Text>
                    <Text style={styles.trackTitle}>{t.title || '?'}</Text>
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtnGhost, { borderColor: colors.red }]} onPress={deletePlaylist}>
                <Text style={[styles.modalBtnGhostText, { color: colors.red }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setPlaylistOpen(false)}>
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll:        { padding: 16, paddingBottom: 40 },
  sectionHead:   { fontSize: 14, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  sectionHeadRow:{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  sectionSub:    { fontSize: 13, color: colors.muted, marginBottom: 2 },
  sectionAction: { fontSize: 13, color: colors.accent2, fontWeight: '600' },
  emptyText:     { fontSize: 13, color: colors.muted, fontStyle: 'italic', padding: 12 },

  digestCard:    { backgroundColor: colors.card, borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: colors.accent, minHeight: 60 },
  digestText:    { fontSize: 14, color: colors.text, lineHeight: 20 },

  actionRow:     { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn:     { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  actionIcon:    { fontSize: 22, marginBottom: 4 },
  actionLabel:   { fontSize: 13, color: colors.text, fontWeight: '600' },

  suggCard:      { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, alignItems: 'flex-start', gap: 10 },
  suggName:      { fontSize: 15, fontWeight: '700', color: colors.text },
  suggReason:    { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 16 },
  suggSource:    { fontSize: 11, color: colors.accent2, marginTop: 4, fontStyle: 'italic' },
  suggActions:   { flexDirection: 'column', gap: 6 },
  addBtn:        { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addBtnText:    { color: colors.text, fontSize: 12, fontWeight: '700' },
  inLibTag:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.green, alignItems: 'center' },
  inLibTagText:  { color: colors.green, fontSize: 11, fontWeight: '700' },
  dismissBtn:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  dismissBtnText:{ color: colors.muted, fontSize: 16 },

  releaseCard:   { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, alignItems: 'flex-start' },
  releaseTitle:  { fontSize: 15, fontWeight: '700', color: colors.text },
  releaseArtist: { fontSize: 12, color: colors.muted, marginTop: 2 },
  releaseReason: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 16 },

  playlistRow:   { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8 },
  playlistName:  { fontSize: 15, fontWeight: '700', color: colors.text },
  playlistDesc:  { fontSize: 13, color: colors.muted, marginTop: 4 },
  playlistMeta:  { fontSize: 11, color: colors.muted, marginTop: 6, opacity: 0.7 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modal:         { backgroundColor: colors.surface, borderRadius: 14, padding: 20 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSub:      { fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 14 },
  modalInput:    { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15 },
  modalActions:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  modalBtn:      { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalBtnText:  { color: colors.text, fontWeight: '700' },
  modalBtnGhost: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  modalBtnGhostText: { color: colors.muted, fontWeight: '600' },

  trackRow:      { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  trackN:        { color: colors.muted, width: 28, fontSize: 13 },
  trackArtistTitle: { flex: 1, fontSize: 13, color: colors.text },
  trackArtist:   { fontWeight: '600' },
  trackSep:      { color: colors.muted },
  trackTitle:    {},
  trackReason:   { width: '100%', color: colors.muted, fontSize: 11, fontStyle: 'italic', paddingLeft: 28, marginTop: 2 },
});
