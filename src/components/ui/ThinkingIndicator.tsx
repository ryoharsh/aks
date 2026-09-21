import type { ComponentProps } from "react";
import { useEffect } from "react";
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
} from "react-native-reanimated";

import AppText from "@/components/ui/Text";
import { copy } from "@/constants/copy";
import { MOTION, startPulse } from "@/lib/motion";

type Props = {
    text?: string;
    variant?: ComponentProps<typeof AppText>["variant"];
    className?: string;
};

/**
 * Existing thinking copy with a soft UI-thread opacity pulse. Runs only while
 * mounted (the streaming block replaces it on first delta) and stays static
 * when the user prefers reduced motion. Layout, text, and style are unchanged.
 */
export default function ThinkingIndicator({
    text = copy.aiConversation.thinkingDefault,
    variant,
    className,
}: Props) {
    const reduceMotion = useReducedMotion();
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (reduceMotion) {
            opacity.value = 1;
            return;
        }
        startPulse(opacity, 0.45, MOTION.pulseMs);
        return () => cancelAnimation(opacity);
    }, [opacity, reduceMotion]);

    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={style}>
            <AppText variant={variant} className={className}>
                {text}
            </AppText>
        </Animated.View>
    );
}
