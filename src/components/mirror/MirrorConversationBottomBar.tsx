import React, { useCallback, useEffect, useRef, useState, } from "react";
import { Pressable, TextInput, } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowUp01Icon, Cancel01Icon, CommandIcon, Mic01Icon, StopIcon, VolumeHighIcon, VolumeOffIcon, XIcon, } from "@hugeicons/core-free-icons";
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
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { startPulse } from "@/lib/motion";
import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { copy } from "@/constants/copy";
import { useAuth } from "@/hooks/useAuth";
import { useMirror } from "@/hooks/useMirror";
import { draftService } from "@/services/draft.service";
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

    const { user } = useAuth();
    const userId = user?.id ?? null;
    const draftScope = mirror.conversationId ?? "mirror-new";
    const draftHydrated = useRef(false);

    const inputRef = useRef<TextInput>(null);

    // Keep an unsent draft on this device across navigation and restarts, then
    // drop it as soon as it is sent or the composer is cleared.
    useEffect(() => {
        draftHydrated.current = false;
        if (!userId) {
            setMessage("");
            return;
        }
        let active = true;
        void draftService.get(userId, draftScope).then((saved) => {
            if (!active) return;
            // Never clobber something the user started typing meanwhile.
            setMessage((current) => (current ? current : saved));
            draftHydrated.current = true;
        });
        return () => { active = false; };
    }, [draftScope, userId]);

    useEffect(() => {
        if (!userId || !draftHydrated.current) return;
        void draftService.set(userId, draftScope, message);
    }, [draftScope, message, userId]);

    const barProgress = useSharedValue(0);
    const voicePulse = useSharedValue(1);
    const hintOpacity = useSharedValue(1);

    const high = useResolveClassNames("text-text-high");
    const low = useResolveClassNames("text-text-low");
    const primaryForeground = useResolveClassNames("text-primary-foreground").color;

    useEffect(() => {
        barProgress.value = withTiming(1, {
            duration: 550,
        });
    }, [barProgress]);

    useEffect(() => {
        if (mirror.voiceActive) {
            startPulse(voicePulse, 1.08, 900);
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

    const handleSend = useCallback(() => {
        const value = message.trim();

        if (!value || mirror.processing || mirror.loading) {
            return;
        }

        // The conversation id is only assigned once the first message is saved,
        // so remember which draft key this text lives under before sending.
        const scopeAtSend = mirror.conversationId ?? "mirror-new";

        // Clear instantly: the message renders optimistically in the
        // conversation and the Aks request starts immediately.
        setMessage("");
        setInputVisible(false);
        if (user) void draftService.clear(user.id, scopeAtSend).catch(() => undefined);

        motionRef.current?.conversation("send");

        void (async () => {
            try {
                await mirror.sendMessage(value);

                motionRef.current?.conversation("responseStart");
            } catch {
                // The sent message stays visible in the conversation next to
                // the existing retry/error state — nothing is lost.
                motionRef.current?.conversation("cancel");
            }
        })();
    }, [message, mirror, motionRef, user]);

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
    }, []);

    const cancelInput = useCallback(() => {
        setInputVisible(false);
        setMessage("");

        motionRef.current?.conversation("cancel");
    }, [motionRef]);

    const hasMessage = Boolean(message.trim());

    return (
        <Animated.View
            style={barStyle}
            className="px-5 pb-8 flex flex-col"
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
                            placeholder={copy.mirrorBar.composerPlaceholder}
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
                                    icon={
                                        <HugeiconsIcon
                                            icon={ArrowUp01Icon}
                                            size={20}
                                            color={primaryForeground}
                                        />
                                    }
                                />
                            </Animated.View>
                        ) : (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                exiting={FadeOut.duration(120)}
                            >
                                <AnimatedSendButton
                                    onPress={() => setInputVisible(false)}
                                    icon={
                                        <HugeiconsIcon
                                            icon={XIcon}
                                            size={20}
                                            color={primaryForeground}
                                        />
                                    }
                                />
                            </Animated.View>
                        )}
                    </Animated.View>
                </Animated.View>
            ) : <>
                <Animated.View
                    layout={LinearTransition.springify()
                        .damping(18)
                        .stiffness(170)}
                    className="h-17 mx-13 flex-row items-center justify-evenly rounded-4xl bg-surface"
                >
                    <AnimatedActionButton
                        delay={80}
                        onPress={cancelInput}
                        accessibilityLabel={copy.mirrorBar.closeComposerA11y}
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
                        accessibilityLabel={copy.mirrorBar.openKeyboardA11y}
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
                                    ? copy.mirrorBar.stopVoiceA11y
                                    : copy.mirrorBar.startVoiceA11y
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
                        delay={200}
                        onPress={mirror.toggleVoiceOutput}
                        accessibilityLabel={
                            mirror.voiceOutputEnabled
                                ? copy.mirrorBar.voiceOffA11y
                                : copy.mirrorBar.voiceOnA11y
                        }
                        active={mirror.voiceOutputEnabled}
                        icon={
                            <HugeiconsIcon
                                icon={
                                    mirror.voiceOutputEnabled
                                        ? VolumeHighIcon
                                        : VolumeOffIcon
                                }
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
                        {copy.mirrorBar.hint}
                    </AppText>
                </Animated.View>
            </>}
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
    icon,
}: {
    onPress: () => void;
    disabled?: boolean;
    icon: React.ReactElement;
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
                accessibilityLabel={copy.mirrorBar.sendMessageA11y}
                onPress={onPress}
                disabled={disabled}
                className="bg-primary"
            >
                {icon}
            </IconButton>
        </Animated.View>
    );
}