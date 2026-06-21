import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, AppState, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { orion, ApiError } from '../api/orion';

const POLL_MS = 30000;

function formatAge(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function dotColorFor(health) {
  if (!health) return colors.muted ?? '#888899';
  if (health.unreachable) return colors.red;
  if (!health.ok) return colors.yellow;
  return colors.green;
}

function labelFor(health) {
  if (!health) return 'Checking…';
  if (health.unreachable) return 'Unreachable';
  const cycle = health.checks?.cycle;
  if (cycle?.status === 'warming') return 'Warming up';
  if (cycle?.status === 'stale') return `Stalled · cycle ${formatAge(cycle.age_seconds)}`;
  if (cycle?.status === 'ok') return `Healthy · cycle ${formatAge(cycle.age_seconds)}`;
  return health.ok ? 'Healthy' : 'Degraded';
}

export function OrionHealthIndicator({ compact = false, onPress }) {
  const [health, setHealth] = useState(null);
  const timerRef = useRef(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await orion.health();
      setHealth(data);
    } catch (e) {
      // Surface offline/network failures as a distinct state rather than
      // letting `health` stay stale.
      setHealth({ ok: false, unreachable: true, error: e?.message });
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    timerRef.current = setInterval(() => {
      if (AppState.currentState === 'active') fetchHealth();
    }, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchHealth]);

  const dot = <View style={[styles.dot, { backgroundColor: dotColorFor(health) }]} />;

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress ?? fetchHealth}
        accessibilityRole="button"
        accessibilityLabel={`Orion status: ${labelFor(health)}`}
        style={styles.compact}
      >
        {dot}
      </TouchableOpacity>
    );
  }

  const cycle = health?.checks?.cycle;
  const predictor = health?.checks?.predictor_db;
  const cache = health?.checks?.tmdb_cache;

  return (
    <TouchableOpacity
      onPress={onPress ?? fetchHealth}
      accessibilityRole="button"
      accessibilityLabel={`Orion status: ${labelFor(health)}. Tap to refresh.`}
      style={styles.full}
    >
      <View style={styles.fullHeader}>
        {dot}
        <Text style={styles.fullLabel}>{labelFor(health)}</Text>
      </View>
      {health && !health.unreachable && (
        <View style={styles.detailGrid}>
          <Text style={styles.detailRow}>
            Cycle: {cycle?.status ?? '—'}
            {cycle?.poll_interval ? ` (poll ${cycle.poll_interval}s)` : ''}
          </Text>
          <Text style={styles.detailRow}>
            Predictor DB: {predictor?.status ?? '—'}
            {predictor?.feature_kinds != null ? ` · ${predictor.feature_kinds} feature kinds` : ''}
          </Text>
          <Text style={styles.detailRow}>
            TMDB cache: {cache?.entries ?? '—'} entries
            {cache?.ttl_seconds ? ` · TTL ${Math.round(cache.ttl_seconds / 3600)}h` : ''}
          </Text>
        </View>
      )}
      {health?.unreachable && (
        <Text style={styles.errorText}>{health.error || 'Network error'}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compact: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  full: {
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullLabel: {
    color: colors.text ?? '#eee',
    fontSize: 14,
    fontWeight: '600',
  },
  detailGrid: {
    marginTop: 8,
    gap: 2,
  },
  detailRow: {
    color: colors.muted ?? '#888899',
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: colors.red,
    fontSize: 12,
  },
});
