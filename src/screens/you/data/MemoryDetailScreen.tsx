import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
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

type Props = NativeStackScreenProps<YourDataStackParamList, "MemoryDetail">;

export default function MemoryDetailScreen({ navigation, route }: Props) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    const data = useMemory(route.params.memoryId);
    const [working, setWorking] = useState(false);
    const reason = data.memory?.metadata && typeof data.memory.metadata === "object" && !Array.isArray(data.memory.metadata) && typeof data.memory.metadata.reason === "string" ? data.memory.metadata.reason : null;

    const archive = () => Alert.alert("Archive this memory?", "Aks will stop using this memory now. Future things you share may support it again. Your original conversations, reflections, and check-ins will remain.", [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", onPress: async () => { setWorking(true); try { await memoriesService.archiveMemory(route.params.memoryId); navigation.goBack(); } catch { Alert.alert("Unable to archive", "Please try again."); } finally { setWorking(false); } } },
    ]);
    const remove = () => Alert.alert("Remove this memory?", "This removes Aks's stored memory only. The original information you shared will not be deleted.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => { setWorking(true); try { await memoriesService.deleteMemory(route.params.memoryId); navigation.goBack(); } catch { Alert.alert("Unable to remove", "Please try again."); } finally { setWorking(false); } } },
    ]);

    return <View className="flex-1 bg-background">
        <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
            <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
            <AppText variant="title" className="text-text-high">Memory</AppText>
        </Animated.View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
            {data.loading ? <View className="items-center py-12"><ActivityIndicator color={iconColor} accessibilityLabel="Loading memory" /></View> : data.error || !data.memory ? (
                <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Memory unavailable.</AppText><AppText className="mt-3 text-text-low">{data.error ?? "It may have been archived or removed."}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View>
            ) : <>
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">WHAT AKS REMEMBERS</AppText>
                    <AppText variant="display" className="text-text-high">{data.memory.content}</AppText>
                    <AppText variant="caption" className="mt-3 capitalize text-text-low">{data.memory.memoryType.replaceAll("_", " ")} · {data.memory.status}</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="title" className="text-text-high">Why Aks remembers this</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{reason ?? `This has appeared in ${data.memory.evidenceCount} ${data.memory.evidenceCount === 1 ? "thing" : "things"} you've shared.`}</AppText>
                    <AppText variant="caption" className="mt-5 text-text-disabled">Last noticed {formatDate(data.memory.lastObservedAt)}</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">EVIDENCE</AppText>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.evidence.map((item, index) => {
                        const canOpenConversation = item.sourceType === "conversation" && item.sourceId;
                        return <Pressable key={item.id} disabled={!canOpenConversation} onPress={() => canOpenConversation && navigation.navigate("ConversationDetail", { conversationId: item.sourceId! })} className={`px-5 py-4 ${index < data.evidence.length - 1 ? "border-b border-border" : ""}`}><AppText className="capitalize text-text-medium">{item.signalType?.replaceAll("_", " ") ?? item.sourceType.replaceAll("_", " ")}</AppText>{item.sourceExcerpt ? <AppText variant="caption" numberOfLines={3} className="mt-2 leading-5 text-text-low">“{item.sourceExcerpt}”</AppText> : null}<AppText variant="caption" className="mt-2 text-text-disabled">{formatDate(item.observedAt)}{canOpenConversation ? " · View conversation" : ""}</AppText></Pressable>;
                    })}</View>
                </Animated.View>
                <View className="mt-9 gap-3"><Button variant="secondary" disabled={working} onPress={archive}><AppText variant="button" className="text-text-high">Archive memory</AppText></Button><Button variant="ghost" disabled={working} onPress={remove}><AppText variant="button" className="text-red-600">Remove memory</AppText></Button></View>
            </>}
        </ScrollView>
    </View>;
}
