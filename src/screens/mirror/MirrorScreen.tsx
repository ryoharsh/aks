import { useEffect, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
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
import { File } from "expo-file-system";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
    ArrowUp01Icon,
    Cancel01Icon,
    Mic01Icon,
    SparklesIcon,
    StopIcon,
} from "@hugeicons/core-free-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import IconButton from "@/components/ui/IconButton";
import AppText from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { useMirror } from "@/hooks/useMirror";
import { voiceReflectionService } from "@/services/voiceReflection.service";
import type { Message as StoredMessage } from "@/types/data";

type MirrorScreenProps = {
    shouldEnter: boolean;
    isActive: boolean;
};

type CheckIn = "Good" | "Okay" | "Chaos";

const topics = [
    "Focus",
    "Energy",
    "Sleep",
    "Emotions",
    "Routines",
    "Relationships",
    "Productivity",
] as const;

const checkIns: CheckIn[] = ["Good", "Okay", "Chaos"];

function formatDuration(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function ChoiceChip({
    label,
    selected = false,
    onPress,
}: {
    label: string;
    selected?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            className={cn(
                "mr-2.5 rounded-full border px-4 py-2.5",
                selected
                    ? "border-primary bg-primary"
                    : "border-border bg-surface",
            )}
        >
            <AppText
                variant="caption"
                className={selected ? "text-primary-foreground" : "text-text-medium"}
            >
                {label}
            </AppText>
        </Pressable>
    );
}

function Message({ message }: { message: StoredMessage }) {
    const isUser = message.role === "user";

    return (
        <View className={cn("mb-5", isUser ? "items-end" : "items-start")}>
            {!isUser ? (
                <AppText
                    variant="caption"
                    className="mb-2 tracking-[1.2px] text-text-disabled"
                >
                    AKS
                </AppText>
            ) : null}
            <View
                className={cn(
                    "max-w-[88%]",
                    isUser
                        ? "rounded-3xl rounded-br-md bg-primary px-4 py-3"
                        : "pr-5",
                )}
            >
                <AppText
                    className={cn(
                        "leading-6",
                        isUser ? "text-primary-foreground" : "text-text-high",
                    )}
                >
                    {message.content}
                </AppText>
            </View>
        </View>
    );
}

export default function MirrorScreen({
    shouldEnter,
    isActive,
}: MirrorScreenProps) {
    const listRef = useRef<FlatList<StoredMessage>>(null);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder, 250);

    const [draft, setDraft] = useState("");
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
    const [voiceReady, setVoiceReady] = useState(false);
    const { user } = useAuth();
    const mirror = useMirror();

    const highColor = useResolveClassNames("text-text-high").color ?? "#171717";
    const lowColor = useResolveClassNames("text-text-low").color ?? "#737373";
    const foregroundColor =
        useResolveClassNames("text-primary-foreground").color ?? "#FFFFFF";

    const sendDraft = async () => {
        const text = draft.trim();
        if (!text || mirror.processing) return;
        try {
            await mirror.sendMessage(text, selectedTopic ? { topic: selectedTopic } : {});
            setDraft("");
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        } catch { }
    };

    const chooseTopic = (topic: string) => {
        setSelectedTopic(topic);
        setDraft(`I’d like to understand my ${topic.toLowerCase()}.`);
    };

    const chooseCheckIn = async (checkIn: CheckIn) => {
        if (mirror.processing) return;
        try {
            await mirror.sendCheckIn(checkIn.toLowerCase());
            setSelectedCheckIn(checkIn);
        } catch { }
    };

    const startRecording = async () => {
        discardVoice();
        try {
            const permission = await AudioModule.requestRecordingPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(
                    "Microphone unavailable",
                    "Microphone access is needed to record a voice reflection. You can still type instead.",
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
            setVoiceReady(false);
        } catch {
            Alert.alert(
                "Couldn’t start listening",
                "Please try again, or share what’s on your mind in text.",
            );
        }
    };

    const stopRecording = async () => {
        try {
            await audioRecorder.stop();
            await setAudioModeAsync({ allowsRecording: false });
            setVoiceReady(Boolean(audioRecorder.uri));
        } catch {
            if (audioRecorder.uri) {
                try { new File(audioRecorder.uri).delete(); } catch { }
            }
            Alert.alert("Couldn't stop recording", "Please try again.");
        }
    };

    const submitVoice = async () => {
        const uri = audioRecorder.uri;
        if (!uri) return;

        setVoiceReady(false);
        const file = new File(uri);
        try {
            const extension = file.extension?.toLowerCase() || ".m4a";
            const mimeTypeByExtension: Record<string, string> = {
                ".m4a": "audio/m4a",
                ".mp4": "audio/mp4",
                ".aac": "audio/aac",
                ".wav": "audio/wav",
                ".mp3": "audio/mpeg",
                ".webm": "audio/webm",
            };
            const mimeType = mimeTypeByExtension[extension] ?? "audio/m4a";
            const base64 = await file.base64();
            await voiceReflectionService.upload(base64, mimeType);
            try { file.delete(); } catch { }
        } catch (error) {
            try { file.delete(); } catch { }
            const code = error instanceof Error ? error.message : "";
            const title = "Couldn't save that recording";
            const message = code === "TRANSCRIPTION_NOT_CONFIGURED"
                ? "Voice reflections aren't available on this build yet. You can still type a reflection."
                : code === "AUDIO_TOO_LARGE"
                    ? "That recording is too long. Try a shorter one."
                    : code === "VOICE_AUDIO_TOO_LARGE"
                        ? "That recording is too long. Try a shorter one."
                        : code === "UNAUTHORIZED"
                            ? "Please sign in and try again."
                            : "Aks couldn't save that recording just now. You can try again or type instead.";
            Alert.alert(title, message);
        }
    };

    const discardVoice = () => {
        const uri = audioRecorder.uri;
        setVoiceReady(false);
        if (uri) {
            try { new File(uri).delete(); } catch { }
        }
    };

    useEffect(() => {
        if (!isActive && recorderState.isRecording) {
            Keyboard.dismiss();
            void audioRecorder.stop().catch(() => undefined).finally(() => {
                void setAudioModeAsync({ allowsRecording: false });
                setVoiceReady(false);
                if (audioRecorder.uri) {
                    try { new File(audioRecorder.uri).delete(); } catch { }
                }
            });
        }
    }, [audioRecorder, isActive, recorderState.isRecording]);

    return (
        <View
            pointerEvents={shouldEnter ? "auto" : "none"}
            style={{ flex: 1, opacity: shouldEnter ? 1 : 0 }}
            className="bg-background"
        >
            <Animated.View
                key={shouldEnter ? "opened" : "waiting"}
                entering={shouldEnter ? FadeIn.duration(420) : undefined}
                className="flex-1"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={40}
                    className="flex-1"
                >
                    <FlatList
                        ref={listRef}
                        data={mirror.messages}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <Message message={item} />}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        contentContainerClassName="px-5 pb-5"
                        ListHeaderComponent={
                            <View className="pb-7 pt-8">
                                <Animated.View entering={FadeInDown.duration(420)}>
                                    <AppText variant="caption" className="text-text-low">
                                        MIRROR
                                    </AppText>
                                    <AppText
                                        variant="display"
                                        className="mt-4 text-[30px] leading-9.25 text-text-high"
                                    >
                                        Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
                                    </AppText>
                                    <AppText className="mt-3 max-w-[320px] leading-6 text-text-low">
                                        I’m Aks. Let’s start with something small.
                                    </AppText>
                                </Animated.View>

                                <View className="mt-8">
                                    <AppText variant="button" className="text-text-high">
                                        What would you like to understand?
                                    </AppText>
                                    <View className="mt-4 flex-row flex-wrap gap-y-2.5">
                                        {topics.map((topic) => (
                                            <ChoiceChip
                                                key={topic}
                                                label={topic}
                                                selected={selectedTopic === topic}
                                                onPress={() => chooseTopic(topic)}
                                            />
                                        ))}
                                    </View>
                                    <AppText variant="caption" className="mt-3 text-text-disabled">
                                        Or tell Aks something completely different.
                                    </AppText>
                                </View>

                                <View className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                                    <AppText variant="caption" className="tracking-[1.2px] text-text-low">
                                        QUICK CHECK-IN
                                    </AppText>
                                    <AppText variant="title" className="mt-3 text-[19px] text-text-high">
                                        How’s today feeling?
                                    </AppText>
                                    <View className="mt-4 flex-row">
                                        {checkIns.map((checkIn) => (
                                            <ChoiceChip
                                                key={checkIn}
                                                label={checkIn}
                                                selected={selectedCheckIn === checkIn}
                                                onPress={() => chooseCheckIn(checkIn)}
                                            />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        }
                        ListFooterComponent={
                            <View>
                                {mirror.processing ? (
                                    <Animated.View entering={FadeIn.duration(180)} className="pb-5">
                                        <AppText className="text-text-low">Aks is thinking…</AppText>
                                    </Animated.View>
                                ) : null}

                                {mirror.error ? (
                                    <Animated.View
                                        entering={FadeIn.duration(200)}
                                        className="mb-4 rounded-3xl border border-border bg-surface p-4"
                                    >
                                        <View className="flex-row items-start">
                                            <HugeiconsIcon
                                                icon={SparklesIcon}
                                                size={19}
                                                color={lowColor}
                                                strokeWidth={1.7}
                                            />
                                            <View className="ml-3 flex-1">
                                                <AppText variant="button" className="text-text-high">
                                                    Something went wrong.
                                                </AppText>
                                                <AppText className="mt-1 text-text-low">
                                                    {mirror.error}
                                                </AppText>
                                                <Pressable onPress={() => mirror.canRetry ? void mirror.retry() : mirror.dismissError()} className="mt-3 self-start py-1"><AppText variant="button" className="text-text-high">{mirror.canRetry ? "Retry response" : "Dismiss"}</AppText></Pressable>
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>
                        }
                    />

                    <View className="border-t border-border bg-background px-5 pb-3 pt-3">
                        {recorderState.isRecording ? (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                className="mb-3 flex-row items-center justify-between rounded-3xl border border-border bg-surface px-4 py-3"
                            >
                                <View>
                                    <AppText variant="button" className="text-text-high">
                                        Listening…
                                    </AppText>
                                    <AppText variant="caption" className="mt-1 text-text-low">
                                        {formatDuration(recorderState.durationMillis)} · stays on this device
                                    </AppText>
                                </View>
                                <IconButton
                                    accessibilityLabel="Stop recording"
                                    onPress={() => void stopRecording()}
                                    className="bg-primary"
                                >
                                    <HugeiconsIcon
                                        icon={StopIcon}
                                        size={18}
                                        color={foregroundColor}
                                    />
                                </IconButton>
                            </Animated.View>
                        ) : null}

                        {voiceReady ? (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                className="mb-3 flex-row items-center rounded-3xl border border-border bg-surface px-4 py-3"
                            >
                                <View className="flex-1">
                                    <AppText variant="button" className="text-text-high">
                                        Voice reflection ready
                                    </AppText>
                                    <AppText variant="caption" className="mt-1 text-text-low">
                                        Aks will transcribe it into a reflection.
                                    </AppText>
                                </View>
                                <IconButton
                                    accessibilityLabel="Discard recording"
                                    onPress={discardVoice}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={19} color={lowColor} />
                                </IconButton>
                                <IconButton
                                    accessibilityLabel="Send recording"
                                    onPress={() => void submitVoice()}
                                    className="ml-1 bg-primary"
                                >
                                    <HugeiconsIcon
                                        icon={ArrowUp01Icon}
                                        size={19}
                                        color={foregroundColor}
                                    />
                                </IconButton>
                            </Animated.View>
                        ) : null}

                        <View className="min-h-14 flex-row items-end rounded-3xl border border-border bg-surface p-1.5 pl-4">
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                placeholder="Tell Aks what’s on your mind…"
                                placeholderTextColor={lowColor}
                                multiline
                                maxLength={1200}
                                returnKeyType="default"
                                className="max-h-28 min-h-11 flex-1 py-2 font-satoshi text-[15px] leading-5 text-text-high"
                            />
                            {draft.trim() ? (
                                <IconButton
                                    accessibilityLabel="Send message"
                                    onPress={() => void sendDraft()}
                                    disabled={mirror.processing}
                                    className="ml-2 bg-primary"
                                >
                                    <HugeiconsIcon
                                        icon={ArrowUp01Icon}
                                        size={19}
                                        color={foregroundColor}
                                        strokeWidth={2}
                                    />
                                </IconButton>
                            ) : (
                                <IconButton
                                    accessibilityLabel="Record voice reflection"
                                    onPress={() => void startRecording()}
                                    disabled={recorderState.isRecording}
                                    className="ml-2 bg-background"
                                >
                                    <HugeiconsIcon
                                        icon={Mic01Icon}
                                        size={20}
                                        color={highColor}
                                        strokeWidth={1.8}
                                    />
                                </IconButton>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Animated.View>
        </View>
    );
}
