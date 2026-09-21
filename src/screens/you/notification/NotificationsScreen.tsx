import { useState } from "react";
import { Linking, Pressable, ScrollView, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    BellIcon,
    BulbIcon,
    Calendar03Icon,
    ChartLineData01Icon,
    Clock01Icon,
    Moon02Icon,
    Settings01Icon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { NotificationCategoryKey } from "@/services/preferences.service";
import type { YouStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YouStackParamList, "Notifications">;

type NotificationKey = NotificationCategoryKey;

type NotificationSettings = Record<NotificationKey, boolean>;

type NotificationItem = {
    key: NotificationKey;
    icon: IconSvgElement;
    title: string;
    description: string;
};

const notificationItems: NotificationItem[] = [
    {
        key: "insights",
        icon: BulbIcon,
        title: copy.notifications.categories.insightsTitle,
        description: copy.notifications.categories.insightsDescription,
    },
    {
        key: "experiments",
        icon: ChartLineData01Icon,
        title: copy.notifications.categories.experimentsTitle,
        description: copy.notifications.categories.experimentsDescription,
    },
    {
        key: "checkIns",
        icon: Clock01Icon,
        title: copy.notifications.categories.checkInsTitle,
        description: copy.notifications.categories.checkInsDescription,
    },
    {
        key: "weekly",
        icon: Calendar03Icon,
        title: copy.notifications.categories.weeklyTitle,
        description: copy.notifications.categories.weeklyDescription,
    },
];

export default function NotificationsScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();
    const { notice } = useBottomSheet();

    const enabled = preferences.notificationsEnabled;
    const quietHours = preferences.quietHoursEnabled;
    const settings: NotificationSettings = preferences.notificationCategories;

    const iconColor = useResolveClassNames("text-text-medium").color;
    const activeColor = useResolveClassNames("text-primary").color;

    // The switches are controlled by context state, so a failed persist can
    // never leave a toggle visually enabled — the value snaps back. The
    // catch surfaces the failure instead of an unhandled rejection.
    const persist = (patch: Parameters<typeof updatePreferences>[0]) => {
        void updatePreferences(patch).catch(() => {
            notice(copy.common.pleaseTryAgain, copy.common.checkConnection);
        });
    };

    const updateSetting = (
        key: NotificationKey,
        value: boolean
    ) => {
        persist({
            notificationCategories: { ...settings, [key]: value },
        });
    };

    const setEnabled = (value: boolean) => {
        persist({ notificationsEnabled: value });
    };

    const setQuietHours = (value: boolean) => {
        persist({ quietHoursEnabled: value });
    };

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
                    {copy.notifications.header}
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
                        {copy.notifications.eyebrow}
                    </AppText>

                    <AppText
                        variant="display"
                        className="text-text-high"
                    >
                        {copy.notifications.title}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6 text-text-low"
                    >
                        {copy.notifications.description}
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
                        {copy.notifications.sectionMain}
                    </AppText>

                    <View className="rounded-[28px] border border-border bg-surface p-5">
                        <View className="flex-row items-center">
                            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                <HugeiconsIcon
                                    icon={BellIcon}
                                    size={21}
                                    color={iconColor}
                                />
                            </View>

                            <View className="flex-1 pr-4">
                                <AppText
                                    variant="button"
                                    className="text-text-high"
                                >
                                    {copy.notifications.allowTitle}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    className="mt-1 text-text-low"
                                >
                                    {copy.notifications.allowDescription}
                                </AppText>
                            </View>

                            <Switch
                                value={enabled}
                                onValueChange={setEnabled}
                                trackColor={{
                                    false: "#D4D4D4",
                                    true: activeColor,
                                }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(220)}
                    className="mt-9"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 tracking-[1.5px] text-text-low"
                    >
                        {copy.notifications.categoriesSection}
                    </AppText>

                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        {notificationItems.map((item, index) => (
                            <View
                                key={item.key}
                                className={`flex-row items-center px-5 py-5 ${index < notificationItems.length - 1
                                        ? "border-b border-border"
                                        : ""
                                    } ${!enabled ? "opacity-50" : ""}`}
                            >
                                <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                    <HugeiconsIcon
                                        icon={item.icon}
                                        size={21}
                                        color={iconColor}
                                    />
                                </View>

                                <View className="flex-1 pr-4">
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        {item.title}
                                    </AppText>

                                    <AppText
                                        variant="caption"
                                        className="mt-1 text-text-low"
                                    >
                                        {item.description}
                                    </AppText>
                                </View>

                                <Switch
                                    value={settings[item.key]}
                                    onValueChange={(value) =>
                                        updateSetting(item.key, value)
                                    }
                                    disabled={!enabled}
                                    trackColor={{
                                        false: "#D4D4D4",
                                        true: activeColor,
                                    }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                        ))}
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(280)}
                    className="mt-9"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 tracking-[1.5px] text-text-low"
                    >
                        {copy.notifications.quietSection}
                    </AppText>

                    <Pressable
                        onPress={() =>
                            enabled &&
                            setQuietHours(!quietHours)
                        }
                        disabled={!enabled}
                        className={`flex-row items-center rounded-[28px] border border-border bg-surface p-5 ${!enabled ? "opacity-50" : ""
                            }`}
                    >
                        <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                            <HugeiconsIcon
                                icon={Moon02Icon}
                                size={21}
                                color={iconColor}
                            />
                        </View>

                        <View className="flex-1 pr-4">
                            <AppText
                                variant="button"
                                className="text-text-high"
                            >
                                {copy.notifications.quietTitle}
                            </AppText>

                            <AppText
                                variant="caption"
                                className="mt-1 text-text-low"
                            >
                                {copy.notifications.quietDescription}
                            </AppText>
                        </View>

                        <Switch
                            value={quietHours}
                            onValueChange={setQuietHours}
                            disabled={!enabled}
                            trackColor={{
                                false: "#D4D4D4",
                                true: activeColor,
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(340)}
                    className="mt-9"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 tracking-[1.5px] text-text-low"
                    >
                        {copy.notifications.deviceSection}
                    </AppText>

                    <Pressable
                        onPress={() => Linking.openSettings()}
                        className="flex-row items-center rounded-[28px] border border-border bg-surface p-5 active:opacity-80"
                        android_ripple={{
                            color: activeColor,
                        }}
                    >
                        <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                            <HugeiconsIcon
                                icon={Settings01Icon}
                                size={21}
                                color={iconColor}
                            />
                        </View>

                        <View className="flex-1 pr-4">
                            <AppText
                                variant="button"
                                className="text-text-high"
                            >
                                {copy.notifications.deviceTitle}
                            </AppText>

                            <AppText
                                variant="caption"
                                className="mt-1 text-text-low"
                            >
                                {copy.notifications.deviceDescription}
                            </AppText>
                        </View>

                        <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            size={19}
                            color={iconColor}
                        />
                    </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(460)}
                    className="mt-6 rounded-[28px] border border-border bg-surface p-5"
                >
                    <AppText
                        variant="caption"
                        className="tracking-[1.5px] text-text-low"
                    >
                        {copy.notifications.noteCaption}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6 text-text-low"
                    >
                        {copy.notifications.noteBody}
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}