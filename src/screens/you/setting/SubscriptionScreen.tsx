import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    ArrowLeft01Icon,
    CheckmarkCircle02Icon,
    CreditCardIcon,
    CrownIcon,
    ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Animated, {
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import AppText from "@/components/ui/Text";
import { useSubscription } from "@/hooks/useSubscription";
import { formatDate } from "@/lib/date";
import type {
    RootStackParamList,
    SettingsStackParamList,
} from "@/navigation/routes";
import { SUBSCRIPTION_DISPLAY_NAME } from "@/services/subscription/subscription.constants";
import type { SubscriptionOption } from "@/services/subscription/subscription.types";
import { copy } from "@/constants/copy";

// Rendered both inside Settings and as the root-level access gate
// (`SubscriptionRequired`); only `goBack`/`canGoBack` are used.
type Props =
    | NativeStackScreenProps<SettingsStackParamList, "Subscription">
    | NativeStackScreenProps<RootStackParamList, "SubscriptionRequired">;

/* -------------------------------------------------------------------------- */
/* Current subscription                                                       */
/* -------------------------------------------------------------------------- */

function PremiumCard() {
    const { state, busy, restore, manage } = useSubscription();

    const plan = state.plan;

    if (!state.isActive) {
        return null;
    }

    return (
        <Animated.View
            entering={FadeInUp.duration(450).delay(180)}
            className="mt-9 overflow-hidden rounded-[28px] border border-border bg-surface"
        >
            {/* Current plan */}
            <View className="flex-row items-center px-5 py-5">
                <View className="size-12 items-center justify-center rounded-2xl bg-background">
                    <HugeiconsIcon
                        icon={CrownIcon}
                        size={22}
                        color="#737373"
                    />
                </View>

                <View className="ml-4 flex-1">
                    <AppText
                        variant="caption"
                        className="tracking-[1.5px] text-text-low"
                    >
                        {copy.subscription.currentPlan}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-1 text-text-high"
                    >
                        {SUBSCRIPTION_DISPLAY_NAME}
                    </AppText>
                </View>

                <View className="rounded-full bg-background px-3 py-1.5">
                    <AppText
                        variant="caption"
                        className="text-text-medium"
                    >
                        {copy.subscription.activeBadge}
                    </AppText>
                </View>
            </View>

            {/* Divider */}
            <View className="h-px bg-border" />

            {/* Billing */}
            <View className="flex-row items-center px-5 py-5">
                <View className="size-12 items-center justify-center rounded-2xl bg-background">
                    <HugeiconsIcon
                        icon={CreditCardIcon}
                        size={22}
                        color="#737373"
                    />
                </View>

                <View className="ml-4 flex-1">
                    <AppText
                        variant="caption"
                        className="tracking-[1.5px] text-text-low"
                    >
                        {copy.subscription.billing}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-1 text-[17px] leading-[23px] text-text-high"
                    >
                        {state.status === "active"
                            ? plan?.expiresAt
                                ? copy.subscription.renewsOn(formatDate(plan.expiresAt))
                                : copy.subscription.planActive
                            : plan?.expiresAt
                                ? copy.subscription.accessUntil(formatDate(plan.expiresAt))
                                : copy.subscription.autoRenewOff}
                    </AppText>
                </View>
            </View>

            {/* Actions */}
            <View className="border-t border-border px-5 py-4">
                <Button
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void manage()}
                >
                    <AppText
                        variant="button"
                        className="text-text-high"
                    >
                        {copy.subscription.manage}
                    </AppText>
                </Button>

                <Button
                    variant="ghost"
                    disabled={busy}
                    onPress={() => void restore()}
                    className="mt-1"
                >
                    <AppText
                        variant="button"
                        className="text-text-medium"
                    >
                        {copy.subscription.restore}
                    </AppText>
                </Button>
            </View>
        </Animated.View>
    );
}

/* -------------------------------------------------------------------------- */
/* Subscription plan card                                                    */
/* -------------------------------------------------------------------------- */

