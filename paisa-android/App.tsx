/**
 * PAISA Android App
 *
 * Architecture:
 * - WebView loads the Paisa PWA (from Vercel or local)
 * - Native SMS bridge reads bank messages and injects them into the WebView
 * - Permission handling for READ_SMS
 *
 * The WebView and native layer communicate via postMessage/onMessage.
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Alert,
  BackHandler,
  AppState,
  type AppStateStatus,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readBankSMS, readNewSMS } from "./src/SMSService";
import type { ParsedSMS } from "./src/sms-parser";

const PAISA_URL = "https://exptracker-chi.vercel.app";
const LAST_SMS_SYNC_KEY = "paisa_last_sms_sync";
const SMS_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [smsSyncStatus, setSMSSyncStatus] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);

  // ─── Permission Request ───
  const requestSMSPermission = useCallback(async () => {
    if (Platform.OS !== "android") {
      setPermissionChecked(true);
      return;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: "Paisa needs SMS access",
          message:
            "To automatically detect your bank transactions, Paisa needs to read your SMS messages. " +
            "Only bank transaction messages are processed. No data leaves your device.",
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        }
      );

      const hasIt = granted === PermissionsAndroid.RESULTS.GRANTED;
      setHasPermission(hasIt);
      setPermissionChecked(true);

      if (hasIt) {
        // Also request RECEIVE_SMS for real-time detection
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
        );
        // Do initial sync
        syncSMS();
      }
    } catch (err) {
      console.log("[Paisa] Permission error:", err);
      setPermissionChecked(true);
    }
  }, []);

  // ─── SMS Sync ───
  const syncSMS = useCallback(async () => {
    try {
      setSMSSyncStatus("Reading messages...");

      // Get last sync time
      const lastSync = await AsyncStorage.getItem(LAST_SMS_SYNC_KEY);
      const sinceTimestamp = lastSync ? parseInt(lastSync) : Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days back for first sync

      const transactions = lastSync
        ? await readNewSMS(sinceTimestamp)
        : await readBankSMS(30);

      if (transactions.length > 0) {
        setSMSSyncStatus(`Found ${transactions.length} transactions`);

        // Send to WebView
        const message = JSON.stringify({
          type: "SMS_TRANSACTIONS",
          data: transactions,
        });
        webviewRef.current?.postMessage(message);

        console.log(`[Paisa] Sent ${transactions.length} SMS transactions to WebView`);
      } else {
        setSMSSyncStatus("Up to date");
      }

      // Update last sync time
      await AsyncStorage.setItem(LAST_SMS_SYNC_KEY, String(Date.now()));

      // Clear status after a moment
      setTimeout(() => setSMSSyncStatus(""), 3000);
    } catch (err) {
      console.log("[Paisa] SMS sync error:", err);
      setSMSSyncStatus("SMS read failed");
      setTimeout(() => setSMSSyncStatus(""), 3000);
    }
  }, []);

  // ─── Initial permission check ───
  useEffect(() => {
    requestSMSPermission();
  }, [requestSMSPermission]);

  // ─── Periodic SMS check ───
  useEffect(() => {
    if (!hasPermission) return;

    const interval = setInterval(syncSMS, SMS_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [hasPermission, syncSMS]);

  // ─── App state change → sync on resume ───
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && hasPermission) {
        syncSMS();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [hasPermission, syncSMS]);

  // ─── Handle back button ───
  useEffect(() => {
    const handler = () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    BackHandler.addEventListener("hardwareBackPress", handler);
    return () => BackHandler.removeEventListener("hardwareBackPress", handler);
  }, [canGoBack]);

  // ─── Handle messages from WebView ───
  const onWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === "REQUEST_SMS_SYNC") {
          syncSMS();
        } else if (msg.type === "REQUEST_SMS_PERMISSION") {
          requestSMSPermission();
        }
      } catch {
        // Not JSON, ignore
      }
    },
    [syncSMS, requestSMSPermission]
  );

  // JavaScript to inject into WebView — creates the bridge
  const injectedJS = `
    (function() {
      // Listen for SMS data from native
      window.addEventListener('message', function(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'SMS_TRANSACTIONS') {
            // Store in IndexedDB via the Paisa app
            if (window.__paisaSMSHandler) {
              window.__paisaSMSHandler(data.data);
            } else {
              // Queue for when the app is ready
              window.__paisaSMSQueue = window.__paisaSMSQueue || [];
              window.__paisaSMSQueue.push(data.data);
            }
          }
        } catch(e) {}
      });

      // Expose native bridge to the web app
      window.__paisaNative = {
        requestSMSSync: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_SMS_SYNC' }));
        },
        requestSMSPermission: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_SMS_PERMISSION' }));
        },
        isNativeApp: true,
      };

      true; // Required for injectedJavaScript
    })();
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#6366F1" barStyle="light-content" />

      {/* SMS sync status bar */}
      {smsSyncStatus ? (
        <View style={styles.syncBar}>
          <Text style={styles.syncText}>{smsSyncStatus}</Text>
        </View>
      ) : null}

      {/* WebView — loads the Paisa PWA */}
      <WebView
        ref={webviewRef}
        source={{ uri: PAISA_URL }}
        style={styles.webview}
        injectedJavaScript={injectedJS}
        onMessage={onWebViewMessage}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowFileAccess={true}
        allowsBackForwardNavigationGestures={true}
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        renderLoading={() => (
          <View style={styles.loading}>
            <View style={styles.loadingIcon}>
              <Text style={styles.loadingIconText}>₹</Text>
            </View>
            <Text style={styles.loadingText}>Loading Paisa...</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#6366F1",
  },
  webview: {
    flex: 1,
  },
  syncBar: {
    backgroundColor: "#4F46E5",
    paddingVertical: 4,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  syncText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  loadingIconText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
  },
});
