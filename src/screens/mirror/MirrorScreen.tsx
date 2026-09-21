import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
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
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import IconButton from "@/components/ui/IconButton";
import ThinkingIndicator from "@/components/ui/ThinkingIndicator";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { MOTION } from "@/lib/motion";
import AppText from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { useMirror } from "@/hooks/useMirror";
import { useLanguage } from "@/providers/LanguageProvider";
import { draftService } from "@/services/draft.service";
import { getDayPart } from "@/lib/dayPart";
import { voiceReflectionService } from "@/services/voiceReflection.service";
import { speechLocaleForLanguage, startLiveDictation, type LiveDictationSession } from "@/services/onDeviceTranscription.service";
import {
    appendFinalChunk,
    composeLiveDraft,
    isMirrorVoiceRecordingEnabled,
    MAX_LIVE_EMPTY_RESTARTS,
    shouldKeepListeningAfterAutoEnd,
} from "@/lib/mirrorVoice";
import type { Message as StoredMessage } from "@/types/data";
import { copy } from "@/constants/copy";

const DRAFT_SCOPE = "mirror-home";

type MirrorScreenProps = {
    shouldEnter: boolean;
    isActive: boolean;
};

type CheckIn = "Good" | "Okay" | "Chaos";

const topics = copy.mirror.topics;

