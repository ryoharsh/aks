import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useInsight } from "@/hooks/useInsights";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { insightsService } from "@/services/insights.service";

type Props = NativeStackScreenProps<YourDataStackParamList, "InsightDetail">;

export default function InsightDetailScreen({ navigation, route }: Props) {
    const data = useInsight(route.params.insightId);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const [working, setWorking] = useState(false);
    useEffect(() => {
        if (data.insight?.status === "new") void insightsService.markSeen(data.insight.id).then(() => data.refresh()).catch(() => undefined);
    }, [data.insight?.id, data.insight?.status, data.refresh]);
    const dismiss = () => Alert.alert("Dismiss this insight?", "The learning, experiment, pattern, and evidence will remain.", [{ text: "Cancel", style: "cancel" }, { text: "Dismiss", onPress: async () => { setWorking(true); try { await insightsService.dismissInsight(route.params.insightId); navigation.goBack(); } catch { Alert.alert("Unable to dismiss", "Please try again."); } finally { setWorking(false); } } }]);
    const remove = () => Alert.alert("Remove this insight?", "This removes only the insight. All source information will remain.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: async () => { setWorking(true); try { await insightsService.deleteInsight(route.params.insightId); navigation.goBack(); } catch { Alert.alert("Unable to remove", "Please try again."); } finally { setWorking(false); } } }]);
    return <View className="flex-1 bg-background"><View className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">Insight</AppText></View><ScrollView contentContainerClassName="px-5 pb-24">
        {data.loading ? <ActivityIndicator className="mt-12" color={iconColor} /> : data.error || !data.insight ? <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Insight unavailable.</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View> : <>
            <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">INSIGHT</AppText><AppText variant="display" className="mt-2 text-text-high">{data.insight.title}</AppText><AppText className="mt-4 leading-6 text-text-low">{data.insight.content}</AppText>
            <View className="mt-9 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Why Aks noticed this</AppText>{data.sources?.experiment ? <><AppText className="mt-3 leading-6 text-text-low">{data.sources.experiment.result_summary}</AppText><Pressable onPress={() => navigation.navigate("ExperimentDetail", { experimentId: data.sources!.experiment!.id })} accessibilityLabel={`Open source experiment ${data.sources.experiment.title}`} className="mt-4 rounded-2xl bg-background p-4"><AppText variant="button" className="text-text-high">{data.sources.experiment.title}</AppText><AppText variant="caption" className="mt-1 text-text-low">{data.sources.experiment.observation_count} recorded observations · View experiment</AppText></Pressable></> : null}{data.sources?.learning ? <Pressable onPress={() => navigation.navigate("LearningDetail", { learningId: data.sources!.learning!.id })} accessibilityLabel={`Open source learning ${data.sources.learning.title}`} className="mt-3 rounded-2xl bg-background p-4"><AppText variant="button" className="text-text-high">{data.sources.learning.title}</AppText><AppText variant="caption" className="mt-1 text-text-low">View source learning</AppText></Pressable> : null}{data.insight.confidence !== null ? <AppText variant="caption" className="mt-4 text-text-disabled">Evidence confidence {Math.round(data.insight.confidence * 100)}% · Created {formatDate(data.insight.createdAt)}</AppText> : null}</View>
            <View className="mt-9 gap-3"><Button variant="secondary" disabled={working} onPress={dismiss} accessibilityLabel="Dismiss insight"><AppText variant="button" className="text-text-high">Dismiss insight</AppText></Button><Button variant="ghost" disabled={working} onPress={remove} accessibilityLabel="Remove insight"><AppText variant="button" className="text-red-600">Remove insight</AppText></Button></View>
        </>}
    </ScrollView></View>;
}
