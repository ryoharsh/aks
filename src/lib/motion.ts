import { Easing, useReducedMotion, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";

/**
 * Calm project-wide motion tokens: fast, soft, no bounce. New motion should
 * reuse these instead of inventing durations/easings per screen.
 */
export const MOTION = {
    /** Single fade/slide entrance (rows, footers, cards). */
    enterMs: 260,
    /** Faster entrance for inline state swaps (streaming start, errors). */
    enterFastMs: 180,
    /** Press feedback, matching the existing IconButton language. */
    pressInMs: 100,
    pressOutMs: 180,
    pressScale: 0.96,
    /** Gentle loading pulse cycle. */
    pulseMs: 900,
} as const;

export function useCalmMotion() {
    const reduceMotion = useReducedMotion();
    return {
        reduceMotion,
        /** Pass an entering animation through, or drop it when the user prefers reduced motion. */
        entering: <T,>(animation: T): T | undefined => (reduceMotion ? undefined : animation),
    };
}

/**
 * Infinite soft pulse on a shared value. If the Reanimated repeat factory is
 * unavailable in the running bundle (seen once as `withRepeat` resolving to
 * undefined and crashing the mic press), it degrades to a single settle
 * instead of throwing — the UI stays alive, just without the loop.
 */
export function startPulse(
    value: SharedValue<number>,
    target: number,
    duration: number = MOTION.pulseMs,
    easing: (value: number) => number = Easing.out(Easing.cubic),
) {
    if (typeof withRepeat === "function") {
        value.value = withRepeat(
            withTiming(target, { duration, easing }),
            -1,
            true,
        );
        return;
    }
    value.value = withTiming(target, { duration, easing });
}
