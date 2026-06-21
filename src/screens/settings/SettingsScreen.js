import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
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

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PredictorDebug')}
        >
          <Text style={styles.actionIcon}>🔍</Text>
          <Text style={styles.actionLabel}>Predictor Debug</Text>
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
