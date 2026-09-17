import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon, Clock01Icon, Download01Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useExportData } from "@/hooks/useExportData";
import type { PrivacyStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<PrivacyStackParamList, "ExportData">;
const INCLUDED = ["Profile and preferences", "Conversations and messages", "Reflections", "Check-ins", "Signals", "Memories and evidence links", "Patterns and evidence links", "Experiments and observations", "Learnings and source links", "Insights and source references"];

function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export default function ExportDataScreen({ navigation }: Props) {
    const color = useResolveClassNames("text-text-high").color;
    const muted = useResolveClassNames("text-text-medium").color;
    const { phase, result, error, downloading, downloadError, secondsRemaining, requestExport, download, reset } = useExportData();

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInDown.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={color} /></IconButton>
                <AppText variant="title" className="text-text-high">Export your data</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow px-5 pb-24">
                {phase === "processing" && (
                    <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-24 items-center">
                        <View className="size-14 items-center justify-center rounded-3xl bg-accent-soft">
                            <HugeiconsIcon icon={RefreshIcon} size={26} color={color} />
                        </View>
                        <AppText variant="title" className="mt-5 text-text-high">Preparing your export</AppText>
                        <AppText className="mt-2 text-center text-text-low">Gathering your conversations, reflections, memories, patterns, experiments, and insights. This usually takes a few seconds.</AppText>
                    </Animated.View>
                )}

                {phase === "error" && (
                    <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                        <AppText variant="display" className="text-text-high">Take your data with you.</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">A downloadable copy of your Aks information is available on request.</AppText>
                        <View className="mt-7 rounded-[28px] border border-red-200 bg-red-50 p-5">
                            <AppText variant="title" className="text-red-600">Couldn't create your export.</AppText>
                            <AppText className="mt-3 leading-6 text-red-700">{error ?? "Something went wrong while preparing your export. Please try again."}</AppText>
                        </View>
                        <View className="mt-7">
                            <Button onPress={requestExport} accessibilityLabel="Try to create the export again"><HugeiconsIcon icon={RefreshIcon} size={20} color={color} /><AppText variant="button" className="ml-2 text-primary-foreground">Try again</AppText></Button>
                            <Button variant="ghost" onPress={reset} className="mt-2" accessibilityLabel="Go back to the export introduction"><AppText variant="button" className="text-primary">Cancel</AppText></Button>
                        </View>
                    </Animated.View>
                )}

                {phase === "ready" && result && (
                    <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                        <AppText variant="display" className="text-text-high">Your export is ready.</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">A snapshot of your Aks information was prepared just now. It covers the same sections listed when you requested it.</AppText>

                        <Animated.View entering={FadeInUp.duration(500).delay(120)} className="mt-7 rounded-[28px] border border-border bg-surface p-5">
                            <View className="flex-row items-center">
                                <View className="size-11 items-center justify-center rounded-2xl bg-accent-soft"><HugeiconsIcon icon={CheckmarkCircle01Icon} size={24} color={color} /></View>
                                <View className="ml-3 flex-1">
                                    <AppText variant="button" className="text-text-high" numberOfLines={1}>{result.fileName}</AppText>
                                    <View className="mt-1 flex-row items-center">
                                        <HugeiconsIcon icon={Clock01Icon} size={15} color={muted} />
                                        <AppText className="ml-1.5 text-text-medium">Link expires in {secondsRemaining !== null ? formatCountdown(secondsRemaining) : "a moment"}</AppText>
                                    </View>
                                </View>
                            </View>
                            <View className="mt-6">
                                <Button onPress={download} loading={downloading} accessibilityLabel="Save the export"><HugeiconsIcon icon={Download01Icon} size={20} color={color} /><AppText variant="button" className="ml-2 text-primary-foreground">Save export</AppText></Button>
                                {downloadError && <AppText className="mt-3 text-center text-red-600">{downloadError}</AppText>}
                            </View>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.duration(500).delay(190)} className="mt-5">
                            <Button variant="ghost" onPress={reset} accessibilityLabel="Request another export"><AppText variant="button" className="text-primary">Request another export</AppText></Button>
                        </Animated.View>
                    </Animated.View>
                )}

                {phase === "idle" && (
                    <>
                        <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                            <AppText variant="display" className="text-text-high">Take your data with you.</AppText>
                            <AppText className="mt-3 leading-6 text-text-low">A downloadable copy of your Aks information is available on request. Each export is a single file that reflects your account at the moment you request it.</AppText>
                        </Animated.View>
                        <Animated.View entering={FadeInUp.duration(500).delay(150)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">WHAT IS INCLUDED</AppText>
                            {INCLUDED.map((item) => (
                                <View key={item} className="flex-row items-center py-2">
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color={muted} />
                                    <AppText className="ml-3 text-text-medium">{item}</AppText>
                                </View>
                            ))}
                        </Animated.View>
                        <Animated.View entering={FadeInUp.duration(500).delay(230)} className="mt-7">
                            <Button onPress={requestExport} accessibilityLabel="Request the export"><HugeiconsIcon icon={Download01Icon} size={20} color={color} /><AppText variant="button" className="ml-2 text-primary-foreground">Request data export</AppText></Button>
                        </Animated.View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}