import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import VideoDiscoverTab from './VideoDiscoverTab';
import MusicDiscoverTab from './MusicDiscoverTab';

export default function DiscoverScreen() {
  const [mode, setMode] = useState('video');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modePill, mode === 'video' && styles.modePillActive]}
          onPress={() => setMode('video')}
        >
          <Text style={[styles.modePillText, mode === 'video' && styles.modePillTextActive]}>🎬 Video</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modePill, mode === 'music' && styles.modePillActive]}
          onPress={() => setMode('music')}
        >
          <Text style={[styles.modePillText, mode === 'music' && styles.modePillTextActive]}>🎵 Music</Text>
        </TouchableOpacity>
      </View>

      {mode === 'video' ? <VideoDiscoverTab /> : <MusicDiscoverTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: colors.bg },
  modeRow:           { flexDirection: 'row', marginHorizontal: 12, marginTop: 12, gap: 8 },
  modePill:          { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modePillActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  modePillText:      { color: colors.muted, fontSize: 14, fontWeight: '600' },
  modePillTextActive:{ color: '#fff' },
});
