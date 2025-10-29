import AntDesign from '@expo/vector-icons/AntDesign';
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  requestBackgroundLocationPermission,
  requestLocationPermission,
} from "../utils/locationPermission";

interface Props {
  notificationPermission: boolean;
  locationPermission: boolean;
  backgroundPermission: boolean;
  sharingLocation: boolean;
  toggleLocationSharing: () => void;
  requestNotificationPermission: () => void;
}

// Warning Icon Component
const WarningIcon = () => (
  <View style={styles.warningIcon}>
    <AntDesign name="warning" size={24} color="orange" />
  </View>
);

export default function PermissionBtns({
  notificationPermission,
  locationPermission,
  backgroundPermission,
  sharingLocation,
  toggleLocationSharing,
  requestNotificationPermission,
}: Props) {
  return (
    <View style={styles.container}>
      {!notificationPermission && (
        <View style={styles.card}>
          <View style={styles.contentWrapper}>
            <WarningIcon />
            <View style={styles.textContainer}>
              <Text style={styles.title}>Notification Access Required</Text>
              <Text style={styles.description}>
                Enable notifications to receive important location updates
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={requestNotificationPermission}
          >
            <Text style={styles.buttonText}>Allow</Text>
          </Pressable>
        </View>
      )}

      {!locationPermission && (
        <View style={styles.card}>
          <View style={styles.contentWrapper}>
            <WarningIcon />
            <View style={styles.textContainer}>
              <Text style={styles.title}>Location Access Required</Text>
              <Text style={styles.description}>
                Allow access to your location to share with others
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={async () => {
              const granted = await requestLocationPermission();
              if (granted) console.log("Location permission granted");
            }}
          >
            <Text style={styles.buttonText}>Allow</Text>
          </Pressable>
        </View>
      )}

      {!backgroundPermission && (
        <View style={styles.card}>
          <View style={styles.contentWrapper}>
            <WarningIcon />
            <View style={styles.textContainer}>
              <Text style={styles.title}>Background Location Required</Text>
              <Text style={styles.description}>
                Enable to share location even when app is closed
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={async () => {
              const granted = await requestBackgroundLocationPermission();
              if (granted)
                console.log("Background location permission granted");
            }}
          >
            <Text style={styles.buttonText}>Allow</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.card, styles.sharingCard]}>
        <View style={styles.contentWrapper}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {sharingLocation
                ? "Location Sharing Active"
                : "Start Location Sharing"}
            </Text>
            <Text style={styles.description}>
              {sharingLocation
                ? "Your location is being shared in real-time"
                : "Begin sharing your location with others"}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            sharingLocation && styles.stopButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={toggleLocationSharing}
        >
          <Text style={styles.buttonText}>
            {sharingLocation ? "Stop" : "Start"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sharingCard: {
    borderColor: "#007AFF20",
    backgroundColor: "#f8fbff",
  },
  contentWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  warningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3CD",
    alignItems: "center",
    justifyContent: "center",
  },
  warningIconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#688396",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignSelf: "flex-start",
    minWidth: 80,
    alignItems: "center",
    shadowColor: "#688396",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButton: {
    backgroundColor: "#FF3B30",
    shadowColor: "#FF3B30",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
