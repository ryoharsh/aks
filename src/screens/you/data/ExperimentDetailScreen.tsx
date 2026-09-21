import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useExperiment } from "@/hooks/useExperiments";
import { formatDate, formatDateTime } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { experimentsService } from "@/services/experiments.service";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "ExperimentDetail">;
const resultLabels: Record<string, string> = {
    supports: copy.experimentDetail.outcomeLabels.supports,
    mixed: copy.experimentDetail.outcomeLabels.mixed,
    does_not_support: copy.experimentDetail.outcomeLabels.doesNotSupport,
    insufficient_data: copy.experimentDetail.outcomeLabels.insufficientData,
};

export default function ExperimentDetailScreen({ navigation, route }: Props) {
    const data = useExperiment(route.params.experimentId);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const placeholderColor = useResolveClassNames("text-text-disabled").color as string;
    const [notes, setNotes] = useState("");
    const [working, setWorking] = useState(false);
    const { confirm, notice } = useBottomSheet();
    const pendingObservation = useRef<{ fingerprint: string; requestId: string } | null>(null);
    const metadata = data.experiment?.metadata && typeof data.experiment.metadata === "object" && !Array.isArray(data.experiment.metadata) ? data.experiment.metadata : null;
    const interpretation = metadata && typeof metadata.interpretation === "string" ? metadata.interpretation : null;
    const analysisRetryable = metadata?.analysis_status === "failed" || metadata?.analysis_status === "pending";
    const learningRetryable = data.experiment?.status === "completed" && data.experiment.result !== "insufficient_data" && (data.experiment.learningStatus === null || data.experiment.learningStatus === "pending" || data.experiment.learningStatus === "failed");
    const insightRetryable = data.experiment?.learningStatus === "succeeded" && (data.experiment.insightStatus === null || data.experiment.insightStatus === "pending" || data.experiment.insightStatus === "failed");
    const durationDays = metadata && typeof metadata.duration_days === "number" ? metadata.duration_days : null;
    const currentDay = data.experiment?.startDate && durationDays ? Math.min(durationDays, Math.max(1, Math.floor((Date.now() - new Date(data.experiment.startDate).getTime()) / 86_400_000) + 1)) : null;

    const act = async (operation: () => Promise<unknown>) => { setWorking(true); try { await operation(); await data.refresh(); } catch { notice(copy.experimentDetail.notices.unableToUpdate, copy.common.pleaseTryAgain); } finally { setWorking(false); } };
    const observe = async (result: "easier" | "same" | "harder") => {
        const fingerprint = `${result}:${notes.trim()}`;
        const requestId = pendingObservation.current?.fingerprint === fingerprint ? pendingObservation.current.requestId : globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        pendingObservation.current = { fingerprint, requestId };
        setWorking(true);
        try {
            await experimentsService.recordObservation(route.params.experimentId, { result }, notes, requestId);
            pendingObservation.current = null;
            setNotes("");
            await data.refresh();
        } catch { notice(copy.experimentDetail.notices.unableToRecord, copy.experimentDetail.notices.recordRetry); }
        finally { setWorking(false); }
    };
    const cancel = async () => {
        const ok = await confirm({ title: copy.experimentDetail.confirmCancelTitle, message: copy.experimentDetail.confirmCancelMessage, confirmLabel: copy.experimentDetail.confirmCancelLabel, cancelLabel: copy.experimentDetail.keepGoing });
        if (ok) void act(() => experimentsService.cancelExperiment(route.params.experimentId));
    };
    const remove = async () => {
        const ok = await confirm({ title: copy.experimentDetail.removeTitle, message: copy.experimentDetail.removeMessage, confirmLabel: copy.experimentDetail.removeConfirm });
        if (!ok) return;
        await act(async () => { await experimentsService.deleteExperiment(route.params.experimentId); navigation.goBack(); });
    };

    return <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background"><View className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">{copy.experimentDetail.header}</AppText></View><ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
        {data.loading ? <ActivityIndicator className="mt-12" color={iconColor} /> : data.error || !data.experiment ? <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.experimentDetail.unavailableTitle}</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">{copy.common.tryAgain}</AppText></Button></View> : <>
            <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">{data.experiment.status.toUpperCase()}</AppText><AppText variant="display" className="mt-2 text-text-high">{data.experiment.title}</AppText><AppText variant="button" className="mt-7 text-text-high">{copy.experimentDetail.hypothesisTitle}</AppText><AppText className="mt-2 leading-6 text-text-low">{data.experiment.hypothesis}</AppText><AppText variant="button" className="mt-6 text-text-high">{copy.experimentDetail.whatToTryTitle}</AppText><AppText className="mt-2 leading-6 text-text-low">{data.experiment.description}</AppText>
            {data.experiment.status === "draft" ? <Button onPress={() => void act(() => experimentsService.startExperiment(data.experiment!.id))} loading={working} className="mt-8" accessibilityLabel={copy.experimentDetail.startA11y}><AppText variant="button" className="text-primary-foreground">{copy.experimentDetail.startAction}</AppText></Button> : null}
            {data.experiment.status === "active" ? <View className="mt-9"><AppText variant="title" className="text-text-high">{copy.experimentDetail.promptTitle}</AppText><View className="mt-4 flex-row gap-2">{(["easier", "same", "harder"] as const).map((result) => <Pressable key={result} disabled={working} onPress={() => void observe(result)} accessibilityLabel={copy.experimentDetail.recordA11y(result)} className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-surface"><AppText variant="button" className="capitalize text-text-high">{copy.experimentDetail.resultLabels[result]}</AppText></Pressable>)}</View><TextInput value={notes} onChangeText={setNotes} accessibilityLabel={copy.experimentDetail.observationA11y} placeholder={copy.experimentDetail.observationPlaceholder} placeholderTextColor={placeholderColor} multiline className="mt-4 min-h-24 rounded-2xl border border-border bg-surface px-4 py-3 text-base text-text-high" textAlignVertical="top" /><AppText variant="caption" className="mt-3 text-text-disabled">{copy.experimentDetail.observationsMeta(data.experiment.observationCount)}{copy.experimentDetail.observationsDay(currentDay ?? 0, durationDays)}{data.experiment.endDate ? copy.experimentDetail.observationsThrough(formatDate(data.experiment.endDate)) : ""}</AppText><Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.completeExperiment(data.experiment!.id))} className="mt-6" accessibilityLabel={copy.experimentDetail.completeA11y}><AppText variant="button" className="text-text-high">{copy.experimentDetail.completeAction}</AppText></Button><Button variant="ghost" disabled={working} onPress={cancel} className="mt-2" accessibilityLabel={copy.experimentDetail.cancelA11y}><AppText variant="button" className="text-text-low">{copy.experimentDetail.cancelAction}</AppText></Button></View> : null}
            {data.experiment.status === "completed" ? <View className="mt-9 rounded-[28px] border border-border bg-surface p-5"><AppText variant="caption" className="tracking-[1.5px] text-text-low">{copy.experimentDetail.resultSection}</AppText><AppText variant="title" className="mt-2 text-text-high">{data.experiment.result ? resultLabels[data.experiment.result] : copy.experimentDetail.analysisPending}</AppText><AppText className="mt-3 leading-6 text-text-low">{data.experiment.resultSummary ?? copy.experimentDetail.resultPendingBody}</AppText>{interpretation ? <AppText className="mt-4 leading-6 text-text-medium">{interpretation}</AppText> : null}{data.experiment.confidence !== null ? <AppText variant="caption" className="mt-4 text-text-disabled">{copy.experimentDetail.confidenceValue(Math.round(data.experiment.confidence * 100))}</AppText> : null}{analysisRetryable ? <Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.retryAnalysis(data.experiment!.id))} className="mt-5" accessibilityLabel={copy.experimentDetail.retryAnalysisA11y}><AppText variant="button" className="text-text-high">{copy.experimentDetail.retryAnalysis}</AppText></Button> : null}{learningRetryable ? <Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.retryLearning(data.experiment!.id))} className="mt-3" accessibilityLabel={copy.experimentDetail.retryLearningA11y}><AppText variant="button" className="text-text-high">{copy.experimentDetail.retryLearning}</AppText></Button> : null}{insightRetryable ? <Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.retryInsight(data.experiment!.id))} className="mt-3" accessibilityLabel={copy.experimentDetail.retryInsightA11y}><AppText variant="button" className="text-text-high">{copy.experimentDetail.retryInsight}</AppText></Button> : null}</View> : null}
            <View className="mt-9"><AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{copy.experimentDetail.observationsSection}</AppText>{data.observations.length ? <View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.observations.map((item, index) => <View key={item.id} className={`px-5 py-4 ${index < data.observations.length - 1 ? "border-b border-border" : ""}`}><AppText variant="button" className="capitalize text-text-high">{typeof item.value === "object" && item.value && !Array.isArray(item.value) && typeof item.value.result === "string" ? item.value.result : copy.experimentDetail.recordedFallback}</AppText>{item.notes ? <AppText className="mt-2 text-text-low">{item.notes}</AppText> : null}<AppText variant="caption" className="mt-2 text-text-disabled">{formatDateTime(item.observedAt)}</AppText></View>)}</View> : <AppText className="text-text-low">{copy.experimentDetail.emptyObservations}</AppText>}</View>
            {data.experiment.status === "completed" || data.experiment.status === "cancelled" ? <Button variant="ghost" disabled={working} onPress={remove} className="mt-8" accessibilityLabel={copy.experimentDetail.removeA11y}><AppText variant="button" className="text-red-600">{copy.experimentDetail.removeAction}</AppText></Button> : null}
        </>}
    </ScrollView></KeyboardAvoidingView>;
}
