import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from "react-native";
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

type Props = NativeStackScreenProps<YourDataStackParamList, "ExperimentDetail">;
const resultLabels: Record<string, string> = { supports: "Supports the hypothesis", mixed: "Mixed result", does_not_support: "Didn't support the hypothesis", insufficient_data: "Not enough data" };

export default function ExperimentDetailScreen({ navigation, route }: Props) {
    const data = useExperiment(route.params.experimentId);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const placeholderColor = useResolveClassNames("text-text-disabled").color as string;
    const [notes, setNotes] = useState("");
    const [working, setWorking] = useState(false);
    const pendingObservation = useRef<{ fingerprint: string; requestId: string } | null>(null);
    const metadata = data.experiment?.metadata && typeof data.experiment.metadata === "object" && !Array.isArray(data.experiment.metadata) ? data.experiment.metadata : null;
    const interpretation = metadata && typeof metadata.interpretation === "string" ? metadata.interpretation : null;
    const analysisRetryable = metadata?.analysis_status === "failed" || metadata?.analysis_status === "pending";
    const learningRetryable = data.experiment?.status === "completed" && data.experiment.result !== "insufficient_data" && (data.experiment.learningStatus === null || data.experiment.learningStatus === "pending" || data.experiment.learningStatus === "failed");
    const insightRetryable = data.experiment?.learningStatus === "succeeded" && (data.experiment.insightStatus === null || data.experiment.insightStatus === "pending" || data.experiment.insightStatus === "failed");
    const durationDays = metadata && typeof metadata.duration_days === "number" ? metadata.duration_days : null;
    const currentDay = data.experiment?.startDate && durationDays ? Math.min(durationDays, Math.max(1, Math.floor((Date.now() - new Date(data.experiment.startDate).getTime()) / 86_400_000) + 1)) : null;

    const act = async (operation: () => Promise<unknown>) => { setWorking(true); try { await operation(); await data.refresh(); } catch { Alert.alert("Unable to update", "Please try again."); } finally { setWorking(false); } };
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
        } catch { Alert.alert("Unable to record", "Your previous attempt can be retried safely."); }
        finally { setWorking(false); }
    };
    const cancel = () => Alert.alert("Cancel experiment?", "Your recorded observations will stay available.", [{ text: "Keep going", style: "cancel" }, { text: "Cancel experiment", style: "destructive", onPress: () => void act(() => experimentsService.cancelExperiment(route.params.experimentId)) }]);
    const remove = () => Alert.alert("Remove experiment?", "This deletes the experiment, observations, and any learning supported only by this experiment. The original pattern and signals remain.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void act(async () => { await experimentsService.deleteExperiment(route.params.experimentId); navigation.goBack(); }) }]);

    return <View className="flex-1 bg-background"><View className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">Experiment</AppText></View><ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
        {data.loading ? <ActivityIndicator className="mt-12" color={iconColor} /> : data.error || !data.experiment ? <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Experiment unavailable.</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View> : <>
            <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">{data.experiment.status.toUpperCase()}</AppText><AppText variant="display" className="mt-2 text-text-high">{data.experiment.title}</AppText><AppText variant="button" className="mt-7 text-text-high">Hypothesis</AppText><AppText className="mt-2 leading-6 text-text-low">{data.experiment.hypothesis}</AppText><AppText variant="button" className="mt-6 text-text-high">What to try</AppText><AppText className="mt-2 leading-6 text-text-low">{data.experiment.description}</AppText>
            {data.experiment.status === "draft" ? <Button onPress={() => void act(() => experimentsService.startExperiment(data.experiment!.id))} loading={working} className="mt-8" accessibilityLabel="Start experiment"><AppText variant="button" className="text-primary-foreground">Start experiment</AppText></Button> : null}
            {data.experiment.status === "active" ? <View className="mt-9"><AppText variant="title" className="text-text-high">How did it feel this time?</AppText><View className="mt-4 flex-row gap-2">{(["easier", "same", "harder"] as const).map((result) => <Pressable key={result} disabled={working} onPress={() => void observe(result)} accessibilityLabel={`Record ${result}`} className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-surface"><AppText variant="button" className="capitalize text-text-high">{result}</AppText></Pressable>)}</View><TextInput value={notes} onChangeText={setNotes} accessibilityLabel="Optional observation note" placeholder="Optional note" placeholderTextColor={placeholderColor} multiline className="mt-4 min-h-24 rounded-2xl border border-border bg-surface px-4 py-3 text-base text-text-high" textAlignVertical="top" /><AppText variant="caption" className="mt-3 text-text-disabled">{data.experiment.observationCount} recorded observations{currentDay && durationDays ? ` · Day ${currentDay} of ${durationDays}` : ""}{data.experiment.endDate ? ` · Through ${formatDate(data.experiment.endDate)}` : ""}</AppText><Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.completeExperiment(data.experiment!.id))} className="mt-6" accessibilityLabel="Complete experiment"><AppText variant="button" className="text-text-high">Complete experiment</AppText></Button><Button variant="ghost" disabled={working} onPress={cancel} className="mt-2" accessibilityLabel="Cancel experiment"><AppText variant="button" className="text-text-low">Cancel experiment</AppText></Button></View> : null}
            {data.experiment.status === "completed" ? <View className="mt-9 rounded-[28px] border border-border bg-surface p-5"><AppText variant="caption" className="tracking-[1.5px] text-text-low">RESULT</AppText><AppText variant="title" className="mt-2 text-text-high">{data.experiment.result ? resultLabels[data.experiment.result] : "Analysis pending"}</AppText><AppText className="mt-3 leading-6 text-text-low">{data.experiment.resultSummary ?? "Your observations are saved while the outcome is prepared."}</AppText>{interpretation ? <AppText className="mt-4 leading-6 text-text-medium">{interpretation}</AppText> : null}{data.experiment.confidence !== null ? <AppText variant="caption" className="mt-4 text-text-disabled">Evidence confidence {Math.round(data.experiment.confidence * 100)}%</AppText> : null}{analysisRetryable ? <Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.retryAnalysis(data.experiment!.id))} className="mt-5" accessibilityLabel="Retry experiment analysis"><AppText variant="button" className="text-text-high">Retry interpretation</AppText></Button> : null}{learningRetryable ? <Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.retryLearning(data.experiment!.id))} className="mt-3" accessibilityLabel="Retry learning synthesis"><AppText variant="button" className="text-text-high">Retry learning</AppText></Button> : null}{insightRetryable ? <Button variant="secondary" disabled={working} onPress={() => void act(() => experimentsService.retryInsight(data.experiment!.id))} className="mt-3" accessibilityLabel="Retry insight generation"><AppText variant="button" className="text-text-high">Retry insight</AppText></Button> : null}</View> : null}
            <View className="mt-9"><AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">OBSERVATIONS</AppText>{data.observations.length ? <View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.observations.map((item, index) => <View key={item.id} className={`px-5 py-4 ${index < data.observations.length - 1 ? "border-b border-border" : ""}`}><AppText variant="button" className="capitalize text-text-high">{typeof item.value === "object" && item.value && !Array.isArray(item.value) && typeof item.value.result === "string" ? item.value.result : "Recorded"}</AppText>{item.notes ? <AppText className="mt-2 text-text-low">{item.notes}</AppText> : null}<AppText variant="caption" className="mt-2 text-text-disabled">{formatDateTime(item.observedAt)}</AppText></View>)}</View> : <AppText className="text-text-low">No observations recorded yet.</AppText>}</View>
            {data.experiment.status === "completed" || data.experiment.status === "cancelled" ? <Button variant="ghost" disabled={working} onPress={remove} className="mt-8" accessibilityLabel="Remove experiment"><AppText variant="button" className="text-red-600">Remove experiment</AppText></Button> : null}
        </>}
    </ScrollView></View>;
}
