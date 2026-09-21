import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useMemory } from "@/hooks/useMemories";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { memoriesService } from "@/services/memories.service";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "MemoryDetail">;

export default function MemoryDetailScreen({ navigation, route }: Props) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    const data = useMemory(route.params.memoryId);
    const [working, setWorking] = useState(false);
    const { confirm, notice } = useBottomSheet();
    const reason = data.memory?.metadata && typeof data.memory.metadata === "object" && !Array.isArray(data.memory.metadata) && typeof data.memory.metadata.reason === "string" ? data.memory.metadata.reason : null;

    const archive = async () => {
        const ok = await confirm({ title: copy.memoryDetail.archiveTitle, message: copy.memoryDetail.archiveMessage, confirmLabel: copy.memoryDetail.archiveConfirm, destructive: false });
        if (!ok) return;
        setWorking(true);
        try { await memoriesService.archiveMemory(route.params.memoryId); navigation.goBack(); } catch { notice(copy.memoryDetail.notices.unableToArchive, copy.common.pleaseTryAgain); } finally { setWorking(false); }
    };
    const remove = async () => {
        const ok = await confirm({ title: copy.memoryDetail.removeTitle, message: copy.memoryDetail.removeMessage, confirmLabel: copy.memoryDetail.removeConfirm });
        if (!ok) return;
        setWorking(true);
        try { await memoriesService.deleteMemory(route.params.memoryId); navigation.goBack(); } catch { notice(copy.memoryDetail.notices.unableToRemove, copy.common.pleaseTryAgain); } finally { setWorking(false); }
    };

    return <View className="flex-1 bg-background">
        <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
            <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
            <AppText variant="title" className="text-text-high">{copy.memoryDetail.header}</AppText>
        </Animated.View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
            {data.loading ? <View className="items-center py-12"><ActivityIndicator color={iconColor} accessibilityLabel={copy.memoryDetail.loadingA11y} /></View> : data.error || !data.memory ? (
                <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.memoryDetail.unavailableTitle}</AppText><AppText className="mt-3 text-text-low">{data.error ?? copy.memoryDetail.archivedFallback}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">{copy.common.tryAgain}</AppText></Button></View>
            ) : <>
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{copy.memoryDetail.eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{data.memory.content}</AppText>
                    <AppText variant="caption" className="mt-3 capitalize text-text-low">{data.memory.memoryType.replaceAll("_", " ")} · {data.memory.status}</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="title" className="text-text-high">{copy.memoryDetail.reasonTitle}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{reason ?? copy.memoryDetail.reasonFallback(data.memory.evidenceCount)}</AppText>
                    <AppText variant="caption" className="mt-5 text-text-disabled">{copy.memoryDetail.lastNoticed(formatDate(data.memory.lastObservedAt))}</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{copy.memoryDetail.evidenceSection}</AppText>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.evidence.map((item, index) => {
                        const canOpenConversation = item.sourceType === "conversation" && item.sourceId;
                        return <Pressable key={item.id} disabled={!canOpenConversation} onPress={() => canOpenConversation && navigation.navigate("ConversationDetail", { conversationId: item.sourceId! })} className={`px-5 py-4 ${index < data.evidence.length - 1 ? "border-b border-border" : ""}`}><AppText className="capitalize text-text-medium">{item.signalType?.replaceAll("_", " ") ?? item.sourceType.replaceAll("_", " ")}</AppText>{item.sourceExcerpt ? <AppText variant="caption" numberOfLines={3} className="mt-2 leading-5 text-text-low">“{item.sourceExcerpt}”</AppText> : null}<AppText variant="caption" className="mt-2 text-text-disabled">{formatDate(item.observedAt)}{canOpenConversation ? copy.memoryDetail.viewConversation : ""}</AppText></Pressable>;
                    })}</View>
                </Animated.View>
                <View className="mt-9 gap-3"><Button variant="secondary" disabled={working} onPress={archive}><AppText variant="button" className="text-text-high">{copy.memoryDetail.archiveAction}</AppText></Button><Button variant="ghost" disabled={working} onPress={remove}><AppText variant="button" className="text-red-600">{copy.memoryDetail.removeAction}</AppText></Button></View>
            </>}
        </ScrollView>
    </View>;
}
