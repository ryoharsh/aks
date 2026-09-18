import React, { useCallback, useEffect, useRef, useState, } from "react";
import { Alert, Pressable, TextInput, } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowUp01Icon, Cancel01Icon, CommandIcon, Menu01Icon, Mic01Icon, StopIcon, } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";
import Animated, {
    cancelAnimation,
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    FadeOutDown,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { useMirror } from "@/hooks/useMirror";
import { AksMotionHandle } from "@/screens/mirror/AiConversationScreen";

export default function MirrorConversationBottomBar({
    motionRef,
    mirror,
}: {
    motionRef: React.RefObject<AksMotionHandle | null>;
    mirror: ReturnType<typeof useMirror>;
}) {
    const [inputVisible, setInputVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    const inputRef = useRef<TextInput>(null);

    const barProgress = useSharedValue(0);
    const voicePulse = useSharedValue(1);
    const hintOpacity = useSharedValue(1);

    const high = useResolveClassNames("text-text-high");
    const low = useResolveClassNames("text-text-low");

    useEffect(() => {
        barProgress.value = withTiming(1, {
            duration: 550,
        });
    }, [barProgress]);

    useEffect(() => {
        if (mirror.voiceActive) {
            voicePulse.value = withRepeat(
                withTiming(1.08, {
                    duration: 900,
                    easing: undefined,
                }),
                -1,
                true,
            );
        } else {
            cancelAnimation(voicePulse);
            voicePulse.value = withSpring(1, {
                damping: 15,
                stiffness: 180,
            });
        }
    }, [mirror.voiceActive, voicePulse]);

    useEffect(() => {
        if (inputVisible) {
            hintOpacity.value = withTiming(0, {
                duration: 180,
            });

            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        } else {
            hintOpacity.value = withTiming(1, {
                duration: 260,
            });
        }
    }, [inputVisible, hintOpacity]);

    const barStyle = useAnimatedStyle(() => ({
        opacity: barProgress.value,
        transform: [
            {
                translateY: (1 - barProgress.value) * 28,
            },
            {
                scale: 0.96 + barProgress.value * 0.04,
            },
        ],
    }));

    const voiceStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: voicePulse.value,
            },
        ],
    }));

    const hintStyle = useAnimatedStyle(() => ({
        opacity: hintOpacity.value,
        transform: [
            {
                translateY: (1 - hintOpacity.value) * 4,
            },
        ],
    }));

    const handleMessageChange = useCallback(
        (value: string) => {
            setMessage(value);

            motionRef.current?.conversation(
                value.trim()
                    ? "typing"
                    : "inputEnd",
            );
        },
        [motionRef],
    );

    const handleSend = useCallback(async () => {
        const value = message.trim();

        if (!value || mirror.processing || mirror.loading) {
            return;
        }

        motionRef.current?.conversation("send");

        try {
            await mirror.sendMessage(value);

            setMessage("");
            setInputVisible(false);

            motionRef.current?.conversation("responseStart");
        } catch {
            motionRef.current?.conversation("cancel");

            Alert.alert(
                "Unable to send message",
                "Your message is still here. Check your connection and try again.",
            );
        }
    }, [message, mirror, motionRef]);

    const startVoice = useCallback(() => {
        motionRef.current?.conversation("speechStart");
        void mirror.startVoiceConversation();
    }, [mirror, motionRef]);

    const stopVoice = useCallback(() => {
        void mirror.stopVoiceConversation();
        motionRef.current?.conversation("inputEnd");
    }, [mirror, motionRef]);

    useEffect(() => {
        switch (mirror.voiceState) {
            case "userSpeaking":
                motionRef.current?.conversation("speechStart");
                break;

            case "thinking":
                motionRef.current?.conversation("typing");
                break;

            case "assistantSpeaking":
                motionRef.current?.conversation("responseStart");
                break;

            case "error":
                motionRef.current?.conversation("cancel");
                break;

            case "listening":
            case "connected":
            case "connecting":
            case "reconnecting":
            case "idle":
            case "ended":
                motionRef.current?.conversation("inputEnd");
                break;
        }
    }, [mirror.voiceState, motionRef]);

    const toggleInput = useCallback(() => {
        setInputVisible((visible) => !visible);
        setMenuOpen(false);
    }, []);

    const cancelInput = useCallback(() => {
        setInputVisible(false);
        setMenuOpen(false);
        setMessage("");

        motionRef.current?.conversation("cancel");
    }, [motionRef]);

    const toggleMenu = useCallback(() => {
        setMenuOpen((open) => !open);
        setInputVisible(false);
    }, []);

    const hasMessage = Boolean(message.trim());

    return (
        <Animated.View
            style={barStyle}
            className="px-5 pb-3 flex flex-col"
        >
            {inputVisible ? (
                <Animated.View
                    entering={FadeInDown.duration(280)}
                    exiting={FadeOutDown.duration(200)}
                    layout={LinearTransition.springify()
                        .damping(18)
                        .stiffness(160)}
                    className="mb-2 z-10"
                >
                    <Animated.View
                        entering={FadeInUp.duration(260)}
                        layout={LinearTransition.springify()
                            .damping(18)
                            .stiffness(170)}
                        className="min-h-12 flex-row items-end rounded-3xl bg-surface/60 p-1.5 pl-4"
                    >
                        <TextInput
                            ref={inputRef}
                            value={message}
                            onChangeText={handleMessageChange}
                            placeholder="Tell Aks what’s on your mind…"
                            placeholderTextColor={low.color}
                            multiline
                            maxLength={1200}
                            returnKeyType="default"
                            className="max-h-28 min-h-10 flex-1 py-2 font-satoshi text-[15px] leading-5 text-text-high"
                        />

                        {hasMessage ? (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                exiting={FadeOut.duration(120)}
                            >
                                <AnimatedSendButton
                                    onPress={() => void handleSend()}
                                    disabled={
                                        mirror.processing ||
                                        mirror.loading
                                    }
                                />
                            </Animated.View>
                        ) : null}
                    </Animated.View>
                </Animated.View>
            ) : null}

            {menuOpen ? (
                <Animated.View
                    entering={FadeInDown.duration(260)}
                    exiting={FadeOutDown.duration(180)}
                    layout={LinearTransition.springify()
                        .damping(18)
                        .stiffness(170)}
                    className="z-10 mb-2 ms-35 me-5 min-w-52 overflow-hidden rounded-2xl bg-surface/60"
                >
                    <Pressable
                        onPress={() => {
                            if (mirror.voiceActive) {
                                void mirror.stopVoiceConversation();
                            }

                            mirror.startNewConversation();

                            setMenuOpen(false);
                            setMessage("");
                            setInputVisible(false);

                            motionRef.current?.conversation(
                                "inputEnd",
                            );
                        }}
                        disabled={
                            mirror.processing ||
                            mirror.loading
                        }
                        className="px-5 py-2.5"
                    >
                        <AppText
                            variant="body"
                            className="text-text-high"
                        >
                            New conversation
                        </AppText>
                    </Pressable>
                </Animated.View>
            ) : null}

            <Animated.View
                layout={LinearTransition.springify()
                    .damping(18)
                    .stiffness(170)}
                className="h-17 mx-13 flex-row items-center justify-evenly rounded-4xl bg-surface"
            >
                <AnimatedActionButton
                    delay={80}
                    onPress={cancelInput}
                    accessibilityLabel="Close composer"
                    className="bg-red-400"
                    icon={
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={28}
                            color="#fff"
                        />
                    }
                />

                <AnimatedActionButton
                    delay={140}
                    onPress={toggleInput}
                    accessibilityLabel="Open keyboard"
                    active={inputVisible}
                    icon={
                        <HugeiconsIcon
                            icon={CommandIcon}
                            size={20}
                            color={high.color}
                        />
                    }
                />

                <Animated.View
                    entering={FadeInUp.delay(200).duration(400)}
                    style={voiceStyle}
                >
                    <AnimatedActionButton
                        onPress={
                            mirror.voiceActive
                                ? stopVoice
                                : startVoice
                        }
                        accessibilityLabel={
                            mirror.voiceActive
                                ? "Stop voice conversation"
                                : "Start voice conversation"
                        }
                        active={mirror.voiceActive}
                        icon={
                            <HugeiconsIcon
                                icon={
                                    mirror.voiceActive
                                        ? StopIcon
                                        : Mic01Icon
                                }
                                size={20}
                                color={high.color}
                                strokeWidth={1.8}
                            />
                        }
                    />
                </Animated.View>

                <AnimatedActionButton
                    delay={260}
                    onPress={toggleMenu}
                    accessibilityLabel="More conversation options"
                    active={menuOpen}
                    icon={
                        <HugeiconsIcon
                            icon={Menu01Icon}
                            size={20}
                            color={high.color}
                        />
                    }
                />
            </Animated.View>

            <Animated.View
                style={hintStyle}
                className="px-4"
                pointerEvents="none"
            >
                <AppText
                    variant="caption"
                    className="mt-3 text-center text-text-high"
                >
                    You don’t need to organize your thoughts
                    first. Just start talking.
                </AppText>
            </Animated.View>
        </Animated.View>
    );
}

