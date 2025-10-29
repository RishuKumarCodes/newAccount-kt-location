// native/src/services/locationStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const LOCATION_HISTORY_KEY = "LOCATION_HISTORY_V1";
export const MAX_LOCATIONS = 20;

export type LocPoint = {
  latitude: number;
  longitude: number;
  timestamp: number; // ms
};

export async function getLocationHistory(): Promise<LocPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn("[locationStorage] getLocationHistory error", e);
    return [];
  }
}

export async function saveLocationPoint(point: LocPoint): Promise<void> {
  try {
    const arr = await getLocationHistory();
    arr.push(point);
    const sliced = arr.slice(-MAX_LOCATIONS);
    await AsyncStorage.setItem(LOCATION_HISTORY_KEY, JSON.stringify(sliced));
  } catch (e) {
    console.warn("[locationStorage] saveLocationPoint error", e);
  }
}

export async function clearLocationHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCATION_HISTORY_KEY);
  } catch (e) {
    console.warn("[locationStorage] clearLocationHistory error", e);
  }
}