const checkIns: CheckIn[] = [...copy.mirror.checks];

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
    // Same press language as IconButton, scaled down for a wide chip. Motion
    // only — layout, colors, and typography are unchanged.
    const reduceMotion = useReducedMotion();
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));
    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={() => {
                if (!reduceMotion) scale.value = withTiming(MOTION.pressScale, { duration: MOTION.pressInMs, easing: Easing.out(Easing.cubic) });
            }}
            onPressOut={() => {
                if (!reduceMotion) scale.value = withTiming(1, { duration: MOTION.pressOutMs, easing: Easing.out(Easing.cubic) });
                else scale.value = 1;
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            style={animatedStyle}
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
        </AnimatedPressable>
    );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MessageRow({ message }: { message: StoredMessage }) {
    const isUser = message.role === "user";

    return (
        <View className={cn("mb-5", isUser ? "items-end" : "items-start")}>
            {!isUser ? (
                <AppText
                    variant="caption"
                    className="mb-2 tracking-[1.2px] text-text-disabled"
                >
                    {copy.mirror.aksLabel}
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

// Row output depends only on its message: memoizing keeps per-token streaming
// updates to the footer instead of re-rendering the whole history.
const Message = memo(MessageRow);

/**
 * Arrival-only entrance: a row animates exactly once when its message is new
 * (sent/received after the history load). History rows, scroll remounts, and
 * optimistic rows (instant by design) never animate. No layout animations —
 * FlatList virtualization stays untouched.
 */
function MessageItem({
    message,
    isNew,
    reduceMotion,
    onAnimated,
}: {
    message: StoredMessage;
    isNew: boolean;
    reduceMotion: boolean;
    onAnimated: (id: string) => void;
}) {
    useEffect(() => {
        if (isNew) onAnimated(message.id);
    }, [isNew, message.id, onAnimated]);
    return (
        <Animated.View entering={isNew && !reduceMotion ? FadeInUp.duration(MOTION.enterMs) : undefined}>
            <Message message={message} />
        </Animated.View>
    );
}

export default function MirrorScreen({
    shouldEnter,
    isActive,
}: MirrorScreenProps) {
    const listRef = useRef<FlatList<StoredMessage>>(null);
    // Document directory, not cache: the OS may wipe cache files under
    // storage pressure (seen as ENOENT at send time), while documents
    // survive. The file is still deleted right after send or discard.
    const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: "document" });
    const recorderState = useAudioRecorderState(audioRecorder, 250);

    const enterProgress = useSharedValue(0);
    const enteredRef = useRef(false);
    const enterStyle = useAnimatedStyle(() => ({
        opacity: enterProgress.value,
    }));

    useEffect(() => {
        if (shouldEnter && !enteredRef.current) {
            enteredRef.current = true;
            enterProgress.value = withTiming(1, {
                duration: 420,
                easing: Easing.out(Easing.cubic),
            });
        }
    }, [shouldEnter, enterProgress]);

    const [draft, setDraft] = useState("");
    // Local clock for the time-based greeting. Ticks every minute so the
    // greeting rolls over (e.g. morning → afternoon) while the screen is open.
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
    const [voiceReady, setVoiceReady] = useState(false);
    // On-device dictation mode (no server STT): the mic transcribes live and
    // no audio file is ever recorded for transcription.
    const [dictating, setDictating] = useState(false);
    const [dictationText, setDictationText] = useState("");
    const dictationSessionRef = useRef<LiveDictationSession | null>(null);
    const dictatingRef = useRef(false);
    const dictationTranscriptRef = useRef("");
    // Default mic path: live STT directly into the composer draft. No audio
    // file is recorded, uploaded, or transcribed server-side on this path.
    // The legacy recording pipeline below only runs when explicitly enabled
    // via EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING=true.
    const enableMirrorVoiceRecording = isMirrorVoiceRecordingEnabled();
    const [liveListening, setLiveListening] = useState(false);
    const [liveInterim, setLiveInterim] = useState("");
    const liveSessionRef = useRef<LiveDictationSession | null>(null);
    const liveListeningRef = useRef(false);
    const liveInterimRef = useRef("");
    // Keep-open bookkeeping: the mic stays open until the user explicitly
    // stops it. Auto-ends (recognizer silence timeouts) restart listening;
    // userStop + sessionSeq invalidate any in-flight restart so the mic can
    // never reopen itself after an explicit stop, blur, send, or unmount.
    const liveUserStopRef = useRef(false);
    const liveSessionSeqRef = useRef(0);
    const liveEmptyRestartsRef = useRef(0);
    // Committed text = existing draft at mic-start + finalized chunks.
    // Visible draft = committed + interim preview (never duplicated).
    const liveBaseRef = useRef("");
    const liveFinalsRef = useRef("");
    const draftRef = useRef("");
    useEffect(() => { draftRef.current = draft; }, [draft]);
    const { user } = useAuth();
    const mirror = useMirror();
    const { language } = useLanguage();
    const { notice } = useBottomSheet();
    // Auto-scroll follows new content only while the user is pinned near the
    // bottom. Refs only — tracking never re-renders per scroll event.
    const nearBottomRef = useRef(false);
    const contentHeightRef = useRef(0);
    // Arrival-only list motion: ids present at history load (plus anything
    // loadEarlier prepends) never animate; appended arrivals animate once.
    const historyIdsRef = useRef<Set<string> | null>(null);
    const prevFirstIdRef = useRef<string | null>(null);
    const arrivalAnimatedRef = useRef<Set<string>>(new Set());
    const reduceMotion = useReducedMotion();
    const draftHydrated = useRef(false);
    const userId = user?.id ?? null;

    // Unsent drafts survive leaving the app; they are never uploaded and are
    // discarded as soon as the text is sent or emptied by the user.
    useEffect(() => {
        draftHydrated.current = false;
        if (!userId) {
            setDraft("");
            return;
        }
        let active = true;
        void draftService.get(userId, DRAFT_SCOPE).then((saved) => {
            if (!active) return;
            // Never clobber something the user started typing meanwhile.
            setDraft((current) => (current ? current : saved));
            draftHydrated.current = true;
        });
        return () => { active = false; };
    }, [userId]);

    useEffect(() => {
        if (!userId || !draftHydrated.current) return;
        void draftService.set(userId, DRAFT_SCOPE, draft);
    }, [draft, userId]);

    useEffect(() => {
        const current = mirror.messages;
        if (current.length === 0) return;
        if (historyIdsRef.current === null) {
            historyIdsRef.current = new Set(current.map((message) => message.id));
        } else {
            // loadEarlier prepends history: absorb ids appearing before the
            // previously-known first message so they never animate.
            const prevFirstIndex = prevFirstIdRef.current
                ? current.findIndex((message) => message.id === prevFirstIdRef.current)
                : -1;
            if (prevFirstIndex > 0) {
                for (let index = 0; index < prevFirstIndex; index += 1) {
                    historyIdsRef.current.add(current[index].id);
                }
            }
        }
        prevFirstIdRef.current = current[0]?.id ?? null;
    }, [mirror.messages]);

    const markArrivalAnimated = useCallback((id: string) => {
        arrivalAnimatedRef.current.add(id);
    }, []);

    const highColor = useResolveClassNames("text-text-high").color ?? "#171717";
    const lowColor = useResolveClassNames("text-text-low").color ?? "#737373";
    const foregroundColor =
        useResolveClassNames("text-primary-foreground").color ?? "#FFFFFF";

    const sendDraft = () => {
        const text = draft.trim();
        if (!text || mirror.processing) return;
        // Sending ends live input: stop the microphone without auto-submit
        // side effects — the explicit Send above is the submission.
        if (liveListeningRef.current) {
            liveUserStopRef.current = true;
            liveSessionSeqRef.current += 1;
            const liveSession = liveSessionRef.current;
            liveSessionRef.current = null;
            liveListeningRef.current = false;
            liveInterimRef.current = "";
            setLiveListening(false);
            setLiveInterim("");
            if (liveSession) {
                try { liveSession.dispose(); } catch { /* teardown is best-effort */ }
            }
        }
        // Clear instantly: the message renders optimistically and Aks starts
        // immediately. The user just sent, so follow the bottom from here.
        setDraft("");
        nearBottomRef.current = true;
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        void mirror.sendMessage(text, selectedTopic ? { topic: selectedTopic } : {}).catch(() => undefined);
    };

    const chooseTopic = (topic: string) => {
        setSelectedTopic(topic);
        setDraft(copy.mirror.topicDraft(topic));
    };

    const chooseCheckIn = async (checkIn: CheckIn) => {
        if (mirror.processing) return;
        try {
            await mirror.sendCheckIn(checkIn.toLowerCase());
            setSelectedCheckIn(checkIn);
        } catch {
            // Swallowed deliberately: useMirror.sendCheckIn already puts the
            // honest message in mirror.error, which this screen renders. The
            // catch only prevents an unhandled rejection.
        }
    };

    const beginLiveSession = async (): Promise<LiveDictationSession | null> => {
        const seq = liveSessionSeqRef.current;
        let session: LiveDictationSession;
        try {
            session = await startLiveDictation({
                lang: speechLocaleForLanguage(language),
                onPartial: (text) => {
                    if (!liveListeningRef.current) return;
                    if (liveSessionSeqRef.current !== seq) return;
                    const clean = (text ?? "").trim();
                    // Heard speech: silence-restart budget resets, so pauses
                    // while dictating never close the mic.
                    if (clean) liveEmptyRestartsRef.current = 0;
                    liveInterimRef.current = clean;
                    setLiveInterim(clean);
                    setDraft(composeLiveDraft(liveBaseRef.current, liveFinalsRef.current, clean));
                },
                onAutoEnd: () => void handleLiveAutoEnd(seq),
            });
        } catch {
            return null;
        }
        if (!liveListeningRef.current || liveUserStopRef.current || liveSessionSeqRef.current !== seq) {
            try { session.dispose(); } catch { /* teardown is best-effort */ }
            return null;
        }
        return session;
    };

    const startLiveInput = async () => {
        if (liveListeningRef.current) return;
        // Capture existing manually-typed text — recognition integrates into
        // it, never replaces it.
        liveUserStopRef.current = false;
        liveEmptyRestartsRef.current = 0;
        liveBaseRef.current = draftRef.current ?? "";
        liveFinalsRef.current = "";
        liveInterimRef.current = "";
        setLiveInterim("");
        // Optimistically open: the banner stays up from the tap until an
        // explicit stop, across recognizer restarts.
        liveListeningRef.current = true;
        setLiveListening(true);
        const session = await beginLiveSession();
        if (!session) {
            // Stopped/blurred mid-start: stay silent and closed.
            if (!liveListeningRef.current || liveUserStopRef.current) return;
            liveSessionRef.current = null;
            liveListeningRef.current = false;
            setLiveListening(false);
            setLiveInterim("");
            liveInterimRef.current = "";
            // Live failure must NOT start recording when the fallback is
            // disabled: surface the honest notice and keep the draft as-is.
            notice(
                copy.mirror.notices.cantListen,
                copy.mirror.notices.cantListenBody,
            );
            return;
        }
        if (!liveListeningRef.current || liveUserStopRef.current) {
            // Stopped/blurred while starting: release, keep text, stay closed.
            try { session.dispose(); } catch { /* teardown is best-effort */ }
            liveSessionRef.current = null;
            return;
        }
        liveSessionRef.current = session;
    };

    const handleLiveAutoEnd = async (seq: number) => {
        // The recognizer ended on its own (typically a silence timeout).
        // The mic must keep open until the user stops: commit what was
        // heard and restart listening instead of closing.
        if (!liveListeningRef.current || liveUserStopRef.current) return;
        if (liveSessionSeqRef.current !== seq) return;
        const session = liveSessionRef.current;
        liveSessionRef.current = null;
        let finalText = "";
        if (session) {
            try {
                finalText = ((await session.stop()) ?? "").trim();
            } catch { /* fall through with whatever was committed */ }
            try { session.dispose(); } catch { /* teardown is best-effort */ }
        }
        if (!liveListeningRef.current || liveUserStopRef.current || liveSessionSeqRef.current !== seq) {
            // The user stopped while committing: fold the text and stay closed.
            if (finalText) {
                liveFinalsRef.current = appendFinalChunk(liveFinalsRef.current, finalText);
                setDraft(composeLiveDraft(liveBaseRef.current, liveFinalsRef.current, ""));
            }
            liveInterimRef.current = "";
            setLiveInterim("");
            return;
        }
        if (finalText) {
            liveEmptyRestartsRef.current = 0;
            liveFinalsRef.current = appendFinalChunk(liveFinalsRef.current, finalText);
        } else {
            liveEmptyRestartsRef.current += 1;
        }
        liveInterimRef.current = "";
        setLiveInterim("");
        setDraft(composeLiveDraft(liveBaseRef.current, liveFinalsRef.current, ""));
        if (!shouldKeepListeningAfterAutoEnd({
            userStopped: liveUserStopRef.current,
            emptyRestarts: liveEmptyRestartsRef.current,
            maxEmpty: MAX_LIVE_EMPTY_RESTARTS,
        })) {
            // Nothing heard across consecutive sessions: stop the mic but
            // keep all text; the notice explains why it closed.
            liveListeningRef.current = false;
            setLiveListening(false);
            notice(copy.mirror.notices.recordingFailed, copy.mirror.notices.emptyTranscription);
            return;
        }
        // Brief beat before reopening the recognizer so a restart can never
        // hot-loop while the mic visibly stays open.
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (!liveListeningRef.current || liveUserStopRef.current || liveSessionSeqRef.current !== seq) return;
        liveSessionSeqRef.current += 1;
        const next = await beginLiveSession();
        if (!next) {
            if (!liveListeningRef.current || liveUserStopRef.current) return;
            liveSessionRef.current = null;
            liveListeningRef.current = false;
            setLiveListening(false);
            liveInterimRef.current = "";
            setLiveInterim("");
            notice(copy.mirror.notices.cantListen, copy.mirror.notices.cantListenBody);
            return;
        }
        liveSessionRef.current = next;
    };

    const finalizeLiveInput = async () => {
        if (!liveListeningRef.current) return;
        // Explicit user stop: invalidate any in-flight auto-end restart so
        // the mic can never reopen itself after this point.
        liveUserStopRef.current = true;
        liveSessionSeqRef.current += 1;
        liveListeningRef.current = false;
        setLiveListening(false);
        const session = liveSessionRef.current;
        liveSessionRef.current = null;
        if (!session) {
            liveInterimRef.current = "";
            setLiveInterim("");
            return;
        }
        try {
            const text = await session.stop();
            try { session.dispose(); } catch { /* teardown is best-effort */ }
            const finalText = (text ?? "").trim();
            if (finalText) {
                liveFinalsRef.current = appendFinalChunk(liveFinalsRef.current, finalText);
                liveInterimRef.current = "";
                setLiveInterim("");
                setDraft(composeLiveDraft(liveBaseRef.current, liveFinalsRef.current, ""));
            } else {
                // Nothing recognizable: keep whatever was committed (usually
                // just the pre-mic base) and clear the preview.
                liveInterimRef.current = "";
                setLiveInterim("");
                setDraft(composeLiveDraft(liveBaseRef.current, liveFinalsRef.current, ""));
                if (!liveFinalsRef.current.trim()) {
                    notice(copy.mirror.notices.recordingFailed, copy.mirror.notices.emptyTranscription);
                }
            }
            // Intentionally no auto-send: the user reviews and presses Send.
        } catch {
            try { session.dispose(); } catch { /* teardown is best-effort */ }
            liveInterimRef.current = "";
            setLiveInterim("");
            setDraft(composeLiveDraft(liveBaseRef.current, liveFinalsRef.current, ""));
            notice(copy.mirror.notices.recordingFailed, copy.mirror.notices.recordingFailedFallback);
        }
    };

    const stopLiveInput = async () => {
        await finalizeLiveInput();
    };

    const handleDraftChange = (value: string) => {
        if (liveListeningRef.current) {
            // Fold user edits into the committed base so the next interim
            // preview cannot clobber typing made mid-dictation.
            const interim = liveInterimRef.current;
            if (interim && value.endsWith(interim)) {
                liveBaseRef.current = value.slice(0, value.length - interim.length);
            } else {
                liveBaseRef.current = value;
            }
            liveFinalsRef.current = "";
        }
        setDraft(value);
    };

    const startRecording = async () => {
        // Recording fallback is environment-gated. Default builds never
        // reach here — the mic uses startLiveInput above instead.
        if (!enableMirrorVoiceRecording) {
            await startLiveInput();
            return;
        }
        // Legacy fallback path only (env-enabled): keep the previous
        // server-STT probe — dictate on-device when the server reported no
        // STT rather than recording audio nothing can transcribe.
        if (voiceReflectionService.preferOnDevice) {
            await startDictation();
            return;
        }
        discardVoice();
        try {
            const permission = await AudioModule.requestRecordingPermissionsAsync();
            if (!permission.granted) {
                notice(
                    copy.mirror.notices.micUnavailable,
                    copy.mirror.notices.micUnavailableBody,
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
            notice(
                copy.mirror.notices.cantListen,
                copy.mirror.notices.cantListenBody,
            );
        }
    };

    const stopRecording = async () => {
        // Recording resources only exist on the env-gated fallback path.
        if (!enableMirrorVoiceRecording) return;
        try {
            await audioRecorder.stop();
            await setAudioModeAsync({ allowsRecording: false });
            // The recorder can report a uri whose file never landed (failed
            // write, cleared cache) or a zero-length recording. Only offer
            // send when a real, non-empty file is there.
            const uri = audioRecorder.uri;
            let ready = false;
            try { ready = Boolean(uri) && uri !== null && new File(uri).exists && recorderState.durationMillis > 0; } catch { ready = false; }
            if (!ready && uri) {
                try { new File(uri).delete(); } catch { }
            }
            setVoiceReady(ready);
            if (!ready) notice(copy.mirror.notices.stopRecording, copy.common.pleaseTryAgain);
        } catch {
            if (audioRecorder.uri) {
                try { new File(audioRecorder.uri).delete(); } catch { }
            }
            notice(copy.mirror.notices.stopRecording, copy.common.pleaseTryAgain);
        }
    };

    const startDictation = async () => {
        discardVoice();
        setDictationText("");
        dictationTranscriptRef.current = "";
        try {
            const session = await startLiveDictation({
                lang: speechLocaleForLanguage(language),
                onPartial: (text) => setDictationText(text),
                onAutoEnd: () => void finalizeDictation(),
            });
            dictationSessionRef.current = session;
            dictatingRef.current = true;
            setDictating(true);
            setVoiceReady(false);
        } catch {
            notice(
                copy.mirror.notices.cantListen,
                copy.mirror.notices.cantListenBody,
            );
        }
    };

    const finalizeDictation = async () => {
        if (!dictatingRef.current) return;
        dictatingRef.current = false;
        setDictating(false);
        const session = dictationSessionRef.current;
        dictationSessionRef.current = null;
        if (!session) return;
        try {
            const text = await session.stop();
            session.dispose();
            if (text?.trim()) {
                dictationTranscriptRef.current = text.trim();
                setDictationText(text.trim());
                setVoiceReady(true);
            } else {
                setDictationText("");
                notice(copy.mirror.notices.recordingFailed, copy.mirror.notices.emptyTranscription);
            }
        } catch {
            try { session.dispose(); } catch { /* teardown is best-effort */ }
            setDictationText("");
            notice(copy.mirror.notices.recordingFailed, copy.mirror.notices.recordingFailedFallback);
        }
    };

    const stopDictation = async () => {
        await finalizeDictation();
    };

    const showVoiceSubmitError = (error: unknown) => {
        const code = error instanceof Error ? error.message : "";
        // Surface the exact server/client code so the message stays
        // honest instead of collapsing everything into one generic line.
        if (__DEV__) console.warn("[voice-reflection] upload failed:", code || error);
        const title = copy.mirror.notices.recordingFailed;
        const message = code === "TRANSCRIPTION_NOT_CONFIGURED"
            ? copy.mirror.notices.transcriptionNotConfigured
            : code === "AUDIO_TOO_LARGE"
                ? copy.mirror.notices.audioTooLong
                : code === "VOICE_AUDIO_TOO_LARGE"
                    ? copy.mirror.notices.audioTooLong
                    : code === "SUBSCRIPTION_REQUIRED"
                        ? copy.mirror.notices.subscriptionRequired
                        : code === "EMPTY_TRANSCRIPTION"
                            ? copy.mirror.notices.emptyTranscription
                            : code === "UNSUPPORTED_AUDIO"
                                ? copy.mirror.notices.unsupportedAudio
                                : code === "TRANSCRIPTION_UNAVAILABLE"
                                    ? copy.mirror.notices.transcriptionUnavailable
                                    : code === "UNAUTHORIZED"
                                        ? copy.mirror.notices.unauthorized
                                        : copy.mirror.notices.recordingFailedFallback;
        notice(title, message);
    };

    const submitVoice = async () => {
        // Legacy fallback only. Default live path keeps text in the draft
        // and never reaches here.
        if (!enableMirrorVoiceRecording) return;
        // Dictated on-device: submit the transcript text directly. No audio
        // was recorded, so there is nothing to transcribe or delete.
        if (dictationTranscriptRef.current) {
            const text = dictationTranscriptRef.current;
            dictationTranscriptRef.current = "";
            setDictationText("");
            setVoiceReady(false);
            try {
                await voiceReflectionService.submitText(text);
            } catch (error) {
                showVoiceSubmitError(error);
            }
            return;
        }

        const uri = audioRecorder.uri;
        if (!uri) return;

        setVoiceReady(false);
        const file = new File(uri);
        // Re-check: a stale uri (deleted or never-written file) must surface
        // the honest notice, not a native file crash in the upload path.
        let fileExists = false;
        try { fileExists = file.exists; } catch { fileExists = false; }
        if (!fileExists) {
            notice(copy.mirror.notices.recordingFailed, copy.mirror.notices.recordingFailedFallback);
            return;
        }
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
            try {
                await voiceReflectionService.upload(base64, mimeType);
            } catch (uploadError) {
                // No server STT on this build: stop recording audio for
                // transcription. Remember it, drop this recording, and hand
                // the mic straight to live on-device dictation instead.
                if (!(uploadError instanceof Error) || uploadError.message !== "TRANSCRIPTION_NOT_CONFIGURED") throw uploadError;
                voiceReflectionService.markServerTranscriptionUnavailable();
                await startDictation();
                return;
            }
            try { file.delete(); } catch { }
        } catch (error) {
            try { file.delete(); } catch { }
            showVoiceSubmitError(error);
        }
    };

    const discardVoice = () => {
        // Default live path: stop recognition but preserve draft text.
        if (liveListeningRef.current) {
            liveUserStopRef.current = true;
            liveSessionSeqRef.current += 1;
            const liveSession = liveSessionRef.current;
            liveSessionRef.current = null;
            liveListeningRef.current = false;
            setLiveListening(false);
            liveInterimRef.current = "";
            setLiveInterim("");
            if (liveSession) {
                try { liveSession.dispose(); } catch { /* teardown is best-effort */ }
            }
        }
        const session = dictationSessionRef.current;
        dictationSessionRef.current = null;
        dictatingRef.current = false;
        setDictating(false);
        dictationTranscriptRef.current = "";
        setDictationText("");
        setVoiceReady(false);
        // Audio file cleanup only on the env-gated fallback path — default
        // builds never create a recording URI.
        if (!enableMirrorVoiceRecording) return;
        const uri = audioRecorder.uri;
        if (uri) {
            try { new File(uri).delete(); } catch { }
        }
    };

    useEffect(() => {
        if (!isActive && liveListeningRef.current) {
            // Blur with live STT: stop the microphone, remove listeners, keep
            // the recognized text already folded into the draft. Flag an
            // explicit stop so a racing auto-end restart aborts.
            liveUserStopRef.current = true;
            liveSessionSeqRef.current += 1;
            const liveSession = liveSessionRef.current;
            liveSessionRef.current = null;
            liveListeningRef.current = false;
            liveInterimRef.current = "";
            setLiveListening(false);
            setLiveInterim("");
            if (liveSession) {
                try { liveSession.dispose(); } catch { /* teardown is best-effort */ }
            }
        }
        if (!isActive && enableMirrorVoiceRecording && recorderState.isRecording) {
            Keyboard.dismiss();
            void audioRecorder.stop().catch(() => undefined).finally(() => {
                void setAudioModeAsync({ allowsRecording: false });
                setVoiceReady(false);
                if (audioRecorder.uri) {
                    try { new File(audioRecorder.uri).delete(); } catch { }
                }
            });
        }
        if (!isActive) {
            // Never leave a fallback dictation session running off-screen.
            // (Default live STT is handled above and preserves draft text.)
            const session = dictationSessionRef.current;
            dictationSessionRef.current = null;
            dictatingRef.current = false;
            dictationTranscriptRef.current = "";
            setDictating(false);
            setDictationText("");
            setVoiceReady(false);
            if (session) {
                try { session.dispose(); } catch { /* teardown is best-effort */ }
            }
        }
    }, [audioRecorder, enableMirrorVoiceRecording, isActive, recorderState.isRecording]);

    // Unmount: never leave the microphone active. Draft text is preserved
    // via state/draftService; only listeners and the recognizer are torn
    // down here.
    useEffect(() => () => {
        liveUserStopRef.current = true;
        liveSessionSeqRef.current += 1;
        const liveSession = liveSessionRef.current;
        liveSessionRef.current = null;
        liveListeningRef.current = false;
        if (liveSession) {
            try { liveSession.dispose(); } catch { /* teardown is best-effort */ }
        }
        const fallbackSession = dictationSessionRef.current;
        dictationSessionRef.current = null;
        dictatingRef.current = false;
        if (fallbackSession) {
            try { fallbackSession.dispose(); } catch { /* teardown is best-effort */ }
        }
    }, []);

    return (
        <View
            pointerEvents={shouldEnter ? "auto" : "none"}
            style={{ flex: 1 }}
            className="bg-background"
        >
            <Animated.View
                style={enterStyle}
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
                        renderItem={({ item }) => {
                            const history = historyIdsRef.current;
                            const isNew = history !== null
                                && !history.has(item.id)
                                && !arrivalAnimatedRef.current.has(item.id)
                                && !item.id.startsWith("pending-");
                            return (
                                <MessageItem
                                    message={item}
                                    isNew={isNew}
                                    reduceMotion={reduceMotion}
                                    onAnimated={markArrivalAnimated}
                                />
                            );
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        scrollEventThrottle={16}
                        onScroll={(event) => {
                            const { contentOffset, layoutMeasurement } = event.nativeEvent;
                            nearBottomRef.current = contentHeightRef.current - (contentOffset.y + layoutMeasurement.height) < 140;
                        }}
                        onContentSizeChange={(_, height) => {
                            contentHeightRef.current = height;
                            if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
                        }}
                        contentContainerClassName="px-5 pb-5"
                        ListHeaderComponent={
                            <View className="pb-7 pt-8">
                                <Animated.View entering={FadeInDown.duration(420)}>
                                    <AppText variant="caption" className="text-text-low">
                                        {copy.mirror.eyebrow}
                                    </AppText>
                                    <AppText
                                        variant="display"
                                        className="mt-4 text-[30px] leading-9.25 text-text-high"
                                    >
                                        {copy.mirror.greeting(user?.name ? user.name.split(" ")[0] : null, getDayPart(now))}
                                    </AppText>
                                    <AppText className="mt-3 max-w-[320px] leading-6 text-text-low">
                                        {copy.mirror.intro}
                                    </AppText>
                                </Animated.View>

                                <View className="mt-8">
                                    <AppText variant="button" className="text-text-high">
                                        {copy.mirror.understandTitle}
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
                                        {copy.mirror.differentHint}
                                    </AppText>
                                </View>

                                <View className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                                    <AppText variant="caption" className="tracking-[1.2px] text-text-low">
                                        {copy.mirror.checkInEyebrow}
                                    </AppText>
                                    <AppText variant="title" className="mt-3 text-[19px] text-text-high">
                                        {copy.mirror.checkInTitle}
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
                                {mirror.processing && mirror.streamingReplyText.trim() ? (
                                    <Animated.View entering={FadeIn.duration(180)} className="pb-5">
                                        <AppText variant="caption" className="mb-2 tracking-[1.2px] text-text-disabled">
                                            {copy.mirror.aksLabel}
                                        </AppText>
                                        <AppText className="text-text-high">
                                            {mirror.streamingReplyText}
                                        </AppText>
                                    </Animated.View>
                                ) : mirror.processing ? (
                                    <Animated.View entering={FadeIn.duration(180)} className="pb-5">
                                        <ThinkingIndicator className="text-text-low" />
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
                                                    {copy.mirror.errorTitle}
                                                </AppText>
                                                <AppText className="mt-1 text-text-low">
                                                    {mirror.error}
                                                </AppText>
                                                <Pressable onPress={() => mirror.canRetry ? void mirror.retry() : mirror.dismissError()} className="mt-3 self-start py-1"><AppText variant="button" className="text-text-high">{mirror.canRetry ? copy.mirror.retryResponse : copy.common.dismiss}</AppText></Pressable>
                                            </View>
                                        </View>
                                    </Animated.View>
                                ) : null}
                            </View>
                        }
                    />

                    <View className="border-t border-border bg-background px-5 pb-3 pt-3">
                        {(liveListening || recorderState.isRecording || dictating) ? (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                className="mb-3 flex-row items-center justify-between rounded-3xl border border-border bg-surface px-4 py-3"
                            >
                                <View>
                                    <AppText variant="button" className="text-text-high">
                                        {copy.mirror.listening}
                                    </AppText>
                                    <AppText variant="caption" className="mt-1 text-text-low">
                                        {liveListening
                                            ? liveInterim.trim() || copy.mirror.voiceReadyHint
                                            : dictating
                                                ? dictationText.trim() || copy.mirror.voiceReadyHint
                                                : copy.mirror.listeningMeta(formatDuration(recorderState.durationMillis))}
                                    </AppText>
                                </View>
                                <IconButton
                                    accessibilityLabel={copy.mirror.stopRecordingA11y}
                                    onPress={() => void (liveListening ? stopLiveInput() : dictating ? stopDictation() : stopRecording())}
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

                        {enableMirrorVoiceRecording && voiceReady ? (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                className="mb-3 flex-row items-center rounded-3xl border border-border bg-surface px-4 py-3"
                            >
                                <View className="flex-1">
                                    <AppText variant="button" className="text-text-high">
                                        {copy.mirror.voiceReady}
                                    </AppText>
                                    <AppText variant="caption" className="mt-1 text-text-low">
                                        {dictationText.trim() || copy.mirror.voiceReadyHint}
                                    </AppText>
                                </View>
                                <IconButton
                                    accessibilityLabel={copy.mirror.discardRecordingA11y}
                                    onPress={discardVoice}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={19} color={lowColor} />
                                </IconButton>
                                <IconButton
                                    accessibilityLabel={copy.mirror.sendRecordingA11y}
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
                                onChangeText={handleDraftChange}
                                placeholder={copy.mirror.composerPlaceholder}
                                placeholderTextColor={lowColor}
                                multiline
                                maxLength={1200}
                                returnKeyType="default"
                                className="max-h-28 min-h-11 flex-1 py-2 font-satoshi text-[15px] leading-5 text-text-high"
                            />
                            {draft.trim() ? (
                                <IconButton
                                    accessibilityLabel={copy.mirror.sendMessageA11y}
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
                                    accessibilityLabel={copy.mirror.recordVoiceA11y}
                                    onPress={() => void (liveListening ? stopLiveInput() : startRecording())}
                                    disabled={enableMirrorVoiceRecording ? recorderState.isRecording || dictating : false}
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
