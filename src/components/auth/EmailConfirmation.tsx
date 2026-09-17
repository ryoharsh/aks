import { KeyboardAvoidingView, Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import LogoMark from "@/components/common/LogoMark";
import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";

type Props = {
    email: string;
    loading: boolean;
    onResend: () => void;
    onEdit: () => void;
};

export default function EmailConfirmation({ email, loading, onResend, onEdit }: Props) {
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 bg-background"
        >
            <StatusBar style="dark" />
            <View className="px-6 pt-16"><LogoMark /></View>
            <View className="flex-1 justify-center px-6 pb-24">
                <Animated.View entering={FadeInDown.duration(450)}>
                    <AppText variant="display" className="text-text-high">Check your email.</AppText>
                    <AppText className="mt-4 leading-6 text-text-low">
                        We sent a secure sign-in link to {email}. Open it on this device to continue.
                    </AppText>
                    <AppText variant="caption" className="mt-3 text-text-low">
                        If you resend, only the newest link will work.
                    </AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(100)} className="mt-8 gap-3">
                    <Button onPress={onResend} loading={loading} accessibilityLabel="Resend sign-in link">
                        <AppText variant="button" className="text-primary-foreground">Resend link</AppText>
                    </Button>
                    <Button variant="ghost" onPress={onEdit} disabled={loading} accessibilityLabel="Edit email address">
                        <AppText variant="button" className="text-text-medium">Edit email</AppText>
                    </Button>
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
    );
}
