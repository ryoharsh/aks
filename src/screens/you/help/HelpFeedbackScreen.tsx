import React from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
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
    ArrowLeftIcon,
    ArrowRight01Icon,
    Chat01Icon,
    FileEditIcon,
    LightbulbIcon,
    Mail01Icon,
    MessageQuestionIcon,
    Bug01Icon,
    SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { HelpFeedbackStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<
    HelpFeedbackStackParamList,
    "HelpFeedbackHome"
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
    const iconColor = useResolveClassNames("text-text-medium").color;
    const arrowColor = useResolveClassNames("text-text-low").color;
    const rippleColor = useResolveClassNames("bg-border").color;

    return (
        <Pressable
            onPress={onPress}
            android_ripple={{ color: rippleColor }}
            className="flex-row items-center border-b border-border py-5 active:opacity-80"
        >
            <View className="mr-4 h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                <HugeiconsIcon
                    icon={icon}
                    size={21}
                    color={iconColor}
                    strokeWidth={1.8}
                />
            </View>

            <View className="flex-1 pr-3">
                <AppText
                    variant="button"
                    className="text-text-high"
                >
                    {title}
                </AppText>

                <AppText
                    variant="caption"
                    className="mt-1 leading-[17px] text-text-low"
                >
                    {description}
                </AppText>
            </View>

            <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={18}
                color={arrowColor}
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
            "mailto:support@aks.ai?subject=Aks%20Support"
        );
    };
    const iconColor = useResolveClassNames("text-text-medium").color;
    const highColor = useResolveClassNames("text-text-high").color;
    const arrowColor = useResolveClassNames("text-text-low").color;
    const rippleColor = useResolveClassNames("bg-border").color;

    return (
        <View className="flex-1 bg-background">

            <Animated.View
                entering={FadeIn.duration(400)}
                className="h-16 flex-row items-center px-6"
            >
                <IconButton
                    onPress={() => navigation.goBack()}
                    className="mr-3"
                >
                    <HugeiconsIcon
                        icon={ArrowLeftIcon}
                        size={22}
                    />
                </IconButton>

                <AppText
                    variant="title"
                    className="text-text-high"
                >
                    {copy.helpHome.header}
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
                        {copy.helpHome.title}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 max-w-82.5 text-text-low"
                    >
                        {copy.helpHome.description}
                    </AppText>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(180)}
                    className="mt-9"
                >
                    <View className="rounded-[28px] border border-border bg-surface p-5">
                        <View className="flex-row items-center">
                            <View className="mr-4 h-11 w-11 items-center justify-center rounded-2xl bg-background">
                                <HugeiconsIcon
                                    icon={Chat01Icon}
                                    size={22}
                                    color={highColor}
                                    strokeWidth={1.8}
                                />
                            </View>

                            <View className="flex-1">
                                <AppText
                                    variant="title"
                                    className="text-text-high"
                                >
                                    {copy.helpHome.supportTitle}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    className="mt-1 text-text-low"
                                >
                                    {copy.helpHome.supportBody}
                                </AppText>
                            </View>
                        </View>

                        <Pressable
                            onPress={openEmail}
                            android_ripple={{ color: "#2A2A2A" }}
                            className="mt-5 h-12 items-center justify-center rounded-2xl bg-primary active:opacity-90"
                        >
                            <AppText
                                variant="button"
                                className="text-primary-foreground"
                            >
                                {copy.helpHome.supportAction}
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
                        {copy.helpHome.getHelpSection}
                    </AppText>

                    <View className="border-t border-border">
                        <ActionItem
                            icon={MessageQuestionIcon}
                            title={copy.helpHome.faqTitle}
                            description={copy.helpHome.faqDescription}
                            onPress={() =>
                                navigation.navigate("FAQ")
                            }
                        />

                        <ActionItem
                            icon={Bug01Icon}
                            title={copy.helpHome.reportTitle}
                            description={copy.helpHome.reportDescription}
                            onPress={() =>
                                navigation.navigate("ReportProblem")
                            }
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
                        {copy.helpHome.improveSection}
                    </AppText>

                    <View className="border-t border-border">
                        <ActionItem
                            icon={LightbulbIcon}
                            title={copy.helpHome.suggestTitle}
                            description={copy.helpHome.suggestDescription}
                            onPress={() =>
                                navigation.navigate("SendFeedback")
                            }
                        />

                        <ActionItem
                            icon={SparklesIcon}
                            title={copy.helpHome.shareTitle}
                            description={copy.helpHome.shareDescription}
                            onPress={() =>
                                navigation.navigate("SendFeedback")
                            }
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
                        {copy.helpHome.contactSection}
                    </AppText>

<Pressable
                            onPress={openEmail}
                            android_ripple={{ color: rippleColor }}
                            className="flex-row items-center border-t border-border py-5 active:opacity-80"
                        >
                            <View className="mr-4 h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                                <HugeiconsIcon
                                    icon={Mail01Icon}
                                    size={21}
                                    color={iconColor}
                                    strokeWidth={1.8}
                                />
                            </View>

                            <View className="flex-1">
                                <AppText
                                    variant="button"
                                    className="text-text-high"
                                >
                                    {copy.helpHome.supportEmail}
                                </AppText>

                                <AppText
                                    variant="caption"
                                    className="mt-1 text-text-low"
                                >
                                    {copy.helpHome.supportResponse}
                                </AppText>
                            </View>

                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                size={18}
                                color={arrowColor}
                                strokeWidth={1.6}
                            />
                        </Pressable>
                </Animated.View>

                <Animated.View
                    entering={FadeIn.duration(500).delay(450)}
                    className="mt-10 items-center"
                >
                    <AppText className="text-[13px] font-medium text-text-disabled">
                        {copy.brand.name}
                    </AppText>

                    <AppText
                        variant="caption"
                        className="mt-1 text-text-disabled"
                    >
                        {copy.common.version(copy.helpHome.footerVersion)}
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}