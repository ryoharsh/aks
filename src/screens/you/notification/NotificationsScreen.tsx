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
import { usePreferences } from "@/providers/PreferencesProvider";
import type { NotificationCategoryKey } from "@/services/preferences.service";
import type { YouStackParamList } from "@/navigation/routes";

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
        title: "New insights",
        description: "When Aks notices a meaningful pattern.",
    },
    {
        key: "experiments",
        icon: ChartLineData01Icon,
        title: "Experiment updates",
        description: "Reminders and outcomes from active experiments.",
    },
    {
        key: "checkIns",
        icon: Clock01Icon,
        title: "Check-in reminders",
        description: "A gentle prompt to reflect on your day.",
    },
    {
        key: "weekly",
        icon: Calendar03Icon,
        title: "Weekly reflection",
        description: "A summary of what changed during the week.",
    },
];

const notificationPreviews = [
    "I noticed something about yesterday.",
    "Your experiment has 2 days left.",
    "You may have learned something this week.",
];

export default function NotificationsScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();

    const enabled = preferences.notificationsEnabled;
    const quietHours = preferences.quietHoursEnabled;
    const settings: NotificationSettings = preferences.notificationCategories;

    const iconColor = useResolveClassNames("text-text-medium").color;
    const activeColor = useResolveClassNames("text-primary").color;

    const updateSetting = (
        key: NotificationKey,
        value: boolean
    ) => {
        void updatePreferences({
            notificationCategories: { ...settings, [key]: value },
        });
    };

    const setEnabled = (value: boolean) => {
        void updatePreferences({ notificationsEnabled: value });
    };

    const setQuietHours = (value: boolean) => {
        void updatePreferences({ quietHoursEnabled: value });
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
                    Notifications
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
                        STAY IN THE LOOP
                    </AppText>

                    <AppText
                        variant="display"
                        className="text-text-high"
                    >
                        Only when it matters.
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6 text-text-low"
                    >
                        Choose when Aks can reach out. You can change these
                        preferences at any time.
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
                        NOTIFICATIONS
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
                                    Allow notifications
                                </AppText>

                                <AppText
                                    variant="caption"
                                    className="mt-1 text-text-low"
                                >
                                    Pause or resume all Aks notifications.
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
                        WHAT AKS CAN SEND
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
                        QUIET HOURS
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
                                Quiet hours
                            </AppText>

                            <AppText
                                variant="caption"
                                className="mt-1 text-text-low"
                            >
                                Silence notifications from 10:00 PM to 8:00 AM.
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
                        NOTIFICATION PREVIEW
                    </AppText>

                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        {notificationPreviews.map((message, index) => (
                            <View
                                key={message}
                                className={`px-5 py-5 ${index < notificationPreviews.length - 1
                                        ? "border-b border-border"
                                        : ""
                                    }`}
                            >
                                <AppText
                                    variant="body"
                                    className="leading-6 text-text-high"
                                >
                                    “{message}”
                                </AppText>

                                <AppText
                                    variant="caption"
                                    className="mt-2 text-text-low"
                                >
                                    Aks notification
                                </AppText>
                            </View>
                        ))}
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(450).delay(400)}
                    className="mt-9"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 tracking-[1.5px] text-text-low"
                    >
                        DEVICE SETTINGS
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
                                Manage device notifications
                            </AppText>

                            <AppText
                                variant="caption"
                                className="mt-1 text-text-low"
                            >
                                Open your device settings to manage Aks
                                permissions.
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
                        A NOTE FROM AKS
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 leading-6 text-text-low"
                    >
                        Notifications should support your attention, not
                        compete for it. Aks will respect the preferences you
                        choose here.
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}