import { KeyboardAvoidingView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import LogoMark from "@/components/common/LogoMark";
import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { copy } from "@/constants/copy";

type Props = {
    email: string;
    loading: boolean;
    onResend: () => void;
    onEdit: () => void;
};

export default function EmailConfirmation({ email, loading, onResend, onEdit }: Props) {
    return (
        <KeyboardAvoidingView
            behavior="padding"
            className="flex-1 bg-background"
        >
            <View className="px-6 pt-16"><LogoMark /></View>
            <View className="flex-1 justify-center px-6 pb-24">
                <Animated.View entering={FadeInDown.duration(450)}>
                    <AppText variant="display" className="text-text-high">{copy.emailConfirmation.title}</AppText>
                    <AppText className="mt-4 leading-6 text-text-low">
                        {copy.emailConfirmation.body(email)}
                    </AppText>
                    <AppText variant="caption" className="mt-3 text-text-low">
                        {copy.emailConfirmation.resendNote}
                    </AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(450).delay(100)} className="mt-8 gap-3">
                    <Button onPress={onResend} loading={loading} accessibilityLabel={copy.emailConfirmation.resendA11y}>
                        <AppText variant="button" className="text-primary-foreground">{copy.emailConfirmation.resend}</AppText>
                    </Button>
                    <Button variant="ghost" onPress={onEdit} disabled={loading} accessibilityLabel={copy.emailConfirmation.editEmailA11y}>
                        <AppText variant="button" className="text-text-medium">{copy.emailConfirmation.editEmail}</AppText>
                    </Button>
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
    );
}
