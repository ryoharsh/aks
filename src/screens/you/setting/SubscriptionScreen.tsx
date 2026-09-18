import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    ArrowLeft01Icon,
    CreditCardIcon,
    CrownIcon,
    ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import AppText from "@/components/ui/Text";
import { useSubscription } from "@/hooks/useSubscription";
import { formatDate } from "@/lib/date";
import type { SettingsStackParamList } from "@/navigation/routes";
import { SUBSCRIPTION_DISPLAY_NAME } from "@/services/subscription/subscription.constants";
import type { SubscriptionOption } from "@/services/subscription/subscription.types";

type Props = NativeStackScreenProps<SettingsStackParamList, "Subscription">;

function PremiumCard() {
    const { state, busy, restore, manage } = useSubscription();
    const plan = state.plan;
    if (!state.isActive) {
        return null;
    }
    return (
        <Animated.View
            entering={FadeInUp.duration(450).delay(200)}
            className="mt-9 rounded-[28px] border border-border bg-surface p-5"
        >
            <View className="flex-row items-center">
                <View className="size-11 items-center justify-center rounded-2xl bg-success-soft">
                    <HugeiconsIcon
                        icon={CrownIcon}
                        size={21}
                        color="#4F806B"
                    />
                </View>
                <View className="ml-4 flex-1">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">
                        CURRENT PLAN
                    </AppText>
                    <AppText variant="title" className="mt-1 text-text-high">
                        {SUBSCRIPTION_DISPLAY_NAME}
                    </AppText>
                </View>
                <View className="rounded-full bg-success-soft px-3 py-1">
                    <AppText variant="caption" className="text-success">
                        Active
                    </AppText>
                </View>
            </View>

            <View className="mt-5 rounded-2xl bg-background px-4 py-3">
                {state.status === "active" ? (
                    <AppText className="text-text-medium">
                        {plan?.expiresAt
                            ? `Your plan renews on ${formatDate(plan.expiresAt)}.`
                            : "Your plan is active."}
                    </AppText>
                ) : (
                    <AppText className="text-text-medium">
                        {plan?.expiresAt
                            ? `Access continues until ${formatDate(plan.expiresAt)}.`
                            : "You've turned off auto-renewal."}
                    </AppText>
                )}
            </View>

            <Button variant="secondary" disabled={busy} onPress={() => void manage()} className="mt-5">
                <AppText variant="button" className="text-text-high">
                    Manage subscription
                </AppText>
            </Button>
            <Button variant="ghost" disabled={busy} onPress={() => void restore()} className="mt-2">
                <AppText variant="button" className="text-text-medium">
                    Restore purchases
                </AppText>
            </Button>
        </Animated.View>
    );
}

function PlansCard() {
    const { state, busy, purchase, restore, refresh } = useSubscription();
    const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);

    if (state.status !== "free" && state.status !== "expired") {
        return null;
    }

    const handleSubscribe = async (option: SubscriptionOption) => {
        setPendingOptionId(option.identifier);
        await purchase(option);
        setPendingOptionId(null);
    };

    return (
        <View className="mt-9">
            {state.status === "expired" && (
                <Animated.View
                    entering={FadeInUp.duration(450).delay(170)}
                    className="mb-5 rounded-[24px] border border-border bg-surface px-5 py-4"
                >
                    <AppText className="text-text-medium">
                        {state.plan?.expiresAt
                            ? `Your Premium access ended on ${formatDate(state.plan.expiresAt)}.`
                            : "Your Premium access has ended."}
                    </AppText>
                </Animated.View>
            )}

            {state.options.length === 0 ? (
                <Animated.View
                    entering={FadeInUp.duration(450).delay(200)}
                    className="items-center rounded-[24px] border border-border bg-surface px-5 py-8"
                >
                    <HugeiconsIcon
                        icon={ShieldCheckIcon}
                        size={22}
                        color="#737373"
                    />
                    <AppText className="mt-3 text-center text-text-medium">
                        Plans aren't listed right now. Please check back in a moment.
                    </AppText>
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onPress={() => void refresh()}
                        className="mt-5"
                    >
                        <AppText variant="button" className="text-text-high">
                            Try again
                        </AppText>
                    </Button>
                </Animated.View>
            ) : (
                state.options.map((option, index) => (
                    <Animated.View
                        key={option.identifier}
                        entering={FadeInUp.duration(450).delay(200 + index * 70)}
                        className="mb-4 rounded-[24px] border border-border bg-surface p-5"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-4">
                                <AppText className="text-[18px] font-semibold leading-[24px] text-text-high">
                                    {option.title}
                                </AppText>
                                {option.periodText && (
                                    <AppText className="mt-1 text-text-medium">
                                        {option.periodText}
                                    </AppText>
                                )}
                            </View>
                            <AppText className="text-[18px] font-semibold leading-[24px] text-text-high">
                                {option.priceText}
                            </AppText>
                        </View>
                        <Button
                            loading={busy && pendingOptionId === option.identifier}
                            disabled={busy}
                            onPress={() => void handleSubscribe(option)}
                            className="mt-5"
                        >
                            <AppText variant="button" className="text-primary-foreground">
                                Subscribe
                            </AppText>
                        </Button>
                    </Animated.View>
                ))
            )}

            <Button variant="ghost" disabled={busy} onPress={() => void restore()} className="mt-1">
                <AppText variant="button" className="text-text-medium">
                    Restore purchases
                </AppText>
            </Button>
        </View>
    );
}

