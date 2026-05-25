import React from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Spinner } from './Spinner';

export default function AlbumTracksModal({ album, tracks, loading, downloading, onClose, onDownload }) {
  return (
    <Modal visible={!!album} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            {album?.cover_url
              ? <Image source={{ uri: album.cover_url }} style={styles.cover} />
              : <View style={[styles.cover, styles.coverFallback]}><Text style={styles.emoji}>♪</Text></View>
            }
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{album?.title}</Text>
              <Text style={styles.subtitle}>{album?.year || ''}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading
          ? <Spinner style={{ paddingVertical: 40 }} />
          : (
            <FlashList
              data={tracks}
              estimatedItemSize={60}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>No tracks found.</Text>}
              renderItem={({ item, index }) => (
                <View style={styles.trackRow}>
                  <Text style={styles.trackNum}>{index + 1}</Text>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackName} numberOfLines={1}>{item.title}</Text>
                    {item.duration_ms && (
                      <Text style={styles.trackDuration}>
                        {Math.floor(item.duration_ms / 60000)}:{String(Math.round((item.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.dlBtn, downloading.has(item.id) && styles.dlBtnActive]}
                    onPress={() => onDownload(item)}
                    disabled={downloading.has(item.id)}
                  >
                    <Text style={styles.dlBtnText}>{downloading.has(item.id) ? '…' : '↓'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )
        }
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInfo:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cover:        { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.card },
  coverFallback:{ alignItems: 'center', justifyContent: 'center' },
  emoji:        { fontSize: 24, color: colors.muted },
  title:        { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle:     { fontSize: 12, color: colors.muted, marginTop: 2 },
  closeBtn:     { padding: 8 },
  closeBtnText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  list:         { paddingBottom: 20 },
  empty:        { color: colors.muted, textAlign: 'center', padding: 30 },
  trackRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  trackNum:     { color: colors.muted, fontSize: 13, width: 24, textAlign: 'center' },
  trackInfo:    { flex: 1 },
  trackName:    { fontSize: 14, fontWeight: '500', color: colors.text },
  trackDuration:{ fontSize: 11, color: colors.muted, marginTop: 2 },
  dlBtn:        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dlBtnActive:  { borderColor: colors.accent },
  dlBtnText:    { color: colors.accent, fontSize: 16, fontWeight: '700' },
});
