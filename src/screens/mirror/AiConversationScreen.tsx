import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    View,
} from "react-native";

import {
    DotLottie,
    type Dotlottie,
} from "@lottiefiles/dotlottie-react-native";

import { cn } from "@/lib/cn";
import AppText from "@/components/ui/Text";
import { useMirror } from "@/hooks/useMirror";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/routes";
import AnimatedAmbientBackground from "@/components/ui/AnimatedAmbientBackground";
import { useAuth } from "@/hooks/useAuth";
import MirrorConversationBottomBar from "@/components/mirror/MirrorConversationBottomBar";
import AnimatedConversationText from "@/components/ui/AnimatedConversationText";

const MASCOT_FALLBACK = require("@assets/splash-icon.png");

const MOTION_ASSETS = {
    idle: require("@assets/lottie/idle.lottie"),
    launch: require("@assets/lottie/launch.lottie"),
    provoke: require("@assets/lottie/provoke.lottie"),
    thinking: require("@assets/lottie/thinking.lottie"),
} as const;

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

    const currentAnimation = useRef<MotionAnimation>("launch");

    const [animation, setAnimation] =
        useState<MotionAnimation>("launch");

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
    const { user } = useAuth();

    const [ready, setReady] = useState(false);
    const mirror = useMirror(route.params?.conversationId);
    const [openingPrompt] = useState(getRandomOpeningPrompt);

    const handleMotionReady = useCallback(() => {
        setReady(true);
    }, []);

    return (
        <View className="flex-1 bg-white-bg">
            <AnimatedAmbientBackground />

            <KeyboardAvoidingView
                className="flex-1 pt-24 pb-7"
                behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View className="flex-1">
                    <ScrollView
                        className="flex-1"
                        contentContainerClassName="flex-grow px-5 pb-8"
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled">
                        <View className="flex-1">
                            <View className="mt-5 min-h-32 items-center justify-center">
                                {!mirror.messages.length ? (
                                    <>
                                        <AppText
                                            variant="body"
                                            className="text-center text-text-medium">
                                            Hey, {user?.name?.trim().split(/\s+/)[0]} 👋
                                        </AppText>

                                        <AnimatedConversationText
                                            text={openingPrompt}
                                            role="assistant"
                                            messageKey="initial-question"
                                        />
                                    </>
                                ) : (
                                    (() => {
                                        const latest = mirror.messages[mirror.messages.length - 1];

                                        return (
                                            <AnimatedConversationText
                                                text={latest.content}
                                                role={latest.role === "user" ? "user" : "assistant"}
                                                messageKey={latest.id}
                                            />
                                        );
                                    })()
                                )}
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
                            </View>

                            {/* {mirror.messages.length ? (
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
                            ) : null} */}
                            {/* {mirror.voiceActive ? (
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
                            ) : null} */}
                            {mirror.voiceActive && mirror.voiceState === "thinking" && !mirror.streamingAssistantText.trim()
                                ? <AppText variant="caption" className="pb-14 text-center text-text-low">Thinking…</AppText>
                                : null}
                            {mirror.loading ? <AppText variant="caption" className="pb-14 text-center text-text-low">Loading conversation…</AppText> : null}
                            {mirror.processing ? <AppText variant="caption" className="pb-14 text-center text-text-medium">Aks is thinking…</AppText> : null}
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
        </View>
    );
}