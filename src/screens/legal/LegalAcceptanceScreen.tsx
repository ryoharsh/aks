import React, { useState } from "react";
import {
    ScrollView,
    View,
} from "react-native";
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
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { useAppFlow } from "@/providers/AppFlowProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "LegalAcceptance"
>;

export default function LegalAcceptanceScreen({
    navigation,
}: Props) {
    const [accepted, setAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const { acceptLegal, error, retry } = useAppFlow();
    const { notice } = useBottomSheet();

    const handleContinue = async () => {
        if (!accepted || loading) return;
        try {
            setLoading(true);
            await acceptLegal();
        } catch {
            notice(copy.legal.acceptance.notices.unableToSave, copy.common.checkConnection);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">

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
                                {copy.legal.acceptance.title}
                            </AppText>

                            <AppText
                                variant="body"
                                className="mt-3 max-w-82.5 text-text-low"
                            >
                                {copy.legal.acceptance.description}
                            </AppText>
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(200)}
                            className="mt-3">
                            <View className="rounded-[28px] border border-border bg-surface p-5">
                                <AppText
                                    variant="title"
                                    className="text-text-high">
                                    {copy.legal.acceptance.cardTitle}
                                </AppText>

                                <AppText
                                    variant="body"
                                    className="mt-3 text-text-low"
                                >
                                    {copy.legal.acceptance.cardBody}
                                </AppText>

                                <View className="mt-3 h-px bg-border" />

                                <View className="mt-5 gap-4">
                                    {copy.legal.acceptance.bullets.map((bullet) => (
                                        <View key={bullet} className="flex-row items-center">
                                            <View className="mr-3 size-1.5 rounded-full bg-primary" />

                                            <AppText variant="body" className="flex-1 text-[14px] text-text-medium">
                                                {bullet}
                                            </AppText>
                                        </View>
                                    ))}
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
                                    accessibilityLabel={copy.legal.acceptance.consentA11y}
                                />

                                <AppText
                                    variant="body"
                                    className="flex-1 text-text-medium">
                                    {copy.legal.acceptance.agreePrefix}{" "}
                                    <AppText
                                        variant="body"
                                        className="text-text-high underline"
                                        onPress={() =>
                                            navigation.navigate("Terms")
                                        }
                                    >
                                        {copy.legal.acceptance.terms}
                                    </AppText>{" "}
                                    {copy.legal.acceptance.andWord}{" "}
                                    <AppText
                                        variant="body"
                                        className="text-text-high underline"
                                        onPress={() =>
                                            navigation.navigate("PrivacyPolicy")
                                        }
                                    >
                                        {copy.legal.acceptance.privacy}
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
                            loading={loading}
                            onPress={handleContinue}
                            className="rounded-2xl"
                        >
                            <AppText
                                variant="button"
                                className="text-white"
                            >
                                {copy.legal.acceptance.continue}
                            </AppText>
                        </Button>

                        {error ? (
                            <AppText onPress={retry} variant="caption" className="mt-3 text-center text-red-600 underline">
                                {error} {copy.legal.acceptance.retryAction}
                            </AppText>
                        ) : null}

                        <AppText
                            variant="caption"
                            className="mt-4 text-center text-text-low"
                        >
                            {copy.legal.acceptance.footnote}
                        </AppText>
                    </Animated.View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
