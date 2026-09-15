import { Pressable, ScrollView, View } from "react-native";
import type {
    NativeStackNavigationProp,
    NativeStackScreenProps,
} from "@react-navigation/native-stack";
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
import IconButton from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import type {
    YouStackParamList,
    YourDataStackParamList,
} from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "YourDataHome">;
type DataSummaryRoute =
    | "Reflections"
    | "CheckIns"
    | "Patterns"
    | "Experiments"
    | "Learnings";
type DataCount = {
    key: "reflections" | "checkIns" | "patterns" | "experiments" | "learnings";
    label: string;
    count: number;
    icon: IconSvgElement;
    route: DataSummaryRoute;
};

const dataCounts: DataCount[] = [
    { key: "reflections", label: "Reflections", count: 24, icon: Note01Icon, route: "Reflections" },
    { key: "checkIns", label: "Check-ins", count: 38, icon: CheckListIcon, route: "CheckIns" },
    { key: "patterns", label: "Patterns", count: 7, icon: SparklesIcon, route: "Patterns" },
    { key: "experiments", label: "Experiments", count: 3, icon: Target01Icon, route: "Experiments" },
    { key: "learnings", label: "Learnings", count: 5, icon: BookOpen01Icon, route: "Learnings" },
];

export default function YourDataScreen({ navigation }: Props) {
    const youNavigation = navigation.getParent<
        NativeStackNavigationProp<YouStackParamList>
    >();
    const iconColor = useResolveClassNames("text-text-medium").color;
    const allCountsAreZero = dataCounts.every((item) => item.count === 0);

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">Your data</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">YOUR DATA</AppText>
                    <AppText variant="display" className="text-text-high">What Aks remembers.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">See the information Aks has gathered from your activity and the things you've chosen to share.</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>AT A GLANCE</SectionLabel>
                    {allCountsAreZero ? (
                        <View className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="title" className="text-text-high">Your story is just getting started.</AppText>
                            <AppText className="mt-3 leading-6 text-text-low">As you reflect, experiment, and learn, Aks will build a clearer picture of your patterns.</AppText>
                        </View>
                    ) : (
                        <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                            {dataCounts.map((item, index) => (
                                <Pressable key={item.key} onPress={() => navigation.navigate(item.route)} android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }} className={cn("flex-row items-center px-5 py-4", index < dataCounts.length - 1 && "border-b border-border")}>
                                    <View className="mr-4 size-10 items-center justify-center rounded-2xl bg-background">
                                        <HugeiconsIcon icon={item.icon} size={19} color={iconColor} />
                                    </View>
                                    <AppText className="flex-1 text-text-medium">{item.label}</AppText>
                                    <AppText variant="button" className="text-text-high">{item.count}</AppText>
                                    <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} />
                                </Pressable>
                            ))}
                            <AppText variant="caption" className="border-t border-border px-5 py-3 text-text-disabled">Placeholder values until account data is connected.</AppText>
                        </View>
                    )}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <SectionLabel>CONVERSATIONS</SectionLabel>
                    <Pressable
                        onPress={() => navigation.navigate("Conversations")}
                        android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }}
                        className="flex-row items-center rounded-[28px] border border-border bg-surface px-5 py-5"
                    >
                        <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                            <HugeiconsIcon icon={Chat01Icon} size={21} color={iconColor} />
                        </View>
                        <View className="flex-1 pr-3">
                            <AppText variant="button" className="text-text-high">Your conversations with Aks</AppText>
                            <AppText variant="caption" className="mt-1 text-text-low">Review the conversations you've had with Aks.</AppText>
                        </View>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} />
                    </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(290)} className="mt-9">
                    <SectionLabel>DATA SOURCES</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <SourceRow icon={UserCircleIcon} title="What you tell Aks" description="Reflections, check-ins, experiments, and other information you provide." iconColor={iconColor} />
                        <SourceRow icon={Link01Icon} title="Connected sources" description="No connected sources. Available when supported." iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(360)} className="mt-9">
                    <SectionLabel>YOUR CHOICE</SectionLabel>
                    <View className="rounded-[28px] border border-border bg-surface p-5">
                        <AppText variant="title" className="text-text-high">You decide what stays.</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">You can review, export, or delete your information. Aks is designed to keep you in control of your personal data.</AppText>
                        <Pressable onPress={() => youNavigation?.navigate("Privacy")} android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }} className="mt-5 flex-row items-center self-start rounded-full bg-background px-4 py-3">
                            <AppText variant="button" className="mr-2 text-text-high">View privacy controls</AppText>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} />
                        </Pressable>
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

function SectionLabel({ children }: { children: string }) {
    return <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{children}</AppText>;
}

function SourceRow({ icon, title, description, iconColor, last = false }: { icon: IconSvgElement; title: string; description: string; iconColor: React.ComponentProps<typeof HugeiconsIcon>["color"]; last?: boolean }) {
    return (
        <View className={cn("flex-row items-center px-5 py-5", !last && "border-b border-border")}>
            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={icon} size={21} color={iconColor} /></View>
            <View className="flex-1">
                <AppText variant="button" className="text-text-high">{title}</AppText>
                <AppText variant="caption" className="mt-1 text-text-low">{description}</AppText>
            </View>
        </View>
    );
}
