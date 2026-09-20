import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import Animated, {
    Easing,
    FadeInDown,
    FadeOutUp,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";

import AppText from "@/components/ui/Text";

type Role = "user" | "assistant";

type Props = {
    text: string;
    role: Role;
    messageKey?: string;
};

/**
 * Only the first MAX_ANIMATED_WORDS words get their own animated node; the
 * remaining words of a long message render as plain (already-visible) text.
 * This keeps per-message animated nodes bounded so long replies never flood
 * the UI thread during the screen transition — and the entrance still reads
 * the same, since later words appear last anyway.
 */
const MAX_ANIMATED_WORDS = 26;
const PER_WORD_DELAY_MS = 40;
const MAX_TOTAL_DELAY_MS = 420;

function AnimatedWord({
    word,
    index,
    animationKey,
}: {
    word: string;
    index: number;
    animationKey: string;
}) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(16);

    useEffect(() => {
        opacity.value = 0;
        translateY.value = 16;

        const delay = Math.min(index * PER_WORD_DELAY_MS, MAX_TOTAL_DELAY_MS);

        opacity.value = withDelay(
            delay,
            withTiming(1, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            }),
        );

        translateY.value = withDelay(
            delay,
            withTiming(0, {
                duration: 300,
                easing: Easing.out(Easing.cubic),
            }),
        );
    }, [animationKey]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View style={style}>
            <AppText
                variant="title"
                className="font-satoshi-medium text-center text-text-high"
            >
                {word}
            </AppText>
        </Animated.View>
    );
}

export default function AnimatedConversationText({
    text,
    role,
    messageKey,
}: Props) {
    const words = useMemo(
        () => text.trim().split(/\s+/).filter(Boolean),
        [text],
    );

    const previousMessageKey = useRef(messageKey);

    const isNewMessage =
        previousMessageKey.current !== messageKey;

    useEffect(() => {
        previousMessageKey.current = messageKey;
    }, [messageKey]);

    if (!text.trim()) {
        return null;
    }

    return (
        <View className="w-full items-center px-8">
            <Animated.View
                key={messageKey}
                entering={FadeInDown.duration(350)}
                exiting={FadeOutUp.duration(250)}
                className="w-full items-center"
            >
                <AppText
                    variant="caption"
                    className="mb-2.5 mt-5 text-center tracking-[2.5px] text-text-low"
                >
                    {role === "assistant" ? "aks" : "you"}
                </AppText>

                <View className="flex-row flex-wrap justify-center">
                    {words.map((word, index) => {
                        const animated = index < MAX_ANIMATED_WORDS;
                        return (
                            <View
                                key={`${messageKey}-${index}`}
                                className="mr-1 overflow-hidden"
                            >
                                {animated ? (
                                    <AnimatedWord
                                        word={word}
                                        index={index}
                                        animationKey={
                                            isNewMessage
                                                ? String(messageKey)
                                                : `${messageKey}-${words.length}`
                                        }
                                    />
                                ) : (
                                    <AppText
                                        variant="title"
                                        className="font-satoshi-medium text-center text-text-high"
                                    >
                                        {word}
                                    </AppText>
                                )}
                            </View>
                        );
                    })}
                </View>
            </Animated.View>
        </View>
    );
}