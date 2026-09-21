import { useDeferredValue, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, ArrowRight01Icon, Chat01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useConversations } from "@/hooks/useConversations";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { dateGroup, formatDateTime } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Conversations">;
const groups = ["Today", "This week", "Earlier"] as const;

export default function ConversationsScreen({ navigation }: Props) {
    const { confirm, notice } = useBottomSheet();
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const data = useConversations(deferredQuery);
    const grouped = useMemo(() => groups.map((group) => ({
        group,
        conversations: data.conversations.filter((conversation) => dateGroup(conversation.updatedAt) === group),
    })), [data.conversations]);

    const archive = async (id: string) => {
        const ok = await confirm({ title: copy.conversations.archiveTitle, message: copy.conversations.archiveMessage, confirmLabel: copy.conversations.archiveConfirm, destructive: false });
        if (!ok) return;
        try { await data.archive(id); } catch { notice(copy.conversations.notices.unableToArchive, copy.common.pleaseTryAgain); }
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="text-text-high">{copy.conversations.header}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{copy.conversations.eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{copy.conversations.title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.conversations.description}</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-7 h-14 flex-row items-center rounded-2xl border border-border bg-surface px-4">
                    <HugeiconsIcon icon={Search01Icon} size={20} color={iconColor} />
                    <TextInput value={query} onChangeText={setQuery} accessibilityLabel={copy.conversations.searchA11y} placeholder={copy.conversations.searchPlaceholder} placeholderTextColor="#A3A3A3" className="ml-3 flex-1 text-[16px] text-text-high" />
                    {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><AppText variant="caption" className="text-text-medium">{copy.conversations.clearSearch}</AppText></Pressable> : null}
                </Animated.View>

                {data.loading ? <View className="items-center py-12"><ActivityIndicator color={iconColor} accessibilityLabel={copy.conversations.loadingA11y} /></View> : data.error ? (
                    <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.conversations.loadErrorTitle}</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">{copy.common.tryAgain}</AppText></Button></View>
                ) : data.conversations.length === 0 ? (
                    <Animated.View entering={FadeInUp.duration(400)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                        <AppText variant="title" className="text-text-high">{query ? copy.conversations.emptyQueryTitle : copy.conversations.emptyTitle}</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">{query ? copy.conversations.emptyQueryBody : copy.conversations.emptyBody}</AppText>
                    </Animated.View>
                ) : grouped.map(({ group, conversations }, groupIndex) => conversations.length ? (
                    <Animated.View key={group} entering={FadeInUp.duration(450).delay(220 + groupIndex * 60)} className="mt-9">
                        <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{group.toUpperCase()}</AppText>
                        <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                            {conversations.map((conversation, index) => (
                                <Pressable key={conversation.id} onPress={() => navigation.navigate("ConversationDetail", { conversationId: conversation.id })} onLongPress={() => void archive(conversation.id)} accessibilityHint={copy.conversations.archiveHint} className={`flex-row items-center px-5 py-5 ${index < conversations.length - 1 ? "border-b border-border" : ""}`}>
                                    <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={Chat01Icon} size={21} color={iconColor} /></View>
                                    <View className="flex-1 pr-3"><AppText variant="button" numberOfLines={2} className="text-text-high">{conversation.title}</AppText><AppText variant="caption" className="mt-1 text-text-low">{formatDateTime(conversation.updatedAt)}</AppText></View>
                                    <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} />
                                </Pressable>
                            ))}
                        </View>
                    </Animated.View>
                ) : null)}

                {data.hasMore ? <Button variant="ghost" onPress={() => void data.loadMore()} loading={data.loadingMore} className="mt-6"><AppText variant="button" className="text-text-medium">{copy.conversations.loadMore}</AppText></Button> : null}
                {data.loadMoreError ? <AppText variant="caption" className="mt-3 text-center text-red-600">{data.loadMoreError}</AppText> : null}
            </ScrollView>
        </View>
    );
}
