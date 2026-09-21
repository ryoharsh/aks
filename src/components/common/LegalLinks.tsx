import React from "react";
import { Pressable, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";

import AppText from "@/components/ui/Text";
import type { RootStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

export default function LegalLinks() {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const rootNavigation = navigation.getParent<NavigationProp<RootStackParamList>>() ?? navigation;

    return (
        <View className="mt-5 flex-row flex-wrap justify-center px-4">
            <AppText
                variant="caption"
                className="text-text-low"
            >
                {copy.legal.links.prefix}{" "}
            </AppText>

            <Pressable
                onPress={() => rootNavigation.navigate("Terms")}
                hitSlop={6}
            >
                <AppText
                    variant="caption"
                    className="text-text-high underline"
                >
                    {copy.legal.links.terms}
                </AppText>
            </Pressable>

            <AppText
                variant="caption"
                className="text-text-low"
            >
                {" "}{copy.legal.links.andWord}{" "}
            </AppText>

            <Pressable
                onPress={() =>
                    rootNavigation.navigate("PrivacyPolicy")
                }
                hitSlop={6}
            >
                <AppText
                    variant="caption"
                    className="text-text-high underline"
                >
                    {copy.legal.links.privacy}
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
