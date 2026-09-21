import { useState } from "react";
import {
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
    ArrowLeftIcon,
    CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { copy } from "@/constants/copy";

type FeedbackFormScreenProps = {
    headerTitle: string;
    title: string;
    description: string;
    optionLabel: string;
    optionHint: string;
    options: readonly string[];
    initialOption?: string;
    messageLabel: string;
    messagePlaceholder: string;
    messageHint: string;
    emailHint: string;
    noteTitle: string;
    noteDescription: string;
    submitLabel: string;
    leaveMessage: string;
    requireOption?: boolean;
    minimumMessageLength?: number;
    onBack: () => void;
};

export default function FeedbackFormScreen({
    headerTitle,
    title,
    description,
    optionLabel,
    optionHint,
    options,
    initialOption,
    messageLabel,
    messagePlaceholder,
    messageHint,
    emailHint,
    noteTitle,
    noteDescription,
    submitLabel,
    leaveMessage,
    requireOption = false,
    minimumMessageLength = 10,
    onBack,
}: FeedbackFormScreenProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(
        initialOption ?? null,
    );
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const textHigh = useResolveClassNames("text-text-high");
    const textMedium = useResolveClassNames("text-text-medium");
    const primaryForeground = useResolveClassNames("text-primary-foreground");
    const placeholderColor = useResolveClassNames("text-text-disabled").color;
    const canSubmit =
        (!requireOption || selectedOption !== null) &&
        message.trim().length >= minimumMessageLength;

    const handleSubmit = () => {
        if (!canSubmit || loading) return;

        setLoading(true);

        setTimeout(() => {
            setLoading(false);
            onBack();
        }, 800);
    };

    return (
        <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">

            <Animated.View
                entering={FadeIn.duration(400)}
                className="h-16 flex-row items-center px-6"
            >
                <IconButton onPress={onBack} className="mr-3">
                    <HugeiconsIcon
                        icon={ArrowLeftIcon}
                        size={21}
                        color={textHigh.color}
                        strokeWidth={1.8}
                    />
                </IconButton>

                <AppText variant="title" className="text-text-high">
                    {headerTitle}
                </AppText>
            </Animated.View>

            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-6 pb-32"
            >
                <Animated.View
                    entering={FadeInDown.duration(550).delay(80)}
                    className="mt-7"
                >
                    <AppText
                        variant="display"
                        className="font-satoshi-medium text-text-high"
                    >
                        {title}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 max-w-85 text-text-low"
                    >
                        {description}
                    </AppText>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(150)}
                    className="mt-9"
                >
                    <View className="mb-3 flex-row items-center justify-between">
                        <AppText
                            variant="caption"
                            className="text-[10px] tracking-[1.8px] text-text-low"
                        >
                            {optionLabel}
                        </AppText>

                        <AppText
                            variant="caption"
                            className={selectedOption ? "text-text-high" : "text-text-disabled"}
                        >
                            {selectedOption && requireOption ? copy.feedbackForm.selectedState : optionHint}
                        </AppText>
                    </View>

                    <View className="flex-row flex-wrap gap-2">
                        {options.map((item) => {
                            const selected = selectedOption === item;

                            return (
                                <Pressable
                                    key={item}
                                    onPress={() => setSelectedOption(item)}
                                    className={
                                        selected
                                            ? "flex-row items-center gap-2 rounded-full border border-primary bg-primary px-4 py-3"
                                            : "flex-row items-center gap-2 rounded-full border border-border bg-surface px-4 py-3"
                                    }
                                >
                                    {selected ? (
                                        <HugeiconsIcon
                                            icon={CheckmarkCircle01Icon}
                                            size={15}
                                            color={primaryForeground.color}
                                            strokeWidth={1.9}
                                        />
                                    ) : null}

                                    <AppText
                                        variant="caption"
                                        className={
                                            selected
                                                ? "text-primary-foreground"
                                                : "text-text-medium"
                                        }
                                    >
                                        {item}
                                    </AppText>
                                </Pressable>
                            );
                        })}
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(220)}
                    className="mt-9"
                >
                    <View className="mb-3 flex-row items-center justify-between">
                        <AppText
                            variant="caption"
                            className="text-[10px] tracking-[1.8px] text-text-low"
                        >
                            {messageLabel}
                        </AppText>

                        <AppText variant="caption" className="text-text-disabled">
                            {message.length}/{copy.feedbackForm.charLimit}
                        </AppText>
                    </View>

                    <View className="overflow-hidden rounded-3xl border border-border bg-surface">
                        <TextInput
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            maxLength={copy.feedbackForm.charLimit}
                            textAlignVertical="top"
                            placeholder={messagePlaceholder}
                            placeholderTextColor={placeholderColor}
                            className="min-h-44 px-4 py-4 text-[16px] leading-6 text-text-high"
                        />

                        <View className="px-4 pb-4">
                            <AppText variant="caption" className="text-text-disabled">
                                {messageHint}
                            </AppText>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(290)}
                    className="mt-7"
                >
                    <AppText
                        variant="caption"
                        className="mb-3 text-[10px] tracking-[1.8px] text-text-low"
                    >
                        {copy.feedbackForm.contactEmail}
                        <AppText variant="caption" className="text-text-disabled">
                            {copy.feedbackForm.optionalMark}
                        </AppText>
                    </AppText>

                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        placeholder={copy.feedbackForm.emailPlaceholder}
                        placeholderTextColor={placeholderColor}
                        className="h-14 rounded-2xl border border-border bg-surface px-4 text-[16px] text-text-high"
                    />

                    <AppText variant="caption" className="mt-2 px-1 text-text-low">
                        {emailHint}
                    </AppText>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(360)}
                    className="mt-9"
                >
                    <View className="rounded-3xl border border-border bg-surface p-4">
                        <View className="flex-row items-start">
                            <View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-xl bg-background">
                                <HugeiconsIcon
                                    icon={CheckmarkCircle01Icon}
                                    size={17}
                                    color={textMedium.color}
                                    strokeWidth={1.8}
                                />
                            </View>

                            <View className="flex-1">
                                <AppText variant="button" className="text-text-high">
                                    {noteTitle}
                                </AppText>
                                <AppText
                                    variant="caption"
                                    className="mt-1 leading-5 text-text-low"
                                >
                                    {noteDescription}
                                </AppText>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(500).delay(430)}
                    className="mt-6"
                >
                    <Button
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        loading={loading}
                        className="h-14 rounded-2xl"
                    >
                        <AppText
                            variant="button"
                            className="text-primary-foreground"
                        >
                            {submitLabel}
                        </AppText>
                    </Button>

                    <AppText
                        variant="caption"
                        className="mt-3 text-center text-text-low"
                    >
                        {leaveMessage}
                    </AppText>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