function AnimatedActionButton({
    onPress,
    accessibilityLabel,
    icon,
    active = false,
    className,
    delay = 0,
}: {
    onPress: () => void;
    accessibilityLabel: string;
    icon: React.ReactNode;
    active?: boolean;
    className?: string;
    delay?: number;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: scale.value,
            },
        ],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.88, {
            damping: 14,
            stiffness: 250,
        });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, {
            damping: 12,
            stiffness: 220,
        });
    };

    return (
        <Animated.View
            entering={FadeInUp.delay(delay).duration(380)}
            layout={LinearTransition.springify()
                .damping(18)
                .stiffness(170)}
            style={animatedStyle}
        >
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                className={cn(
                    "size-11 items-center justify-center rounded-full",
                    active && "bg-background",
                    className,
                )}
            >
                {icon}
            </Pressable>
        </Animated.View>
    );
}

function AnimatedSendButton({
    onPress,
    disabled,
}: {
    onPress: () => void;
    disabled?: boolean;
}) {
    const scale = useSharedValue(0.7);

    useEffect(() => {
        scale.value = withSpring(1, {
            damping: 12,
            stiffness: 220,
        });
    }, [scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: scale.value,
            },
        ],
    }));

    return (
        <Animated.View style={animatedStyle}>
            <IconButton
                accessibilityLabel="Send message"
                onPress={onPress}
                disabled={disabled}
                className="bg-primary"
            >
                <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    size={20}
                    color="#fff"
                />
            </IconButton>
        </Animated.View>
    );
}