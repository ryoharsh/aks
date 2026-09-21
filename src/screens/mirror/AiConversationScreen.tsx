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
    TextInput,
    View,
} from "react-native";
import { useResolveClassNames } from "uniwind";

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
import ThinkingIndicator from "@/components/ui/ThinkingIndicator";
import { messageActionsService } from "@/services/messageActions.service";
import LottieView from "lottie-react-native";
import { copy } from "@/constants/copy";

const LAUNCH_MOTION = require("@assets/lottie/json/launch.json");

const OPENING_PROMPTS: readonly string[] = copy.aiConversation.openingPrompts;

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

    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Refs hold the latest hook values so focus transitions fire exactly once.
    const mirrorRef = useRef(mirror);
    mirrorRef.current = mirror;
    const scrollRef = useRef<ScrollView>(null);
    // Follow streamed content only while pinned near the bottom. Refs only —
    // tracking never re-renders per scroll event.
    const nearBottomRef = useRef(false);
    const contentHeightRef = useRef(0);
    const low = useResolveClassNames("text-text-low");
    const whiteBgColor = useResolveClassNames("bg-white-bg").backgroundColor;

    const latestMessage =
        mirror.messages.length > 0
            ? mirror.messages[mirror.messages.length - 1]
            : null;

    useEffect(() => () => {
        if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    }, []);

    // The realtime session is user-started from the composer mic, so it must
    // never outlive this screen: leaving stops an active voice conversation.
    useEffect(() => {
        if (isFocused) return;
        if (mirrorRef.current.voiceActive) {
            void mirrorRef.current.stopVoiceConversation();
        }
    }, [isFocused]);

    // A send starts processing: follow the bottom from here until the user
    // scrolls away.
    useEffect(() => {
        if (mirror.processing) nearBottomRef.current = true;
    }, [mirror.processing]);

    // A failed turn can be corrected before it is answered: the stored message
    // keeps its identity, so this never duplicates the turn or rewrites history.
    useEffect(() => {
        if (!mirror.pendingMessage) {
            setEditing(false);
            setDraft("");
        }
    }, [mirror.pendingMessage]);

    const confirmCopied = () => {
        setCopied(true);
        if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
        copiedTimeout.current = setTimeout(() => setCopied(false), 1800);
    };

    const handleCopy = async () => {
        if (!latestMessage) return;
        if (await messageActionsService.copy(latestMessage.content)) confirmCopied();
    };

    const handleShare = async () => {
        if (!latestMessage) return;
        await messageActionsService.share(latestMessage.content);
    };

    const startEditing = () => {
        if (!mirror.pendingMessage) return;
        setDraft(mirror.pendingMessage.content);
        setEditing(true);
    };

    const saveEdit = async () => {
        if (!draft.trim()) return;
        try {
            await mirror.editPendingMessage(draft);
            setEditing(false);
            setDraft("");
        } catch {
            // The error card already explains what happened; keep the draft so
            // nothing the user typed is lost.
        }
    };

    const showActions = Boolean(
        latestMessage &&
        !mirror.processing &&
        !mirror.loading &&
        !mirror.error,
    );

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
                            backgroundColor: whiteBgColor,
                        }}
                    />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1">
                <View className="flex-1">
                    <ScrollView
                        ref={scrollRef}
                        className="flex-1"
                        contentContainerClassName="flex-grow px-2"
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        scrollEventThrottle={16}
                        onScroll={(event) => {
                            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                            contentHeightRef.current = contentSize.height;
                            nearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 140;
                        }}
                        onContentSizeChange={(_, height) => {
                            contentHeightRef.current = height;
                            if (nearBottomRef.current && mirror.processing) scrollRef.current?.scrollToEnd({ animated: true });
                        }}
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
                                            {copy.aiConversation.greeting(
                                                user?.name?.trim().split(/\s+/)[0] ?? null,
                                            )}
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

                                        {showActions ? (
                                            <View className="mt-6 flex-row items-center justify-center gap-6">
                                                <Pressable
                                                    onPress={() => void handleCopy()}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={copy.aiConversation.copyA11y}
                                                    className="px-1 py-1"
                                                >
                                                    <AppText
                                                        variant="caption"
                                                        className="tracking-[1.5px] text-text-low"
                                                    >
                                                        {copied ? copy.aiConversation.copiedAction : copy.aiConversation.copyAction}
                                                    </AppText>
                                                </Pressable>

                                                <Pressable
                                                    onPress={() => void handleShare()}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={copy.aiConversation.shareA11y}
                                                    className="px-1 py-1"
                                                >
                                                    <AppText
                                                        variant="caption"
                                                        className="tracking-[1.5px] text-text-low"
                                                    >
                                                        {copy.aiConversation.shareAction}
                                                    </AppText>
                                                </Pressable>

                                                {mirror.canRegenerate ? (
                                                    <Pressable
                                                        onPress={() => void mirror.regenerateReply()}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={copy.aiConversation.tryAgainA11y}
                                                        className="px-1 py-1"
                                                    >
                                                        <AppText
                                                            variant="caption"
                                                            className="tracking-[1.5px] text-text-low"
                                                        >
                                                            {copy.aiConversation.tryAgainAction}
                                                        </AppText>
                                                    </Pressable>
                                                ) : null}
                                            </View>
                                        ) : null}
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
                                            accessibilityLabel={copy.aiConversation.motionReadyA11y}
                                        />
                                    )}
                                </View>
                            </View>

                            <View className="min-h-14 items-center justify-center absolute bottom-2 left-0 right-0">
                                {mirror.voiceActive && mirror.voiceState === "thinking" && !mirror.streamingAssistantText.trim() ? (
                                    <ThinkingIndicator variant="caption" className="text-center text-text-low" text={copy.aiConversation.thinking} />
                                ) : null}

                                {mirror.voiceActive && (mirror.voiceState === "listening" || mirror.voiceState === "userSpeaking" || mirror.voiceState === "connected") && !mirror.streamingUserTranscript.trim() && !mirror.streamingAssistantText.trim() ? (
                                    <AppText variant="caption" className="text-center text-text-low">{copy.aiConversation.listening}</AppText>
                                ) : null}

                                {mirror.voiceActive && mirror.streamingUserTranscript.trim() ? (
                                    <AppText variant="caption" className="text-center text-text-medium">{copy.aiConversation.youPrefix}{mirror.streamingUserTranscript}</AppText>
                                ) : null}

                                {mirror.voiceActive && mirror.streamingAssistantText.trim() ? (
                                    <AppText variant="caption" className="text-center text-text-low">{mirror.streamingAssistantText}</AppText>
                                ) : null}

                                {mirror.ttsSpeaking && !mirror.processing ? (
                                    <AppText variant="caption" className="text-center text-text-low">{copy.aiConversation.speaking}</AppText>
                                ) : null}

                                {mirror.loading ? (
                                    <AppText variant="caption" className="text-center text-text-low">{copy.aiConversation.loadingConversation}</AppText>
                                ) : null}

                                {mirror.processing && !mirror.streamingReplyText.trim() ? (
                                    <ThinkingIndicator variant="caption" className="text-center text-text-medium" />
                                ) : null}
                            </View>

                            {mirror.error ? (
                                <View className="absolute mt-20 w-full rounded-3xl border border-border bg-surface p-4">
                                    <AppText variant="button" className="text-text-high">{copy.aiConversation.errorTitle}</AppText>

                                    <AppText className="mt-1 text-text-low">{mirror.error}</AppText>

                                    {editing && mirror.pendingMessage ? (
                                        <View className="mt-3">
                                            <TextInput
                                                value={draft}
                                                onChangeText={setDraft}
                                                multiline
                                                maxLength={1200}
                                                placeholder={copy.aiConversation.editPlaceholder}
                                                placeholderTextColor={low.color}
                                                className="min-h-10 rounded-2xl bg-background px-3 py-2 font-satoshi text-[15px] leading-5 text-text-high"
                                            />

                                            <View className="mt-3 flex-row items-center gap-5">
                                                <Pressable
                                                    onPress={() => void saveEdit()}
                                                    disabled={!draft.trim()}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={copy.aiConversation.saveAndSendA11y}
                                                    className="py-1"
                                                >
                                                    <AppText
                                                        variant="button"
                                                        className="text-text-high"
                                                    >
                                                        {copy.aiConversation.saveAndSend}
                                                    </AppText>
                                                </Pressable>

                                                <Pressable
                                                    onPress={() => {
                                                        setEditing(false);
                                                        setDraft("");
                                                    }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={copy.aiConversation.cancelEditingA11y}
                                                    className="py-1"
                                                >
                                                    <AppText
                                                        variant="button"
                                                        className="text-text-medium"
                                                    >
                                                        {copy.aiConversation.cancel}
                                                    </AppText>
                                                </Pressable>
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="mt-3 flex-row items-center gap-5">
                                            <Pressable
                                                onPress={() =>
                                                    mirror.canRetry
                                                        ? void mirror.retry()
                                                        : mirror.dismissError()
                                                }
                                                accessibilityRole="button"
                                                className="py-1"
                                            >
                                                <AppText
                                                    variant="button"
                                                    className="text-text-high"
                                                >
                                                    {mirror.canRetry
                                                        ? copy.aiConversation.retryResponse
                                                        : copy.common.dismiss}
                                                </AppText>
                                            </Pressable>

                                            {mirror.pendingMessage ? (
                                                <Pressable
                                                    onPress={startEditing}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={copy.aiConversation.editMessageA11y}
                                                    className="py-1"
                                                >
                                                    <AppText
                                                        variant="button"
                                                        className="text-text-medium"
                                                    >
                                                        {copy.aiConversation.editMessage}
                                                    </AppText>
                                                </Pressable>
                                            ) : null}
                                        </View>
                                    )}
                                </View>
                            ) : null}

                            {mirror.voiceError ? (
                                <View className="absolute w-full rounded-3xl mt-20 border border-border bg-surface p-4">
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        {copy.aiConversation.voicePaused}
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
                                            {copy.common.dismiss}
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