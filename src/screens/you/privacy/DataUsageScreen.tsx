import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { PrivacyStackParamList } from "@/navigation/PrivacyNavigator";
import type { RootStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<PrivacyStackParamList, "DataUsage">;

const SECTIONS = [
    ["Why Aks uses your data", "Information you choose to share helps Aks personalize reflections, identify useful themes, and support your goals."],
    ["Reflections and check-ins", "Your entries can provide context for changes in mood, energy, focus, and routines over time."],
    ["Pattern detection", "Aks can compare information you provide to surface possible patterns for you to review. These are prompts for reflection, not medical conclusions."],
    ["Experiments and outcomes", "Experiment entries can help you compare what you tried with the outcomes you recorded."],
    ["AI-assisted understanding", "AI may help organize and summarize the information you provide. Review important insights and use your own judgment."],
] as const;

export default function DataUsageScreen({ navigation }: Props) {
    const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
    const color = useResolveClassNames("text-text-high").color;
    const muted = useResolveClassNames("text-text-medium").color;
    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInDown.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={color} /></IconButton>
                <AppText variant="title" className="text-text-high">How your data is used</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                    <AppText variant="display" className="text-text-high">Your data has a purpose.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Aks uses information within the product to make your experience more relevant and understandable.</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(500).delay(150)} className="mt-8 overflow-hidden rounded-[28px] border border-border bg-surface">
                    {SECTIONS.map(([title, body], index) => (
                        <View key={title} className={`px-5 py-5 ${index < SECTIONS.length - 1 ? "border-b border-border" : ""}`}>
                            <AppText variant="button" className="text-text-high">{title}</AppText>
                            <AppText className="mt-2 leading-6 text-text-low">{body}</AppText>
                        </View>
                    ))}
                </Animated.View>
                <Pressable onPress={() => rootNavigation.navigate("PrivacyPolicy")} className="mt-7 flex-row items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4">
                    <AppText variant="button" className="text-text-high">Read full Privacy Policy</AppText>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={muted} />
                </Pressable>
            </ScrollView>
        </View>
    );
}
