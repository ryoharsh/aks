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

type Props = NativeStackScreenProps<YourDataStackParamList, "YourDataHome">;
type DataRoute = "Reflections" | "CheckIns" | "Conversations" | "Memories" | "Patterns" | "Experiments" | "Learnings" | "Insights";
type DataCount = { key: string; label: string; count: number; icon: IconSvgElement; route: DataRoute };

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
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="text-text-high">Your data</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading && counts !== null} onRefresh={() => void refresh()} />} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">YOUR DATA</AppText>
                    <AppText variant="display" className="text-text-high">What Aks remembers.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">See the information Aks has gathered from your activity and the things you've chosen to share.</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>AT A GLANCE</SectionLabel>
                    {loading && !counts ? <View className="items-center py-10"><ActivityIndicator color={iconColor} accessibilityLabel="Loading data summary" /></View> : error ? (
                        <View className="rounded-[28px] border border-border bg-surface p-5"><AppText className="text-text-low">{error}</AppText><Button variant="secondary" onPress={() => void refresh()} className="mt-4"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View>
                    ) : (
                        <DataRows items={overview} onNavigate={(route) => navigation.navigate(route as never)} iconColor={iconColor} />
                    )}
                </Animated.View>

                {!loading && !error && counts ? <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <SectionLabel>WHAT AKS REMEMBERS</SectionLabel>
                    <DataRows items={remembered} onNavigate={(route) => navigation.navigate(route as never)} iconColor={iconColor} />
                </Animated.View> : null}

                <Animated.View entering={FadeInUp.duration(450).delay(290)} className="mt-9">
                    <SectionLabel>DATA SOURCES</SectionLabel>
                    <View className="rounded-[28px] border border-border bg-surface">
                        <SourceRow icon={UserCircleIcon} title="Aks" description="Conversations, reflections, and check-ins you choose to share." iconColor={iconColor} />
                        <SourceRow icon={Link01Icon} title="Connected sources" description="No connected sources. Available when supported." iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(360)} className="mt-9">
                    <SectionLabel>YOUR CHOICE</SectionLabel>
                    <View className="rounded-[28px] border border-border bg-surface p-5">
                        <AppText variant="title" className="text-text-high">You decide what stays.</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">You can review, export, or delete your information. Aks is designed to keep you in control of your personal data.</AppText>
                        <View className="mt-5 flex-row flex-wrap gap-3">
                            <Pressable onPress={() => youNavigation?.navigate("Privacy", { screen: "ExportData" })} className="flex-row items-center rounded-full bg-background px-4 py-3">
                                <AppText variant="button" className="mr-2 text-text-high">Export data</AppText>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} />
                            </Pressable>
                            <Pressable onPress={() => youNavigation?.navigate("Privacy", { screen: "DeleteData" })} className="flex-row items-center rounded-full bg-background px-4 py-3">
                                <AppText variant="button" className="mr-2 text-text-high">Delete data</AppText>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} />
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(430)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">A NOTE FROM AKS</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Your data is what makes Aks personal. It should also remain understandable and under your control.</AppText>
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

function SourceRow({ icon, title, description, iconColor }: { icon: IconSvgElement; title: string; description: string; iconColor: React.ComponentProps<typeof HugeiconsIcon>["color"] }) {
    return <View className="flex-row items-center px-5 py-5"><View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={icon} size={21} color={iconColor} /></View><View className="flex-1"><AppText variant="button" className="text-text-high">{title}</AppText><AppText variant="caption" className="mt-1 text-text-low">{description}</AppText></View></View>;
}

