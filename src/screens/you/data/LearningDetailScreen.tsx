import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
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
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "LearningDetail">;
const resultLabels: Record<string, string> = {
    supports: copy.learningDetail.resultLabels.supports,
    mixed: copy.learningDetail.resultLabels.mixed,
    does_not_support: copy.learningDetail.resultLabels.doesNotSupport,
    insufficient_data: copy.learningDetail.resultLabels.insufficientData,
};

export default function LearningDetailScreen({ navigation, route }: Props) {
    const data = useLearning(route.params.learningId);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const [working, setWorking] = useState(false);
    const { confirm, notice } = useBottomSheet();
    const metadata = data.learning?.metadata && typeof data.learning.metadata === "object" && !Array.isArray(data.learning.metadata) ? data.learning.metadata : null;
    const experimentCount = metadata && typeof metadata.experiment_count === "number" ? metadata.experiment_count : data.evidence.length;
    const archive = async () => {
        const ok = await confirm({ title: copy.learningDetail.archiveTitle, message: copy.learningDetail.archiveMessage, confirmLabel: copy.learningDetail.archiveConfirm, destructive: false });
        if (!ok) return;
        setWorking(true);
        try { await learningsService.archiveLearning(route.params.learningId); navigation.goBack(); } catch { notice(copy.learningDetail.notices.unableToArchive, copy.common.pleaseTryAgain); } finally { setWorking(false); }
    };
    const remove = async () => {
        const ok = await confirm({ title: copy.learningDetail.removeTitle, message: copy.learningDetail.removeMessage, confirmLabel: copy.learningDetail.removeConfirm });
        if (!ok) return;
        setWorking(true);
        try { await learningsService.deleteLearning(route.params.learningId); navigation.goBack(); } catch { notice(copy.learningDetail.notices.unableToRemove, copy.common.pleaseTryAgain); } finally { setWorking(false); }
    };

    return <View className="flex-1 bg-background"><View className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">{copy.learningDetail.header}</AppText></View><ScrollView contentContainerClassName="px-5 pb-24">
        {data.loading ? <ActivityIndicator className="mt-12" color={iconColor} /> : data.error || !data.learning ? <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.learningDetail.unavailableTitle}</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">{copy.common.tryAgain}</AppText></Button></View> : <>
            <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">{data.learning.status.toUpperCase()}</AppText><AppText variant="display" className="mt-2 text-text-high">{data.learning.title}</AppText><AppText className="mt-4 leading-6 text-text-low">{data.learning.description}</AppText>
            <View className="mt-9 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.learningDetail.evidenceTitle}</AppText><AppText className="mt-3 leading-6 text-text-low">{copy.learningDetail.evidenceLine(experimentCount, data.learning.evidenceCount)}</AppText>{data.learning.confidence !== null ? <AppText variant="caption" className="mt-4 text-text-disabled">{copy.learningDetail.confidenceValue(Math.round(data.learning.confidence * 100))} · {copy.learningDetail.updatedAt(formatDate(data.learning.updatedAt))}</AppText> : null}</View>
            <View className="mt-9"><AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{copy.learningDetail.sourceSection}</AppText><View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.evidence.map((item, index) => <Pressable key={item.id} onPress={() => navigation.navigate("ExperimentDetail", { experimentId: item.experimentId })} accessibilityLabel={copy.learningDetail.openExperimentA11y(item.experimentTitle)} className={`px-5 py-4 ${index < data.evidence.length - 1 ? "border-b border-border" : ""}`}><AppText variant="button" className="text-text-high">{item.experimentTitle}</AppText><AppText variant="caption" className="mt-1 text-text-low">{resultLabels[item.result]} · {copy.learningDetail.observationsCount(item.observationCount)}</AppText><AppText className="mt-2 leading-5 text-text-medium">{item.resultSummary}</AppText></Pressable>)}</View></View>
            <View className="mt-9 gap-3"><Button variant="secondary" disabled={working} onPress={archive} accessibilityLabel={copy.learningDetail.archiveA11y}><AppText variant="button" className="text-text-high">{copy.learningDetail.archiveAction}</AppText></Button><Button variant="ghost" disabled={working} onPress={remove} accessibilityLabel={copy.learningDetail.removeA11y}><AppText variant="button" className="text-red-600">{copy.learningDetail.removeAction}</AppText></Button></View>
        </>}
    </ScrollView></View>;
}
