import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
let _lastKnown = { orion: null, aria: null };
export function setLastKnown(service, data) { _lastKnown[service] = data; }
export function getLastKnown(service) { return _lastKnown[service]; }

const KEYS = {
  orion:  'orion_url',
  aria:   'aria_url',
  apiKey: 'api_key',
};

const DEFAULTS = {
  orion:  '',
  aria:   '',
  apiKey: '',
};

let _cache = null;

export async function getConfig() {
  if (_cache) return _cache;
  const [orion, aria, secureKey] = await Promise.all([
    AsyncStorage.getItem(KEYS.orion),
    AsyncStorage.getItem(KEYS.aria),
    SecureStore.getItemAsync(KEYS.apiKey),
  ]);

  // One-time migration: move API key from AsyncStorage to SecureStore
  let apiKey = secureKey;
  if (!apiKey) {
    const legacyKey = await AsyncStorage.getItem(KEYS.apiKey);
    if (legacyKey) {
      await SecureStore.setItemAsync(KEYS.apiKey, legacyKey);
      await AsyncStorage.removeItem(KEYS.apiKey);
      apiKey = legacyKey;
    }
  }

  _cache = {
    orion:  orion  ?? DEFAULTS.orion,
    aria:   aria   ?? DEFAULTS.aria,
    apiKey: apiKey ?? DEFAULTS.apiKey,
  };
  return _cache;
}

export async function saveConfig({ orion, aria, apiKey }) {
  await Promise.all([
    AsyncStorage.setItem(KEYS.orion,  orion.trim()),
    AsyncStorage.setItem(KEYS.aria,   aria.trim()),
    SecureStore.setItemAsync(KEYS.apiKey, apiKey.trim()),
  ]);
  _cache = null;
}