function PlanCard({
    option,
    index,
    busy,
    pending,
    onSubscribe,
}: {
    option: SubscriptionOption;
    index: number;
    busy: boolean;
    pending: boolean;
    onSubscribe: () => void;
}) {
    const isYearly =
        option.identifier.toLowerCase().includes("year") ||
        option.title.toLowerCase().includes("year") ||
        option.periodText?.toLowerCase().includes("year");

    return (
        <Animated.View
            entering={FadeInUp.duration(450).delay(180 + index * 80)}
            className="mb-4 overflow-hidden rounded-[28px] border border-border bg-surface"
        >
            {/* Optional yearly highlight */}
            {isYearly ? (
                <View className="bg-background px-5 py-2.5">
                    <AppText
                        variant="caption"
                        className="tracking-[1.3px] text-text-medium"
                    >
                        {copy.subscription.bestValue}
                    </AppText>
                </View>
            ) : null}

            <View className="p-5">
                <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-5">
                        <AppText
                            variant="caption"
                            className="tracking-[1.5px] text-text-low"
                        >
                            {copy.subscription.premiumEyebrow}
                        </AppText>

                        <AppText
                            variant="title"
                            className="mt-1 text-text-high"
                        >
                            {option.title}
                        </AppText>

                        {option.periodText ? (
                            <AppText className="mt-1 text-text-medium">
                                {option.periodText}
                            </AppText>
                        ) : null}
                    </View>

                    <View className="items-end">
                        <AppText
                            className="text-[22px] font-semibold leading-[28px] text-text-high"
                        >
                            {option.priceText}
                        </AppText>
                    </View>
                </View>

                {/* Feature feeling / value row */}
                <View className="mt-5 rounded-2xl bg-background px-4 py-3">
                    <View className="flex-row items-center">
                        <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            size={17}
                            color="#737373"
                        />

                        <AppText className="ml-2 flex-1 text-text-medium">
                            {copy.subscription.premiumAccess}
                        </AppText>
                    </View>
                </View>

                <Button
                    loading={pending}
                    disabled={busy}
                    onPress={onSubscribe}
                    className="mt-5"
                >
                    <AppText
                        variant="button"
                        className="text-primary-foreground"
                    >
                        {copy.subscription.continueWith(option.title)}
                    </AppText>
                </Button>
            </View>
        </Animated.View>
    );
}

/* -------------------------------------------------------------------------- */
/* Plans                                                                      */
/* -------------------------------------------------------------------------- */

