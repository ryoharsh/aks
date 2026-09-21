import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, Chat01Icon, PencilEdit01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useConversation } from "@/hooks/useConversations";
import { formatDateTime } from "@/lib/date";
import type { RootStackParamList, YourDataStackParamList } from "@/navigation/routes";
import { AI_CONVERSATION_ENABLED } from "@/lib/aiConversation";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "ConversationDetail">;

export default function ConversationDetailScreen({ navigation, route }: Props) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    const data = useConversation(route.params.conversationId);
    const rootNavigation = navigation.getParent()?.getParent<NativeStackNavigationProp<RootStackParamList>>();
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");

    const beginRename = () => {
        setTitleDraft(data.conversation?.title ?? "");
        setEditingTitle(true);
    };

    const cancelRename = () => {
        setEditingTitle(false);
        setTitleDraft("");
    };

    const saveRename = async () => {
        if (!titleDraft.trim()) return;
        const updated = await data.rename(titleDraft);
        if (updated) cancelRename();
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="flex-1 text-text-high" numberOfLines={1}>{data.conversation?.title ?? copy.conversationDetail.fallbackTitle}</AppText>
                {data.conversation && !editingTitle ? (
                    <IconButton onPress={beginRename} accessibilityLabel={copy.conversationDetail.renameA11y}><HugeiconsIcon icon={PencilEdit01Icon} size={20} color={iconColor} /></IconButton>
                ) : null}
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                {data.loading ? <View className="items-center py-12"><ActivityIndicator color={iconColor} accessibilityLabel={copy.conversationDetail.loadingA11y} /></View> : data.error ? (
                    <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.conversationDetail.unavailableTitle}</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">{copy.common.tryAgain}</AppText></Button></View>
                ) : data.conversation ? (
                    <>
                        {editingTitle ? (
                            <Animated.View entering={FadeInDown.duration(400)} className="mt-5 rounded-[28px] border border-border bg-surface p-5">
                                <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{copy.conversationDetail.renameSection}</AppText>
                                <TextInput
                                    value={titleDraft}
                                    onChangeText={setTitleDraft}
                                    autoFocus
                                    maxLength={200}
                                    accessibilityLabel={copy.conversationDetail.titleA11y}
                                    placeholder={copy.conversationDetail.titlePlaceholder}
                                    placeholderTextColor={iconColor}
                                    className="rounded-2xl bg-background px-4 py-3 text-[16px] text-text-high"
                                />
                                <View className="mt-4 flex-row items-center gap-5">
                                    <Button onPress={() => void saveRename()} disabled={!titleDraft.trim()}><AppText variant="button" className="text-primary-foreground">{copy.common.save}</AppText></Button>
                                    <Pressable onPress={cancelRename} accessibilityRole="button" accessibilityLabel={copy.conversationDetail.cancelRenameA11y} className="py-1"><AppText variant="button" className="text-text-medium">{copy.common.cancel}</AppText></Pressable>
                                </View>
                                {data.renameError ? <AppText variant="caption" className="mt-3 text-red-600">{data.renameError}</AppText> : null}
                            </Animated.View>
                        ) : null}

                        <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                            <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{copy.conversationDetail.historySection}</AppText>
                            <AppText variant="display" className="text-text-high">{data.conversation.title}</AppText>
                            <AppText variant="caption" className="mt-3 text-text-low">{copy.conversationDetail.startedAt(formatDateTime(data.conversation.createdAt))}</AppText>
                        </Animated.View>
                        {AI_CONVERSATION_ENABLED ? <Button onPress={() => rootNavigation?.navigate("AiConversation", { conversationId: route.params.conversationId })} className="mt-6"><AppText variant="button" className="text-primary-foreground">{copy.conversationDetail.continueMirror}</AppText></Button> : null}
                        {data.hasMore ? <Button variant="ghost" onPress={() => void data.loadMore()} loading={data.loadingMore} className="mt-6"><AppText variant="button" className="text-text-medium">{copy.conversationDetail.loadEarlier}</AppText></Button> : null}
                        {data.loadMoreError ? <AppText variant="caption" className="mt-3 text-center text-red-600">{data.loadMoreError}</AppText> : null}
                        <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 gap-4">
                            {data.messages.length ? data.messages.map((message) => {
                                const fromUser = message.role === "user";
                                return <View key={message.id} className={fromUser ? "ml-8" : "mr-8"}><View className="mb-2 flex-row items-center"><View className="mr-2 size-7 items-center justify-center rounded-full bg-surface"><HugeiconsIcon icon={fromUser ? UserIcon : Chat01Icon} size={15} color={iconColor} /></View><AppText variant="caption" className="text-text-low">{fromUser ? copy.conversationDetail.youLabel : message.role === "assistant" ? copy.conversationDetail.aksLabel : copy.conversationDetail.systemLabel} · {formatDateTime(message.createdAt)}</AppText></View><View className={fromUser ? "rounded-3xl border border-border bg-surface p-4" : "rounded-3xl bg-background p-4"}><AppText className="leading-6 text-text-high">{message.content}</AppText></View></View>;
                            }) : <View className="rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.conversationDetail.emptyTitle}</AppText></View>}
                        </Animated.View>
                    </>
                ) : <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.conversationDetail.unavailableTitle}</AppText><AppText className="mt-3 text-text-low">{copy.conversationDetail.archivedBody}</AppText></View>}
            </ScrollView>
        </View>
    );
}
