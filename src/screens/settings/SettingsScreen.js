import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { getConfig, saveConfig } from '../../api/config';
import { orion } from '../../api/orion';
import { aria } from '../../api/aria';
import { OrionHealthIndicator } from '../../components/OrionHealthIndicator';
import { AriaHealthIndicator } from '../../components/AriaHealthIndicator';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [orionUrl,    setOrionUrl]    = useState('');
  const [ariaUrl,     setAriaUrl]     = useState('');
  const [apiKey,      setApiKey]      = useState('');
  const [saved,       setSaved]       = useState(false);
  const [orionStatus, setOrionStatus] = useState(null);
  const [ariaStatus,  setAriaStatus]  = useState(null);

  useEffect(() => {
    getConfig().then(({ orion: o, aria: a, apiKey: k }) => {
      setOrionUrl(o);
      setAriaUrl(a);
      setApiKey(k);
    });
  }, []);

  const save = useCallback(async () => {
    const config = await getConfig();
    await saveConfig({
      orion:  orionUrl.trim()  || config.orion,
      aria:   ariaUrl.trim()   || config.aria,
      apiKey,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [orionUrl, ariaUrl, apiKey]);

  const testOrion = useCallback(async () => {
    setOrionStatus('testing');
    try {
      await orion.stats();
      setOrionStatus('ok');
    } catch (e) {
      setOrionStatus('fail');
      Alert.alert('Orion test failed', e?.message || 'Unknown error');
    }
  }, []);

  const testAria = useCallback(async () => {
    setAriaStatus('testing');
    try {
      await aria.stats();
      setAriaStatus('ok');
    } catch (e) {
      setAriaStatus('fail');
      Alert.alert('Aria test failed', e?.message || 'Unknown error');
    }
  }, []);

  const scanJellyfin = useCallback(() => {
    Alert.alert(
      'Scan Jellyfin Library',
      'Trigger a full library scan now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Scan', onPress: async () => {
          try {
            await orion.scan();
            Alert.alert('Jellyfin Scan', 'Library scan triggered successfully.');
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }},
      ],
    );
  }, []);

  const runOrionCycle = useCallback(() => {
    Alert.alert(
      'Run Orion Cycle',
      'Start the processing cycle now? This will queue new downloads.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run', onPress: async () => {
          try {
            await orion.runCycle();
            Alert.alert('Orion', 'Processing cycle started.');
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }},
      ],
    );
  }, []);

  const runAriaCycle = useCallback(() => {
    Alert.alert(
      'Run Aria Cycle',
      'Start the download cycle now? This will process queued albums.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run', onPress: async () => {
          try {
            await aria.runCycle();
            Alert.alert('Aria', 'Download cycle started.');
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }},
      ],
    );
  }, []);

  const scanAriaLibrary = useCallback(() => {
    Alert.alert(
      'Scan Existing Library',
      'Walk Aria\'s music folder and mark already-on-disk albums as complete. Safe to re-run.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Scan', onPress: async () => {
          try {
            const r = await aria.scanExisting();
            Alert.alert(
              'Scan complete',
              `Matched ${r.matched_albums} album${r.matched_albums === 1 ? '' : 's'} across ${r.scanned_artists} artists (${r.unmatched_dirs} unmatched dirs).`
            );
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }},
      ],
    );
  }, []);

  const importLibrary = useCallback(() => {
    Alert.alert(
      'Import Disk',
      'Scan your music folder and add everything on disk to Aria. Only adds library entries — never moves or deletes files. Takes a minute or two.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: async () => {
          try {
            const r = await aria.importLibrary();
            Alert.alert('Import complete', `+${r.artists_created} artists, +${r.albums_created} albums, ${r.albums_reconciled} reconciled.`);
          } catch (e) { Alert.alert('Error', e.message); }
        }},
      ],
    );
  }, []);

  const completeArtists = useCallback(() => {
    Alert.alert(
      'Complete Artists',
      'Fill in imported artists’ photos and full discographies from the catalog. Runs in the background; nothing auto-downloads. Ambiguous / soundtrack names are skipped.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: async () => {
          try {
            await aria.enrichImported();
            Alert.alert('Started', 'Enrichment is running in the background — artists will gain photos and discographies over the next few minutes. Pull to refresh to see them.');
          } catch (e) { Alert.alert('Error', e.message); }
        }},
      ],
    );
  }, []);

  const cleanStrays = useCallback(() => {
    Alert.alert(
      'Clean Stray Files',
      'Fingerprint loose / untagged files, give them a real artist and title, and file root-level strays into the artist’s folder. Reversible. Takes a minute or two.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clean', onPress: async () => {
          try {
            const r = await aria.cleanupStrays();
            Alert.alert('Stray cleanup', `Tagged ${r.tagged} file${r.tagged === 1 ? '' : 's'}, moved ${r.moved}. Run Import Disk to register them.`);
          } catch (e) { Alert.alert('Error', e.message); }
        }},
      ],
    );
  }, []);

  const fixDumpArtists = useCallback(() => {
    Alert.alert(
      'Fix Dump / Collab Artists',
      'Split "Discography" dumps and collab-string artists into their real primary artist so they become discoverable. Verified against the catalog; reversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Fix', onPress: async () => {
          try {
            const r = await aria.fixDumpArtists();
            Alert.alert('Fix artists', `Split ${r.artists_fixed} artist${r.artists_fixed === 1 ? '' : 's'}, retagged ${r.files_fixed} file${r.files_fixed === 1 ? '' : 's'}.`);
          } catch (e) { Alert.alert('Error', e.message); }
        }},
      ],
    );
  }, []);

  const checkAppUpdate = useCallback(async () => {
    try {
      const { aria: ariaBase } = await getConfig();
      const j = await aria.appVersion();
      if (!j.apkLatest) {
        Alert.alert('No build', 'No Arion APK is published on the server right now.');
        return;
      }
      const INSTALLED = '@arion/installedApk';
      const installed = await AsyncStorage.getItem(INSTALLED);
      const download = async () => {
        // Record intent before handing to the OS installer; worst case is a
        // stale "up to date", recoverable via "Download anyway".
        await AsyncStorage.setItem(INSTALLED, j.apkLatest);
        Linking.openURL(ariaBase + j.apkUrl);
      };
      if (installed === j.apkLatest) {
        Alert.alert(
          'Up to date',
          `Latest APK: ${j.apkLatest}\n\nThis matches what you last installed here.`,
          [{ text: 'OK', style: 'cancel' }, { text: 'Download anyway', onPress: download }],
        );
        return;
      }
      Alert.alert(
        'Update available',
        `Latest APK: ${j.apkLatest}\n\nTap Download to fetch and install. Android will ask once to allow installs from the browser.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Download', onPress: download }],
      );
    } catch (e) {
      Alert.alert('Update check failed', e?.message || String(e));
    }
  }, []);

  const undoCleanup = useCallback(() => {
    Alert.alert(
      'Undo Last Cleanup',
      'Move relocated files back and restore original tags from the stray-cleanup and artist-fix passes. Does not affect enrichment.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: async () => {
          try {
            const r = await aria.cleanupUndo();
            Alert.alert('Undone', `Moved back ${r.moved_back} file${r.moved_back === 1 ? '' : 's'}, restored tags on ${r.tags_restored}.`);
          } catch (e) { Alert.alert('Error', e.message); }
        }},
      ],
    );
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Settings</Text>

        <Text style={styles.label}>Orion URL</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={orionUrl}
            onChangeText={setOrionUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholderTextColor={colors.muted}
            placeholder="http://192.168.1.10:8888"
          />
          <TouchableOpacity style={styles.testBtn} onPress={testOrion} disabled={orionStatus === 'testing'} accessibilityRole="button" accessibilityLabel="Test Orion connection">
            <Text style={[styles.testBtnText, orionStatus === 'ok' && { color: colors.green }, orionStatus === 'fail' && { color: colors.red }]}>
              {orionStatus === 'testing' ? '…' : orionStatus === 'ok' ? '✓' : orionStatus === 'fail' ? '✗' : 'Test'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Aria URL</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={ariaUrl}
            onChangeText={setAriaUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholderTextColor={colors.muted}
            placeholder="http://192.168.1.10:7171"
          />
          <TouchableOpacity style={styles.testBtn} onPress={testAria} disabled={ariaStatus === 'testing'} accessibilityRole="button" accessibilityLabel="Test Aria connection">
            <Text style={[styles.testBtnText, ariaStatus === 'ok' && { color: colors.green }, ariaStatus === 'fail' && { color: colors.red }]}>
              {ariaStatus === 'testing' ? '…' : ariaStatus === 'ok' ? '✓' : ariaStatus === 'fail' ? '✗' : 'Test'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={[styles.input, styles.inputFull]}
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholderTextColor={colors.muted}
          placeholder="Shared key for Orion and Aria"
        />

        <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={save}>
          <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionHead}>Orion Status</Text>
        {/* Self-polling indicator hits /health every 30s. Shows cycle
            freshness, predictor DB health, and TMDB cache size — the same
            signals you'd otherwise need to SSH in to check. */}
        <OrionHealthIndicator />

        <Text style={styles.sectionHead}>Aria Status</Text>
        {/* Music manager's health. Cycle status, DB readability, and Ollama
            reachability (Ollama down only disables AI suggestions; music
            sync keeps running). */}
        <AriaHealthIndicator />

        <View style={styles.divider} />
        <Text style={styles.sectionHead}>Actions</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={scanJellyfin}>
          <Text style={styles.actionIcon}>🎞️</Text>
          <Text style={styles.actionLabel}>Scan Jellyfin Library</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={runOrionCycle}>
          <Text style={styles.actionIcon}>🎬</Text>
          <Text style={styles.actionLabel}>Run Orion Processing Cycle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={runAriaCycle}>
          <Text style={styles.actionIcon}>🎵</Text>
          <Text style={styles.actionLabel}>Run Aria Download Cycle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={scanAriaLibrary}>
          <Text style={styles.actionIcon}>📁</Text>
          <Text style={styles.actionLabel}>Scan Existing Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PredictorDebug')}
        >
          <Text style={styles.actionIcon}>🔍</Text>
          <Text style={styles.actionLabel}>Predictor Debug</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionHead}>Library Maintenance</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={importLibrary}>
          <Text style={styles.actionIcon}>💽</Text>
          <Text style={styles.actionLabel}>Import Disk</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={completeArtists}>
          <Text style={styles.actionIcon}>🎨</Text>
          <Text style={styles.actionLabel}>Complete Artists (photos + discographies)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={cleanStrays}>
          <Text style={styles.actionIcon}>🧹</Text>
          <Text style={styles.actionLabel}>Clean Stray Files</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={fixDumpArtists}>
          <Text style={styles.actionIcon}>🔧</Text>
          <Text style={styles.actionLabel}>Fix Dump / Collab Artists</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={undoCleanup}>
          <Text style={styles.actionIcon}>↩️</Text>
          <Text style={styles.actionLabel}>Undo Last Cleanup</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionHead}>App Update</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={checkAppUpdate}>
          <Text style={styles.actionIcon}>⬆️</Text>
          <Text style={styles.actionLabel}>Check for Arion Update</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { padding: 20, paddingBottom: 40 },
  heading:     { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 28 },
  label:       { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  input: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14,
  },
  inputFull:   { flex: undefined, marginBottom: 20 },
  testBtn:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  testBtnText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  saveBtn:     { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  saveBtnDone: { backgroundColor: '#1a401a' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: colors.border, marginVertical: 24 },
  sectionHead: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16, marginBottom: 10 },
  actionIcon:  { fontSize: 20 },
  actionLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
});
