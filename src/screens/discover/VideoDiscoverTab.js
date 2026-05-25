import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, Dimensions, Alert, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme';
import { orion } from '../../api/orion';
import { DiscoverCard } from '../../components/PosterCard';
import { FlashList } from '@shopify/flash-list';
import { Spinner } from '../../components/Spinner';
import { SkeletonPosterGrid } from '../../components/Skeleton';

const VIDEO_SECTIONS = [
  { key: 'trending-all',    label: 'Trending Now' },
  { key: 'trending-movies', label: 'Trending Movies' },
  { key: 'trending-shows',  label: 'Trending Shows' },
  { key: 'top-movies',      label: 'Top Rated Movies' },
  { key: 'popular-movies',  label: 'Popular Movies' },
  { key: 'popular-shows',   label: 'Popular Shows' },
  { key: 'top-shows',       label: 'Top Rated Shows' },
];

const W          = Dimensions.get('window').width;
const COLS       = Math.floor(W / 120);
const CARD_W     = (W - 24 - (COLS - 1) * 10) / COLS;
const CARD_H     = Math.round(CARD_W * 1.5);
const ROW_CARD_W = 110;
const HERO_H     = 160;

export default function VideoDiscoverTab() {
  const navigation = useNavigation();
  const [query,         setQuery]         = useState('');
  const [sections,      setSections]      = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [searching,     setSearching]     = useState(false);
  const [error,         setError]         = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [libraryIds,    setLibraryIds]    = useState(new Set());
  const [addedIds,      setAddedIds]      = useState(new Set());
  const [searchPage,    setSearchPage]    = useState(1);
  const timerRef    = useRef(null);
  const searchIdRef = useRef(0);

  useEffect(() => {
    orion.items()
      .then(all => setLibraryIds(new Set(all.filter(i => i.tmdb_id).map(i => i.tmdb_id))))
      .catch(() => {});
    loadBrowse();
    return () => clearTimeout(timerRef.current);
  }, []);

  const loadBrowse = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        VIDEO_SECTIONS.map(s => orion.discover(s.key))
      );
      const next = {};
      VIDEO_SECTIONS.forEach((s, i) => {
        next[s.key] = results[i].status === 'fulfilled' ? results[i].value : [];
      });
      setSections(next);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onSearch = useCallback((q) => {
    setQuery(q);
    setError(null);
    clearTimeout(timerRef.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    const id = ++searchIdRef.current;
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await orion.search(q.trim(), 1);
        if (id !== searchIdRef.current) return;
        setSearchResults(results);
        setSearchPage(1);
      } catch (e) {
        if (id !== searchIdRef.current) return;
        setError(e.message || 'Search failed');
        setSearchResults([]);
      } finally {
        if (id === searchIdRef.current) setSearching(false);
      }
    }, 400);
  }, []);

  const loadMore = useCallback(async () => {
    if (!query.trim()) return;
    const next = searchPage + 1;
    try {
      const data = await orion.search(query.trim(), next);
      setSearchResults(prev => [...prev, ...data]);
      setSearchPage(next);
    } catch {}
  }, [query, searchPage]);

  const addItem = useCallback(async (item) => {
    if (addedIds.has(item.tmdb_id) || libraryIds.has(item.tmdb_id)) return;
    setAddedIds(prev => new Set([...prev, item.tmdb_id]));
    try {
      await orion.addItem(item);
      setLibraryIds(prev => new Set([...prev, item.tmdb_id]));
    } catch (e) {
      if (e?.status > 0) {
        // Server responded — item exists or was created, treat as added
        setLibraryIds(prev => new Set([...prev, item.tmdb_id]));
      } else {
        // Network failure — item was never sent, revert
        setAddedIds(prev => { const s = new Set(prev); s.delete(item.tmdb_id); return s; });
        Alert.alert('Error', 'Failed to add item. Check Orion connection.');
      }
    }
  }, [addedIds, libraryIds]);

  const isAdded    = (item) => libraryIds.has(item.tmdb_id) || addedIds.has(item.tmdb_id);
  const showSearch = query.trim().length > 0;

  const activeSectionItems = activeSection ? (sections[activeSection] ?? []) : [];
  const activeSectionLabel = activeSection
    ? (VIDEO_SECTIONS.find(s => s.key === activeSection)?.label ?? '')
    : '';

  const hero = sections['trending-all']?.[0] ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onSearch}
          placeholder="Search movies & shows…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
          <TouchableOpacity
            onPress={() => showSearch ? onSearch(query) : loadBrowse()}
            style={styles.bannerRetry}
          >
            <Text style={styles.bannerRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {showSearch ? (
        <FlashList
          data={searchResults}
          estimatedItemSize={90}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={searching ? <Spinner /> : null}
          ListEmptyComponent={!searching && !error ? <Text style={styles.empty}>No results</Text> : null}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => navigation.navigate('ItemDetail', { item })}
              activeOpacity={0.8}
            >
              <DiscoverCard item={item} width={50} />
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultMeta}>
                  {item.year || '—'} · {item.type === 'movie' ? '🎬 Movie' : '📺 Show'}
                </Text>
                <Text style={styles.resultOverview} numberOfLines={2}>{item.overview}</Text>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, isAdded(item) && styles.addBtnDone]}
                onPress={() => addItem(item)}
                disabled={isAdded(item)}
              >
                <Text style={[styles.addBtnText, isAdded(item) && { color: colors.green }]}>
                  {isAdded(item) ? '✓' : '+ Add'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : activeSection ? (
        <>
          <TouchableOpacity style={styles.backRow} onPress={() => setActiveSection(null)}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backTitle}>{activeSectionLabel}</Text>
          </TouchableOpacity>
          <FlashList
            data={activeSectionItems}
            numColumns={COLS}
            estimatedItemSize={CARD_H + 50}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<Text style={styles.empty}>Nothing found</Text>}
            renderItem={({ item, index }) => (
              <View style={index % COLS < COLS - 1 ? styles.gridItemGap : styles.gridItemLast}>
                <DiscoverCard
                  item={item}
                  width={CARD_W}
                  onPress={() => navigation.navigate('ItemDetail', { item })}
                  onAdd={() => addItem(item)}
                  added={isAdded(item)}
                />
              </View>
            )}
          />
        </>
      ) : loading ? <SkeletonPosterGrid /> : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadBrowse(true)}
              tintColor={colors.accent}
            />
          }
        >
          {/* Hero — #1 Trending */}
          {hero && (
            <TouchableOpacity
              style={styles.hero}
              onPress={() => navigation.navigate('ItemDetail', { item: hero })}
              activeOpacity={0.85}
            >
              {hero.poster_url
                ? <Image source={{ uri: hero.poster_url }} style={styles.heroPoster} resizeMode="cover" />
                : <View style={[styles.heroPoster, styles.heroPosterFallback]}><Text style={styles.heroEmoji}>🎬</Text></View>
              }
              <View style={styles.heroBody}>
                <View style={styles.heroTypeBadge}>
                  <Text style={styles.heroTypeText}>
                    {hero.type === 'movie' ? '🎬 Movie' : '📺 Show'}
                  </Text>
                </View>
                <Text style={styles.heroRank}>#1 Trending</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
                <Text style={styles.heroMeta}>{hero.year || ''}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[styles.heroAddBtn, isAdded(hero) && styles.heroAddBtnDone]}
                  onPress={() => addItem(hero)}
                  disabled={isAdded(hero)}
                >
                  <Text style={styles.heroAddText}>
                    {isAdded(hero) ? '✓ Added' : '+ Add to Library'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}

          {/* Sections */}
          {VIDEO_SECTIONS.map(section => {
            const items = sections[section.key] ?? [];
            if (items.length === 0) return null;
            return (
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.label}</Text>
                  <TouchableOpacity onPress={() => setActiveSection(section.key)}>
                    <Text style={styles.seeAll}>See All →</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScroll}
                >
                  {items.slice(0, 10).map((item, i) => (
                    <DiscoverCard
                      key={i}
                      item={item}
                      width={ROW_CARD_W}
                      rank={section.key === 'trending-all' ? i + 1 : undefined}
                      onPress={() => navigation.navigate('ItemDetail', { item })}
                      onAdd={() => addItem(item)}
                      added={isAdded(item)}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1 },
  searchRow:        { flexDirection: 'row', alignItems: 'center', margin: 12, gap: 8 },
  searchInput:      { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, fontSize: 15 },
  clearBtn:         { padding: 8 },
  clearBtnText:     { color: colors.muted, fontSize: 18 },
  banner:           { backgroundColor: '#3d1515', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginBottom: 8, borderRadius: 8 },
  bannerText:       { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  bannerRetry:      { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  bannerRetryText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  // Hero
  hero:             { flexDirection: 'row', marginHorizontal: 12, marginBottom: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', height: HERO_H },
  heroPoster:       { width: HERO_H * (2 / 3), height: HERO_H },
  heroPosterFallback: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  heroEmoji:        { fontSize: 32 },
  heroBody:         { flex: 1, padding: 12, gap: 4 },
  heroTypeBadge:    { backgroundColor: colors.accent, alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  heroTypeText:     { color: '#fff', fontSize: 10, fontWeight: '700' },
  heroRank:         { fontSize: 11, color: colors.muted, fontWeight: '600', marginTop: 2 },
  heroTitle:        { fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 20 },
  heroMeta:         { fontSize: 12, color: colors.muted },
  heroAddBtn:       { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  heroAddBtnDone:   { backgroundColor: '#1a401a' },
  heroAddText:      { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Sections
  section:          { marginBottom: 28 },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 12 },
  sectionTitle:     { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  seeAll:           { fontSize: 12, color: colors.accent, fontWeight: '600' },
  hScroll:          { paddingHorizontal: 16, gap: 10 },
  // Drill-down
  backRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  backArrow:        { color: colors.accent, fontSize: 18, fontWeight: '700' },
  backTitle:        { fontSize: 15, fontWeight: '700', color: colors.text },
  grid:             { padding: 12 },
  gridItemGap:      { marginRight: 10, marginBottom: 10 },
  gridItemLast:     { marginBottom: 10 },
  // Search
  empty:            { color: colors.muted, textAlign: 'center', padding: 40 },
  listContent:      { padding: 12, gap: 4 },
  resultRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultInfo:       { flex: 1 },
  resultTitle:      { fontSize: 14, fontWeight: '600', color: colors.text },
  resultMeta:       { fontSize: 12, color: colors.muted, marginTop: 2 },
  resultOverview:   { fontSize: 11, color: colors.muted, marginTop: 3, lineHeight: 15 },
  addBtn:           { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnDone:       { backgroundColor: '#1a401a' },
  addBtnText:       { color: '#fff', fontSize: 12, fontWeight: '700' },
});
