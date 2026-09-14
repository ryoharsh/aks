import React from "react";
import {
    Pressable,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";

const AnimatedPressable =
    Animated.createAnimatedComponent(Pressable);

type IconButtonProps = Omit<PressableProps, "style"> & {
    children: React.ReactNode;
    className?: string;
    style?: StyleProp<ViewStyle>;
    rippleColor?: string;
};

export default function IconButton({
    children,
    className,
    style,
    rippleColor = "rgba(0, 0, 0, 0.08)",
    disabled = false,
    onPressIn,
    onPressOut,
    ...props
}: IconButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: scale.value,
            },
        ],
    }));

    const handlePressIn = (
        event: Parameters<NonNullable<PressableProps["onPressIn"]>>[0],
    ) => {
        if (disabled) return;

        scale.value = withTiming(0.9, {
            duration: 100,
            easing: Easing.out(Easing.cubic),
        });

        onPressIn?.(event);
    };

    const handlePressOut = (
        event: Parameters<NonNullable<PressableProps["onPressOut"]>>[0],
    ) => {
        if (disabled) return;

        scale.value = withTiming(1, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
        });

        onPressOut?.(event);
    };

    return (
        <AnimatedPressable
            {...props}
            disabled={disabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{
                color: rippleColor,
                borderless: false,
                foreground: true,
            }}
            style={[animatedStyle, style]}
            className={cn(
                "h-11 w-11 items-center justify-center rounded-full",
                disabled && "opacity-50",
                className,
            )}
        >
            {children}
        </AnimatedPressable>
    );
}