export default function SubscriptionScreen({ navigation }: Props) {
    const { state, notice, refresh, busy } = useSubscription();
    const iconColor = useResolveClassNames("text-text-medium").color;

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const loading = state.status === "unknown" || state.status === "loading";

    return (
        <View className="flex-1 bg-background">
            <Animated.View
                entering={FadeInUp.duration(400)}
                className="h-16 flex-row items-center px-5"
            >
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        size={22}
                        color={iconColor}
                    />
                </IconButton>
                <AppText variant="title" className="text-text-high">
                    Subscription
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
                        YOUR PLAN
                    </AppText>
                    <AppText variant="display" className="text-text-high">
                        Choose how you want to use Aks.
                    </AppText>
                    <AppText className="mt-3 leading-6 text-text-low">
                        Your plan and billing status live here. Billing is handled
                        by your device's store, so nothing is ever lost between
                        devices.
                    </AppText>
                </Animated.View>

                {notice && state.status !== "error" && (
                    <Animated.View
                        entering={FadeInUp.duration(400).delay(120)}
                        className="mt-5 rounded-[20px] border border-border bg-surface px-5 py-4"
                    >
                        <AppText className="text-text-medium">{notice}</AppText>
                    </Animated.View>
                )}

                {loading && (
                    <Animated.View
                        entering={FadeInUp.duration(450).delay(200)}
                        className="mt-9 items-center rounded-[28px] border border-border bg-surface px-5 py-10"
                    >
                        <ActivityIndicator size="small" color="#737373" />
                        <AppText className="mt-3 text-text-medium">
                            Checking your plan…
                        </AppText>
                    </Animated.View>
                )}

                {state.status === "error" && (
                    <Animated.View
                        entering={FadeInUp.duration(450).delay(200)}
                        className="mt-9 rounded-[28px] border border-border bg-surface px-5 py-8"
                    >
                        <AppText className="text-text-medium">
                            {notice ??
                                "We couldn't check your plan. Please try again."}
                        </AppText>
                        <Button
                            variant="secondary"
                            disabled={busy}
                            onPress={() => void refresh()}
                            className="mt-5"
                        >
                            <AppText variant="button" className="text-text-high">
                                Try again
                            </AppText>
                        </Button>
                    </Animated.View>
                )}

                {state.status === "unavailable" && (
                    <Animated.View
                        entering={FadeInUp.duration(450).delay(200)}
                        className="mt-9 rounded-[28px] border border-border bg-surface px-5 py-8"
                    >
                        <View className="size-11 items-center justify-center rounded-2xl bg-background">
                            <HugeiconsIcon
                                icon={CreditCardIcon}
                                size={21}
                                color={iconColor}
                            />
                        </View>
                        <AppText variant="title" className="mt-4 text-[18px] leading-[24px] text-text-high">
                            Subscriptions aren't connected on this device yet.
                        </AppText>
                        <AppText className="mt-2 text-text-medium">
                            Once billing is available on this device, plans will
                            appear here and you can review or manage them from
                            this screen.
                        </AppText>
                    </Animated.View>
                )}

                <PremiumCard />

                <PlansCard />

                <Animated.View
                    entering={FadeInUp.duration(450).delay(280)}
                    className="mt-6 rounded-[28px] border border-border bg-surface p-5"
                >
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">
                        A NOTE FROM AKS
                    </AppText>
                    <AppText className="mt-3 leading-6 text-text-low">
                        Payments are handled entirely by your device's store, and
                        Aks never stores your payment details. Purchases can be
                        restored and managed from this screen at any time.
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}