import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, {
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import {
    HugeiconsIcon,
    type IconSvgElement,
} from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    CheckmarkCircle02Icon,
    ComputerIcon,
    Moon02Icon,
    Sun03Icon,
} from "@hugeicons/core-free-icons";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { YouStackParamList } from "@/navigation/routes";
import { cn } from "@/lib/cn";
import { useResolveClassNames } from "uniwind";

type Props = NativeStackScreenProps<YouStackParamList, "Appearance">;

type ThemeOption = {
    id: "system" | "light" | "dark";
    title: string;
    description: string;
    icon: IconSvgElement;
};

const themeOptions: ThemeOption[] = [
    {
        id: "system",
        title: "System",
        description: "Follow your device appearance.",
        icon: ComputerIcon,
    },
    {
        id: "light",
        title: "Light",
        description: "Keep Aks bright and clear.",
        icon: Sun03Icon,
    },
    {
        id: "dark",
        title: "Dark",
        description: "A softer experience in low light.",
        icon: Moon02Icon,
    },
];

export default function AppearanceScreen({ navigation }: Props) {
    const [selectedTheme, setSelectedTheme] =
        useState<ThemeOption["id"]>("system");

    const iconColor = useResolveClassNames("text-text-medium").color;
    const activeColor = useResolveClassNames("text-primary").color;

    return (
        <View className="flex-1 bg-background">
            <Animated.View
                entering={FadeInUp.duration(400)}
                className="h-16 flex-row items-center px-5"
            >
                <IconButton
                    onPress={() => navigation.goBack()}
                    className="mr-3"
                >
                    <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        size={22}
                        color={iconColor}
                    />
                </IconButton>

                <AppText
                    variant="title"
                    className="text-text-high"
                >
                    Appearance
                </AppText>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-5 pb-24"
            >
                <Animated.View
                    entering={FadeInDown.duration(500).delay(80)}
                    className="mt-5"
                >
                    <AppText
                        variant="caption"
                        className="mb-2 tracking-[1.5px] text-text-low"
                    >
                        YOUR EXPERIENCE
                    </AppText>

                    <AppText
                        variant="display"
                        className="text-text-high"
                    >
                        Make it feel like yours.
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6 text-text-low"
                    >
                        Choose how Aks looks throughout the app.
                    </AppText>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(150)}
                    className="mt-9"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 tracking-[1.5px] text-text-low"
                    >
                        THEME
                    </AppText>

                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        {themeOptions.map((option, index) => {
                            const selected = selectedTheme === option.id;

                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() =>
                                        setSelectedTheme(option.id)
                                    }
                                    className={cn(
                                        "flex-row items-center px-5 py-5",
                                        index !== themeOptions.length - 1 &&
                                        "border-b border-border"
                                    )}
                                >
                                    <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                        <HugeiconsIcon
                                            icon={option.icon}
                                            size={21}
                                            color={
                                                selected
                                                    ? activeColor
                                                    : iconColor
                                            }
                                        />
                                    </View>

                                    <View className="flex-1">
                                        <AppText
                                            variant="button"
                                            className="text-text-high"
                                        >
                                            {option.title}
                                        </AppText>

                                        <AppText
                                            variant="body"
                                            className="mt-1 leading-5 text-text-low"
                                        >
                                            {option.description}
                                        </AppText>
                                    </View>

                                    {selected && (
                                        <HugeiconsIcon
                                            icon={CheckmarkCircle02Icon}
                                            size={22}
                                            color={activeColor}
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(220)}
                    className="mt-6 rounded-[28px] border border-border bg-surface p-5"
                >
                    <AppText
                        variant="caption"
                        className="tracking-[1.5px] text-text-low"
                    >
                        A NOTE FROM AKS
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6 text-text-low"
                    >
                        Appearance only changes how Aks looks. Your data,
                        insights, and experiments stay exactly the same.
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}