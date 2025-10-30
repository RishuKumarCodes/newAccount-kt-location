import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import io from "socket.io-client";

export interface LocPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

const MAX_LOCATIONS = 20;
const STORAGE_KEY = "location_history";
const LOCATION_TASK_NAME = "background-location-task-v1";
const SOCKET_URL = "https://rider-prototype-backend.onrender.com";
let socketInstance: any = null;

// ----- AsyncStorage helpers -----
export const saveLocationPoint = async (point: LocPoint) => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr: LocPoint[] = json ? JSON.parse(json) : [];
    arr.push(point);
    if (arr.length > MAX_LOCATIONS) arr.splice(0, arr.length - MAX_LOCATIONS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("saveLocationPoint error:", e);
  }
};

export const getLocationHistory = async (): Promise<LocPoint[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.warn("getLocationHistory error:", e);
    return [];
  }
};

export const clearLocationHistory = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("clearLocationHistory error:", e);
  }
};

// helper to fetch stored userId (return null if missing)
const getStoredUserId = async (): Promise<string | null> => {
  try {
    const raw = await AsyncStorage.getItem("userData");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?._id ?? null;
  } catch (e) {
    console.warn("getStoredUserId error:", e);
    return null;
  }
};

// ----- Background task -----
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[BG TASK] error:", error);
    return;
  }
  if (!data?.locations) return;

  for (const loc of data.locations) {
    const coords = loc.coords || loc;
    const point: LocPoint = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: Date.now(),
    };
    await saveLocationPoint(point);

    try {
      const userId = await getStoredUserId();
      if (!userId) {
        console.log("[BG TASK] no userId in storage — skipping socket emit");
        continue;
      }

      if (!socketInstance || !socketInstance.connected) {
        socketInstance = io(SOCKET_URL, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1500,
          forceNew: true,
          timeout: 5000,
        });

        await new Promise<void>((resolve) => {
          let resolved = false;
          const onConnect = () => {
            if (!resolved) {
              resolved = true;
              console.log("[BG TASK] socket connected");
              resolve();
            }
          };
          socketInstance.once("connect", onConnect);
          socketInstance.once("connect_error", (err) => {
            console.log("[BG TASK] connect_error:", err.message);
          });
          setTimeout(() => {
            if (!resolved) {
              console.log("[BG TASK] socket connection timed out");
              resolved = true;
              resolve();
            }
          }, 7000);
        });
      }

      if (socketInstance && socketInstance.connected) {
        socketInstance.emit("locationUpdate", {
          userId,
          latitude: point.latitude,
          longitude: point.longitude,
        });
        console.log(
          "[BG TASK] emitted locationUpdate:",
          userId,
          point.latitude,
          point.longitude
        );
      } else {
        console.log("[BG TASK] socket not connected — skipping emit");
      }
    } catch (e) {
      console.warn("[BG TASK] socket emit failed:", e);
    }
  }

  console.log("[BG TASK] saved locations to AsyncStorage");
});

// ----- Permissions Context -----
interface PermissionsContextType {
  notificationPermission: boolean;
  locationPermission: boolean;
  backgroundPermission: boolean;
  sharingLocation: boolean;
  location: { latitude: number; longitude: number } | null;
  requestNotificationPermission: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  requestBackgroundPermission: () => Promise<boolean>;
  clearStoredHistory: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);
export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx)
    throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
};

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // ----- Check permissions -----
  const checkAllPermissions = async () => {
    try {
      const notif = await Notifications.getPermissionsAsync();
      setNotificationPermission(notif.status === "granted");

      const fg = await Location.getForegroundPermissionsAsync();
      setLocationPermission(fg.status === "granted");

      const bg = await Location.getBackgroundPermissionsAsync();
      setBackgroundPermission(bg.status === "granted");
    } catch (e) {
      console.warn("checkAllPermissions error:", e);
    }
  };

  useEffect(() => {
    checkAllPermissions();
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await checkAllPermissions();
      }
    });
    return () => sub.remove();
  }, []);

  // ----- Request permissions -----
  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationPermission(status === "granted");
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const confirmed = status === "granted";
    setLocationPermission(confirmed);
    return confirmed;
  };

  const requestBackgroundPermission = async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    const granted = status === "granted";
    setBackgroundPermission(granted);
    return granted;
  };

  // ----- Auto-start location sharing -----
  useEffect(() => {
    const startSharing = async () => {
      try {
        if (!locationPermission) {
          const granted = await requestLocationPermission();
          if (!granted) return;
        }
        if (!backgroundPermission) {
          const granted = await requestBackgroundPermission();
          if (!granted) return;
        }
        if (sharingLocation) return;

        console.log("[AutoStart] Starting location sharing...");

        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 5000,
            distanceInterval: 1,
          },
          async (loc) => {
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setLocation(coords);
            await saveLocationPoint({ ...coords, timestamp: Date.now() });

            try {
              const userId = await getStoredUserId();
              if (!userId) return;

              if (
                !global.foregroundSocket ||
                !global.foregroundSocket.connected
              ) {
                global.foregroundSocket = io(SOCKET_URL, {
                  transports: ["websocket"],
                  reconnection: true,
                });
              }

              global.foregroundSocket.emit("locationUpdate", {
                userId,
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
            } catch (e) {
              console.warn("Emit failed:", e);
            }
          }
        );

        if (Platform.OS === "android" && Constants.appOwnership === "expo") {
          console.warn(
            "Background location is disabled in Expo Go. Build standalone APK/AAB to test."
          );
        } else {
          if (!(await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME))) {
            try {
              await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Highest,
                timeInterval: 2000,
                distanceInterval: 1,
                foregroundService: {
                  notificationTitle: "Tracking Location",
                  notificationBody: "App is running in background",
                },
                pausesUpdatesAutomatically: false,
                showsBackgroundLocationIndicator: true,
              });
            } catch (e) {
              console.warn("startLocationUpdatesAsync failed:", e);
            }
          }
        }

        setSharingLocation(true);
        console.log("[AutoStart] Location sharing started");
      } catch (e) {
        console.warn("[AutoStart] Failed:", e);
      }
    };

    if (locationPermission && backgroundPermission) {
      startSharing();
    }
  }, [locationPermission, backgroundPermission]);

  const clearStoredHistory = async () => {
    await clearLocationHistory();
  };

  return (
    <PermissionsContext.Provider
      value={{
        notificationPermission,
        locationPermission,
        backgroundPermission,
        sharingLocation,
        location,
        requestNotificationPermission,
        requestLocationPermission,
        requestBackgroundPermission,
        clearStoredHistory,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};
