import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
    FadeIn,
    FadeInDown,
    ZoomIn,
} from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppLogo from "@/components/ui/AppLogo";
import AppText from "@/components/ui/Text";
import type { RootStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
    useEffect(() => {
        const timer = setTimeout(() => {
            navigation.replace("Onboarding");
        }, 2000);

        return () => clearTimeout(timer);
    }, [navigation]);

    return (
        <View className="flex-1 items-center justify-center bg-background">
            <StatusBar style="dark" />

            <View className="items-center">
                {/* Logo */}
                <Animated.View
                    entering={ZoomIn
                        .duration(700)
                        .springify()}
                >
                    <AppLogo />
                </Animated.View>

                {/* App Name */}
                <Animated.View
                    entering={FadeInDown
                        .duration(700)
                        .delay(250)}
                >
                    <AppText
                        variant="display"
                        className="-mt-4 font-satoshi-medium"
                    >
                        Aks.ai
                    </AppText>
                </Animated.View>

                {/* Subtitle */}
                <Animated.View
                    entering={FadeIn
                        .duration(800)
                        .delay(500)}
                >
                    <AppText
                        variant="body"
                        className="mt-2 text-center"
                    >
                        Understand yourself, differently.
                    </AppText>
                </Animated.View>
            </View>
        </View>
    );
}