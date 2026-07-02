import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, AppState, ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, statusColors } from '../../theme';
import { aria, ApiError } from '../../api/aria';
import { getLastKnown } from '../../api/config';
import { StatusBadge } from '../../components/StatusBadge';

// Poll fast while something is in flight so progress feels live; back off to a
// gentle idle cadence when everything has settled (saves battery/requests).
const ACTIVE_POLL_MS = 4000;
const IDLE_POLL_MS   = 15000;

function StateIcon({ state }) {
  if (state === 'downloading') return <ActivityIndicator size="small" color={colors.accent2} />;
  const icon = {
    queued: 'time-outline',
    done:   'checkmark-circle',
    failed: 'alert-circle',
  }[state] || 'ellipse-outline';
  return <Ionicons name={icon} size={22} color={statusColors[state] ?? colors.muted} />;
}

function DownloadRow({ item }) {
  const subtitle = item.kind === 'album'
    ? `Album · ${item.artist}`
    : (item.album ? `${item.artist} · ${item.album}` : item.artist);
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}><StateIcon state={item.state} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title || item.album}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
        {item.state === 'done' && item.source ? (
          <Text style={styles.rowMeta} numberOfLines={1}>via {item.source}</Text>
        ) : null}
        {item.state === 'failed' && item.error ? (
          <Text style={styles.rowError} numberOfLines={2}>{item.error}</Text>
        ) : null}
      </View>
      <StatusBadge status={item.state} />
    </View>
  );
}

export default function DownloadsScreen() {
  const [items,      setItems]      = useState([]);
  const [active,     setActive]     = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [offline,    setOffline]    = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    setOffline(false);
    try {
      const data = await aria.downloads();
      setItems(data.items || []);
      setActive(data.active || 0);
    } catch (e) {
      if (e instanceof ApiError && e.isOffline) {
        setOffline(true);
        const cached = getLastKnown('aria');
        if (cached && cached.path === '/api/downloads' && cached.data?.items) {
          setItems(cached.data.items);
        }
      } else {
        setError(e.message || 'Failed to load downloads');
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Self-rescheduling poll: cadence depends on whether anything is active, so a
  // finished queue doesn't keep hammering the backend every few seconds.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const tick = async () => {
      if (AppState.currentState === 'active') await load(true);
      if (cancelled) return;
      const delay = active > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
      timerRef.current = setTimeout(tick, delay);
    };
    load();
    timerRef.current = setTimeout(tick, ACTIVE_POLL_MS);
    return () => { cancelled = true; clearTimeout(timerRef.current); };
  }, [load, active]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Downloads</Text>
        {active > 0 ? (
          <View style={styles.activePill}>
            <ActivityIndicator size="small" color={colors.accent2} />
            <Text style={styles.activePillText}>{active} active</Text>
          </View>
        ) : null}
      </View>

      {offline ? (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerText}>Offline — showing last known activity</Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent2} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-download-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>No downloads yet</Text>
          <Text style={styles.emptySub}>Tracks and albums you download will show their progress here.</Text>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(it) => String(it.id)}
          estimatedItemSize={72}
          renderItem={({ item }) => <DownloadRow item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent2} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e1a3a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  activePillText: { color: colors.accent2, fontSize: 12, fontWeight: '700' },
  banner: { paddingHorizontal: 16, paddingVertical: 8 },
  bannerWarn: { backgroundColor: '#2d2a00' },
  bannerError: { backgroundColor: '#3d1515' },
  bannerText: { color: colors.text, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  listContent: { padding: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  iconWrap: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowMeta: { color: colors.green, fontSize: 11, marginTop: 2 },
  rowError: { color: colors.red, fontSize: 11, marginTop: 2 },
});