function PlansCard() {
    const { state, busy, purchase, restore, refresh } =
        useSubscription();

    const [pendingOptionId, setPendingOptionId] =
        useState<string | null>(null);

    const handleSubscribe = useCallback(
        async (option: SubscriptionOption) => {
            setPendingOptionId(option.identifier);

            try {
                await purchase(option);
            } finally {
                setPendingOptionId(null);
            }
        },
        [purchase],
    );

    if (
        state.status !== "free" &&
        state.status !== "expired"
    ) {
        return null;
    }

    return (
        <View className="mt-9">
            {/* Section heading */}
            <Animated.View
                entering={FadeInDown.duration(450).delay(120)}
                className="mb-5"
            >
                <AppText
                    variant="caption"
                    className="tracking-[1.5px] text-text-low"
                >
                    {copy.subscription.choosePlan}
                </AppText>

                <AppText
                    variant="title"
                    className="mt-2 text-text-high"
                >
                    {copy.subscription.chooseTitle}
                </AppText>

                <AppText className="mt-2 leading-6 text-text-low">
                    {copy.subscription.chooseDescription}
                </AppText>
            </Animated.View>

            {/* Expired notice */}
            {state.status === "expired" ? (
                <Animated.View
                    entering={FadeInUp.duration(400)}
                    className="mb-5 rounded-[24px] border border-border bg-surface px-5 py-4"
                >
                    <AppText className="text-text-medium">
                        {state.plan?.expiresAt
                            ? copy.subscription.expiredWithDate(formatDate(state.plan.expiresAt))
                            : copy.subscription.expiredFallback}
                    </AppText>
                </Animated.View>
            ) : null}

            {/* Plans unavailable */}
            {state.options.length === 0 ? (
                <Animated.View
                    entering={FadeInUp.duration(450).delay(180)}
                    className="items-center rounded-[28px] border border-border bg-surface px-5 py-9"
                >
                    <View className="size-12 items-center justify-center rounded-2xl bg-background">
                        <HugeiconsIcon
                            icon={ShieldCheckIcon}
                            size={22}
                            color="#737373"
                        />
                    </View>

                    <AppText className="mt-4 text-center text-text-medium">
                        {copy.subscription.plansEmpty}
                    </AppText>

                    <Button
                        variant="secondary"
                        disabled={busy}
                        onPress={() => void refresh()}
                        className="mt-5"
                    >
                        <AppText
                            variant="button"
                            className="text-text-high"
                        >
                            {copy.common.tryAgain}
                        </AppText>
                    </Button>
                </Animated.View>
            ) : (
                state.options.map((option, index) => (
                    <PlanCard
                        key={option.identifier}
                        option={option}
                        index={index}
                        busy={busy}
                        pending={
                            busy &&
                            pendingOptionId === option.identifier
                        }
                        onSubscribe={() =>
                            void handleSubscribe(option)
                        }
                    />
                ))
            )}

            <Button
                variant="ghost"
                disabled={busy}
                onPress={() => void restore()}
                className="mt-1"
            >
                <AppText
                    variant="button"
                    className="text-text-medium"
                >
                    {copy.subscription.restore}
                </AppText>
            </Button>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function SubscriptionScreen({
    navigation,
}: Props) {
    const { state, notice, refresh, busy } =
        useSubscription();

    const iconColor =
        useResolveClassNames("text-text-medium").color;
    // No back navigation when this screen is the root-level access gate.
    const canGoBack = navigation.canGoBack();

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const loading =
        state.status === "unknown" ||
        state.status === "loading";

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <Animated.View
                entering={FadeInUp.duration(400)}
                className="h-16 flex-row items-center px-5"
            >
                {canGoBack ? (
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
                ) : null}

                <AppText
                    variant="title"
                    className="text-text-high"
                >
                    {copy.subscription.header}
                </AppText>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-5 pb-28"
            >
                {/* Hero */}
                <Animated.View
                    entering={FadeInDown.duration(500).delay(80)}
                    className="mt-5"
                >
                    <AppText
                        variant="caption"
                        className="mb-2 tracking-[1.5px] text-text-low"
                    >
                        {copy.subscription.eyebrow}
                    </AppText>

                    <AppText
                        variant="display"
                        className="text-text-high"
                    >
                        {copy.subscription.title}
                    </AppText>

                    <AppText className="mt-3 leading-6 text-text-low">
                        {copy.subscription.description}
                    </AppText>
                </Animated.View>

                {/* Notice */}
                {notice && state.status !== "error" ? (
                    <Animated.View
                        entering={FadeInUp.duration(400).delay(120)}
                        className="mt-5 rounded-[22px] border border-border bg-surface px-5 py-4"
                    >
                        <AppText className="text-text-medium">
                            {notice}
                        </AppText>
                    </Animated.View>
                ) : null}

                {/* Loading */}
                {loading ? (
                    <Animated.View
                        entering={FadeInUp.duration(450).delay(180)}
                        className="mt-9 items-center rounded-[28px] border border-border bg-surface px-5 py-10"
                    >
                        <ActivityIndicator
                            size="small"
                            color="#737373"
                        />

                        <AppText className="mt-3 text-text-medium">
                            {copy.subscription.checkingPlan}
                        </AppText>
                    </Animated.View>
                ) : null}

                {/* Error */}
                {state.status === "error" ? (
                    <Animated.View
                        entering={FadeInUp.duration(450).delay(180)}
                        className="mt-9 rounded-[28px] border border-border bg-surface px-5 py-7"
                    >
                        <AppText className="text-text-medium">
                            {notice ??
                                copy.subscription.fallbackError}
                        </AppText>

                        <Button
                            variant="secondary"
                            disabled={busy}
                            onPress={() => void refresh()}
                            className="mt-5"
                        >
                            <AppText
                                variant="button"
                                className="text-text-high"
                            >
                                {copy.common.tryAgain}
                            </AppText>
                        </Button>
                    </Animated.View>
                ) : null}

                {/* Store unavailable */}
                {state.status === "unavailable" ? (
                    <Animated.View
                        entering={FadeInUp.duration(450).delay(180)}
                        className="mt-9 rounded-[28px] border border-border bg-surface p-5"
                    >
                        <View className="size-12 items-center justify-center rounded-2xl bg-background">
                            <HugeiconsIcon
                                icon={CreditCardIcon}
                                size={22}
                                color={iconColor}
                            />
                        </View>

                        <AppText
                            variant="title"
                            className="mt-4 text-[19px] leading-[25px] text-text-high"
                        >
                            {copy.subscription.unavailableTitle}
                        </AppText>

                        <AppText className="mt-2 leading-6 text-text-medium">
                            {copy.subscription.unavailableBody}
                        </AppText>
                    </Animated.View>
                ) : null}

                {/* Active subscription */}
                <PremiumCard />

                {/* Free / expired subscription plans */}
                <PlansCard />

                {/* Aks note */}
                <Animated.View
                    entering={FadeInUp.duration(450).delay(300)}
                    className="mt-6 rounded-[28px] border border-border bg-surface p-5"
                >
                    <AppText
                        variant="caption"
                        className="tracking-[1.5px] text-text-low"
                    >
                        {copy.subscription.noteCaption}
                    </AppText>

                    <AppText className="mt-3 leading-6 text-text-low">
                        {copy.subscription.noteBody}
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}