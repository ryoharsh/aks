import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { useUniwind } from "uniwind";

export default function ThemedSystemBars() {
    const { theme } = useUniwind();
    const isDark = theme === "dark";

    return (
        <>
            <StatusBar style={isDark ? "light" : "dark"} />
            {Platform.OS === "android" ? (
                <NavigationBar style={isDark ? "dark" : "light"} />
            ) : null}
        </>
    );
}