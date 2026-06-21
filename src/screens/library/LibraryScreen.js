import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, AppState, useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme';
import { orion, ApiError } from '../../api/orion';
import { getLastKnown } from '../../api/config';
import { PosterCard } from '../../components/PosterCard';
import { SkeletonPosterGrid } from '../../components/Skeleton';
import { OrionHealthIndicator } from '../../components/OrionHealthIndicator';

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'movie',   label: 'Movies' },
  { key: 'show',    label: 'Shows' },
  { key: 'pending', label: 'Pending' },
  { key: 'queued',  label: 'Queued' },
  { key: 'failed',  label: 'Failed' },
];

const LOG_LEVEL_COLOR = { error: colors.red, warn: colors.yellow, info: colors.accent2 };

export default function LibraryScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const COLS   = Math.floor(width / 130);
  const CARD_W = (width - 24 - (COLS - 1) * 10) / COLS;
  const CARD_H = Math.round(CARD_W * 1.5);
  const [tab,         setTab]         = useState('items');
  const [allItems,    setAllItems]    = useState([]);
  const [stats,       setStats]       = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter,   setLogFilter]   = useState('all');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [offline,     setOffline]     = useState(false);
  const intervalRef = useRef(null);

  const hydrateFromCache = useCallback(() => {
    const cItems = getLastKnown('orion', '/api/items');
    const cStats = getLastKnown('orion', '/api/stats');
    const cLogs  = getLastKnown('orion', '/api/logs');
    let any = false;
    if (Array.isArray(cItems?.data)) { setAllItems(cItems.data); any = true; }
    if (cStats?.data)                { setStats(cStats.data);    any = true; }
    if (Array.isArray(cLogs?.data))  { setLogs(cLogs.data);      any = true; }
    return any;
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const [items, s, l] = await Promise.all([orion.items(), orion.stats(), orion.logs()]);
      setAllItems(items);
      setStats(s);
      setLogs(l);
    } catch (e) {
      if (e instanceof ApiError && e.isOffline) {
        setOffline(true);
        hydrateFromCache();
      } else {
        setError(e.message || 'Failed to load library');
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, [hydrateFromCache]);

  useFocusEffect(useCallback(() => {
    if (hydrateFromCache()) setLoading(false);
    load();
    intervalRef.current = setInterval(() => {
      if (AppState.currentState === 'active') load(true);
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, [load, hydrateFromCache]));

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (filter === 'pending')      items = items.filter(i => i.status === 'pending');
    else if (filter === 'queued')  items = items.filter(i => i.status === 'queued');
    else if (filter === 'failed')  items = items.filter(i => i.status === 'failed');
    else if (filter !== 'all')     items = items.filter(i => i.type === filter);
    if (searchQuery) items = items.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [allItems, filter, searchQuery]);

  if (loading) return <SkeletonPosterGrid showStats />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Offline banner */}
      {offline && (
        <View style={styles.bannerOffline}>
          <Text style={styles.bannerText}>⚠ Orion is unreachable. Showing last known data.</Text>
        </View>
      )}
      {/* Error banner */}
      {error && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)} style={styles.bannerRetry} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={styles.bannerRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'items' && styles.tabPillActive]}
          onPress={() => setTab('items')}
        >
          <Text style={[styles.tabPillText, tab === 'items' && styles.tabPillTextActive]}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'logs' && styles.tabPillActive]}
          onPress={() => setTab('logs')}
        >
          <Text style={[styles.tabPillText, tab === 'logs' && styles.tabPillTextActive]}>Logs</Text>
        </TouchableOpacity>
      </View>

      {tab === 'items' ? (
        <>
          {stats && (
            <View style={styles.statsRow}>
              <StatPill label="Movies"  value={`${stats.movies.resolved}/${stats.movies.total}`} onPress={() => setFilter('movie')} />
              <StatPill label="Shows"   value={`${stats.shows.resolved}/${stats.shows.total}`}   onPress={() => setFilter('show')} />
              <StatPill label="Eps"     value={stats.episodes.resolved.toLocaleString()} />
              <StatPill label="Pending" value={stats.pending} warn onPress={() => setFilter('pending')} />
              <StatPill label="Queued"  value={stats.queued ?? 0}    onPress={() => setFilter('queued')} />
              <StatPill label="Failed"  value={stats.failed}  err    onPress={() => setFilter('failed')} />
            </View>
          )}
          <TextInput
            style={styles.searchInput}
            placeholder="Search library…"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.pill, filter === f.key && styles.pillActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlashList
            data={filteredItems}
            numColumns={COLS}
            estimatedItemSize={CARD_H + 50}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.grid}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
            ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
            renderItem={({ item, index }) => (
              <View style={index % COLS < COLS - 1 ? styles.gridItemGap : styles.gridItemLast}>
                <PosterCard
                  item={item}
                  width={CARD_W}
                  onPress={() => navigation.navigate('ItemDetail', { item })}
                />
              </View>
            )}
          />
        </>
      ) : (
        <>
          <View style={styles.logFilterRow}>
            {['all', 'info', 'warn', 'error'].map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.pill, logFilter === level && styles.pillActive]}
                onPress={() => setLogFilter(level)}
              >
                <Text style={[styles.pillText, logFilter === level && styles.pillTextActive]}>
                  {level.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlashList
            data={logFilter === 'all' ? logs : logs.filter(l => l.level?.toLowerCase() === logFilter)}
            estimatedItemSize={64}
            keyExtractor={(item, i) => item.ts ?? item.at ?? String(i)}
            contentContainerStyle={styles.logsContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
            ListEmptyComponent={<Text style={styles.empty}>No logs yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.logRow}>
                <Text style={[styles.logLevel, { color: LOG_LEVEL_COLOR[item.level] ?? colors.muted }]}>
                  {item.level?.toUpperCase()}
                </Text>
                <View style={styles.logBody}>
                  <Text style={styles.logMsg} numberOfLines={3}>{item.msg ?? item.message}</Text>
                  <Text style={styles.logAt}>{item.ts ?? item.at}</Text>
                </View>
              </View>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function StatPill({ label, value, warn, err, onPress }) {
  const valueColor = err ? colors.red : warn ? colors.yellow : colors.accent2;
  return (
    <TouchableOpacity
      style={styles.stat}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={[styles.statNum, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: colors.bg },
  bannerOffline:    { backgroundColor: '#2d2a00', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bannerError:      { backgroundColor: '#3d1515', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerText:       { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  bannerRetry:      { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  bannerRetryText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabRow:           { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, marginBottom: 4, gap: 8 },
  tabPill:          { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabPillActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  tabPillText:      { color: colors.muted, fontSize: 14, fontWeight: '600' },
  tabPillTextActive:{ color: '#fff' },
  statsRow:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  stat:             { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', flex: 1, minWidth: 56 },
  statNum:          { fontSize: 18, fontWeight: '700' },
  statLabel:        { fontSize: 10, color: colors.muted, marginTop: 2 },
  filterRow:        { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 6, flexWrap: 'wrap' },
  pill:             { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  pillActive:       { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText:         { color: colors.muted, fontSize: 13 },
  pillTextActive:   { color: '#fff' },
  searchInput:      { marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text, fontSize: 14 },
  logFilterRow:     { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 6, flexWrap: 'wrap' },
  grid:             { padding: 12 },
  gridItemGap:      { marginRight: 10, marginBottom: 10 },
  gridItemLast:     { marginBottom: 10 },
  empty:            { color: colors.muted, textAlign: 'center', padding: 40 },
  logsContent:      { padding: 12 },
  logRow:           { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  logLevel:         { fontSize: 10, fontWeight: '700', width: 40, paddingTop: 2 },
  logBody:          { flex: 1 },
  logMsg:           { fontSize: 12, color: colors.text, lineHeight: 17 },
  logAt:            { fontSize: 10, color: colors.muted, marginTop: 3 },
});
