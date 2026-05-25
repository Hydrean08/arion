import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { statusColors, statusBg } from '../theme';

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <Text style={[styles.badge, {
      color: statusColors[status] ?? '#888899',
      backgroundColor: statusBg[status] ?? '#1e1e2e',
    }]}>
      {status.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
