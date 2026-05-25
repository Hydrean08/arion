import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, statusColors, statusBg } from '../theme';

export function AlbumCard({ album, onPress, onRetry, onWant, width = 140 }) {
  const status = album.status ?? 'missing';
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cover, { width }]}>
        {album.cover_url
          ? <Image source={{ uri: album.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <Text style={styles.emoji}>♪</Text>
        }
        <View style={[styles.statusDot, { backgroundColor: statusColors[status] ?? colors.muted }]} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{album.title}</Text>
        <Text style={styles.year}>{album.year || ''}</Text>
        <View style={[styles.badge, { backgroundColor: statusBg[status] ?? colors.card }]}>
          <Text style={[styles.badgeText, { color: statusColors[status] ?? colors.muted }]}>
            {status.toUpperCase()}
          </Text>
        </View>
        {album.track_count > 0 && (
          <Text style={styles.trackCount}>{album.track_count} tracks</Text>
        )}
        {onWant && (
          <TouchableOpacity style={[styles.wantBtn, album.wanted && styles.wantBtnActive]} onPress={onWant}>
            <Text style={[styles.wantText, album.wanted && styles.wantTextActive]}>
              {album.wanted ? '✓ Wanted' : '↓ Want'}
            </Text>
          </TouchableOpacity>
        )}
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>↻ Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    aspectRatio: 1,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 32, color: colors.muted },
  statusDot: {
    position: 'absolute', bottom: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
  },
  body: { padding: 8 },
  title: { fontSize: 12, fontWeight: '600', color: colors.text, lineHeight: 16 },
  year:  { fontSize: 11, color: colors.muted, marginTop: 2 },
  badge:      { marginTop: 5, alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  trackCount: { fontSize: 9, color: colors.muted, marginTop: 2 },
  wantBtn:        { marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#1a2d1a', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  wantBtnActive:  { backgroundColor: '#0d1f0d' },
  wantText:       { fontSize: 9, fontWeight: '700', color: colors.green },
  wantTextActive: { color: colors.muted },
  retryBtn:   { marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#3d1515', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  retryText:  { fontSize: 9, fontWeight: '700', color: colors.red },
});
