// import * as Location from "expo-location";
// import * as Notifications from "expo-notifications";
// import * as TaskManager from "expo-task-manager";
// import { useEffect, useRef, useState } from "react";
// import {
//   checkLocationPermission,
//   requestBackgroundLocationPermission,
//   requestLocationPermission as requestForegroundLocationPermission,
// } from "../utils/locationPermission";

// const LOCATION_TASK_NAME = "background-location-task";

// TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
//   if (error) {
//     console.error("Background task error:", error);
//     return;
//   }
//   if (data) {
//     const { locations } = data as any;
//     console.log("Background location:", locations[0].coords);
//   }
// });

// export const useLocationManager = () => {
//   const [notificationPermission, setNotificationPermission] = useState(false);
//   const [locationPermission, setLocationPermission] = useState(false);
//   const [backgroundPermission, setBackgroundPermission] = useState(false);
//   const [sharingLocation, setSharingLocation] = useState(false);
//   const [location, setLocation] = useState<{
//     latitude: number;
//     longitude: number;
//   } | null>(null);

//   const watchRef = useRef<Location.LocationSubscription | null>(null);

//   // Ask initial permissions
//   useEffect(() => {
//     (async () => {
//       const { status: notifStatus } = await Notifications.getPermissionsAsync();
//       setNotificationPermission(notifStatus === "granted");

//       const fg = await checkLocationPermission();
//       setLocationPermission(fg);

//       const bg = await Location.getBackgroundPermissionsAsync();
//       setBackgroundPermission(bg.status === "granted");
//     })();
//   }, []);

//   // Request notification permission
//   const requestNotificationPermission = async () => {
//     const { status } = await Notifications.requestPermissionsAsync();
//     setNotificationPermission(status === "granted");
//   };

//   // Request foreground location permission and update state immediately
//   const requestLocationPermission = async () => {
//     const { status } = await requestForegroundLocationPermission();
//     const granted = status === "granted";
//     setLocationPermission(granted);
//     return granted;
//   };

//   // Request background location permission and update state immediately
//   const requestBackgroundPermission = async () => {
//     const granted = await requestBackgroundLocationPermission();
//     setBackgroundPermission(granted);
//     return granted;
//   };

//   const toggleLocationSharing = async () => {
//     if (sharingLocation) {
//       // Stop sharing
//       watchRef.current?.remove();
//       watchRef.current = null;

//       const isRegistered = await TaskManager.isTaskRegisteredAsync(
//         LOCATION_TASK_NAME
//       );
//       if (isRegistered)
//         await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

//       setSharingLocation(false);
//       console.log("Location sharing stopped");
//     } else {
//       // Start sharing
//       if (!locationPermission) {
//         const granted = await requestLocationPermission();
//         if (!granted) return;
//       }

//       if (!backgroundPermission) {
//         const granted = await requestBackgroundPermission();
//         if (!granted) {
//           alert("Background permission is required for location sharing");
//           return;
//         }
//       }

//       // Foreground watcher
//       watchRef.current = await Location.watchPositionAsync(
//         {
//           accuracy: Location.Accuracy.Highest,
//           timeInterval: 5000,
//           distanceInterval: 1,
//         },
//         (loc) => {
//           const coords = {
//             latitude: loc.coords.latitude,
//             longitude: loc.coords.longitude,
//           };
//           setLocation(coords);
//           console.log("Foreground location:", coords);
//         }
//       );

//       // Background task
//       const isRegistered = await TaskManager.isTaskRegisteredAsync(
//         LOCATION_TASK_NAME
//       );
//       if (!isRegistered) {
//         await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
//           accuracy: Location.Accuracy.Highest,
//           timeInterval: 2000,
//           distanceInterval: 1,
//           foregroundService: {
//             notificationTitle: "Tracking Location",
//             notificationBody: "App is running in background",
//           },
//           pausesUpdatesAutomatically: false,
//         });
//       }

//       setSharingLocation(true);
//       console.log("Location sharing started");
//     }
//   };

//   return {
//     notificationPermission,
//     locationPermission,
//     backgroundPermission,
//     sharingLocation,
//     location,
//     toggleLocationSharing,
//     requestNotificationPermission,
//     requestLocationPermission,
//     requestBackgroundPermission,
//   };
// };
