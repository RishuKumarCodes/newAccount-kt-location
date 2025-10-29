import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";

import AskPermissionCard from "@/components/AskPermissioncard";
import PermissionBtns from "@/components/PermissionBtns";
import { usePermissions, PermissionsProvider } from "../context/PermissionsContext";

import {
  getLocationHistory,
  clearLocationHistory,
} from "../services/locationStorage";

import {
  initNotifications,
  handleWebMessageFromPWA,
  setOnNotificationResponse,
  popPendingNotificationResponse,
  getDeliveredNotificationsHistory,
  cleanupNotifications,
  registerForPushNotificationsAsync,
} from "../services/NotificationService";

const AppInner: React.FC = () => {
  const {
    locationPermission,
    location,
    notificationPermission,
    sharingLocation,
    backgroundPermission,
    toggleLocationSharing,
    requestNotificationPermission,
  } = usePermissions();

  const webviewRef = useRef<any>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const pendingMessages = useRef<string[]>([]);

  const postToWeb = (obj: any) => {
    const msg = typeof obj === "string" ? obj : JSON.stringify(obj);
    if (webviewRef.current && webviewReady) {
      try {
        webviewRef.current.postMessage(msg);
      } catch (e) {
        pendingMessages.current.push(msg);
      }
    } else {
      pendingMessages.current.push(msg);
    }
  };

  const flushPending = async () => {
    if (!webviewRef.current) return;

    try {
      // send queued messages
      pendingMessages.current.forEach((m) => webviewRef.current.postMessage(m));
      pendingMessages.current = [];

      // send location history
      const history = await getLocationHistory();
      if (history?.length) {
        webviewRef.current.postMessage(
          JSON.stringify({ type: "history", data: history })
        );
      }

      // send pending notification tap
      const pendingTap = await popPendingNotificationResponse();
      if (pendingTap) {
        webviewRef.current.postMessage(
          JSON.stringify({
            type: "notificationTap",
            data: pendingTap.notification.request.content.data || {},
            title: pendingTap.notification.request.content.title,
            body: pendingTap.notification.request.content.body,
          })
        );
      }

      // delivered notifications history
      const recent = await getDeliveredNotificationsHistory();
      if (recent?.length) {
        webviewRef.current.postMessage(
          JSON.stringify({ type: "deliveredNotifications", data: recent })
        );
      }
    } catch (e) {
      console.warn("flushPending error:", e);
    }
  };

  // Send live location updates
  useEffect(() => {
    if (!location) return;
    postToWeb({
      type: "locationUpdate",
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
      },
    });
  }, [location]);

  const handleWebViewLoadEnd = () => {
    setWebviewReady(true);
    flushPending();
  };

  const handleWebViewMessage = async (event: any) => {
    const raw = event?.nativeEvent?.data;
    if (!raw) return;

    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.log("Raw from WebView:", raw);
    }

    if (!msg) return;

    switch (msg.type) {
      case "webReady":
        setWebviewReady(true);
        flushPending();
        break;
      case "simulateFirebase":
        await handleWebMessageFromPWA(msg.payload || {});
        break;
      case "notify":
        await Notifications.scheduleNotificationAsync({
          content: {
            title: msg.title || "Notification",
            body: msg.body || "",
            data: msg.data || {},
          },
          trigger: null,
        });
        break;
      case "clearHistory":
        await clearLocationHistory();
        // previously we sent clearHistoryAck back to web; removed per request
        break;
      default:
        console.log("WebView msg:", msg);
    }
  };

  // Inject JS to WebView for webReady only (removed console forwarding)
  const injectedJS = `
    (function () {
      function notifyReady() {
        try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'webReady' })); } catch(e){}
      }
      if(document.readyState==='complete'){notifyReady();} else {window.addEventListener('load',notifyReady);}
    })();
    true;
  `;

  // ✅ Always keep hooks before conditional render
  useEffect(() => {
    (async () => {
      try {
        await initNotifications();
        const token = await registerForPushNotificationsAsync();
        console.log("🎯 Device Push Token:", token);
        postToWeb({ type: "devicePushToken", token });
      } catch (e) {
        console.warn("Push token error:", e);
      }
    })();

    setOnNotificationResponse((response) => {
      const payload = {
        type: "notificationTap",
        data: response.notification.request.content.data || {},
        title: response.notification.request.content.title,
        body: response.notification.request.content.body,
      };
      postToWeb(payload);
    });

    return () => cleanupNotifications();
  }, []);

  // ✅ Render conditionally inside return (not before hooks)
  return (
    <SafeAreaView style={styles.container}>
      {!locationPermission ? (
        <AskPermissionCard />
      ) : (
        <>
          <WebView
            ref={webviewRef}
            source={{
              uri: "https://rider-prototype-shell.vercel.app/",
            }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleWebViewMessage}
            onLoadEnd={handleWebViewLoadEnd}
            injectedJavaScript={injectedJS}
            originWhitelist={["*"]}
          />

          <PermissionBtns
            notificationPermission={notificationPermission}
            locationPermission={locationPermission}
            backgroundPermission={backgroundPermission}
            sharingLocation={sharingLocation}
            toggleLocationSharing={toggleLocationSharing}
            requestNotificationPermission={requestNotificationPermission}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const App: React.FC = () => (
  <PermissionsProvider>
    <AppInner />
  </PermissionsProvider>
);

export default App;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
