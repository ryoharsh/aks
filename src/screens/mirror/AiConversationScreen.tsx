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
    StopIcon,
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
import { useMirror } from "@/hooks/useMirror";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/routes";

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

type Props = NativeStackScreenProps<RootStackParamList, "AiConversation">;

export default function MirrorConversationScreen({ route }: Props) {
    const motionRef = useRef<AksMotionHandle>(null);

    const [ready, setReady] = useState(false);
    const mirror = useMirror(route.params?.conversationId);

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

                        {mirror.messages.length ? (
                            <View className="gap-4 pb-8">
                                {mirror.hasEarlier ? <Pressable onPress={() => void mirror.loadEarlier()} disabled={mirror.loadingEarlier} className="self-center py-3"><AppText variant="button" className="text-text-medium">{mirror.loadingEarlier ? "Loading…" : "Load earlier messages"}</AppText></Pressable> : null}
                                {mirror.messages.map((item) => (
                                    <View key={item.id} className={item.role === "user" ? "ml-10 items-end" : "mr-10 items-start"}>
                                        <AppText variant="caption" className="mb-2 text-text-low">{item.role === "user" ? "YOU" : "AKS"}</AppText>
                                        <View className={item.role === "user" ? "rounded-3xl bg-primary px-4 py-3" : "pr-4"}>
                                            <AppText className={item.role === "user" ? "text-primary-foreground" : "text-text-high"}>{item.content}</AppText>
                                        </View>
                                    </View>
                                ))}
</View>
                        ) : null}
                        {mirror.voiceActive ? (
                            <View className="gap-4 pb-8">
                                {mirror.streamingUserTranscript.trim() ? (
                                    <View className="ml-10 items-end">
                                        <AppText variant="caption" className="mb-2 text-text-low">YOU</AppText>
                                        <View className="rounded-3xl bg-primary px-4 py-3 opacity-90">
                                            <AppText className="text-primary-foreground">{mirror.streamingUserTranscript}</AppText>
                                        </View>
                                    </View>
                                ) : null}
                                {mirror.streamingAssistantText.trim() ? (
                                    <View className="mr-10 items-start">
                                        <AppText variant="caption" className="mb-2 text-text-low">AKS</AppText>
                                        <View className="pr-4">
                                            <AppText className="text-text-high">{mirror.streamingAssistantText}</AppText>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                        {mirror.voiceActive && mirror.voiceState === "thinking" && !mirror.streamingAssistantText.trim()
                            ? <AppText className="pb-8 text-center text-text-low">Thinking…</AppText>
                            : null}
                        {mirror.loading ? <AppText className="pb-8 text-center text-text-low">Loading conversation…</AppText> : null}
                        {mirror.processing ? <AppText className="pb-8 text-center text-text-low">Finding the signal…</AppText> : null}
{mirror.error ? (
                            <View className="mb-8 rounded-3xl border border-border bg-surface p-4">
                                <AppText variant="button" className="text-text-high">Something went wrong.</AppText>
                                <AppText className="mt-1 text-text-low">{mirror.error}</AppText>
                                <Pressable onPress={() => mirror.canRetry ? void mirror.retry() : mirror.dismissError()} className="mt-3 self-start py-1"><AppText variant="button" className="text-text-high">{mirror.canRetry ? "Retry response" : "Dismiss"}</AppText></Pressable>
                            </View>
                        ) : null}
                        {mirror.voiceError ? (
                            <View className="mb-8 rounded-3xl border border-border bg-surface p-4">
                                <AppText variant="button" className="text-text-high">Voice paused.</AppText>
                                <AppText className="mt-1 text-text-low">{mirror.voiceError}</AppText>
                                <Pressable onPress={mirror.dismissVoiceError} className="mt-3 self-start py-1"><AppText variant="button" className="text-text-high">Dismiss</AppText></Pressable>
                            </View>
                        ) : null}
                    </View>
                </ScrollView>

                <MirrorConversationBottomBar
                    motionRef={motionRef}
                    mirror={mirror}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

export function MirrorConversationBottomBar({
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

    const high = useResolveClassNames("text-text-high");
    const low = useResolveClassNames("text-text-low");

    useEffect(() => {
        if (inputVisible) requestAnimationFrame(() => inputRef.current?.focus());
    }, [inputVisible]);

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
            motionRef.current?.conversation("inputEnd");
        } catch {
            motionRef.current?.conversation("cancel");
            Alert.alert("Unable to save message", "Your message is still here. Check your connection and try again.");
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

        motionRef.current?.conversation(
            "cancel",
        );
    }, [motionRef]);

    const toggleMenu = useCallback(() => {
        setMenuOpen((open) => !open);
        setInputVisible(false);
    }, []);

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
                            ref={inputRef}
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
                                onPress={() => void handleSend()}
                                disabled={mirror.processing || mirror.loading}
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
                        ) : null}
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
                        onPress={() => {
                            mirror.startNewConversation();
                            setMenuOpen(false);
                            setMessage("");
                        }}
                        className="px-5 py-4"
                        disabled={mirror.processing || mirror.loading}
                    >
                        <AppText
                            variant="body"
                            className="text-text-high"
                        >
                            New conversation
                        </AppText>
                    </Pressable>

                </Animated.View>
            )}

            <View className="h-17 mx-13 flex-row items-center justify-evenly rounded-4xl bg-background px-3">
                <Pressable
                    onPress={toggleInput}
                    accessibilityRole="button"
                    accessibilityLabel="Open keyboard"
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
                    accessibilityRole="button"
                    accessibilityLabel="Close composer"
                    className="size-11 items-center justify-center rounded-full border border-neutral-300 bg-white-bg"
                >
                    <HugeiconsIcon
                        icon={Cancel01Icon}
                        size={28}
                        color={high.color}
                    />
                </Pressable>

                <Pressable
                    onPress={mirror.voiceActive
                        ? stopVoice
                        : startVoice}
                    accessibilityRole="button"
                    accessibilityLabel={mirror.voiceActive
                        ? "Stop voice conversation"
                        : "Start voice conversation"}
                    className={cn(
                        "size-11 items-center justify-center rounded-full",
                        mirror.voiceActive &&
                        "bg-primary/15",
                    )}
                >
                    <HugeiconsIcon
                        icon={mirror.voiceActive
                            ? StopIcon
                            : Mic01Icon}
                        size={20}
                        color={high.color}
                        strokeWidth={1.8}
                    />
                </Pressable>

                <Pressable
                    onPress={toggleMenu}
                    accessibilityRole="button"
                    accessibilityLabel="More conversation options"
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
