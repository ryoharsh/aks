import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    BookOpen01Icon,
    Chat01Icon,
    CheckListIcon,
    Link01Icon,
    Note01Icon,
    SparklesIcon,
    Target01Icon,
    UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useYourDataCounts } from "@/hooks/useYourDataCounts";
import { cn } from "@/lib/cn";
import type { YouStackParamList, YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "YourDataHome">;
type DataRoute = "Reflections" | "CheckIns" | "Conversations" | "Memories" | "Patterns" | "Experiments" | "Learnings" | "Insights";
type DataCount = { key: string; label: string; count: number; icon: IconSvgElement; route: DataRoute };

/** Truthful summary of the canonical source registry — never assumed. */
function connectedSourcesCopy(connected: number | undefined) {
    if (connected === undefined) return copy.yourData.sourcesUnknown;
    if (connected === 0) return copy.yourData.sourcesNone;
    return copy.yourData.sourcesCount(connected);
}

export default function YourDataScreen({ navigation }: Props) {
    const youNavigation = navigation.getParent<NativeStackNavigationProp<YouStackParamList>>();
    const iconColor = useResolveClassNames("text-text-medium").color;
    const { counts, loading, error, refresh } = useYourDataCounts();

    const overview: DataCount[] = counts ? [
        { key: "reflections", label: "Reflections", count: counts.reflections, icon: Note01Icon, route: "Reflections" },
        { key: "checkIns", label: "Check-ins", count: counts.checkIns, icon: CheckListIcon, route: "CheckIns" },
        { key: "conversations", label: "Conversations", count: counts.conversations, icon: Chat01Icon, route: "Conversations" },
    ] : [];
    const remembered: DataCount[] = [
        { key: "conversations", label: "Conversations", count: counts?.conversations ?? 0, icon: Chat01Icon, route: "Conversations" },
        { key: "memories", label: "Memories", count: counts?.memories ?? 0, icon: SparklesIcon, route: "Memories" },
        { key: "patterns", label: "Patterns", count: counts?.patterns ?? 0, icon: SparklesIcon, route: "Patterns" },
        { key: "experiments", label: "Experiments", count: counts?.experiments ?? 0, icon: Target01Icon, route: "Experiments" },
        { key: "learnings", label: "Learnings", count: counts?.learnings ?? 0, icon: BookOpen01Icon, route: "Learnings" },
        { key: "insights", label: "Insights", count: counts?.insights ?? 0, icon: SparklesIcon, route: "Insights" },
    ];

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="text-text-high">{copy.yourData.header}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading && counts !== null} onRefresh={() => void refresh()} />} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{copy.yourData.eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{copy.yourData.title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.yourData.description}</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>{copy.yourData.glanceSection}</SectionLabel>
                    {loading && !counts ? <View className="items-center py-10"><ActivityIndicator color={iconColor} accessibilityLabel={copy.yourData.loadingData} /></View> : error ? (
                        <View className="rounded-[28px] border border-border bg-surface p-5"><AppText className="text-text-low">{error}</AppText><Button variant="secondary" onPress={() => void refresh()} className="mt-4"><AppText variant="button" className="text-text-high">{copy.yourData.retry}</AppText></Button></View>
                    ) : (
                        <DataRows items={overview} onNavigate={(route) => navigation.navigate(route as never)} iconColor={iconColor} />
                    )}
                </Animated.View>

                {!loading && !error && counts ? <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <SectionLabel>{copy.yourData.remembersSection}</SectionLabel>
                    <DataRows items={remembered} onNavigate={(route) => navigation.navigate(route as never)} iconColor={iconColor} />
                </Animated.View> : null}

                <Animated.View entering={FadeInUp.duration(450).delay(290)} className="mt-9">
                    <SectionLabel>{copy.yourData.sourcesSection}</SectionLabel>
                    <View className="rounded-[28px] border border-border bg-surface">
                        <Pressable onPress={() => navigation.navigate("ConnectedSources")} accessibilityRole="button" className={`flex-row items-center px-5 py-5`}>
                            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                <HugeiconsIcon icon={Link01Icon} size={21} color={iconColor} />
                            </View>
                            <View className="flex-1 pr-3">
                                <AppText variant="button" className={"text-text-high"}>{copy.yourData.sourcesTitle}</AppText>
                                <AppText variant="caption" className="mt-1 text-text-low">{connectedSourcesCopy(counts?.connectedSources)}</AppText>
                            </View>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} />
                        </Pressable>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(360)} className="mt-9">
                    <SectionLabel>{copy.yourData.choiceSection}</SectionLabel>
                    <View className="rounded-[28px] border border-border bg-surface p-5">
                        <AppText variant="title" className="text-text-high">{copy.yourData.choiceTitle}</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">{copy.yourData.choiceBody}</AppText>
                        <View className="mt-5 flex-row flex-wrap gap-3">
                            <Pressable onPress={() => youNavigation?.navigate("Privacy", { screen: "ExportData" })} className="flex-row items-center rounded-full bg-background px-4 py-3">
                                <AppText variant="button" className="mr-2 text-text-high">{copy.yourData.exportAction}</AppText>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} />
                            </Pressable>
                            <Pressable onPress={() => youNavigation?.navigate("Privacy", { screen: "DeleteData" })} className="flex-row items-center rounded-full bg-background px-4 py-3">
                                <AppText variant="button" className="mr-2 text-text-high">{copy.yourData.deleteAction}</AppText>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} />
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(430)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">{copy.yourData.noteCaption}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.yourData.noteBody}</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

function DataRows({ items, onNavigate, iconColor }: { items: DataCount[]; onNavigate: (route: DataRoute) => void; iconColor: React.ComponentProps<typeof HugeiconsIcon>["color"] }) {
    return <View className="overflow-hidden rounded-[28px] border border-border bg-surface">{items.map((item, index) => <Pressable key={item.key} onPress={() => onNavigate(item.route)} className={cn("flex-row items-center px-5 py-4", index < items.length - 1 && "border-b border-border")}><View className="mr-4 size-10 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={item.icon} size={19} color={iconColor} /></View><AppText className="flex-1 text-text-medium">{item.label}</AppText><AppText variant="button" className="mr-2 text-text-high">{item.count}</AppText><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} /></Pressable>)}</View>;
}

function SectionLabel({ children }: { children: string }) {
    return <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{children}</AppText>;
}
