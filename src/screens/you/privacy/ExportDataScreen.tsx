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
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<PrivacyStackParamList, "ExportData">;
const INCLUDED: readonly string[] = copy.exportData.included;

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
                <AppText variant="title" className="text-text-high">{copy.exportData.header}</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow px-5 pb-24">
                {phase === "processing" && (
                    <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-24 items-center">
                        <View className="size-14 items-center justify-center rounded-3xl bg-accent-soft">
                            <HugeiconsIcon icon={RefreshIcon} size={26} color={color} />
                        </View>
                        <AppText variant="title" className="mt-5 text-text-high">{copy.exportData.preparingTitle}</AppText>
                        <AppText className="mt-2 text-center text-text-low">{copy.exportData.preparingBody}</AppText>
                    </Animated.View>
                )}

                {phase === "error" && (
                    <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                        <AppText variant="display" className="text-text-high">{copy.exportData.errorTitle}</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">{copy.exportData.errorBody}</AppText>
                        <View className="mt-7 rounded-[28px] border border-red-200 bg-red-50 p-5">
                            <AppText variant="title" className="text-red-600">{copy.exportData.failedTitle}</AppText>
                            <AppText className="mt-3 leading-6 text-red-700">{error ?? copy.exportData.failedFallback}</AppText>
                        </View>
                        <View className="mt-7">
                            <Button onPress={requestExport} accessibilityLabel={copy.exportData.retryA11y}><HugeiconsIcon icon={RefreshIcon} size={20} color={color} /><AppText variant="button" className="ml-2 text-primary-foreground">{copy.common.tryAgain}</AppText></Button>
                            <Button variant="ghost" onPress={reset} className="mt-2" accessibilityLabel={copy.exportData.cancelA11y}><AppText variant="button" className="text-primary">{copy.exportData.cancelAction}</AppText></Button>
                        </View>
                    </Animated.View>
                )}

                {phase === "ready" && result && (
                    <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                        <AppText variant="display" className="text-text-high">{copy.exportData.readyTitle}</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">{copy.exportData.readyBody}</AppText>

                        <Animated.View entering={FadeInUp.duration(500).delay(120)} className="mt-7 rounded-[28px] border border-border bg-surface p-5">
                            <View className="flex-row items-center">
                                <View className="size-11 items-center justify-center rounded-2xl bg-accent-soft"><HugeiconsIcon icon={CheckmarkCircle01Icon} size={24} color={color} /></View>
                                <View className="ml-3 flex-1">
                                    <AppText variant="button" className="text-text-high" numberOfLines={1}>{result.fileName}</AppText>
                                    <View className="mt-1 flex-row items-center">
                                        <HugeiconsIcon icon={Clock01Icon} size={15} color={muted} />
                                        <AppText className="ml-1.5 text-text-medium">{copy.exportData.expiresIn(secondsRemaining !== null ? formatCountdown(secondsRemaining) : copy.exportData.expiresSoon)}</AppText>
                                    </View>
                                </View>
                            </View>
                            <View className="mt-6">
                                <Button onPress={download} loading={downloading} accessibilityLabel={copy.exportData.saveA11y}><HugeiconsIcon icon={Download01Icon} size={20} color={color} /><AppText variant="button" className="ml-2 text-primary-foreground">{copy.exportData.saveAction}</AppText></Button>
                                {downloadError && <AppText className="mt-3 text-center text-red-600">{downloadError}</AppText>}
                            </View>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.duration(500).delay(190)} className="mt-5">
                            <Button variant="ghost" onPress={reset} accessibilityLabel={copy.exportData.requestAnotherA11y}><AppText variant="button" className="text-primary">{copy.exportData.requestAnother}</AppText></Button>
                        </Animated.View>
                    </Animated.View>
                )}

                {phase === "idle" && (
                    <>
                        <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                            <AppText variant="display" className="text-text-high">{copy.exportData.idleTitle}</AppText>
                            <AppText className="mt-3 leading-6 text-text-low">{copy.exportData.idleBody}</AppText>
                        </Animated.View>
                        <Animated.View entering={FadeInUp.duration(500).delay(150)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{copy.exportData.includedSection}</AppText>
                            {INCLUDED.map((item) => (
                                <View key={item} className="flex-row items-center py-2">
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color={muted} />
                                    <AppText className="ml-3 text-text-medium">{item}</AppText>
                                </View>
                            ))}
                        </Animated.View>
                        <Animated.View entering={FadeInUp.duration(500).delay(230)} className="mt-7">
                            <Button onPress={requestExport} accessibilityLabel={copy.exportData.requestA11y}><HugeiconsIcon icon={Download01Icon} size={20} color={color} /><AppText variant="button" className="ml-2 text-primary-foreground">{copy.exportData.requestAction}</AppText></Button>
                        </Animated.View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}