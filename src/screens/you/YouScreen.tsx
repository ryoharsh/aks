import React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
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
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useYourDataCounts } from "@/hooks/useYourDataCounts";
import { useTimelineNavigation } from "@/hooks/useTimelineNavigation";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YouStackParamList, "YouHome"> & {
    shouldEnter: boolean;
};

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

export default function YouScreen({ navigation, shouldEnter }: Props) {
    const primaryColor = useResolveClassNames("text-text-high");
    const primaryForegroundColor = useResolveClassNames("text-primary-foreground");
    const { user } = useAuth();
    const { preferences } = usePreferences();
    const { counts } = useYourDataCounts();
    const [avatarFailed, setAvatarFailed] = React.useState(false);

    React.useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);
    useTimelineNavigation(navigation);

    const enteredRef = React.useRef(false);
    const enterProgress = useSharedValue(0);
    const enterStyle = useAnimatedStyle(() => ({
        opacity: enterProgress.value,
    }));

    React.useEffect(() => {
        if (shouldEnter && !enteredRef.current) {
            enteredRef.current = true;
            enterProgress.value = withTiming(1, {
                duration: 350,
                easing: Easing.out(Easing.cubic),
            });
        }
    }, [shouldEnter, enterProgress]);

    return (
        <View
            pointerEvents={shouldEnter ? "auto" : "none"}
            className="flex-1 bg-background"
        >
            <Animated.View
                style={enterStyle}
                className="flex-1"
            >

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerClassName="px-6 pb-32"
                >
                    <Animated.View
                        className="pt-8"
                    >
                        <View className="flex-row items-center justify-between">
                            <AppText
                                variant="title"
                                className="text-[18px] text-text-high"
                            >
                                {copy.you.title}
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
                        className="mt-8"
                    >
                        <View className="flex-row items-center">
                            <View className="h-16 w-16 overflow-hidden items-center justify-center rounded-full bg-primary">
                                {user?.avatarUrl && !avatarFailed ? (
                                    <Image source={{ uri: user.avatarUrl }} className="size-16" onError={() => setAvatarFailed(true)} />
                                ) : (
                                    <HugeiconsIcon icon={UserIcon} size={28} color={primaryForegroundColor.color} strokeWidth={1.8} />
                                )}
                            </View>

                            <View className="ml-4 flex-1">
                                <AppText
                                    variant="title"
                                    className="text-text-high"
                                >
                                    {user?.name ?? copy.you.fallbackName}
                                </AppText>

                                <AppText className="mt-1 text-text-low">
                                    {copy.you.subtitle}
                                </AppText>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View
                        className="mt-8"
                    >
                        <Pressable
                            onPress={() =>
                                navigation.navigate("YourData", {
                                    screen: "Memories",
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
                                            {copy.you.knowsTitle}
                                        </AppText>

                                        <AppText
                                            variant="caption"
                                            className="mt-1 text-text-low"
                                        >
                                            {counts?.memories ? copy.you.memoriesCount(counts.memories) : copy.you.knowsEmpty}
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
                        className="mt-4"
                    >
                        <Pressable
                            onPress={() =>
                                navigation.navigate("Settings", {
                                    screen: "Exploring",
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
                                            {copy.you.exploringTitle}
                                        </AppText>

                                        <AppText
                                            variant="caption"
                                            className="mt-1 text-text-low"
                                        >
                                            {preferences.whatExploring.join(" · ") || copy.you.exploringEmpty}
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
                        className="mt-4"
                    >
                        <Pressable
                            onPress={() =>
                                navigation.navigate("YourData", {
                                    screen: "Insights",
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
                                            {copy.you.unnoticedTitle}
                                        </AppText>

                                        <AppText
                                            variant="caption"
                                            className="mt-1 text-text-low"
                                        >
                                            {counts?.insights
                                                ? copy.you.insightsCount(counts.insights)
                                                : copy.you.insightsEmpty}
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
                        className="mt-10"
                    >
                        <SectionLabel>
                            {copy.you.journeySection}
                        </SectionLabel>

                        <View className="border-t border-border">
                            <MenuItem
                                icon={SparklesIcon}
                                title={copy.you.patternsTitle}
                                description={copy.you.patternsDescription}
                                onPress={() =>
                                    navigation.navigate("YourData", {
                                        screen: "Patterns",
                                    })
                                }
                            />

                            <View className="h-px bg-border" />

                            <MenuItem
                                icon={Target01Icon}
                                title={copy.you.experimentsTitle}
                                description={copy.you.experimentsDescription}
                                onPress={() =>
                                    navigation.navigate("YourData", {
                                        screen: "Experiments",
                                    })
                                }
                            />

                            <View className="h-px bg-border" />

                            <MenuItem
                                icon={Database01Icon}
                                title={copy.you.yourDataTitle}
                                description={copy.you.yourDataDescription}
                                onPress={() => navigation.navigate("YourData")}
                            />
                        </View>
                    </Animated.View>

                    <Animated.View
                        className="mt-10"
                    >
                        <SectionLabel>
                            {copy.you.preferencesSection}
                        </SectionLabel>

                        <View className="border-t border-border">
                            <MenuItem
                                icon={BellIcon}
                                title={copy.you.notificationsTitle}
                                description={copy.you.notificationsDescription}
                                onPress={() => navigation.navigate("Notifications")}
                            />

                            <View className="h-px bg-border" />

                            <MenuItem
                                icon={Moon02Icon}
                                title={copy.you.appearanceTitle}
                                description={copy.you.appearanceDescription}
                                onPress={() => navigation.navigate("Appearance")}
                            />

                            <View className="h-px bg-border" />

                            <MenuItem
                                icon={LockIcon}
                                title={copy.you.privacyTitle}
                                description={copy.you.privacyDescription}
                                onPress={() => navigation.navigate("Privacy")}
                            />
                        </View>
                    </Animated.View>

                    <Animated.View
                        className="mt-10"
                    >
                        <SectionLabel>
                            {copy.you.supportSection}
                        </SectionLabel>

                        <View className="border-t border-border">
                            <MenuItem
                                icon={HelpCircleIcon}
                                title={copy.you.helpTitle}
                                onPress={() => navigation.navigate("HelpFeedback")}
                            />
                        </View>
                    </Animated.View>

                    <Animated.View
                        className="mt-10 items-center"
                    >
                        <AppText
                            variant="caption"
                            className="text-text-low"
                        >
                            {copy.brand.name}
                        </AppText>

                        <AppText
                            variant="caption"
                            className="mt-1 text-text-disabled"
                        >
                            {copy.brand.tagline}
                        </AppText>
                    </Animated.View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}
