import React from "react";
import {
    Linking,
    Pressable,
    ScrollView,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import {
    HugeiconsIcon,
    type IconSvgElement,
} from "@hugeicons/react-native";
import {
    ArrowRight01Icon,
    Chat01Icon,
    FileEditIcon,
    Mail01Icon,
    MessageQuestionIcon,
    Bug01Icon,
    LightbulbIcon,
} from "@hugeicons/core-free-icons";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { YouStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<
    YouStackParamList,
    "HelpFeedback"
>;

type ActionItemProps = {
    icon: IconSvgElement;
    title: string;
    description: string;
    onPress: () => void;
};

function ActionItem({
    icon,
    title,
    description,
    onPress,
}: ActionItemProps) {
    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center border-b border-border py-5"
        >
            <View className="mr-4 h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                <HugeiconsIcon
                    icon={icon}
                    size={21}
                    color="#525252"
                    strokeWidth={1.8}
                />
            </View>

            <View className="flex-1">
                <AppText
                    variant="button"
                    className="text-text-high"
                >
                    {title}
                </AppText>

                <AppText
                    variant="caption"
                    className="mt-1 text-text-low"
                >
                    {description}
                </AppText>
            </View>

            <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={18}
                color="#737373"
                strokeWidth={1.6}
            />
        </Pressable>
    );
}

export default function HelpFeedbackScreen({
    navigation,
}: Props) {
    const openEmail = () => {
        Linking.openURL(
            "mailto:support@aks.ai?subject=Aks%20Support",
        );
    };

    const reportIssue = () => {
        Linking.openURL(
            "mailto:support@aks.ai?subject=Aks%20Bug%20Report",
        );
    };

    const sendFeedback = () => {
        Linking.openURL(
            "mailto:hello@aks.ai?subject=Aks%20Feedback",
        );
    };

    const suggestIdea = () => {
        Linking.openURL(
            "mailto:hello@aks.ai?subject=Aks%20Feature%20Idea",
        );
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar style="dark" />

            <Animated.View
                entering={FadeIn.duration(400)}
                className="h-16 flex-row items-center px-6"
            >
                <IconButton
                    onPress={() => navigation.goBack()}
                    className="mr-3"
                >
                    <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={21}
                        color="#171717"
                        strokeWidth={1.8}
                        style={{
                            transform: [{ rotate: "180deg" }],
                        }}
                    />
                </IconButton>

                <AppText
                    variant="title"
                    className="text-text-high"
                >
                    Help & feedback
                </AppText>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-6 pb-32"
            >
                <Animated.View
                    entering={FadeInDown.duration(550).delay(100)}
                    className="mt-8"
                >
                    <AppText
                        variant="display"
                        className="font-satoshi-medium text-text-high"
                    >
                        We're listening.
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 max-w-[330px] text-text-low"
                    >
                        Something not working, something confusing, or
                        something you wish Aks could do?
                    </AppText>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(180)}
                    className="mt-9"
                >
                    <View className="rounded-[28px] border border-border bg-surface p-5">
                        <View className="flex-row items-center">
                            <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-background">
                                <HugeiconsIcon
                                    icon={Chat01Icon}
                                    size={23}
                                    color="#171717"
                                    strokeWidth={1.8}
                                />
                            </View>

                            <View className="flex-1">
                                <AppText
                                    variant="title"
                                    className="text-text-high"
                                >
                                    Need a hand?
                                </AppText>

                                <AppText
                                    variant="caption"
                                    className="mt-1 text-text-low"
                                >
                                    Our support team is here to help.
                                </AppText>
                            </View>
                        </View>

                        <Pressable
                            onPress={openEmail}
                            className="mt-5 h-12 items-center justify-center rounded-2xl bg-primary"
                        >
                            <AppText
                                variant="button"
                                className="text-primary-foreground"
                            >
                                Contact support
                            </AppText>
                        </Pressable>
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(250)}
                    className="mt-10"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 text-[10px] tracking-[1.8px] text-text-low"
                    >
                        GET HELP
                    </AppText>

                    <View className="border-t border-border">
                        <ActionItem
                            icon={MessageQuestionIcon}
                            title="Frequently asked questions"
                            description="Find quick answers to common questions"
                            onPress={() => { }}
                        />

                        <ActionItem
                            icon={Bug01Icon}
                            title="Report a problem"
                            description="Tell us when something isn't working"
                            onPress={reportIssue}
                        />
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(320)}
                    className="mt-10"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 text-[10px] tracking-[1.8px] text-text-low"
                    >
                        MAKE AKS BETTER
                    </AppText>

                    <View className="border-t border-border">
                        <ActionItem
                            icon={LightbulbIcon}
                            title="Suggest an idea"
                            description="Tell us what you'd like Aks to learn or do"
                            onPress={suggestIdea}
                        />

                        <ActionItem
                            icon={FileEditIcon}
                            title="Send feedback"
                            description="Share your thoughts about the experience"
                            onPress={sendFeedback}
                        />
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(390)}
                    className="mt-10"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 text-[10px] tracking-[1.8px] text-text-low"
                    >
                        CONTACT
                    </AppText>

                    <Pressable
                        onPress={openEmail}
                        className="flex-row items-center border-t border-border py-5"
                    >
                        <View className="mr-4 h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                            <HugeiconsIcon
                                icon={Mail01Icon}
                                size={21}
                                color="#525252"
                                strokeWidth={1.8}
                            />
                        </View>

                        <View className="flex-1">
                            <AppText
                                variant="button"
                                className="text-text-high"
                            >
                                support@aks.ai
                            </AppText>

                            <AppText
                                variant="caption"
                                className="mt-1 text-text-low"
                            >
                                Usually replies within 1–2 business days
                            </AppText>
                        </View>
                    </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeIn.duration(500).delay(450)}
                    className="mt-10 items-center"
                >
                    <AppText
                        variant="caption"
                        className="text-text-disabled"
                    >
                        Aks.ai
                    </AppText>

                    <AppText
                        variant="caption"
                        className="mt-1 text-text-disabled"
                    >
                        Version 1.0.0
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}