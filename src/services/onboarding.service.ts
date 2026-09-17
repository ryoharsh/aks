import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const onboardingKey = "aks.onboarding.completed";

export const onboardingService = {
    async isCompleted() {
        if (Platform.OS === "web") {
            return globalThis.localStorage?.getItem(onboardingKey) === "true";
        }
        return (await SecureStore.getItemAsync(onboardingKey)) === "true";
    },

    async complete() {
        if (Platform.OS === "web") {
            globalThis.localStorage?.setItem(onboardingKey, "true");
            return;
        }
        await SecureStore.setItemAsync(onboardingKey, "true");
    },
};
