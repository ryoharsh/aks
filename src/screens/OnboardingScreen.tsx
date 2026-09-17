import React, { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    View,
    Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useEventListener } from "expo";

import AppText from "@/components/ui/Text";
import AppLogo from "@/components/ui/AppLogo";
import AnimatedButton from "@/components/ui/AnimatedButton";
import type { RootStackParamList } from "@/navigation/routes";
import LogoMark from "@/components/common/LogoMark";
import { useAppFlow } from "@/providers/AppFlowProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

type Slide = {
    eyebrow: string;
    title: string;
    description: string;
    asset: number;
};

const slides: Slide[] = [
    {
        eyebrow: "YOUR LIFE LEAVES CLUES",
        title: "You already leave\nclues about yourself.",
        description:
            "The things you repeat. The moments you avoid. The days that feel different. Aks brings those signals together.",
        asset: require("@assets/videos/slide_1.mp4"),
    },
    {
        eyebrow: "DON'T JUST REFLECT",
        title: "Don’t guess.\nTest it.",
        description:
            "Turn a hunch into a small experiment. Change one thing, measure what happens, and discover what actually works for you.",
        asset: require("@assets/videos/slide_2.mp4"),
    },
    {
        eyebrow: "A CLEARER YOU",
        title: "Become less of\na mystery to yourself.",
        description:
            "Over time, Aks builds a living picture of your patterns, your responses, and the changes that make a difference.",
        asset: require("@assets/videos/slide_3.mp4"),
    },
];

function Visual({
    asset,
    active,
}: {
    asset: Slide["asset"];
    active: boolean;
}) {
    const [status, setStatus] = useState("idle");

    const player = useVideoPlayer(asset, (player) => {
        player.loop = true;
        player.muted = true;
        player.volume = 0;
    });

    useEventListener(player, "statusChange", ({
        status,
        error,
    }) => {
        setStatus(status);

        if (error) {
            console.log("Video error:", error);
        }

        console.log("Video status:", status);
    });

    useEffect(() => {
        if (active) {
            player.currentTime = 0;
            player.play();
        } else {
            player.pause();
        }
    }, [active, player]);

    return (
        <View
            className="h-60 w-full overflow-hidden rounded-3xl bg-white">
            <VideoView
                player={player}
                nativeControls={false}
                contentFit="cover"
                style={{
                    width: "100%",
                    height: "100%",
                }}
            />
        </View>
    );
}

function AnimatedSlideContent({
    slide,
    index,
    currentIndex,
}: {
    slide: Slide;
    index: number;
    currentIndex: number;
}) {
    const progress = useSharedValue(index === currentIndex ? 1 : 0);

    useEffect(() => {
        progress.value = withTiming(index === currentIndex ? 1 : 0, {
            duration: 500,
            easing: Easing.out(Easing.cubic),
        });
    }, [currentIndex, index, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            {
                translateY: interpolate(progress.value, [0, 1], [18, 0]),
            },
            {
                scale: interpolate(progress.value, [0, 1], [0.97, 1]),
            },
        ],
    }));

    return (
        <Animated.View
            style={animatedStyle}
            className="flex-1"
        >
            <Visual
                asset={slide.asset}
                active={index === currentIndex}
            />

            <Animated.View
                entering={FadeInDown.duration(500).delay(100)}
                className="mt-6"
            >
                <AppText
                    variant="caption"
                    className="text-[10px] tracking-[2px] text-text-low"
                >
                    {slide.eyebrow}
                </AppText>

                <AppText
                    variant="title"
                    className="mt-4 text-[36px] leading-10.5 text-text-high"
                >
                    {slide.title}
                </AppText>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(200)}
                >
                    <AppText className="mt-5 max-w-85 text-[16px] leading-6 text-text-low">
                        {slide.description}
                    </AppText>
                </Animated.View>
            </Animated.View>
        </Animated.View>
    );
}

export default function OnboardingScreen({ navigation }: Props) {
    const { completeOnboarding } = useAppFlow();
    const scrollRef = useRef<ScrollView>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [saving, setSaving] = useState(false);

    const isLastSlide = currentIndex === slides.length - 1;

    const ctaProgress = useSharedValue(1);

    useEffect(() => {
        ctaProgress.value = 0;

        ctaProgress.value = withTiming(1, {
            duration: 350,
            easing: Easing.out(Easing.cubic),
        });
    }, [currentIndex, ctaProgress]);

    const ctaStyle = useAnimatedStyle(() => ({
        opacity: ctaProgress.value,
        transform: [
            {
                translateY: interpolate(
                    ctaProgress.value,
                    [0, 1],
                    [12, 0],
                ),
            },
            {
                scale: interpolate(
                    ctaProgress.value,
                    [0, 1],
                    [0.97, 1],
                ),
            },
        ],
    }));

    const handleScroll = (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);

        if (
            index !== currentIndex &&
            index >= 0 &&
            index < slides.length
        ) {
            setCurrentIndex(index);
        }
    };

    const finishOnboarding = async () => {
        if (saving) return;
        try {
            setSaving(true);
            await completeOnboarding();
        } catch {
            Alert.alert("Unable to continue", "Please try again.");
            setSaving(false);
        }
    };

    const goToNext = () => {
        if (isLastSlide) {
            void finishOnboarding();
            return;
        }

        const nextIndex = currentIndex + 1;

        scrollRef.current?.scrollTo({
            x: nextIndex * SCREEN_WIDTH,
            animated: true,
        });
    };

    const skip = () => {
        void finishOnboarding();
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar style="dark" />

            <Animated.View
                entering={FadeIn.duration(500)}
                className="flex-row items-center justify-between px-6 pt-16"
            >
                <LogoMark />

                {!isLastSlide ? (
                    <Animated.View
                        entering={FadeIn.duration(500).delay(150)}
                    >
                        <Pressable
                            onPress={skip}
                            disabled={saving}
                            hitSlop={12}
                        >
                            <AppText className="text-sm text-text-high">
                                Skip
                            </AppText>
                        </Pressable>
                    </Animated.View>
                ) : (
                    <View className="h-16" />
                )}
            </Animated.View>

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                className="flex-1"
            >
                {slides.map((slide, index) => (
                    <View
                        key={slide.asset}
                        style={{ width: SCREEN_WIDTH }}
                        className="px-6 pt-5 pb-12"
                    >
                        <AnimatedSlideContent
                            slide={slide}
                            index={index}
                            currentIndex={currentIndex}
                        />
                    </View>
                ))}
            </ScrollView>

            <View className="px-6 pb-10">
                <View className="mb-7 flex-row items-center gap-2">
                    {slides.map((slide, index) => (
                        <View
                            key={slide.asset}
                            className={
                                index === currentIndex
                                    ? "h-1.5 w-5 rounded-full bg-primary"
                                    : "h-1.5 w-1.5 rounded-full bg-border-strong"
                            }
                        />
                    ))}
                </View>

                <Animated.View style={ctaStyle}>
                    <AnimatedButton
                        onPress={goToNext}
                        loading={saving}
                        disabled={saving}
                        bgColor="bg-white"
                        pressBgColor="bg-neutral-950"
                        textColor="text-black"
                        pressTextColor="text-white"
                        borderColor="border-transparent"
                        className="mx-5 mb-5 rounded-full shadow-2xl shadow-neutral-300"
                    >
                        {isLastSlide ? "Get started" : "Move forward"}
                    </AnimatedButton>
                </Animated.View>
            </View>
        </View>
    );
}
