import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { requestLocationPermission } from "../utils/locationPermission";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PATH_LENGTH_OUTER = 300;
const PATH_LENGTH_INNER = 100;
const DRAW_DURATION = 2500;

const AskPermissionCard: React.FC = () => {
  const dashOffsetOuter = useRef(new Animated.Value(PATH_LENGTH_OUTER)).current;
  const dashOffsetInner = useRef(new Animated.Value(PATH_LENGTH_INNER)).current;

  const bounceAnim = useRef(new Animated.Value(0)).current; // for up-down movement
  const getGPSPermission = async () => {
    const granted = await requestLocationPermission();
    if (granted) console.log("Location permission granted");
  };

  useEffect(() => {
    // Animate stroke drawing
    Animated.timing(dashOffsetOuter, {
      toValue: 0,
      duration: DRAW_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();

    Animated.timing(dashOffsetInner, {
      toValue: 0,
      duration: DRAW_DURATION,
      delay: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      // Start bouncing after stroke animation completes
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -5, // move up
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 5, // move down
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [dashOffsetOuter, dashOffsetInner, bounceAnim]);

  return (
    <View style={styles.centered}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <Svg width={150} height={150} viewBox="0 0 97 90">
          {/* Outer heart */}
          <AnimatedPath
            d="M 45.229 90.18 l -26.97 -31.765 c -5.419 -6.387 -8.404 -14.506 -8.404 -22.861 c 0 -19.506 15.869 -35.374 35.374 -35.374 s 35.375 15.869 35.375 35.374 c 0 8.355 -2.985 16.474 -8.405 22.861 L 45.229 90.18 z"
            strokeWidth={2}
            fill="none"
            stroke="#334049"
            strokeDasharray={PATH_LENGTH_OUTER}
            strokeDashoffset={dashOffsetOuter}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inner circle */}
          <AnimatedPath
            d="M 45.229 49.801 c -8.499 0 -15.413 -6.915 -15.413 -15.414 s 6.915 -15.414 15.413 -15.414 c 8.499 0 15.413 6.915 15.413 15.414 S 53.728 49.801 45.229 49.801 z"
            strokeWidth={2}
            fill="none"
            stroke="#334049"
            strokeDasharray={PATH_LENGTH_INNER}
            strokeDashoffset={dashOffsetInner}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      <Text style={styles.permissionText}>Location permission is required</Text>

      <TouchableOpacity style={styles.permissionBtn} onPress={getGPSPermission}>
        <Text style={styles.permissionBtnText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );
};

export default AskPermissionCard;

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionText: {
    fontSize: 16,
    marginBottom: 30,
    marginTop: 10,
    color: "#333",
  },
  permissionBtn: {
    position: "absolute",
    bottom: 50,
    paddingVertical: 27,
    width: "88%",
    alignItems: "center",
    borderRadius: 5,
    backgroundColor: "#93BBD5",
  },
  permissionBtnText: { color: "#4C6270", fontSize: 20 },
});
