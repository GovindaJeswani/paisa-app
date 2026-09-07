# Paisa Android — Native SMS Auto-Reader

This is the native Android wrapper for Paisa. It adds the one feature a PWA can't have: **automatic SMS reading**.

## What it does

1. **Reads bank SMS automatically** — When you receive a transaction SMS from your bank, the app detects it in real-time
2. **Parses the SMS** — Extracts amount, merchant, date, bank, account number, UPI reference
3. **Auto-categorizes** — Swiggy → Food, Uber → Transport, Amazon → Shopping, etc.
4. **Creates transactions** — Sends parsed data to the Paisa web app running inside a WebView
5. **Works in background** — The SMS receiver runs even when the app is not open

## Supported Banks

HDFC, SBI, ICICI, Axis, Kotak, BOB, PNB, Yes Bank, IDBI, Canara, Union, IndusInd, Federal, Paytm, PhonePe, GPay, CRED, Amazon Pay, and any SMS with standard Indian bank transaction format.

## Architecture

```
┌─────────────────────────────┐
│     Android OS              │
│  ┌───────────────────────┐  │
│  │  SMSReceiver.java     │  │  ← Intercepts incoming SMS in real-time
│  │  (BroadcastReceiver)  │  │
│  └──────────┬────────────┘  │
│             │               │
│  ┌──────────▼────────────┐  │
│  │  SMSService.ts        │  │  ← Reads SMS from inbox on app open
│  │  (react-native-get-   │  │
│  │   sms-android)        │  │
│  └──────────┬────────────┘  │
│             │               │
│  ┌──────────▼────────────┐  │
│  │  sms-parser.ts        │  │  ← Parses bank SMS → structured data
│  └──────────┬────────────┘  │
│             │               │
│  ┌──────────▼────────────┐  │
│  │  App.tsx (WebView)    │  │  ← Sends to Paisa web app via postMessage
│  │  ↕ postMessage bridge │  │
│  └──────────┬────────────┘  │
│             │               │
│  ┌──────────▼────────────┐  │
│  │  Paisa PWA            │  │  ← Full web app (exptracker-chi.vercel.app)
│  │  (IndexedDB + Dexie)  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

## How to Build

### Prerequisites

1. **Node.js** 18+
2. **Android Studio** with Android SDK 34
3. **Java 11** (OpenJDK)

### Setup

```bash
cd paisa-android
npm install

# Generate the Android project
npx react-native init PaisaAndroid --template react-native-template-typescript

# Copy our source files over the generated project:
# - Copy App.tsx → PaisaAndroid/App.tsx
# - Copy src/ → PaisaAndroid/src/
# - Copy AndroidManifest.xml → PaisaAndroid/android/app/src/main/AndroidManifest.xml
# - Copy SMSReceiver.java → PaisaAndroid/android/app/src/main/java/com/paisa/app/
```

### Build Debug APK

```bash
cd android
./gradlew assembleDebug
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Build Release APK

```bash
cd android
./gradlew assembleRelease
```

### Install on Phone

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or transfer the APK file to your phone and install it directly.

## Permissions

The app requests these permissions:

| Permission | Why |
|-----------|-----|
| `READ_SMS` | Read bank transaction messages from your inbox |
| `RECEIVE_SMS` | Detect new bank SMS in real-time |
| `INTERNET` | Load the Paisa web app |
| `CAMERA` | Receipt scanning |

**All SMS processing happens on your device. No SMS data is ever sent to any server.**

## How SMS Auto-Detection Works

1. You receive a bank SMS: `INR 420.00 debited from A/c XX1234 at Swiggy on 05-09-26`
2. Android's `SMSReceiver` intercepts it
3. It checks if it's a bank transaction (sender ID + keywords)
4. If yes, it sends the text to the React Native layer
5. `sms-parser.ts` extracts: amount=420, merchant=Swiggy, bank=HDFC, date=2026-09-05
6. The data is sent to the Paisa WebView via `postMessage`
7. `native-bridge.tsx` in the web app receives it and creates a transaction
8. The transaction appears in your Calendar, Home, and Transactions automatically

**From your perspective: you pay → it appears in the app. Zero manual input.**
