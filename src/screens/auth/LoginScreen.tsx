import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import type { AuthStackParamList } from "@/navigation/routes";
import LogoMark from "@/components/common/LogoMark";
import LegalLinks from "@/components/common/LegalLinks";
import EmailConfirmation from "@/components/auth/EmailConfirmation";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { useAuth } from "@/hooks/useAuth";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;
const facebookEnabled = process.env.EXPO_PUBLIC_AUTH_FACEBOOK_ENABLED === "true";

export default function LoginScreen({ navigation }: Props) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sentEmail, setSentEmail] = useState<string | null>(null);
    const { callbackError, clearCallbackError, signInWithMagicLink, signInWithProvider } = useAuth();
    const { notice } = useBottomSheet();

    const handleMagicLink = async () => {
        if (!email.trim() || loading) return;

        try {
            setLoading(true);
            await signInWithMagicLink(email);
            setSentEmail(email.trim().toLowerCase());
        } catch (error) {
            notice(
                copy.login.notices.unableToSendLink,
                error instanceof Error ? error.message : copy.common.pleaseTryAgain,
            );
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider: "google" | "facebook" | "github") => {
        if (loading) return;

        try {
            setLoading(true);
            await signInWithProvider(provider);
        } catch (error) {
            notice(
                copy.login.notices.unableToSignIn,
                error instanceof Error ? error.message : copy.common.pleaseTryAgain,
            );
        } finally {
            setLoading(false);
        }
    };

    if (sentEmail) {
        return (
            <EmailConfirmation
                email={sentEmail}
                loading={loading}
                onResend={() => void handleMagicLink()}
                onEdit={() => setSentEmail(null)}
            />
        );
    }

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior="padding"
        >

            <Animated.View
                entering={FadeIn.duration(500)}
                className="flex-row items-center justify-between px-6 pt-16"
            >
                <LogoMark />
            </Animated.View>

            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-1 px-6 pb-10 pt-6">
                    <View className="flex-1">
                        <Animated.View
                            entering={FadeInDown.duration(550)}
                            className="mb-4"
                        >
                            <AppText
                                variant="display"
                                className="font-satoshi-medium text-text-high">
                                {copy.login.title}
                            </AppText>

                            <AppText
                                variant="body"
                                className="mt-3 text-text-low"
                            >
                                {copy.login.description}
                            </AppText>
                            {callbackError ? (
                                <Pressable onPress={clearCallbackError} accessibilityRole="button">
                                    <AppText variant="caption" className="mt-3 text-red-600">{callbackError} {copy.login.dismissError}</AppText>
                                </Pressable>
                            ) : null}
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(100)}
                        >
                            <AppText
                                variant="caption"
                                className="mb-2 text-text-medium"
                            >
                                {copy.login.emailLabel}
                            </AppText>

                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                placeholder={copy.common.emailPlaceholder}
                                placeholderTextColor="#A3A3A3"
                                className="h-14 rounded-2xl border border-border bg-surface px-4 text-[16px] text-text-high"
                                accessibilityLabel={copy.login.emailLabel}
                            />

                            <Button
                                variant="primary"
                                onPress={handleMagicLink}
                                loading={loading}
                                disabled={!email.trim()}
                                accessibilityLabel={copy.login.sendLinkA11y}
                                className="mt-4 rounded-2xl">
                                <AppText
                                    variant="button"
                                    className="text-white"
                                >
                                    {copy.login.sendLink}
                                </AppText>
                            </Button>

                            <AppText
                                variant="caption"
                                className="mt-3 px-2 text-center text-text-low"
                            >
                                {copy.login.secureLinkNote}
                            </AppText>
                        </Animated.View>

                        <Animated.View
                            entering={FadeIn.duration(450).delay(200)}
                            className="my-8 flex-row items-center"
                        >
                            <View className="h-px flex-1 bg-border" />

                            <AppText
                                variant="caption"
                                className="mx-4 text-text-low"
                            >
                                {copy.login.divider}
                            </AppText>

                            <View className="h-px flex-1 bg-border" />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(250)}
                        >
                            <View className="mb-3 flex-row gap-3">
                                <Button
                                    onPress={() => handleOAuth("google")}
                                    variant="secondary"
                                    disabled={loading}
                                    accessibilityLabel={copy.login.googleA11y}
                                    className="flex-1 rounded-full bg-surface"
                                >
                                    <Image
                                        source={require("@assets/icons/google.png")}
                                        className="mr-2 size-5"
                                        resizeMode="contain"
                                    />

                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        {copy.login.google}
                                    </AppText>
                                </Button>

                                {facebookEnabled ? <Button
                                    onPress={() => handleOAuth("facebook")}
                                    variant="secondary"
                                    disabled={loading}
                                    accessibilityLabel={copy.login.facebookA11y}
                                    className="flex-1 rounded-full bg-surface"
                                >
                                    <Image
                                        source={require("@assets/icons/fb.png")}
                                        className="mr-2 size-5"
                                        resizeMode="contain"
                                    />

                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        {copy.login.facebook}
                                    </AppText>
                                </Button> : null}
                            </View>

                            <Button
                                onPress={() => handleOAuth("github")}
                                variant="secondary"
                                disabled={loading}
                                accessibilityLabel={copy.login.githubA11y}
                                className="rounded-full bg-surface"
                            >
                                <Image
                                    source={require("@assets/icons/gh.png")}
                                    className="mr-2 size-5"
                                    resizeMode="contain"
                                />

                                <AppText
                                    variant="button"
                                    className="text-text-high"
                                >
                                    {copy.login.github}
                                </AppText>
                            </Button>
                        </Animated.View>
                    </View>

                    <Animated.View
                        entering={FadeInUp.duration(500).delay(350)}
                        className="mt-12 items-center"
                    >
                        <View className="flex-row items-center">
                            <AppText
                                variant="button"
                                className="text-text-low"
                            >
                                {copy.login.noAccount}
                            </AppText>

                            <Pressable
                                onPress={() =>
                                    navigation.navigate("Register")
                                }
                                hitSlop={8}
                            >
                                <AppText
                                    variant="button"
                                    className="ml-1 text-[14px] text-text-high"
                                >
                                    {copy.login.createOne}
                                </AppText>
                            </Pressable>
                        </View>

                        <LegalLinks />
                    </Animated.View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
