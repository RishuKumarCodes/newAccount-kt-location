import { PermissionsProvider } from "@/context/PermissionsContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <PermissionsProvider>
      <StatusBar style="dark" backgroundColor="#fff" />
      <Stack screenOptions={{ headerShown: false }} />
    </PermissionsProvider>
  );
}
