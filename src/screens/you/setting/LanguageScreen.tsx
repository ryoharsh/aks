import { useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { copy } from "@/constants/copy";
import { useLanguage } from "@/providers/LanguageProvider";

export default function LanguageScreen() {
    const navigation = useNavigation();
    const { language, languages, selectLanguage } = useLanguage();
    const pendingRef = useRef(false);
    const { notice } = useBottomSheet();
    const iconColor = useResolveClassNames("text-text-medium").color;
    const activeColor = useResolveClassNames("text-primary").color;

    // Each row shows the language's own name, with its English name as
    // secondary context for users currently reading English.
    const rows = useMemo(
        () => languages.map((entry) => ({ ...entry, selected: entry.code === language })),
        [languages, language],
    );

    const choose = (code: typeof language) => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        void selectLanguage(code).then((result) => {
            if (result) notice(copy.language.header, result, copy.bottomSheet.defaultConfirm);
            pendingRef.current = false;
        });
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">{copy.language.header}</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{copy.language.eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{copy.language.title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.language.description}</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 overflow-hidden rounded-[28px] border border-border bg-surface">
                    {rows.map((row, index) => {
                        const showHint = !row.available && row.code !== language;
                        return (
                            <Pressable
                                key={row.code}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: row.selected }}
                                onPress={() => choose(row.code)}
                                className={`flex-row items-center px-5 py-5 ${index < rows.length - 1 ? "border-b border-border" : ""}`}
                            >
                                <View className="flex-1">
                                    <AppText className="text-text-high">{row.nativeName}</AppText>
                                    {showHint ? (
                                        <AppText variant="caption" className="mt-1 text-text-low">{row.englishName} · {copy.language.comingSoon}</AppText>
                                    ) : null}
                                </View>
                                {row.selected ? <HugeiconsIcon icon={CheckmarkCircle01Icon} size={21} color={activeColor} /> : null}
                            </Pressable>
                        );
                    })}
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">{copy.profilePreference.noteCaption}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.profilePreference.noteBody}</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
