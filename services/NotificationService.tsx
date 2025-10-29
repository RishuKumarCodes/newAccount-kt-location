// services/notificationService.tsx
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Minimal notification service (no expo-device)
 * - initNotifications(): sets handlers, requests permission, creates Android channel
 * - registerForPushNotificationsAsync(): requests permission + returns native push token (FCM/APNs)
 * - setOnNotificationResponse(cb): callback when user taps notification
 * - popPendingNotificationResponse(): returns any stored tap that happened before app ready
 * - getDeliveredNotificationsHistory(): returns notifications currently in tray
 * - handleWebMessageFromPWA(payload): schedules local notification (image support removed for brevity but easily re-addable)
 */

// Internal listeners refs for cleanup if needed
let _receivedListener: any = null;
let _responseListener: any = null;

// Pending tap (if user tapped notification while app was closed / not ready)
let pendingNotificationResponse: Notifications.NotificationResponse | null = null;

// External callback to forward notification-taps to app/webview
let onNotificationResponse:
  | ((response: Notifications.NotificationResponse) => void)
  | null = null;

export const setOnNotificationResponse = (
  cb: (response: Notifications.NotificationResponse) => void
) => {
  onNotificationResponse = cb;
};

/**
 * Initialize notification system (call once on app start)
 */
export const initNotifications = async (): Promise<void> => {
  // Make notifications show even when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Android: create default channel (required on Android 8+, and important for Android 13)
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });
    } catch (err) {
      console.warn("Failed to create Android notification channel:", err);
    }
  }

  // Install listeners
  _receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    // Called when a notification is delivered while the app is foregrounded
    console.log("[notifications] received:", notification);
  });

  _responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log("[notifications] response received:", response);
      // If app is ready to handle taps, forward immediately
      if (onNotificationResponse) {
        onNotificationResponse(response);
      } else {
        // otherwise save as pending so UI/webview can consume later
        pendingNotificationResponse = response;
      }
    }
  );

  // Try to capture the last notification response (if the app was launched by tapping a notification)
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      // If there was a last response, and we don't yet have a handler, keep it pending
      // (some SDKs return null here depending on platform/version - handle gracefully)
      pendingNotificationResponse = last;
    }
  } catch (err) {
    // this is non-fatal, some expo versions/platforms are flaky here
    console.warn("getLastNotificationResponseAsync() failed:", err);
  }
};

/**
 * Ask for permission and return native push token (FCM token on Android; APNs token / FCM token on iOS).
 * Returns null if permission denied or token cannot be obtained.
 */
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    // Request permission (iOS + Android 13+)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    // IMPORTANT: On Android (API 33) a channel must exist before calling getDevicePushTokenAsync.
    // We created one in initNotifications; ensure initNotifications ran before this.
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const token = tokenResult?.data ?? null;
    console.log("[notifications] native push token:", token);
    return token;
  } catch (err) {
    console.error("Failed to get device push token:", err);
    return null;
  }
};

/**
 * Schedule a local notification from app/PWA message. Useful for "simulate push"
 */
export const handleWebMessageFromPWA = async (payload: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title ?? "Notification",
        body: payload.body ?? "",
        data: payload.data ?? {},
        // channelId for Android to ensure it shows with our channel config
        ...(Platform.OS === "android" ? { android: { channelId: "default" } as any } : {}),
      } as any,
      trigger: null,
    });
  } catch (err) {
    console.warn("handleWebMessageFromPWA schedule failed:", err);
  }
};

/**
 * If a notification tap happened before the app/webview was ready, call this to pop it.
 * After popping, it clears the pending value.
 */
export const popPendingNotificationResponse = async (): Promise<
  Notifications.NotificationResponse | null
> => {
  const p = pendingNotificationResponse;
  pendingNotificationResponse = null;
  return p;
};

/**
 * Query the device for notifications currently present in the notification tray (notification center)
 */
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

/**
 * Optional cleanup if needed (call on app unmount)
 */
export const cleanupNotifications = () => {
  if (_receivedListener && _receivedListener.remove) _receivedListener.remove();
  if (_responseListener && _responseListener.remove) _responseListener.remove();
  _receivedListener = null;
  _responseListener = null;
};
