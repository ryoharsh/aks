import { useState } from "react";
import { Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import type {
    NativeStackNavigationProp,
    NativeStackScreenProps,
} from "@react-navigation/native-stack";
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
import LogoMark from "@/components/common/LogoMark";
import type {
    AuthStackParamList,
    RootStackParamList,
} from "@/navigation/routes";
import LegalLinks from "@/components/common/LegalLinks";
import { sendMagicLink, signInWithProvider } from "@/lib/auth";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const isValid =
        name.trim().length > 1 &&
        email.trim().length > 3;

    const handleRegister = async () => {
        if (!isValid || loading) return;

        try {
            setLoading(true);
            const { error } = await sendMagicLink(email, {
                shouldCreateUser: true,
                fullName: name,
            });

            if (error) throw error;

            Alert.alert(
                "Check your email",
                "Use the secure link we sent to finish creating your account.",
            );
        } catch (error) {
            Alert.alert(
                "Unable to create account",
                error instanceof Error ? error.message : "Please try again.",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider: "google" | "facebook" | "github") => {
        if (loading) return;

        try {
            setLoading(true);
            const { error } = await signInWithProvider(provider);

            if (error) throw error;

            navigation
                .getParent<NativeStackNavigationProp<RootStackParamList>>()
                ?.navigate("LegalAcceptance");
        } catch (error) {
            Alert.alert(
                "Unable to sign in",
                error instanceof Error ? error.message : "Please try again.",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <StatusBar style="dark" />

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
                            className="mb-8"
                        >
                            <AppText
                                variant="display"
                                className="font-satoshi-medium text-text-high"
                            >
                                Create your account.
                            </AppText>

                            <AppText
                                variant="body"
                                className="mt-3 text-text-low"
                            >
                                Start building a clearer picture of
                                yourself with Aks.
                            </AppText>
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(100)}
                        >
                            <AppText
                                variant="caption"
                                className="mb-2 text-text-medium"
                            >
                                Full name
                            </AppText>

                            <TextInput
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                                autoCorrect={false}
                                textContentType="name"
                                placeholder="Your full name"
                                placeholderTextColor="#A3A3A3"
                                className="h-14 rounded-2xl border border-border bg-surface px-4 text-[16px] text-text-high"
                            />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(150)}
                            className="mt-5"
                        >
                            <AppText
                                variant="caption"
                                className="mb-2 text-text-medium"
                            >
                                Email address
                            </AppText>

                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                placeholder="you@example.com"
                                placeholderTextColor="#A3A3A3"
                                className="h-14 rounded-2xl border border-border bg-surface px-4 text-[16px] text-text-high"
                            />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(200)}
                        >
                            <Button
                                variant="primary"
                                onPress={handleRegister}
                                loading={loading}
                                disabled={!isValid}
                                className="mt-4 rounded-2xl"
                            >
                                <AppText
                                    variant="button"
                                    className="text-white"
                                >
                                    Create account
                                </AppText>
                            </Button>

                            <AppText
                                variant="caption"
                                className="mt-3 px-2 text-center text-text-low"
                            >
                                We'll send you a secure sign-in link.
                                No password needed.
                            </AppText>
                        </Animated.View>

                        <Animated.View
                            entering={FadeIn.duration(450).delay(250)}
                            className="my-8 flex-row items-center"
                        >
                            <View className="h-px flex-1 bg-border" />

                            <AppText
                                variant="caption"
                                className="mx-4 text-text-low"
                            >
                                OR SIGN UP WITH
                            </AppText>

                            <View className="h-px flex-1 bg-border" />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.duration(500).delay(300)}
                        >
                            <View className="mb-3 flex-row gap-3">
                                <Button
                                    onPress={() => handleOAuth("google")}
                                    variant="secondary"
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
                                        Google
                                    </AppText>
                                </Button>

                                <Button
                                    onPress={() => handleOAuth("facebook")}
                                    variant="secondary"
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
                                        Facebook
                                    </AppText>
                                </Button>
                            </View>

                            <Button
                                onPress={() => handleOAuth("github")}
                                variant="secondary"
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
                                    Continue with GitHub
                                </AppText>
                            </Button>
                        </Animated.View>
                    </View>

                    <Animated.View
                        entering={FadeInUp.duration(500).delay(400)}
                        className="mt-12 items-center"
                    >
                        <View className="flex-row items-center">
                            <AppText
                                variant="button"
                                className="text-text-low"
                            >
                                Already have an account?
                            </AppText>

                            <Pressable
                                onPress={() =>
                                    navigation.navigate("Login")
                                }
                                hitSlop={8}
                            >
                                <AppText
                                    variant="button"
                                    className="ml-1 text-[14px] text-text-high"
                                >
                                    Sign in
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