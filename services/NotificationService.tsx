import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { AppState, NativeModules, Platform } from "react-native";

// --- sound state (for foreground mode) ---
let _receivedListener: any = null;
let _responseListener: any = null;
let pendingNotificationResponse: Notifications.NotificationResponse | null =
  null;
let onNotificationResponse:
  | ((response: Notifications.NotificationResponse) => void)
  | null = null;

let soundObject: Audio.Sound | null = null;
let isPlaying = false;

const soundMap: Record<string, any> = {
  ORDER: require("../assets/sounds/order_ring.mp3"),
  GENERAL: require("../assets/sounds/message.mp3"),
  MESSAGE: require("../assets/sounds/message.mp3"),
};

// --- native service helpers ---
async function startNativeRingtoneService() {
  if (Platform.OS !== "android") return;
  try {
    const { RingtoneModule } = NativeModules;
    if (RingtoneModule?.startRingtoneService) {
      await RingtoneModule.startRingtoneService();
      console.log("[notifications] Started native RingtoneService");
    } else {
      console.warn("[notifications] RingtoneModule not found");
    }
  } catch (e) {
    console.warn("Failed to start native ringtone service:", e);
  }
}

async function stopNativeRingtoneService() {
  if (Platform.OS !== "android") return;
  try {
    const { RingtoneModule } = NativeModules;
    if (RingtoneModule?.stopRingtoneService) {
      await RingtoneModule.stopRingtoneService();
      console.log("[notifications] Stopped native RingtoneService");
    }
  } catch (e) {
    console.warn("Failed to stop native ringtone service:", e);
  }
}

// --- in-app playback ---
async function playCustomSound(normalizedType: string, loop = false) {
  try {
    if (soundObject) {
      try {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
      } catch {}
      soundObject = null;
      isPlaying = false;
    }

    const soundFile = soundMap[normalizedType];
    if (!soundFile) return;

    soundObject = new Audio.Sound();
    await soundObject.loadAsync(soundFile);
    await soundObject.setIsLoopingAsync(loop);
    await soundObject.playAsync();
    isPlaying = true;
    console.log(`[notifications] Playing ${normalizedType}, loop=${loop}`);
  } catch (err) {
    console.warn("playCustomSound failed:", err);
  }
}

export async function stopCustomSound() {
  try {
    if (soundObject && isPlaying) {
      await soundObject.stopAsync();
      await soundObject.unloadAsync();
      soundObject = null;
      isPlaying = false;
      console.log("[notifications] Sound stopped manually");
    }
  } catch (err) {
    console.warn("stopCustomSound failed:", err);
  }
  await stopNativeRingtoneService();
}

// Check if app is in foreground
function isAppInForeground(): boolean {
  return AppState.currentState === "active";
}

// --- setup + listeners ---
export const initNotifications = async (): Promise<void> => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync("order-alert", {
        name: "Order Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        sound: "default",
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationCategoryAsync("orderCategory", [
        {
          identifier: "STOP_SOUND",
          buttonTitle: "Stop",
          options: { opensAppToForeground: false },
        },
      ]);
    } catch (err) {
      console.warn("Failed to create Android channels/categories:", err);
    }
  }

  _receivedListener = Notifications.addNotificationReceivedListener(
    async (notification) => {
      const dataRaw = notification.request.content.data || {};
      const type = (dataRaw.type || "").toString().trim().toUpperCase();
      const normalized = type.includes("ORDER")
        ? "ORDER"
        : type.includes("MESSAGE")
        ? "MESSAGE"
        : "GENERAL";

      console.log("[notifications] received:", normalized);

      // For ORDER notifications: use native service for reliability
      if (normalized === "ORDER") {
        if (Platform.OS === "android") {
          // Always use native service for ORDER (works in all states)
          await startNativeRingtoneService();
        } else {
          // iOS fallback to JS audio (foreground only)
          await playCustomSound("ORDER", true);
        }
      } else {
        // Non-ORDER notifications: foreground audio only
        if (isAppInForeground()) {
          await playCustomSound(normalized, false);
        }
      }
    }
  );

  _responseListener = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      console.log("[notifications] response:", response);
      const action = response.actionIdentifier;

      if (action === "STOP_SOUND") {
        await stopCustomSound();
        return;
      }

      // Stop sound when user interacts with notification
      const dataRaw = response.notification.request.content.data || {};
      const type = (dataRaw.type || "").toString().trim().toUpperCase();
      if (type.includes("ORDER")) {
        await stopCustomSound();
      }

      if (onNotificationResponse) onNotificationResponse(response);
      else pendingNotificationResponse = response;
    }
  );
};

export const setOnNotificationResponse = (
  cb: (r: Notifications.NotificationResponse) => void
) => {
  onNotificationResponse = cb;
};

// --- Push registration ---
export const registerForPushNotificationsAsync = async (): Promise<{
  fcmToken: string | null;
} | null> => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const fcmToken = tokenResult?.data ?? null;
    console.log("[notifications] FCM token:", fcmToken);
    return { fcmToken };
  } catch (err) {
    console.error("Failed to get FCM token:", err);
    return null;
  }
};

// --- Local notifications (from PWA or internal trigger) ---
export const handleWebMessageFromPWA = async (payload: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) => {
  try {
    const rawType = payload?.data?.type || "";
    const isOrder = rawType.toUpperCase().includes("ORDER");

    // For ORDER notifications on Android: start native service FIRST
    // This ensures sound plays even if notification scheduling fails
    if (isOrder && Platform.OS === "android") {
      await startNativeRingtoneService();
      console.log("[notifications] Native ringtone service started for ORDER");
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title ?? "Notification",
        body: payload.body ?? "",
        data: payload.data ?? {},
        categoryIdentifier:
          isOrder && Platform.OS === "android" ? "orderCategory" : undefined,
        ...(Platform.OS === "android"
          ? {
              android: {
                channelId: isOrder ? "order-alert" : "default",
              } as any,
            }
          : {}),
      } as any,
      trigger: null,
    });

    console.log("[notifications] Local notification scheduled:", payload);
  } catch (err) {
    console.warn("handleWebMessageFromPWA failed:", err);
  }
};

// --- utils ---
export const popPendingNotificationResponse =
  async (): Promise<Notifications.NotificationResponse | null> => {
    const p = pendingNotificationResponse;
    pendingNotificationResponse = null;
    return p;
  };

export const getDeliveredNotificationsHistory = async (): Promise<
  Notifications.Notification[]
> => {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    return presented ?? [];
  } catch (err) {
    console.warn("getPresentedNotificationsAsync failed:", err);
    return [];
  }
};

export const cleanupNotifications = () => {
  if (_receivedListener?.remove) _receivedListener.remove();
  if (_responseListener?.remove) _responseListener.remove();
  _receivedListener = null;
  _responseListener = null;
};