import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme';
import { orion } from '../../api/orion';

// Friendly labels for the predictor's feature kinds. Keeps the UI readable
// without having to teach users the schema field names.
const KIND_LABEL = {
  release_group: 'Release group',
  cdn_host:      'CDN host',
  hash:          'Torrent hash',
  provider:      'Provider',
};

function shortVal(val) {
  // Hashes are 40-char hex — collapse for the table view.
  if (typeof val === 'string' && /^[a-f0-9]{40}$/.test(val)) {
    return `${val.slice(0, 8)}…${val.slice(-4)}`;
  }
  return val;
}

export default function PredictorDebugScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const d = await orion.predictorDiag(1, 25);
      setData(d);
    } catch (e) {
      setError(e?.message || 'Failed to load predictor diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Predictor Debug</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text} />}
      >
        {loading && <ActivityIndicator color={colors.accent2} style={{ marginTop: 32 }} />}

        {error && !loading && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {data && (
          <>
            <Text style={styles.sectionHead}>Totals by feature kind</Text>
            <View style={styles.card}>
              {(data.stats || []).map(s => (
                <View key={s.feature_kind} style={styles.statRow}>
                  <Text style={styles.statLabel}>{KIND_LABEL[s.feature_kind] ?? s.feature_kind}</Text>
                  <Text style={styles.statValue}>
                    {s.total_alive} alive · {s.total_dead} dead · {s.distinct_values} distinct
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionHead}>Top dead-rate features</Text>
            <Text style={styles.sectionSub}>
              Predictor avoids URLs matching these. Decays exponentially with a 14-day half-life
              so stale "dead" signals don't permanently block recovered groups.
            </Text>
            <View style={styles.card}>
              {(data.top_dead || []).map((t, i) => (
                <View key={`${t.kind}:${t.value}:${i}`} style={styles.deadRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deadValue}>{shortVal(t.value)}</Text>
                    <Text style={styles.deadKind}>{KIND_LABEL[t.kind] ?? t.kind}</Text>
                  </View>
                  <View style={styles.deadStats}>
                    <Text style={styles.deadRate}>{(t.dead_rate * 100).toFixed(0)}% dead</Text>
                    <Text style={styles.deadCounts}>{t.alive}↑ {t.dead}↓</Text>
                  </View>
                </View>
              ))}
              {(!data.top_dead || data.top_dead.length === 0) && (
                <Text style={styles.emptyText}>No samples yet. Run a cycle to populate.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  closeBtn:    { padding: 4, marginRight: 12 },
  title:       { fontSize: 20, fontWeight: '700', color: colors.text },
  scroll:      { padding: 20, paddingBottom: 40 },
  sectionHead: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  sectionSub:  { fontSize: 12, color: colors.muted, marginBottom: 8, lineHeight: 17 },
  card:        { backgroundColor: colors.card, borderRadius: 10, padding: 12 },
  statRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statLabel:   { color: colors.text, fontSize: 14, fontWeight: '600' },
  statValue:   { color: colors.muted, fontSize: 12 },
  deadRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  deadValue:   { color: colors.text, fontSize: 14, fontFamily: 'monospace' },
  deadKind:    { color: colors.muted, fontSize: 11, marginTop: 2 },
  deadStats:   { alignItems: 'flex-end' },
  deadRate:    { color: colors.red, fontSize: 13, fontWeight: '700' },
  deadCounts:  { color: colors.muted, fontSize: 11, marginTop: 2 },
  emptyText:   { color: colors.muted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  errorText:   { color: colors.red, fontSize: 14, marginTop: 24, textAlign: 'center' },
});
