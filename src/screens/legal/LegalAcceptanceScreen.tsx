import React, { useState } from "react";
import {
    ScrollView,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";


import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import LogoMark from "@/components/common/LogoMark";
import type { RootStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "LegalAcceptance"
>;

export default function LegalAcceptanceScreen({
    navigation,
}: Props) {
    const [accepted, setAccepted] = useState(false);

    const handleContinue = () => {
        if (!accepted) return;

        navigation.replace("Main");
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <StatusBar style="dark" />

            <Animated.View
                entering={FadeIn.duration(500)}
                className="flex-row items-center justify-between px-6 pt-6"
            >
                <LogoMark />
            </Animated.View>

            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-1 px-6 pb-10 pt-6">
                    <View className="flex-1">
                        <Animated.View
                            entering={FadeInDown.duration(550).delay(100)}
                            className="mb-4">
                            <AppText
                                variant="display"
                                className="font-satoshi-medium text-text-high"
                            >
                                Before we begin.
                            </AppText>

                            <AppText
                                variant="body"
                                className="mt-3 max-w-82.5 text-text-low"
                            >
                                Aks works with personal information to help
                                you understand your patterns. Here's what
                                you should know before continuing.
                            </AppText>
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(200)}
                            className="mt-3">
                            <View className="rounded-[28px] border border-border bg-surface p-5">
                                <AppText
                                    variant="title"
                                    className="text-text-high">
                                    Your data, your control.
                                </AppText>

                                <AppText
                                    variant="body"
                                    className="mt-3 text-text-low"
                                >
                                    Aks uses the information you choose to
                                    share to identify patterns and help you
                                    run personal experiments.
                                </AppText>

                                <View className="mt-3 h-px bg-border" />

                                <View className="mt-5 gap-4">
                                    <View className="flex-row items-center">
                                        <View className="mr-3 size-1.5 rounded-full bg-primary" />

                                        <AppText variant="body" className="flex-1 text-[14px] text-text-medium">
                                            You decide what information to
                                            provide.
                                        </AppText>
                                    </View>

                                    <View className="flex-row items-center">
                                        <View className="mr-3 size-1.5 rounded-full bg-primary" />

                                        <AppText variant="body" className="flex-1 text-[14px] text-text-medium">
                                            You can manage your data and
                                            permissions.
                                        </AppText>
                                    </View>

                                    <View className="flex-row items-center">
                                        <View className="mr-3 size-1.5 rounded-full bg-primary" />

                                        <AppText variant="body" className="flex-1 text-[14px] text-text-medium">
                                            Aks does not replace professional
                                            medical or mental-health advice.
                                        </AppText>
                                    </View>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(300)}
                            className="mt-6"
                        >
                            <View className="flex-row items-start">
                                <Checkbox
                                    checked={accepted}
                                    onCheckedChange={setAccepted}
                                    size="sm"
                                    className="mr-3 mt-0.5"
                                    accessibilityLabel="Accept Terms of Service and Privacy Policy"
                                />

                                <AppText
                                    variant="body"
                                    className="flex-1 text-text-medium">
                                    I agree to Aks.ai's{" "}
                                    <AppText
                                        variant="body"
                                        className="text-text-high underline"
                                        onPress={() =>
                                            navigation.navigate("Terms")
                                        }
                                    >
                                        Terms of Service
                                    </AppText>{" "}
                                    and{" "}
                                    <AppText
                                        variant="body"
                                        className="text-text-high underline"
                                        onPress={() =>
                                            navigation.navigate("PrivacyPolicy")
                                        }
                                    >
                                        Privacy Policy
                                    </AppText>
                                    .
                                </AppText>
                            </View>
                        </Animated.View>
                    </View>

                    <Animated.View
                        entering={FadeInUp.duration(500).delay(400)}
                        className="mt-10"
                    >
                        <Button
                            variant="primary"
                            disabled={!accepted}
                            onPress={handleContinue}
                            className="rounded-2xl"
                        >
                            <AppText
                                variant="button"
                                className="text-white"
                            >
                                Continue to Aks
                            </AppText>
                        </Button>

                        <AppText
                            variant="caption"
                            className="mt-4 text-center text-text-low"
                        >
                            You can review these documents again later
                            from Settings.
                        </AppText>
                    </Animated.View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}