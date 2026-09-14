import React from "react";
import { Pressable, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";

import AppText from "@/components/ui/Text";
import type { RootStackParamList } from "@/navigation/routes";

export default function LegalLinks() {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    return (
        <View className="mt-5 flex-row flex-wrap justify-center px-4">
            <AppText
                variant="caption"
                className="text-text-low"
            >
                By continuing, you agree to Aks.ai's{" "}
            </AppText>

            <Pressable
                onPress={() => navigation.navigate("Terms")}
                hitSlop={6}
            >
                <AppText
                    variant="caption"
                    className="text-text-high underline"
                >
                    Terms of Service
                </AppText>
            </Pressable>

            <AppText
                variant="caption"
                className="text-text-low"
            >
                {" "}and{" "}
            </AppText>

            <Pressable
                onPress={() =>
                    navigation.navigate("PrivacyPolicy")
                }
                hitSlop={6}
            >
                <AppText
                    variant="caption"
                    className="text-text-high underline"
                >
                    Privacy Policy
                </AppText>
            </Pressable>

            <AppText
                variant="caption"
                className="text-text-low"
            >
                .
            </AppText>
        </View>
    );
}