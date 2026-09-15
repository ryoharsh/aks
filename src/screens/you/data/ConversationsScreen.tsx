import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, ArrowRight01Icon, Chat01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { mockConversations } from "@/data/mockConversations";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Conversations">;
const GROUPS = ["Today", "This week", "Earlier"] as const;

export default function ConversationsScreen({ navigation }: Props) {
    const [query, setQuery] = useState("");
    const iconColor = useResolveClassNames("text-text-medium").color;
    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return mockConversations;
        return mockConversations.filter((conversation) =>
            `${conversation.title} ${conversation.messages.map((message) => message.content).join(" ")}`
                .toLowerCase()
                .includes(normalized),
        );
    }, [query]);

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">Conversations</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">YOUR CONVERSATIONS</AppText>
                    <AppText variant="display" className="text-text-high">Your conversations with Aks.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Revisit what you've talked about and the thoughts that started there.</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-7 h-14 flex-row items-center rounded-2xl border border-border bg-surface px-4">
                    <HugeiconsIcon icon={Search01Icon} size={20} color={iconColor} />
                    <TextInput value={query} onChangeText={setQuery} placeholder="Search conversations" placeholderTextColor="#A3A3A3" className="ml-3 flex-1 text-[16px] text-text-high" />
                    {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><AppText variant="caption" className="text-text-medium">Clear</AppText></Pressable> : null}
                </Animated.View>

                {filtered.length === 0 ? (
                    <Animated.View entering={FadeInUp.duration(400)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                        <AppText variant="title" className="text-text-high">No conversations yet.</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">Your conversations with Aks will appear here as you explore your patterns, experiments, and everyday life.</AppText>
                    </Animated.View>
                ) : (
                    GROUPS.map((group, groupIndex) => {
                        const conversations = filtered.filter((conversation) => conversation.group === group);
                        if (conversations.length === 0) return null;
                        return (
                            <Animated.View key={group} entering={FadeInUp.duration(450).delay(220 + groupIndex * 60)} className="mt-9">
                                <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{group.toUpperCase()}</AppText>
                                <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                                    {conversations.map((conversation, index) => (
                                        <Pressable key={conversation.id} onPress={() => navigation.navigate("ConversationDetail", { conversationId: conversation.id })} android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }} className={`flex-row items-center px-5 py-5 ${index < conversations.length - 1 ? "border-b border-border" : ""}`}>
                                            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                                <HugeiconsIcon icon={Chat01Icon} size={21} color={iconColor} />
                                            </View>
                                            <View className="flex-1 pr-3">
                                                <AppText variant="button" className="text-text-high">{conversation.title}</AppText>
                                                <AppText variant="caption" className="mt-1 text-text-low">{conversation.messages.at(-1)?.createdAt}</AppText>
                                            </View>
                                            <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} />
                                        </Pressable>
                                    ))}
                                </View>
                            </Animated.View>
                        );
                    })
                )}

                <Animated.View entering={FadeInUp.duration(450).delay(420)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">PLACEHOLDER HISTORY</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">These examples are shown for layout only until conversation history is connected.</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
