import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    CheckmarkCircle02Icon,
    ComputerIcon,
    Moon02Icon,
    Sun03Icon,
} from "@hugeicons/core-free-icons";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppText from "@/components/ui/Text";
import type { YouStackParamList } from "@/navigation/routes";
import { cn } from "@/lib/cn";
import { useResolveClassNames } from "uniwind";

type Props = NativeStackScreenProps<YouStackParamList, "Appearance">;

type ThemeOption = {
    id: "system" | "light" | "dark";
    title: string;
    description: string;
    icon: typeof ComputerIcon;
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
            <View className="h-16 flex-row items-center border-b border-border px-6">
                <Pressable
                    onPress={() => navigation.goBack()}
                    hitSlop={8}
                    className="mr-4 h-11 w-11 items-center justify-center rounded-full"
                    android_ripple={{ color: activeColor }}
                >
                    <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        size={22}
                        color={iconColor}
                    />
                </Pressable>

                <AppText
                    variant="title"
                    className="text-text-high"
                >
                    Appearance
                </AppText>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-6 pb-12"
            >
                <View className="mt-8">
                    <AppText variant="display">
                        Make it feel like yours.
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6"
                    >
                        Choose how Aks looks throughout the app.
                    </AppText>
                </View>

                <View className="mt-8">
                    <AppText
                        variant="caption"
                        className="mb-3 uppercase tracking-[1.5px]"
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
                                    android_ripple={{
                                        color: activeColor,
                                    }}
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
                                            className="mt-1 leading-5"
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
                </View>

                <View className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText
                        variant="caption"
                        className="uppercase tracking-[1.5px]"
                    >
                        A NOTE FROM AKS
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6"
                    >
                        Appearance only changes how Aks looks. Your data,
                        insights, and experiments stay exactly the same.
                    </AppText>
                </View>
            </ScrollView>
        </View>
    );
}