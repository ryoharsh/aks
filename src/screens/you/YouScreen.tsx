import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import {
    HugeiconsIcon,
    type IconSvgElement,
} from "@hugeicons/react-native";
import {
    ArrowRight01Icon,
    BellIcon,
    Database01Icon,
    HelpCircleIcon,
    LockIcon,
    Moon02Icon,
    Settings01Icon,
    SparklesIcon,
    Target01Icon,
    UserIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import type { YouStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YouStackParamList, "YouHome">;

type MenuItemProps = {
    icon: IconSvgElement;
    title: string;
    description?: string;
    onPress?: () => void;
};

function MenuItem({
    icon,
    title,
    description,
    onPress,
}: MenuItemProps) {
    const iconColor = useResolveClassNames("text-text-medium");

    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center py-4"
        >
            <View className="mr-4 h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                <HugeiconsIcon
                    icon={icon}
                    size={21}
                    color={iconColor.color}
                    strokeWidth={1.8}
                />
            </View>

            <View className="flex-1">
                <AppText
                    variant="button"
                    className="text-text-high"
                >
                    {title}
                </AppText>

                {description ? (
                    <AppText
                        variant="caption"
                        className="mt-1 text-text-low"
                    >
                        {description}
                    </AppText>
                ) : null}
            </View>

            <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={18}
                color={iconColor.color}
                strokeWidth={1.6}
            />
        </Pressable>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <AppText
            variant="caption"
            className="mb-3 text-[10px] tracking-[1.8px] text-text-low"
        >
            {children}
        </AppText>
    );
}

export default function YouScreen({ navigation }: Props) {
    const primaryColor = useResolveClassNames("text-text-high");

    return (
        <View className="flex-1 bg-background">
            <StatusBar style="dark" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-6 pb-32"
            >
                <Animated.View
                    entering={FadeIn.duration(450)}
                    className="pt-8"
                >
                    <View className="flex-row items-center justify-between">
                        <AppText
                            variant="title"
                            className="text-[18px] text-text-high"
                        >
                            You
                        </AppText>

                        <Pressable
                            onPress={() => navigation.navigate("Settings")}
                            hitSlop={10}
                            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
                        >
                            <HugeiconsIcon
                                icon={Settings01Icon}
                                size={20}
                                color={primaryColor.color}
                                strokeWidth={1.8}
                            />
                        </Pressable>
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInDown.duration(550).delay(100)}
                    className="mt-8"
                >
                    <View className="flex-row items-center">
                        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
                            <HugeiconsIcon
                                icon={UserIcon}
                                size={28}
                                color="#FFFFFF"
                                strokeWidth={1.8}
                            />
                        </View>

                        <View className="ml-4 flex-1">
                            <AppText
                                variant="title"
                                className="text-text-high"
                            >
                                Harsh
                            </AppText>

                            <AppText className="mt-1 text-text-low">
                                Your personal space
                            </AppText>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(180)}
                    className="mt-8"
                >
                    <Pressable
                        onPress={() =>
                            navigation.navigate("YourData", {
                                screen: "Patterns",
                            })
                        }
                        className="rounded-[28px] border border-border bg-surface p-5"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background">
                                    <HugeiconsIcon
                                        icon={SparklesIcon}
                                        size={20}
                                        color={primaryColor.color}
                                        strokeWidth={1.8}
                                    />
                                </View>

                                <View>
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        What Aks knows
                                    </AppText>

                                    <AppText
                                        variant="caption"
                                        className="mt-1 text-text-low"
                                    >
                                        7 patterns discovered
                                    </AppText>
                                </View>
                            </View>

                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                size={19}
                                color={primaryColor.color}
                            />
                        </View>
                    </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(240)}
                    className="mt-4"
                >
                    <Pressable
                        onPress={() =>
                            navigation.navigate("YourData", {
                                screen: "Experiments",
                            })
                        }
                        className="rounded-[28px] border border-border bg-surface p-5"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background">
                                    <HugeiconsIcon
                                        icon={Target01Icon}
                                        size={20}
                                        color={primaryColor.color}
                                        strokeWidth={1.8}
                                    />
                                </View>

                                <View>
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        What you're exploring
                                    </AppText>

                                    <AppText
                                        variant="caption"
                                        className="mt-1 text-text-low"
                                    >
                                        Focus · Energy · Sleep
                                    </AppText>
                                </View>
                            </View>

                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                size={19}
                                color={primaryColor.color}
                            />
                        </View>
                    </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(300)}
                    className="mt-4"
                >
                    <Pressable
                        onPress={() =>
                            navigation.navigate("YourData", {
                                screen: "Learnings",
                            })
                        }
                        className="rounded-[28px] border border-border bg-surface p-5"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background">
                                    <HugeiconsIcon
                                        icon={SparklesIcon}
                                        size={20}
                                        color={primaryColor.color}
                                        strokeWidth={1.8}
                                    />
                                </View>

                                <View>
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        Things you haven't noticed
                                    </AppText>

                                    <AppText
                                        variant="caption"
                                        className="mt-1 text-text-low"
                                    >
                                        3 new discoveries
                                    </AppText>
                                </View>
                            </View>

                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                size={19}
                                color={primaryColor.color}
                            />
                        </View>
                    </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(350)}
                    className="mt-10"
                >
                    <SectionLabel>
                        YOUR JOURNEY
                    </SectionLabel>

                    <View className="border-t border-border">
                        <MenuItem
                            icon={SparklesIcon}
                            title="Patterns"
                            description="Things Aks has noticed"
                            onPress={() =>
                                navigation.navigate("YourData", {
                                    screen: "Patterns",
                                })
                            }
                        />

                        <View className="h-px bg-border" />

                        <MenuItem
                            icon={Target01Icon}
                            title="Experiments"
                            description="What you're currently testing"
                            onPress={() =>
                                navigation.navigate("YourData", {
                                    screen: "Experiments",
                                })
                            }
                        />

                        <View className="h-px bg-border" />

                        <MenuItem
                            icon={Database01Icon}
                            title="Your data"
                            description="Review and manage your information"
                            onPress={() => navigation.navigate("YourData")}
                        />
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(400)}
                    className="mt-10"
                >
                    <SectionLabel>
                        PREFERENCES
                    </SectionLabel>

                    <View className="border-t border-border">
                        <MenuItem
                            icon={BellIcon}
                            title="Notifications"
                            description="When Aks should reach out"
                            onPress={() => navigation.navigate("Notifications")}
                        />

                        <View className="h-px bg-border" />

                        <MenuItem
                            icon={Moon02Icon}
                            title="Appearance"
                            description="System · Light · Dark"
                            onPress={() => navigation.navigate("Appearance")}
                        />

                        <View className="h-px bg-border" />

                        <MenuItem
                            icon={LockIcon}
                            title="Privacy"
                            description="Permissions and privacy controls"
                            onPress={() => navigation.navigate("Privacy")}
                        />
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(450)}
                    className="mt-10"
                >
                    <SectionLabel>
                        SUPPORT
                    </SectionLabel>

                    <View className="border-t border-border">
                        <MenuItem
                            icon={HelpCircleIcon}
                            title="Help & feedback"
                            onPress={() => navigation.navigate("HelpFeedback")}
                        />
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeIn.duration(500).delay(500)}
                    className="mt-10 items-center"
                >
                    <AppText
                        variant="caption"
                        className="text-text-low"
                    >
                        Aks.ai
                    </AppText>

                    <AppText
                        variant="caption"
                        className="mt-1 text-text-disabled"
                    >
                        Understand yourself, differently.
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}