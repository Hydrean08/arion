import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function Spinner({ size = 'small', style }) {
  return (
    <View style={[styles.wrap, style]}>
      <ActivityIndicator size={size} color={colors.accent} />
    </View>
  );
}

export function FullSpinner() {
  return (
    <View style={styles.full}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
