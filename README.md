# Arion

Android mobile companion app for **[Orion](https://github.com/Hydrean08/orion)** (media automation) and **[Aria](https://github.com/Hydrean08/aria)** (AI music curation) — a single React Native / Expo client that gives both self-hosted services a unified mobile interface.

## What it does

Arion is a thin native shell that points at your own Orion and Aria instances:

- **Library browse and search** across both services from one home screen
- **Aria's AI suggestions panel** — surfaces the local-LLM-generated weekly artist suggestions and themed/mood playlists
- **Orion stream status** — see Bayesian-predictor candidate rankings and health
- **Settings screen** with live connection tests for both backends (URL, API key, ping)
- **Push notifications** via Expo for download/playlist events
- **Secure credential storage** via `expo-secure-store`

There is no bundled backend, no cloud service, no telemetry. You point Arion at your own URLs (LAN, VPN, or tunneled) and it speaks to your instances directly.

## Stack

- **Framework:** Expo SDK 52, React Native 0.76, React 18.3
- **Navigation:** `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`
- **State / storage:** `@react-native-async-storage/async-storage`, `expo-secure-store`
- **Lists:** `@shopify/flash-list` (for big library views)
- **Notifications:** `expo-notifications` + `expo-device`

## Setup (development)

```bash
git clone https://github.com/Hydrean08/arion
cd arion
npm install

# Start the Metro bundler
npx expo start

# Or build a release APK
npx expo prebuild
cd android && ./gradlew assembleRelease
```

Open the app, go to the **Settings** screen, and enter your Orion and Aria URLs + API keys. The "Test" buttons confirm connectivity before anything else tries to talk to the backends.

## Configuration

There is no `.env` file — Arion stores all configuration in `expo-secure-store` at runtime:

| Setting | Set in Settings screen | Purpose |
|---|---|---|
| Orion URL | Required for Orion features | e.g. `http://192.168.1.10:8888` or `https://orion.example.com` |
| Aria URL | Required for Aria features | e.g. `http://192.168.1.10:7171` or `https://aria.example.com` |
| API Key | Optional | Sent as `X-API-Key` header (matches `ARIA_API_KEY` / `ORION_API_KEY` in those services) |

## Disclaimer

Arion is a personal-use client for self-hosted services *you* are running. It does not provide media, music, accounts, or backend infrastructure — it only consumes your own Orion and Aria instances. See those projects' disclaimers for the legal framing around what they integrate with.

## License

MIT — see [LICENSE](LICENSE).
