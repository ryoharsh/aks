import { useRef, useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    TextInput,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowUp01Icon,
    Mic01Icon,
} from "@hugeicons/core-free-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import IconButton from "@/components/ui/IconButton";
import AppText from "@/components/ui/Text";
import type { RootStackParamList } from "@/navigation/routes";
import {
    submitToAks,
    type MirrorMessage,
} from "@/screens/mirror/MirrorScreen";
import { cn } from "@/lib/cn";

type Props = NativeStackScreenProps<RootStackParamList, "AiConversation">;

type ProcessingState = "idle" | "thinking" | "error";

const openingMessages: MirrorMessage[] = [
    {
        id: "conversation-opening",
        role: "aks",
        content: "What have you been noticing about yourself lately?",
    },
];

function ConversationMessage({ message }: { message: MirrorMessage }) {
    const fromUser = message.role === "user";

    return (
        <View className={cn("mb-6", fromUser ? "items-end" : "items-start")}>
            {!fromUser ? (
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
                    fromUser
                        ? "rounded-3xl rounded-br-md bg-primary px-4 py-3"
                        : "pr-5",
                )}
            >
                <AppText
                    className={cn(
                        "leading-6",
                        fromUser
                            ? "text-primary-foreground"
                            : "text-text-high",
                    )}
                >
                    {message.content}
                </AppText>
            </View>
        </View>
    );
}

export default function AiConversationScreen({ navigation }: Props) {
    const listRef = useRef<FlatList<MirrorMessage>>(null);
    const [messages, setMessages] =
        useState<MirrorMessage[]>(openingMessages);
    const [draft, setDraft] = useState("");
    const [processing, setProcessing] =
        useState<ProcessingState>("idle");

    const highColor =
        useResolveClassNames("text-text-high").color ?? "#171717";
    const lowColor =
        useResolveClassNames("text-text-low").color ?? "#737373";
    const foregroundColor =
        useResolveClassNames("text-primary-foreground").color ?? "#FFFFFF";

    const sendMessage = () => {
        const text = draft.trim();
        if (!text || processing === "thinking") return;

        setMessages((current) => [
            ...current,
            {
                id: `${Date.now()}-user`,
                role: "user",
                content: text,
            },
        ]);
        setDraft("");
        setProcessing("thinking");
        requestAnimationFrame(() =>
            listRef.current?.scrollToEnd({ animated: true }),
        );

        void submitToAks({
            kind: "text",
            text,
            createdAt: new Date().toISOString(),
        })
            .then(() => setProcessing("idle"))
            .catch(() => setProcessing("error"));
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View
                entering={FadeInDown.duration(350)}
                className="h-16 flex-row items-center border-b border-border px-5"
            >
                <IconButton
                    accessibilityLabel="Close conversation"
                    onPress={() => navigation.goBack()}
                    className="mr-3"
                >
                    <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        size={22}
                        color={highColor}
                    />
                </IconButton>
                <View className="flex-1">
                    <AppText variant="title" className="text-[18px] text-text-high">
                        Aks
                    </AppText>
                    <AppText variant="caption" className="mt-0.5 text-text-low">
                        A quiet place to notice what repeats
                    </AppText>
                </View>
            </Animated.View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                className="flex-1"
            >
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ConversationMessage message={item} />
                    )}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerClassName="flex-grow px-5 pb-6 pt-8"
                    ListHeaderComponent={
                        <Animated.View
                            entering={FadeIn.duration(350)}
                            className="mb-10"
                        >
                            <AppText
                                variant="caption"
                                className="tracking-[1.5px] text-text-low"
                            >
                                CONVERSATION
                            </AppText>
                            <AppText
                                variant="display"
                                className="mt-3 text-[28px] leading-9 text-text-high"
                            >
                                Talk it through.
                            </AppText>
                            <AppText className="mt-3 max-w-[320px] text-text-low">
                                Share a thought, a moment, or something you want
                                to understand. Aks will organize only what you
                                choose to provide.
                            </AppText>
                        </Animated.View>
                    }
                    ListFooterComponent={
                        <View className="pb-2">
                            {processing === "thinking" ? (
                                <Animated.View entering={FadeIn.duration(180)}>
                                    <AppText className="text-text-low">
                                        Finding the signal…
                                    </AppText>
                                </Animated.View>
                            ) : null}
                            {processing === "error" ? (
                                <Animated.View
                                    entering={FadeIn.duration(180)}
                                    className="rounded-3xl border border-border bg-surface p-4"
                                >
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        Aks isn’t connected yet.
                                    </AppText>
                                    <AppText className="mt-1 text-text-low">
                                        This message wasn’t saved or processed.
                                    </AppText>
                                    <Pressable
                                        onPress={() => setProcessing("idle")}
                                        className="mt-3 self-start py-1"
                                    >
                                        <AppText
                                            variant="button"
                                            className="text-text-high"
                                        >
                                            Dismiss
                                        </AppText>
                                    </Pressable>
                                </Animated.View>
                            ) : null}
                        </View>
                    }
                />

                <View className="border-t border-border bg-background px-5 pb-4 pt-3">
                    <View className="min-h-14 flex-row items-end rounded-3xl border border-border bg-surface p-1.5 pl-4">
                        <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="Tell Aks what’s on your mind…"
                            placeholderTextColor={lowColor}
                            multiline
                            maxLength={1200}
                            className="max-h-28 min-h-11 flex-1 py-2 font-satoshi text-[15px] leading-5 text-text-high"
                        />
                        {draft.trim() ? (
                            <IconButton
                                accessibilityLabel="Send message"
                                onPress={sendMessage}
                                disabled={processing === "thinking"}
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
                                accessibilityLabel="Voice input is available from Mirror"
                                disabled
                                className="ml-2 bg-background"
                            >
                                <HugeiconsIcon
                                    icon={Mic01Icon}
                                    size={20}
                                    color={lowColor}
                                    strokeWidth={1.8}
                                />
                            </IconButton>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
