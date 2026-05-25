import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { StatusBadge } from './StatusBadge';

export function PosterCard({ item, onPress, width = 110 }) {
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.8}>
      {item.poster_url
        ? <Image source={{ uri: item.poster_url }} style={[styles.poster, { width }]} />
        : <View style={[styles.posterFallback, { width }]}><Text style={styles.emoji}>🎬</Text></View>
      }
      <View style={styles.badgeWrap}>
        {item.status && <StatusBadge status={item.status} />}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.meta}>{item.year || ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function DiscoverCard({ item, onPress, onAdd, added, width = 110, rank }) {
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.8}>
      {item.poster_url
        ? <Image source={{ uri: item.poster_url }} style={[styles.poster, { width }]} />
        : <View style={[styles.posterFallback, { width }]}><Text style={styles.emoji}>🎬</Text></View>
      }
      {rank != null && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      )}
      {onAdd && (
        <TouchableOpacity
          style={[styles.addBtn, added && styles.addBtnAdded]}
          onPress={onAdd}
          disabled={added}
        >
          <Text style={[styles.addBtnText, added && styles.addBtnTextAdded]}>
            {added ? '✓' : '+'}
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.meta}>{item.year || ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

const POSTER_RATIO = 3 / 2;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  poster: {
    aspectRatio: 1 / POSTER_RATIO,
    resizeMode: 'cover',
  },
  posterFallback: {
    aspectRatio: 1 / POSTER_RATIO,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji:           { fontSize: 28 },
  badgeWrap:       { position: 'absolute', top: 6, right: 6 },
  body:            { padding: 6 },
  title:           { fontSize: 11, fontWeight: '600', color: colors.text, lineHeight: 15 },
  meta:            { fontSize: 10, color: colors.muted, marginTop: 2 },
  rankBadge:       { position: 'absolute', bottom: 34, left: 0, backgroundColor: 'rgba(0,0,0,0.78)', borderTopRightRadius: 4, borderBottomRightRadius: 4, paddingHorizontal: 6, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  rankText:        { color: '#fff', fontSize: 11, fontWeight: '900' },
  addBtn:          { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnAdded:     { backgroundColor: '#1a401a' },
  addBtnText:      { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 20 },
  addBtnTextAdded: { color: colors.green },
});
