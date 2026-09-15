import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";

type ProfilePreferenceScreenProps = {
    headerTitle: string;
    eyebrow: string;
    title: string;
    description: string;
    options: readonly string[];
    initialSelections: readonly string[];
    multiple?: boolean;
    onBack: () => void;
};

export default function ProfilePreferenceScreen({ headerTitle, eyebrow, title, description, options, initialSelections, multiple = false, onBack }: ProfilePreferenceScreenProps) {
    const [selections, setSelections] = useState<string[]>([...initialSelections]);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const activeColor = useResolveClassNames("text-primary").color;

    const toggle = (option: string) => {
        setSelections((current) => {
            if (!multiple) return [option];
            return current.includes(option)
                ? current.filter((item) => item !== option)
                : [...current, option];
        });
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={onBack} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="text-text-high">{headerTitle}</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{description}</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 overflow-hidden rounded-[28px] border border-border bg-surface">
                    {options.map((option, index) => {
                        const selected = selections.includes(option);
                        return (
                            <Pressable key={option} onPress={() => toggle(option)} className={`flex-row items-center px-5 py-5 ${index < options.length - 1 ? "border-b border-border" : ""}`}>
                                <AppText className="flex-1 text-text-high">{option}</AppText>
                                {selected ? <HugeiconsIcon icon={CheckmarkCircle01Icon} size={21} color={activeColor} /> : null}
                            </Pressable>
                        );
                    })}
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">SAVED ON THIS DEVICE</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">These selections are local placeholders until profile storage is connected.</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
