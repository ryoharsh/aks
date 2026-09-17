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
import { usePattern } from "@/hooks/usePatterns";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { patternsService } from "@/services/patterns.service";

type Props = NativeStackScreenProps<YourDataStackParamList, "PatternDetail">;

const labels: Record<string, string> = { candidate: "Candidate", possible: "Possible pattern", testing: "Being tested", supported: "Supported", not_supported: "Not supported", archived: "Archived" };

export default function PatternDetailScreen({ navigation, route }: Props) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    const data = usePattern(route.params.patternId);
    const [working, setWorking] = useState(false);
    const metadata = data.pattern?.metadata && typeof data.pattern.metadata === "object" && !Array.isArray(data.pattern.metadata) ? data.pattern.metadata : null;
    const alternative = metadata && typeof metadata.alternative_explanation === "string" ? metadata.alternative_explanation : null;
    const supportingCount = metadata && typeof metadata.supporting_count === "number" ? metadata.supporting_count : data.evidence.filter((item) => item.relationship === "supporting").length;
    const contradictingCount = metadata && typeof metadata.contradicting_count === "number" ? metadata.contradicting_count : data.evidence.filter((item) => item.relationship === "contradicting").length;

    const archive = () => Alert.alert("Archive this pattern?", "Aks will stop showing this pattern. Future observations may support a new review.", [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", onPress: async () => { setWorking(true); try { await patternsService.archivePattern(route.params.patternId); navigation.goBack(); } catch { Alert.alert("Unable to archive", "Please try again."); } finally { setWorking(false); } } },
    ]);
    const remove = () => Alert.alert("Remove this pattern?", "This removes only the derived pattern and its evidence links. Your signals and original information will remain.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => { setWorking(true); try { await patternsService.deletePattern(route.params.patternId); navigation.goBack(); } catch { Alert.alert("Unable to remove", "Please try again."); } finally { setWorking(false); } } },
    ]);

    return <View className="flex-1 bg-background">
        <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">Pattern</AppText></Animated.View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
            {data.loading ? <View className="items-center py-12"><ActivityIndicator color={iconColor} accessibilityLabel="Loading pattern" /></View> : data.error || !data.pattern ? <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Pattern unavailable.</AppText><AppText className="mt-3 text-text-low">{data.error ?? "It may have been archived or removed."}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View> : <>
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5"><AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{labels[data.pattern.status].toUpperCase()}</AppText><AppText variant="display" className="text-text-high">{data.pattern.title}</AppText><AppText className="mt-4 leading-6 text-text-low">{data.pattern.description}</AppText></Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Why Aks noticed this</AppText><AppText className="mt-3 leading-6 text-text-low">This relationship is linked to {supportingCount} supporting {supportingCount === 1 ? "observation" : "observations"}{contradictingCount ? ` and ${contradictingCount} contradicting ${contradictingCount === 1 ? "observation" : "observations"}` : ""}.</AppText><AppText variant="caption" className="mt-4 text-text-disabled">{data.pattern.confidence === null ? "Confidence still being assessed" : `Evidence confidence ${Math.round(data.pattern.confidence * 100)}%`} · First noticed {formatDate(data.pattern.firstDetectedAt)} · Last observed {formatDate(data.pattern.lastObservedAt)}</AppText>{alternative ? <><AppText variant="button" className="mt-5 text-text-high">Another possibility</AppText><AppText className="mt-2 leading-6 text-text-low">{alternative}</AppText></> : null}</Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9"><AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">EVIDENCE</AppText><View className="overflow-hidden rounded-[28px] border border-border bg-surface">{data.evidence.map((item, index) => { const canOpen = item.sourceType === "conversation"; return <Pressable key={item.id} disabled={!canOpen} onPress={() => canOpen && navigation.navigate("ConversationDetail", { conversationId: item.sourceId })} className={`px-5 py-4 ${index < data.evidence.length - 1 ? "border-b border-border" : ""}`}><View className="flex-row justify-between"><AppText className="capitalize text-text-medium">{item.signalType.replaceAll("_", " ")}</AppText><AppText variant="caption" className={item.relationship === "contradicting" ? "text-red-600" : "text-text-disabled"}>{item.relationship === "contradicting" ? "Contradicting" : "Supporting"}</AppText></View>{item.sourceExcerpt ? <AppText variant="caption" numberOfLines={3} className="mt-2 leading-5 text-text-low">“{item.sourceExcerpt}”</AppText> : null}<AppText variant="caption" className="mt-2 text-text-disabled">{formatDate(item.observedAt)}{canOpen ? " · View conversation" : ""}</AppText></Pressable>; })}</View></Animated.View>
                <Button disabled={data.pattern.status === "not_supported"} onPress={() => navigation.navigate("ExperimentSetup", { patternId: data.pattern!.id })} className="mt-9" accessibilityLabel={data.pattern.status === "not_supported" ? "This pattern is not ready to test" : "Test this pattern"}><AppText variant="button" className="text-primary-foreground">{data.pattern.status === "not_supported" ? "Not ready to test" : "Test this pattern"}</AppText></Button>
                <View className="mt-4 gap-3"><Button variant="secondary" disabled={working} onPress={archive}><AppText variant="button" className="text-text-high">Archive pattern</AppText></Button><Button variant="ghost" disabled={working} onPress={remove}><AppText variant="button" className="text-red-600">Remove pattern</AppText></Button></View>
            </>}
        </ScrollView>
    </View>;
}
