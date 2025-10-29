// native/src/context/PermissionsProvider.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LocPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

const MAX_LOCATIONS = 20;
const STORAGE_KEY = "location_history";
const LOCATION_TASK_NAME = "background-location-task-v1";

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
  toggleLocationSharing: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  requestBackgroundPermission: () => Promise<boolean>;
  clearStoredHistory: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);
export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
};

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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

  // ----- Toggle location sharing -----
  const toggleLocationSharing = async () => {
    if (sharingLocation) {
      // Stop foreground watcher
      try {
        watchRef.current?.remove();
        watchRef.current = null;
      } catch (e) {}

      // Stop background task if registered
      try {
        if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          console.log("[PermissionsProvider] background task stopped");
        }
      } catch (e) {
        console.warn("stopLocationUpdatesAsync failed:", e);
      }

      setSharingLocation(false);
      console.log("[PermissionsProvider] Location sharing stopped");
    } else {
      // Ensure permissions
      if (!locationPermission && !(await requestLocationPermission())) return;
      if (!backgroundPermission && !(await requestBackgroundPermission())) {
        alert("Background location permission is required");
        return;
      }

      // Start foreground watcher
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 5000, distanceInterval: 1 },
        async (loc) => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setLocation(coords);
          await saveLocationPoint({ ...coords, timestamp: Date.now() });
        }
      );

      // Start background task ONLY on standalone builds (skip Expo Go)
      if (Platform.OS === "android" && Constants.appOwnership === "expo") {
        console.warn("Background location is disabled in Expo Go. Build standalone APK/AAB to test.");
      } else {
        if (!(await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME))) {
          // Tiny delay ensures SharedPreferences initialized
          await new Promise(res => setTimeout(res, 100));
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
            });
          } catch (e) {
            console.warn("startLocationUpdatesAsync failed:", e);
          }
        }
      }

      setSharingLocation(true);
      console.log("[PermissionsProvider] Location sharing started");
    }
  };

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
        toggleLocationSharing,
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
