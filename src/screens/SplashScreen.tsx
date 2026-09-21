import { View } from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    ZoomIn,
} from "react-native-reanimated";

import AppLogo from "@/components/ui/AppLogo";
import AppText from "@/components/ui/Text";
import { copy } from "@/constants/copy";
export default function SplashScreen() {
    return (
        <View className="flex-1 items-center justify-center bg-background">

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
                        {copy.splash.appName}
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
                        {copy.splash.subtitle}
                    </AppText>
                </Animated.View>
            </View>
        </View>
    );
}
