import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { copy } from "@/constants/copy";

type Props = {
    headerTitle: string;
    eyebrow: string;
    title: string;
    description: string;
    options: readonly string[];
    selections: readonly string[];
    multiple?: boolean;
    onSave: (selections: string[]) => Promise<void>;
    onBack: () => void;
};

export default function ProfilePreferenceScreen({ headerTitle, eyebrow, title, description, options, selections: storedSelections, multiple = false, onSave, onBack }: Props) {
    const [selections, setSelections] = useState<string[]>([...storedSelections]);
    const [saving, setSaving] = useState(false);
    const { notice } = useBottomSheet();
    const iconColor = useResolveClassNames("text-text-medium").color;
    const activeColor = useResolveClassNames("text-primary").color;

    useEffect(() => setSelections([...storedSelections]), [storedSelections]);

    const save = async () => {
        try {
            setSaving(true);
            await onSave(selections);
            onBack();
        } catch {
            notice(copy.profilePreference.notices.unableToSave, copy.common.checkConnection);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={onBack} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
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
                            <Pressable key={option} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setSelections((current) => !multiple ? [option] : current.includes(option) ? current.filter((item) => item !== option) : [...current, option])} className={`flex-row items-center px-5 py-5 ${index < options.length - 1 ? "border-b border-border" : ""}`}>
                                <AppText className="flex-1 text-text-high">{option}</AppText>
                                {selected ? <HugeiconsIcon icon={CheckmarkCircle01Icon} size={21} color={activeColor} /> : null}
                            </Pressable>
                        );
                    })}
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">{copy.profilePreference.noteCaption}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.profilePreference.noteBody}</AppText>
                </Animated.View>
                <Button onPress={() => void save()} loading={saving} className="mt-6" accessibilityLabel={copy.profilePreference.saveA11y(headerTitle)}>
                    <AppText variant="button" className="text-primary-foreground">{copy.profilePreference.saveAction}</AppText>
                </Button>
            </ScrollView>
        </View>
    );
}
