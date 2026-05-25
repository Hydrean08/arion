import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Image, Alert, RefreshControl, Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme';
import { aria } from '../../api/aria';
import { Spinner } from '../../components/Spinner';
import { SkeletonArtistList } from '../../components/Skeleton';

const W            = Dimensions.get('window').width;
const GENRE_COL_W  = (W - 32 - 12) / 2;

const deezerId = (a) => a.deezer_id || String(a.id);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Up late?';
}

export default function MusicDiscoverTab() {
  const navigation = useNavigation();
  const [query,         setQuery]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [error,         setError]         = useState(null);
  const [charts,        setCharts]        = useState([]);
  const [genreRows,     setGenreRows]     = useState([]);
  const [activeGenre,   setActiveGenre]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [myArtists,     setMyArtists]     = useState([]);
  const [newReleases,   setNewReleases]   = useState([]);
  const [adding,        setAdding]        = useState(new Set());
  const timerRef    = useRef(null);
  const searchIdRef = useRef(0);

  useEffect(() => {
    loadBrowse();
    return () => clearTimeout(timerRef.current);
  }, []);

  const loadBrowse = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [c, a, g, r] = await Promise.all([
        aria.charts().catch(() => ({})),
        aria.artists().catch(() => []),
        aria.genreCharts().catch(() => []),
        aria.recent().catch(() => []),
      ]);
      setCharts((Array.isArray(c) ? c : (c.artists ?? [])).slice(0, 12));
      setMyArtists(a);
      setGenreRows(Array.isArray(g) ? g : []);
      setNewReleases(Array.isArray(r) ? r : []);
    } catch (e) {
      setError(e.message || 'Failed to load music browse');
    } finally { setLoading(false); setRefreshing(false); }
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
        const results = await aria.searchArtists(q.trim());
        if (id !== searchIdRef.current) return;
        setSearchResults(results);
      } catch (e) {
        if (id !== searchIdRef.current) return;
        setError(e.message || 'Search failed');
        setSearchResults([]);
      } finally {
        if (id === searchIdRef.current) setSearching(false);
      }
    }, 400);
  }, []);

  const isInLibrary = useCallback((a) =>
    myArtists.some(m => m.deezer_id === deezerId(a) || String(m.deezer_id) === deezerId(a)),
    [myArtists]
  );

  const addArtist = useCallback(async (artist) => {
    const did = deezerId(artist);
    if (adding.has(did)) return;
    setAdding(prev => new Set([...prev, did]));
    try {
      await aria.addArtist(artist.name);
      setMyArtists(prev => [...prev, { ...artist }]);
    } catch {
      Alert.alert('Error', 'Failed to add artist. Check Aria connection.');
    } finally {
      setAdding(prev => { const s = new Set(prev); s.delete(did); return s; });
    }
  }, [adding]);

  const openArtist = useCallback((artist) =>
    navigation.navigate('ArtistDetail', { artist }), [navigation]);

  const showSearch = query.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onSearch}
          placeholder="Search artists…"
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
          <TouchableOpacity onPress={() => showSearch ? onSearch(query) : loadBrowse()} style={styles.bannerRetry}>
            <Text style={styles.bannerRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {showSearch ? (
        <FlashList
          data={searchResults}
          estimatedItemSize={72}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={searching ? <Spinner /> : null}
          ListEmptyComponent={!searching && !error ? <Text style={styles.empty}>No artists found</Text> : null}
          renderItem={({ item }) => {
            const inLib    = isInLibrary(item);
            const did      = deezerId(item);
            const isAdding = adding.has(did);
            return (
              <TouchableOpacity style={styles.artistRow} onPress={() => openArtist(item)} activeOpacity={0.8}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={styles.artistThumb} />
                  : <View style={[styles.artistThumb, styles.thumbFallback]}><Text style={styles.emoji}>♪</Text></View>
                }
                <View style={styles.artistInfo}>
                  <Text style={styles.artistName}>{item.name}</Text>
                  {item.genres?.length > 0 && (
                    <Text style={styles.artistGenres} numberOfLines={1}>{item.genres.slice(0, 3).join(' · ')}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, (inLib || isAdding) && styles.addBtnDone]}
                  onPress={() => addArtist(item)}
                  disabled={inLib || isAdding}
                >
                  <Text style={[styles.addBtnText, (inLib || isAdding) && { color: colors.green }]}>
                    {inLib ? '✓' : isAdding ? '…' : '+ Follow'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      ) : activeGenre ? (
        <>
          <TouchableOpacity style={styles.backRow} onPress={() => setActiveGenre(null)}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backTitle}>Top {activeGenre.genre}</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.genreGrid} showsVerticalScrollIndicator={false}>
            {activeGenre.artists.map((artist, i) => {
              const inLib    = isInLibrary(artist);
              const did      = deezerId(artist);
              const isAdding = adding.has(did);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.genreGridCard, { width: GENRE_COL_W }]}
                  onPress={() => openArtist(artist)}
                  activeOpacity={0.8}
                >
                  {artist.image_url
                    ? <Image source={{ uri: artist.image_url }} style={styles.genreGridImg} />
                    : <View style={[styles.genreGridImg, styles.thumbFallback]}><Text style={styles.emoji}>♪</Text></View>
                  }
                  <Text style={styles.genreGridName} numberOfLines={2}>{artist.name}</Text>
                  <TouchableOpacity
                    style={[styles.genreGridFollowBtn, (inLib || isAdding) && styles.genreGridFollowBtnDone]}
                    onPress={() => addArtist(artist)}
                    disabled={inLib || isAdding}
                  >
                    <Text style={[styles.genreGridFollowText, (inLib || isAdding) && { color: colors.green }]}>
                      {inLib ? '✓ Following' : isAdding ? '…' : '+ Follow'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : loading ? <SkeletonArtistList /> : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBrowse(true)} tintColor={colors.accent} />}
        >
          {/* Greeting */}
          <View style={styles.greetingRow}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.greetingSub}>Discover new music</Text>
          </View>

          {/* My Artists */}
          {myArtists.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Artists</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {myArtists.map((artist, i) => (
                  <TouchableOpacity key={i} style={styles.myArtistCard} onPress={() => openArtist(artist)} activeOpacity={0.8}>
                    {artist.image_url
                      ? <Image source={{ uri: artist.image_url }} style={styles.myArtistImg} />
                      : <View style={[styles.myArtistImg, styles.thumbFallback]}><Text style={styles.emoji}>♪</Text></View>
                    }
                    <Text style={styles.myArtistName} numberOfLines={2}>{artist.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* New Releases */}
          {newReleases.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New in Your Library</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {newReleases.map((rel, i) => (
                  <View key={i} style={styles.releaseCard}>
                    {rel.cover_url
                      ? <Image source={{ uri: rel.cover_url }} style={styles.releaseCover} />
                      : <View style={[styles.releaseCover, styles.thumbFallback]}><Text style={styles.emoji}>♪</Text></View>
                    }
                    <Text style={styles.releaseTitle} numberOfLines={2}>{rel.title}</Text>
                    <Text style={styles.releaseArtist} numberOfLines={1}>{rel.artist}</Text>
                    {rel.year ? <Text style={styles.releaseYear}>{rel.year}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Trending Artists */}
          {charts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending Artists</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {charts.map((artist, i) => {
                  const inLib    = isInLibrary(artist);
                  const did      = deezerId(artist);
                  const isAdding = adding.has(did);
                  return (
                    <TouchableOpacity key={i} style={styles.chartCard} onPress={() => openArtist(artist)} activeOpacity={0.8}>
                      <View style={styles.chartImgWrap}>
                        {artist.image_url
                          ? <Image source={{ uri: artist.image_url }} style={styles.chartImg} />
                          : <View style={[styles.chartImg, styles.thumbFallback]}><Text style={styles.emoji}>♪</Text></View>
                        }
                        <View style={styles.chartRankBadge}>
                          <Text style={styles.chartRankText}>{i + 1}</Text>
                        </View>
                        {inLib && <View style={styles.inLibDot} />}
                      </View>
                      <Text style={styles.chartName} numberOfLines={2}>{artist.name}</Text>
                      <TouchableOpacity
                        style={[styles.chartFollowBtn, (inLib || isAdding) && styles.chartFollowBtnDone]}
                        onPress={() => addArtist(artist)}
                        disabled={inLib || isAdding}
                      >
                        <Text style={[styles.chartFollowText, (inLib || isAdding) && { color: colors.green }]}>
                          {inLib ? '✓' : isAdding ? '…' : '+ Follow'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Genre sections */}
          {genreRows.map(({ genre, artists }) => (
            <View key={genre} style={styles.section}>
              <Text style={styles.sectionTitle}>Top {genre}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {artists.slice(0, 8).map((artist, i) => {
                  const inLib    = isInLibrary(artist);
                  const did      = deezerId(artist);
                  const isAdding = adding.has(did);
                  return (
                    <TouchableOpacity key={i} style={styles.genreCard} onPress={() => openArtist(artist)} activeOpacity={0.8}>
                      {artist.image_url
                        ? <Image source={{ uri: artist.image_url }} style={styles.genreImg} />
                        : <View style={[styles.genreImg, styles.thumbFallback]}><Text style={styles.emoji}>♪</Text></View>
                      }
                      <Text style={styles.genreName} numberOfLines={2}>{artist.name}</Text>
                      <TouchableOpacity
                        style={[styles.genreFollowBtn, (inLib || isAdding) && styles.genreFollowBtnDone]}
                        onPress={() => addArtist(artist)}
                        disabled={inLib || isAdding}
                      >
                        <Text style={[styles.genreFollowText, (inLib || isAdding) && { color: colors.green }]}>
                          {inLib ? '✓' : isAdding ? '…' : '+ Follow'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.seeMoreCard} onPress={() => setActiveGenre({ genre, artists })} activeOpacity={0.7}>
                  <View style={styles.seeMoreCircle}>
                    <Text style={styles.seeMoreArrow}>→</Text>
                  </View>
                  <Text style={styles.seeMoreText}>See More</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          ))}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:               { flex: 1 },
  searchRow:          { flexDirection: 'row', alignItems: 'center', margin: 12, gap: 8 },
  searchInput:        { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, fontSize: 15 },
  clearBtn:           { padding: 8 },
  clearBtnText:       { color: colors.muted, fontSize: 18 },
  banner:             { backgroundColor: '#3d1515', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginBottom: 8, borderRadius: 8 },
  bannerText:         { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  bannerRetry:        { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  bannerRetryText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  listContent:        { padding: 12, gap: 4 },
  empty:              { color: colors.muted, textAlign: 'center', padding: 40 },
  // Greeting
  greetingRow:        { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  greetingText:       { fontSize: 24, fontWeight: '800', color: colors.text },
  greetingSub:        { fontSize: 13, color: colors.muted, marginTop: 2 },
  // Sections
  section:            { marginBottom: 28 },
  sectionTitle:       { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 12 },
  hScroll:            { paddingHorizontal: 16, gap: 12 },
  // My Artists
  myArtistCard:   { width: 90, alignItems: 'center', gap: 6 },
  myArtistImg:    { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.card },
  myArtistName:   { fontSize: 11, color: colors.text, textAlign: 'center', fontWeight: '600', lineHeight: 14 },
  // New Releases
  releaseCard:    { width: 110, gap: 4 },
  releaseCover:   { width: 110, height: 110, borderRadius: 8, backgroundColor: colors.card },
  releaseTitle:   { fontSize: 11, fontWeight: '600', color: colors.text, lineHeight: 15 },
  releaseArtist:  { fontSize: 10, color: colors.muted },
  releaseYear:    { fontSize: 10, color: colors.muted },
  // Trending Artists
  chartCard:          { width: 120, alignItems: 'center', gap: 6 },
  chartImgWrap:       { position: 'relative' },
  chartImg:           { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.card },
  chartRankBadge:     { position: 'absolute', bottom: 4, left: 0, backgroundColor: colors.accent, borderRadius: 99, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  chartRankText:      { color: '#fff', fontSize: 10, fontWeight: '900' },
  inLibDot:           { position: 'absolute', top: 4, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  chartName:          { fontSize: 12, color: colors.text, textAlign: 'center', fontWeight: '600', lineHeight: 16 },
  chartFollowBtn:     { backgroundColor: colors.accent, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 },
  chartFollowBtnDone: { backgroundColor: '#1a401a' },
  chartFollowText:    { color: '#fff', fontSize: 10, fontWeight: '700' },
  // Genre sections
  genreCard:          { width: 100, alignItems: 'center', gap: 6 },
  genreImg:           { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.card },
  genreName:          { fontSize: 11, color: colors.text, textAlign: 'center', fontWeight: '600', lineHeight: 14 },
  genreFollowBtn:     { backgroundColor: colors.accent, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  genreFollowBtnDone: { backgroundColor: '#1a401a' },
  genreFollowText:    { color: '#fff', fontSize: 10, fontWeight: '700' },
  // Genre drill-down
  backRow:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  backArrow:            { color: colors.accent, fontSize: 18, fontWeight: '700' },
  backTitle:            { fontSize: 15, fontWeight: '700', color: colors.text },
  genreGrid:            { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  genreGridCard:        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, alignItems: 'center', gap: 6 },
  genreGridImg:         { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card },
  genreGridName:        { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 17 },
  genreGridFollowBtn:     { backgroundColor: colors.accent, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  genreGridFollowBtnDone: { backgroundColor: '#1a401a' },
  genreGridFollowText:    { color: '#fff', fontSize: 10, fontWeight: '700' },
  // See More end-cap
  seeMoreCard:          { width: 100, alignItems: 'center', justifyContent: 'center', gap: 6 },
  seeMoreCircle:        { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  seeMoreArrow:         { fontSize: 26, color: colors.accent, fontWeight: '700' },
  seeMoreText:          { fontSize: 11, color: colors.accent, fontWeight: '600' },
  // Search results
  artistRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  artistThumb:        { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card },
  thumbFallback:      { alignItems: 'center', justifyContent: 'center' },
  emoji:              { fontSize: 20, color: colors.muted },
  artistInfo:         { flex: 1 },
  artistName:         { fontSize: 14, fontWeight: '600', color: colors.text },
  artistGenres:       { fontSize: 12, color: colors.muted, marginTop: 2 },
  addBtn:             { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnDone:         { backgroundColor: '#1a401a' },
  addBtnText:         { color: '#fff', fontSize: 12, fontWeight: '700' },
});
