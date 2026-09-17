import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useLearning } from "@/hooks/useLearnings";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { learningsService } from "@/services/learnings.service";

type Props = NativeStackScreenProps<YourDataStackParamList, "LearningDetail">;
const resultLabels: Record<string, string> = { supports: "Supported the hypothesis", mixed: "Mixed result", does_not_support: "Did not support the hypothesis", insufficient_data: "Not enough data" };

export default function LearningDetailScreen({ navigation, route }: Props) {
    const data = useLearning(route.params.learningId);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const [working, setWorking] = useState(false);
    const metadata = data.learning?.metadata && typeof data.learning.metadata === "object" && !Array.isArray(data.learning.metadata) ? data.learning.metadata : null;
    const experimentCount = metadata && typeof metadata.experiment_count === "number" ? metadata.experiment_count : data.evidence.length;
    const archive = () => Alert.alert("Archive this learning?", "The source experiments and observations will remain available.", [{ text: "Cancel", style: "cancel" }, { text: "Archive", onPress: async () => { setWorking(true); try { await learningsService.archiveLearning(route.params.learningId); navigation.goBack(); } catch { Alert.alert("Unable to archive", "Please try again."); } finally { setWorking(false); } } }]);
    const remove = () => Alert.alert("Remove this learning?", "This removes only the derived learning. Experiments, observations, patterns, and signals will remain.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: async () => { setWorking(true); try { await learningsService.deleteLearning(route.params.learningId); navigation.goBack(); } catch { Alert.alert("Unable to remove", "Please try again."); } finally { setWorking(false); } } }]);

    return <View className="flex-1 bg-background"><View className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">Learning</AppText></View><ScrollView contentContainerClassName="px-5 pb-24">
        {data.loading ? <ActivityIndicator className="mt-12" color={iconColor} /> : data.error || !data.learning ? <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Learning unavailable.</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View> : <>
            <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">{data.learning.status.toUpperCase()}</AppText><AppText variant="display" className="mt-2 text-text-high">{data.learning.title}</AppText><AppText className="mt-4 leading-6 text-text-low">{data.learning.description}</AppText>
            <View className="mt-9 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">What led to this?</AppText><AppText className="mt-3 leading-6 text-text-low">Based on {experimentCount} completed {experimentCount === 1 ? "experiment" : "experiments"} and {data.learning.evidenceCount} recorded {data.learning.evidenceCount === 1 ? "observation" : "observations"}.</AppText>{data.learning.confidence !== null ? <AppText variant="caption" className="mt-4 text-text-disabled">Evidence confidence {Math.round(data.learning.confidence * 100)}% · Updated {formatDate(data.learning.updatedAt)}</AppText> : null}</View>
            <View className="mt-9"><AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">SOURCE EXPERIMENTS</AppText><View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.evidence.map((item, index) => <Pressable key={item.id} onPress={() => navigation.navigate("ExperimentDetail", { experimentId: item.experimentId })} accessibilityLabel={`Open experiment ${item.experimentTitle}`} className={`px-5 py-4 ${index < data.evidence.length - 1 ? "border-b border-border" : ""}`}><AppText variant="button" className="text-text-high">{item.experimentTitle}</AppText><AppText variant="caption" className="mt-1 text-text-low">{resultLabels[item.result]} · {item.observationCount} observations</AppText><AppText className="mt-2 leading-5 text-text-medium">{item.resultSummary}</AppText></Pressable>)}</View></View>
            <View className="mt-9 gap-3"><Button variant="secondary" disabled={working} onPress={archive} accessibilityLabel="Archive learning"><AppText variant="button" className="text-text-high">Archive learning</AppText></Button><Button variant="ghost" disabled={working} onPress={remove} accessibilityLabel="Remove learning"><AppText variant="button" className="text-red-600">Remove learning</AppText></Button></View>
        </>}
    </ScrollView></View>;
}
