// services/notificationService.tsx
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let _receivedListener: any = null;
let _responseListener: any = null;

let pendingNotificationResponse: Notifications.NotificationResponse | null =
  null;

let onNotificationResponse:
  | ((response: Notifications.NotificationResponse) => void)
  | null = null;

export const setOnNotificationResponse = (
  cb: (response: Notifications.NotificationResponse) => void
) => {
  onNotificationResponse = cb;
};

export const initNotifications = async (): Promise<void> => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
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
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });
    } catch (err) {
      console.warn("Failed to create Android notification channel:", err);
    }
  }

  // Install listeners
  _receivedListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      // Called when a notification is delivered while the app is foregrounded
      console.log("[notifications] received:", notification);
    }
  );

  _responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log("[notifications] response received:", response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      } else {
        // otherwise save as pending so UI/webview can consume later
        pendingNotificationResponse = response;
      }
    }
  );

  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      pendingNotificationResponse = last;
    }
  } catch (err) {
    console.warn("getLastNotificationResponseAsync() failed:", err);
  }
};

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
    if (finalStatus !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const fcmToken = tokenResult?.data ?? null;
    console.log("[notifications] FCM token:", fcmToken);

    return { fcmToken };
  } catch (err) {
    console.error("Failed to get FCM token:", err);
    return null;
  }
};

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
        ...(Platform.OS === "android"
          ? { android: { channelId: "default" } as any }
          : {}),
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
export const popPendingNotificationResponse =
  async (): Promise<Notifications.NotificationResponse | null> => {
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
