import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";

import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

import AppText from "@/components/ui/Text";
import { useMirror } from "@/hooks/useMirror";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/routes";
import AnimatedAmbientBackground from "@/components/ui/AnimatedAmbientBackground";
import { useAuth } from "@/hooks/useAuth";
import { useDeferredHeavyMount } from "@/hooks/useDeferredHeavyMount";
import { useIsFocused } from "@react-navigation/native";
import MirrorConversationBottomBar from "@/components/mirror/MirrorConversationBottomBar";
import AnimatedConversationText from "@/components/ui/AnimatedConversationText";
import LottieView from "lottie-react-native";

const LAUNCH_MOTION = require("@assets/lottie/json/launch.json");

const OPENING_PROMPTS = [
    "What’s been on your mind?",
    "How are you feeling today?",
    "Is there something you’ve been carrying lately?",
    "What’s been taking up space in your head?",
    "Want to talk about what’s bothering you?",
    "Anything you feel like getting off your chest?",
    "What’s been weighing on you lately?",
    "Is there something you wish you could say?",
];

function getRandomOpeningPrompt() {
    return OPENING_PROMPTS[
        Math.floor(Math.random() * OPENING_PROMPTS.length)
    ];
}

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

const AksMotion = forwardRef<AksMotionHandle>(function AksMotion(
    _props,
    ref,
) {
    const animationRef = useRef<LottieView>(null);
    const isFocused = useIsFocused();

    const play = useCallback(() => {
        animationRef.current?.play();
    }, []);

    useEffect(() => {
        if (isFocused) {
            animationRef.current?.play();
        } else {
            animationRef.current?.pause();
        }
    }, [isFocused]);

    useImperativeHandle(
        ref,
        () => ({
            conversation: () => {
                play();
            },
        }),
        [play],
    );

    return (
        <LottieView
            ref={animationRef}
            source={LAUNCH_MOTION}
            autoPlay
            loop
            style={{ flex: 1 }}
        />
    );
});

AksMotion.displayName = "AksMotion";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "AiConversation"
>;

export default function MirrorConversationScreen({
    route,
}: Props) {
    const motionRef = useRef<AksMotionHandle>(null);
    const { user } = useAuth();
    const isFocused = useIsFocused();
    const heavyReady = useDeferredHeavyMount();

    const mirror = useMirror(
        route.params?.conversationId,
    );

    const [openingPrompt] = useState(
        getRandomOpeningPrompt,
    );

    const latestMessage =
        mirror.messages.length > 0
            ? mirror.messages[mirror.messages.length - 1]
            : null;

    return (
        <View className="flex-1 bg-white-bg">
            {heavyReady ? (
                <AnimatedAmbientBackground />
            ) : (
                <View
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                >
                    <View
                        style={{
                            ...StyleSheet.absoluteFill,
                            backgroundColor: "#FFFFFF",
                        }}
                    />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1">
                <View className="flex-1">
                    <ScrollView
                        className="flex-1"
                        contentContainerClassName="flex-grow px-2"
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View className="flex-1">
                            <View className="mt-20 min-h-32 items-center justify-center px-3">
                                {mirror.processing &&
                                    mirror.streamingReplyText.trim() ? (
                                    <View className="w-full">
                                        <AppText
                                            variant="title"
                                            className="text-center font-satoshi-medium text-text-high"
                                        >
                                            {mirror.streamingReplyText}
                                        </AppText>
                                    </View>
                                ) : !latestMessage ? (
                                    <>
                                        <AppText
                                            variant="body"
                                            className="text-center text-text-medium"
                                        >
                                            Hey,{" "}
                                            {user?.name
                                                ?.trim()
                                                .split(/\s+/)[0] ??
                                                "there"}{" "}
                                            👋
                                        </AppText>

                                        <View className="mt-3 w-full">
                                            <AnimatedConversationText
                                                text={openingPrompt}
                                                role="assistant"
                                                messageKey="initial-question"
                                            />
                                        </View>
                                    </>
                                ) : (
                                    <View className="w-full">
                                        <AnimatedConversationText
                                            text={latestMessage.content}
                                            role={
                                                latestMessage.role ===
                                                    "user"
                                                    ? "user"
                                                    : "assistant"
                                            }
                                            messageKey={
                                                latestMessage.id
                                            }
                                        />
                                    </View>
                                )}
                            </View>

                            <View className="mt-10 items-center justify-center">
                                <View className="h-100 w-100">
                                    {heavyReady ? (
                                        <AksMotion
                                            ref={motionRef}
                                        />
                                    ) : (
                                        <View
                                            className="size-full items-center justify-center"
                                            accessibilityLabel="Aks is ready"
                                        />
                                    )}
                                </View>
                            </View>

                            <View className="min-h-14 items-center justify-center absolute bottom-2 left-0 right-0">
                                {mirror.voiceActive && mirror.voiceState === "thinking" && !mirror.streamingAssistantText.trim() ? (
                                    <AppText variant="caption" className="text-center text-text-low">Thinking…</AppText>
                                ) : null}

                                {mirror.loading ? (
                                    <AppText variant="caption" className="text-center text-text-low">Loading conversation…</AppText>
                                ) : null}

                                {mirror.processing && !mirror.streamingReplyText.trim() ? (
                                    <AppText variant="caption" className="text-center text-text-medium">Aks is thinking…</AppText>
                                ) : null}
                            </View>

                            {mirror.error ? (
                                <View className="absolute mt-20 w-full rounded-3xl border border-border bg-surface p-4">
                                    <AppText variant="button" className="text-text-high">Something went wrong.</AppText>

                                    <AppText className="mt-1 text-text-low">{mirror.error}</AppText>

                                    <Pressable
                                        onPress={() =>
                                            mirror.canRetry
                                                ? void mirror.retry()
                                                : mirror.dismissError()
                                        }
                                        className="mt-3 self-start py-1"
                                    >
                                        <AppText
                                            variant="button"
                                            className="text-text-high"
                                        >
                                            {mirror.canRetry
                                                ? "Retry response"
                                                : "Dismiss"}
                                        </AppText>
                                    </Pressable>
                                </View>
                            ) : null}

                            {mirror.voiceError ? (
                                <View className="absolute w-full rounded-3xl mt-20 border border-border bg-surface p-4">
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        Voice paused.
                                    </AppText>

                                    <AppText className="mt-1 text-text-low">
                                        {mirror.voiceError}
                                    </AppText>

                                    <Pressable
                                        onPress={
                                            mirror.dismissVoiceError
                                        }
                                        className="mt-3 self-start py-1"
                                    >
                                        <AppText
                                            variant="button"
                                            className="text-text-high"
                                        >
                                            Dismiss
                                        </AppText>
                                    </Pressable>
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
        </View>
    );
}