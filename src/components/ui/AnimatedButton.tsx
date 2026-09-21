import React, {
  PropsWithChildren,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AppText from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useResolveClassNames } from "uniwind";

type ButtonVariant = "filled" | "outline";

type ButtonProps = PropsWithChildren<
  PressableProps & {
    variant?: ButtonVariant;
    loading?: boolean;

    bgColor?: string;
    pressBgColor?: string;

    textColor?: string;
    pressTextColor?: string;

    borderColor?: string;
    pressBorderColor?: string;

    className?: string;
  }
>;

const AnimatedView = Animated.createAnimatedComponent(View);

export default function AnimatedButton({
  children,
  variant = "filled",
  loading = false,
  disabled = false,

  bgColor,
  pressBgColor,

  textColor,
  pressTextColor,

  borderColor,
  pressBorderColor,

  className,

  onPressIn,
  onPressOut,

  ...props
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const fillScale = useSharedValue(0);
  const fillX = useSharedValue(0);
  const fillY = useSharedValue(0);

  const isFilled = variant === "filled";

  const defaultBg = isFilled
    ? "bg-primary"
    : "bg-surface";

  const defaultPressBg = isFilled
    ? "bg-surface"
    : "bg-primary";

  const defaultText = isFilled
    ? "text-primary-foreground"
    : "text-primary";

  const defaultPressText = isFilled
    ? "text-primary"
    : "text-primary-foreground";

  const defaultBorder = "border-primary";

  const filledForeground = useResolveClassNames("text-primary-foreground").color;
  const outlineForeground = useResolveClassNames("text-primary").color;

  const handlePressIn = (event: GestureResponderEvent) => {
    if (disabled || loading) return;

    setIsPressed(true);

    const { locationX, locationY } = event.nativeEvent;

    fillX.value = locationX;
    fillY.value = locationY;

    fillScale.value = withTiming(8, {
      duration: 450,
      easing: Easing.out(Easing.cubic),
    });

    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (disabled || loading) return;

    setIsPressed(false);

    fillScale.value = withTiming(0, {
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
    });

    onPressOut?.(event);
  };

  const fillStyle = useAnimatedStyle(() => ({
    left: fillX.value - 50,
    top: fillY.value - 50,
    transform: [
      {
        scale: fillScale.value,
      },
    ],
  }));

  const resolvedTextColor = isPressed
    ? pressTextColor ?? defaultPressText
    : textColor ?? defaultText;

  const resolvedBorderColor = isPressed
    ? pressBorderColor ?? borderColor ?? defaultBorder
    : borderColor ?? defaultBorder;

  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={cn(
        "relative min-h-13 overflow-hidden rounded-2xl border px-5",
        "items-center justify-center",

        bgColor ?? defaultBg,
        resolvedBorderColor,

        disabled || loading
          ? "opacity-50"
          : "opacity-100",

        className,
      )}
    >
      {/* Expanding press layer */}
      <AnimatedView
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: 100,
            height: 100,
            borderRadius: 50,
          },
          fillStyle,
        ]}
        className={pressBgColor ?? defaultPressBg}
      />

      {/* Button content */}
      <View className="z-10 flex-row items-center justify-center">
        {loading ? (
          <ActivityIndicator
            size="small"
            color={isFilled ? filledForeground : outlineForeground}
          />
        ) : (
          <AppText
            variant="button"
            className={resolvedTextColor}
          >
            {children}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}