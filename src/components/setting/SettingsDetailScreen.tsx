import { ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";

type DetailItem = {
    label: string;
    value: string;
    icon: IconSvgElement;
};

type SettingsDetailScreenProps = {
    headerTitle: string;
    eyebrow: string;
    title: string;
    description: string;
    items: DetailItem[];
    note: string;
    onBack: () => void;
};

export default function SettingsDetailScreen({
    headerTitle,
    eyebrow,
    title,
    description,
    items,
    note,
    onBack,
}: SettingsDetailScreenProps) {
    const iconColor = useResolveClassNames("text-text-medium").color;

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={onBack} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">{headerTitle}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{description}</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 overflow-hidden rounded-[28px] border border-border bg-surface">
                    {items.map((item, index) => (
                        <View key={item.label} className={`flex-row items-center px-5 py-5 ${index < items.length - 1 ? "border-b border-border" : ""}`}>
                            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                <HugeiconsIcon icon={item.icon} size={21} color={iconColor} />
                            </View>
                            <View className="flex-1">
                                <AppText variant="caption" className="text-text-low">{item.label}</AppText>
                                <AppText variant="button" className="mt-1 text-text-high">{item.value}</AppText>
                            </View>
                        </View>
                    ))}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">A NOTE FROM AKS</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{note}</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
