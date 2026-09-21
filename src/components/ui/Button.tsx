import React, { PropsWithChildren } from "react";
import {
    ActivityIndicator,
    Pressable,
    type PressableProps,
    View,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { useResolveClassNames } from "uniwind";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = PropsWithChildren<
    PressableProps & {
        variant?: ButtonVariant;
        loading?: boolean;
        className?: string;
    }
>;

const AnimatedPressable =
    Animated.createAnimatedComponent(Pressable);

const containerVariants: Record<ButtonVariant, string> = {
    primary: "bg-primary",
    secondary: "bg-accent-soft",
    ghost: "bg-transparent",
};

export default function Button({
    children,
    variant = "primary",
    loading = false,
    disabled = false,
    className,
    onPressIn,
    onPressOut,
    ...props
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const foregroundColor = useResolveClassNames("text-primary-foreground").color;

    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: scale.value,
            },
        ],
    }));

    const handlePressIn = (
        event: Parameters<
            NonNullable<PressableProps["onPressIn"]>
        >[0],
    ) => {
        if (isDisabled) return;

        scale.value = withTiming(0.97, {
            duration: 100,
            easing: Easing.out(Easing.cubic),
        });

        onPressIn?.(event);
    };

    const handlePressOut = (
        event: Parameters<
            NonNullable<PressableProps["onPressOut"]>
        >[0],
    ) => {
        if (isDisabled) return;

        scale.value = withTiming(1, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
        });

        onPressOut?.(event);
    };

    return (
        <AnimatedPressable
            {...props}
            disabled={isDisabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={animatedStyle}
            className={cn(
                "min-h-13 flex-row items-center justify-center rounded-2xl px-5",
                containerVariants[variant],
                isDisabled && "opacity-50",
                className,
            )}
        >
            {loading ? (
                <ActivityIndicator
                    color={foregroundColor}
                />
            ) : (
                <View className="flex-row items-center justify-center">
                    {children}
                </View>
            )}
        </AnimatedPressable>
    );
}