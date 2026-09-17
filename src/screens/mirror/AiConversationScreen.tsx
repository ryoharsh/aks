import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";

import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";

import {
    DotLottie,
    type Dotlottie,
} from "@lottiefiles/dotlottie-react-native";

import { HugeiconsIcon } from "@hugeicons/react-native";
import {
    ArrowUp01Icon,
    Cancel01Icon,
    CommandIcon,
    Menu01Icon,
    Mic01Icon,
} from "@hugeicons/core-free-icons";

import { useResolveClassNames } from "uniwind";

import Animated, {
    FadeInDown,
    FadeOutDown,
    LinearTransition,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";

const MASCOT_FALLBACK = require("@assets/splash-icon.png");

const MOTION_ASSETS = {
    idle: require("@assets/lottie/idle.lottie"),
    launch: require("@assets/lottie/launch.lottie"),
    provoke: require("@assets/lottie/provoke.lottie"),
    thinking: require("@assets/lottie/thinking.lottie"),
} as const;

type MotionAnimation = keyof typeof MOTION_ASSETS;

export type AksConversationEvent =
    | "typing"
    | "speechStart"
    | "send"
    | "responseStart"
    | "observation"
    | "positive"
    | "responseEnd"
    | "cancel"
    | "inputEnd";

export type AksMotionHandle = {
    conversation: (event: AksConversationEvent) => void;
};

const EVENT_ANIMATIONS: Record<
    AksConversationEvent,
    MotionAnimation
> = {
    typing: "thinking",
    speechStart: "provoke",
    send: "launch",
    responseStart: "launch",
    observation: "thinking",
    positive: "launch",
    responseEnd: "idle",
    cancel: "idle",
    inputEnd: "idle",
};

const AksMotion = forwardRef<
    AksMotionHandle,
    {
        onReady?: () => void;
    }
>(function AksMotion({ onReady }, ref) {
    const animationRef = useRef<Dotlottie>(null);

    const currentAnimation = useRef<MotionAnimation>("idle");

    const [animation, setAnimation] =
        useState<MotionAnimation>("idle");

    const changeAnimation = useCallback(
        (nextAnimation: MotionAnimation) => {
            if (currentAnimation.current === nextAnimation) {
                animationRef.current?.play();
                return;
            }

            currentAnimation.current = nextAnimation;

            setAnimation(nextAnimation);
        },
        [],
    );

    useImperativeHandle(
        ref,
        () => ({
            conversation: (event) => {
                changeAnimation(EVENT_ANIMATIONS[event]);
            },
        }),
        [changeAnimation],
    );

    const handleLoad = useCallback(() => {
        onReady?.();

        animationRef.current?.play();
    }, [onReady]);

    return (
        <DotLottie
            ref={animationRef}
            source={MOTION_ASSETS[animation]}
            autoplay={false}
            style={{ flex: 1 }}
            onLoad={handleLoad}
        />
    );
});

AksMotion.displayName = "AksMotion";

export default function MirrorConversationScreen() {
    const motionRef = useRef<AksMotionHandle>(null);

    const [ready, setReady] = useState(false);

    const handleMotionReady = useCallback(() => {
        setReady(true);
    }, []);

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-white-bg pt-24 pb-7"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerClassName="flex-grow px-5 pb-8"
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="flex-1">
                        <View>
                            <AppText
                                variant="body"
                                className="text-text-medium"
                            >
                                Hey, Aks 👋
                            </AppText>

                            <AppText
                                variant="title"
                                className="mt-3 max-w-82.5 font-satoshi-medium"
                            >
                                What’s been on your mind?
                            </AppText>
                        </View>

                        <View className="flex-1 items-center justify-center py-10">
                            <View className="relative h-62.5 w-62.5 overflow-hidden">
                                <Image
                                    source={MASCOT_FALLBACK}
                                    resizeMode="contain"
                                    className={cn(
                                        "absolute inset-0 h-full w-full",
                                        ready && "opacity-0",
                                    )}
                                />

                                <View className="absolute inset-0">
                                    <AksMotion
                                        ref={motionRef}
                                        onReady={handleMotionReady}
                                    />
                                </View>
                            </View>

                            <AppText
                                variant="body"
                                className="mt-5 max-w-70 text-center text-text-low"
                            >
                                You don’t need to organize your thoughts
                                first. Just start talking.
                            </AppText>
                        </View>
                    </View>
                </ScrollView>

                <MirrorConversationBottomBar
                    motionRef={motionRef}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

export function MirrorConversationBottomBar({
    motionRef,
}: {
    motionRef: React.RefObject<AksMotionHandle | null>;
}) {
    const [inputVisible, setInputVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    const audioRecorder = useAudioRecorder(
        RecordingPresets.HIGH_QUALITY,
    );

    const recorderState = useAudioRecorderState(
        audioRecorder,
        250,
    );

    const responseTimers = useRef<
        ReturnType<typeof setTimeout>[]
    >([]);

    const high = useResolveClassNames("text-text-high");
    const low = useResolveClassNames("text-text-low");

    const clearResponseTimers = useCallback(() => {
        responseTimers.current.forEach(clearTimeout);
        responseTimers.current = [];
    }, []);

    const playResponseLifecycle = useCallback(() => {
        clearResponseTimers();

        motionRef.current?.conversation("send");

        responseTimers.current = [
            setTimeout(() => {
                motionRef.current?.conversation(
                    "responseStart",
                );
            }, 180),

            setTimeout(() => {
                motionRef.current?.conversation(
                    "responseEnd",
                );
            }, 1400),
        ];
    }, [clearResponseTimers, motionRef]);

    useEffect(() => {
        return () => {
            clearResponseTimers();

            if (!recorderState.isRecording) {
                return;
            }

            void audioRecorder.stop().finally(() => {
                void setAudioModeAsync({
                    allowsRecording: false,
                });
            });
        };
    }, [
        audioRecorder,
        recorderState.isRecording,
        clearResponseTimers,
    ]);

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

        if (!value) {
            return;
        }

        setMessage("");

        playResponseLifecycle();
    }, [message, playResponseLifecycle]);

    const startRecording = useCallback(async () => {
        try {
            const permission =
                await AudioModule.requestRecordingPermissionsAsync();

            if (!permission.granted) {
                Alert.alert(
                    "Microphone unavailable",
                    "Microphone access is needed to share a voice reflection.",
                );

                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                allowsBackgroundRecording: false,
                playsInSilentMode: true,
            });

            await audioRecorder.prepareToRecordAsync();

            audioRecorder.record();

            motionRef.current?.conversation(
                "speechStart",
            );
        } catch {
            Alert.alert(
                "Couldn’t start listening",
                "Please try again, or share what’s on your mind in text.",
            );
        }
    }, [audioRecorder, motionRef]);

    const stopRecording = useCallback(async () => {
        try {
            await audioRecorder.stop();

            await setAudioModeAsync({
                allowsRecording: false,
            });

            motionRef.current?.conversation(
                "inputEnd",
            );

            playResponseLifecycle();
        } catch {
            motionRef.current?.conversation(
                "cancel",
            );
        }
    }, [
        audioRecorder,
        motionRef,
        playResponseLifecycle,
    ]);

    const toggleInput = useCallback(() => {
        setInputVisible((visible) => !visible);
        setMenuOpen(false);
    }, []);

    const cancelInput = useCallback(() => {
        setInputVisible(false);
        setMenuOpen(false);
        setMessage("");

        motionRef.current?.conversation(
            "cancel",
        );
    }, [motionRef]);

    const toggleMenu = useCallback(() => {
        setMenuOpen((open) => !open);
        setInputVisible(false);
    }, []);

    const isRecording = recorderState.isRecording;
    const hasMessage = Boolean(message.trim());

    return (
        <View className="px-5 pb-3">
            {inputVisible && (
                <Animated.View
                    entering={FadeInDown.duration(220)}
                    exiting={FadeOutDown.duration(180)}
                    layout={LinearTransition.duration(220)}
                    className="absolute bottom-22 left-4 right-4 z-10"
                >
                    <View className="min-h-14 flex-row items-end rounded-3xl border border-border bg-surface p-1.5 pl-4">
                        <TextInput
                            value={message}
                            onChangeText={
                                handleMessageChange
                            }
                            placeholder="Tell Aks what’s on your mind…"
                            placeholderTextColor={
                                low.color
                            }
                            multiline
                            maxLength={1200}
                            returnKeyType="default"
                            className="max-h-28 min-h-11 flex-1 py-2 font-satoshi text-[15px] leading-5 text-text-high"
                        />

                        {hasMessage ? (
                            <IconButton
                                accessibilityLabel="Send message"
                                onPress={handleSend}
                                className="bg-primary"
                            >
                                <HugeiconsIcon
                                    icon={
                                        ArrowUp01Icon
                                    }
                                    size={20}
                                    color="#fff"
                                />
                            </IconButton>
                        ) : (
                            <IconButton
                                accessibilityLabel={
                                    isRecording
                                        ? "Stop listening"
                                        : "Start listening"
                                }
                                onPress={
                                    isRecording
                                        ? stopRecording
                                        : startRecording
                                }
                                className={cn(
                                    "ml-2 bg-background",
                                    isRecording &&
                                    "bg-primary/15",
                                )}
                            >
                                <HugeiconsIcon
                                    icon={
                                        isRecording
                                            ? Cancel01Icon
                                            : Mic01Icon
                                    }
                                    size={20}
                                    color={
                                        high.color
                                    }
                                    strokeWidth={1.8}
                                />
                            </IconButton>
                        )}
                    </View>
                </Animated.View>
            )}

            {menuOpen && (
                <Animated.View
                    entering={FadeInDown.duration(180)}
                    exiting={FadeOutDown.duration(140)}
                    className="absolute bottom-22 right-4 z-10 min-w-52 overflow-hidden rounded-2xl border border-border bg-surface"
                >
                    <Pressable
                        onPress={() =>
                            setMenuOpen(false)
                        }
                        className="px-5 py-4"
                    >
                        <AppText
                            variant="body"
                            className="text-text-high"
                        >
                            New conversation
                        </AppText>
                    </Pressable>

                    <View className="h-px bg-border" />

                    <Pressable
                        onPress={() =>
                            setMenuOpen(false)
                        }
                        className="px-5 py-4"
                    >
                        <AppText
                            variant="body"
                            className="text-text-high"
                        >
                            Conversation history
                        </AppText>
                    </Pressable>
                </Animated.View>
            )}

            <View className="h-17 mx-13 flex-row items-center justify-evenly rounded-4xl bg-background px-3">
                <Pressable
                    onPress={toggleInput}
                    className={cn(
                        "size-11 items-center justify-center rounded-full",
                        inputVisible &&
                        "bg-background",
                    )}
                >
                    <HugeiconsIcon
                        icon={CommandIcon}
                        size={20}
                        color={high.color}
                    />
                </Pressable>

                <Pressable
                    onPress={cancelInput}
                    className="size-11 items-center justify-center rounded-full border border-neutral-300 bg-white-bg"
                >
                    <HugeiconsIcon
                        icon={Cancel01Icon}
                        size={28}
                        color={high.color}
                    />
                </Pressable>

                <Pressable
                    onPress={toggleMenu}
                    className={cn(
                        "size-11 items-center justify-center rounded-full",
                        menuOpen &&
                        "bg-background",
                    )}
                >
                    <HugeiconsIcon
                        icon={Menu01Icon}
                        size={20}
                        color={high.color}
                    />
                </Pressable>
            </View>
        </View>
    );
}