import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export default function AnimatedAmbientBackground({
    active = true,
    fadeIn = false,
}: {
    /** Pause the gradient motion when the screen is not settled/focused. */
    active?: boolean;
    /** Fade the layer in from opacity 0 when first mounted (smooth entry). */
    fadeIn?: boolean;
} = {}) {
    const p1 = useSharedValue(0);
    const p2 = useSharedValue(0);
    const p3 = useSharedValue(0);
    const p4 = useSharedValue(0);

    useEffect(() => {
        if (!active) return;
        p1.value = withRepeat(
            withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
        p2.value = withRepeat(
            withTiming(1, { duration: 23000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
        p3.value = withRepeat(
            withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
        p4.value = withRepeat(
            withTiming(1, { duration: 26000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );
        return () => {
            cancelAnimation(p1);
            cancelAnimation(p2);
            cancelAnimation(p3);
            cancelAnimation(p4);
        };
    }, [p1, p2, p3, p4, active]);

    const layerStyle = useAnimatedStyle(() => ({
        opacity: fadeIn ? layerOpacity.value : 1,
    }));
    const layerOpacity = useSharedValue(fadeIn ? 0 : 1);
    useEffect(() => {
        if (!fadeIn) return;
        layerOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    }, [fadeIn, layerOpacity]);

    const lerp = (t: number, a: number, b: number) => {
        "worklet";
        return a + (b - a) * t;
    };

    const firstStyle = useAnimatedStyle(() => ({
        opacity: lerp(p1.value, 0.55, 0.95),
        transform: [
            { translateX: lerp(p1.value, -140, 140) },
            { translateY: lerp(p2.value, -100, 100) },
            { rotate: `${lerp(p1.value, -25, 25)}deg` },
            { scale: lerp(p1.value, 1, 1.25) },
        ],
    }));

    const secondStyle = useAnimatedStyle(() => ({
        opacity: lerp(p2.value, 0.25, 0.65),
        transform: [
            { translateX: lerp(p2.value, 130, -130) },
            { translateY: lerp(p3.value, 110, -110) },
            { rotate: `${lerp(p2.value, 30, -30)}deg` },
            { scale: lerp(p2.value, 1.15, 1) },
        ],
    }));

    const thirdStyle = useAnimatedStyle(() => ({
        opacity: lerp(p3.value, 0.15, 0.5),
        transform: [
            { translateX: lerp(p3.value, -100, 100) },
            { translateY: lerp(p4.value, 130, -130) },
            { rotate: `${lerp(p3.value, 15, -35)}deg` },
            { scale: lerp(p3.value, 1, 1.2) },
        ],
    }));

    const fourthStyle = useAnimatedStyle(() => ({
        opacity: lerp(p4.value, 0.2, 0.5),
        transform: [
            { translateX: lerp(p4.value, 110, -90) },
            { translateY: lerp(p1.value, -120, 120) },
            { rotate: `${lerp(p4.value, -20, 20)}deg` },
            { scale: lerp(p4.value, 1.1, 1) },
        ],
    }));

    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, layerStyle]}>
            <View style={styles.base} />

            <AnimatedGradient
                colors={["#FFFFFF", "#FFF1E6", "#FDE8F3", "#ECE9FF", "#FFFFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradient, firstStyle]}
            />

            <AnimatedGradient
                colors={["#F0ECFF", "#FFFFFF", "#FFE8DC", "#FFDFF0", "#FFFFFF"]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.gradient, secondStyle]}
            />

            <AnimatedGradient
                colors={["#FFFFFF", "#FDE3ED", "#EAE6FF", "#FFF0DD", "#FFFFFF"]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={[styles.gradient, thirdStyle]}
            />

            <AnimatedGradient
                colors={["#E6F5FF", "#FFFFFF", "#F5E6FF", "#FFF6E0", "#FFFFFF"]}
                start={{ x: 1, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={[styles.gradient, fourthStyle]}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    base: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "#FFFFFF",
    },
    gradient: {
        position: "absolute",
        width: "260%",
        height: "260%",
        left: "-80%",
        top: "-80%",
    },
});