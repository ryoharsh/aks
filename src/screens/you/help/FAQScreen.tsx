import { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
    ArrowDown01Icon,
    ArrowLeftIcon,
    ArrowUp01Icon,
    Search01Icon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { HelpFeedbackStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<
    HelpFeedbackStackParamList,
    "FAQ"
>;

type FAQItem = {
    question: string;
    answer: string;
};

const FAQ_ITEMS: readonly FAQItem[] = copy.faq.items;

export default function FAQScreen({ navigation }: Props) {
    const [query, setQuery] = useState("");
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
    const textHigh = useResolveClassNames("text-text-high");
    const textLow = useResolveClassNames("text-text-low");
    const border = useResolveClassNames("border-border");
    const surface = useResolveClassNames("bg-surface");
    const primaryForeground = useResolveClassNames("text-primary-foreground");

    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return FAQ_ITEMS;
        }

        return FAQ_ITEMS.filter(({ question, answer }) =>
            `${question} ${answer}`
                .toLowerCase()
                .includes(normalizedQuery),
        );
    }, [query]);

    return (
        <View className="flex-1 bg-background">

            <Animated.View
                entering={FadeIn.duration(400)}
                className="flex-row items-center px-6 pt-4"
            >
                <IconButton
                    onPress={() => navigation.goBack()}
                    className="mr-3"
                >
                    <HugeiconsIcon
                        icon={ArrowLeftIcon}
                        size={21}
                        color={textHigh.color}
                        strokeWidth={1.8}
                    />
                </IconButton>

                <View className="flex-1">
                    <AppText
                        variant="title"
                        className="text-text-high"
                    >
                        {copy.faq.header}
                    </AppText>
                </View>
            </Animated.View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="px-6 pb-32"
            >
                <Animated.View
                    entering={FadeInDown
                        .duration(500)
                        .delay(80)}
                    className="mt-7"
                >
                    <AppText
                        variant="display"
                        className="font-satoshi-medium text-text-high"
                    >
                        {copy.faq.title}
                    </AppText>

                    <AppText
                        variant="body"
                        className="mt-3 max-w-[330px] text-text-low"
                    >
                        {copy.faq.description}
                    </AppText>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp
                        .duration(500)
                        .delay(150)}
                    className="mt-7"
                >
                    <View
                        className="h-14 flex-row items-center rounded-2xl border border-border bg-surface px-4"
                    >
                        <HugeiconsIcon
                            icon={Search01Icon}
                            size={20}
                            color={textLow.color}
                            strokeWidth={1.8}
                        />

                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder={copy.faq.searchPlaceholder}
                            placeholderTextColor="#A3A3A3"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                            className="ml-3 flex-1 text-[16px] text-text-high"
                        />

                        {query.length > 0 ? (
                            <Pressable
                                onPress={() => setQuery("")}
                                hitSlop={10}
                            >
                                <AppText
                                    variant="caption"
                                    className="text-text-medium"
                                >
                                    {copy.faq.clearSearch}
                                </AppText>
                            </Pressable>
                        ) : null}
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp
                        .duration(500)
                        .delay(220)}
                    className="mt-9"
                >
                    <View className="mb-3 flex-row items-center justify-between">
                        <AppText
                            variant="caption"
                            className="text-[10px] tracking-[1.8px] text-text-low"
                        >
                            {query.trim()
                                ? copy.faq.resultsCount(filteredItems.length)
                                : copy.faq.popularSection}
                        </AppText>

                        {!query.trim() ? (
                            <AppText
                                variant="caption"
                                className="text-text-disabled"
                            >
                                {copy.faq.questionsCount(FAQ_ITEMS.length)}
                            </AppText>
                        ) : null}
                    </View>

                    <View
                        className="overflow-hidden rounded-[28px] border border-border bg-surface"
                    >
                        {filteredItems.map((item, index) => {
                            const expanded = expandedIndex === index;

                            return (
                                <Pressable
                                    key={item.question}
                                    onPress={() =>
                                        setExpandedIndex(
                                            expanded
                                                ? null
                                                : index,
                                        )
                                    }
                                    className="px-5"
                                >
                                    <View className="flex-row items-center py-5">
                                        <View className="flex-1 pr-4">
                                            <AppText
                                                variant="button"
                                                className="text-[15px] leading-5 text-text-high"
                                            >
                                                {item.question}
                                            </AppText>
                                        </View>

                                        <View
                                            className={
                                                expanded
                                                    ? "h-8 w-8 items-center justify-center rounded-full bg-primary"
                                                    : "h-8 w-8 items-center justify-center rounded-full bg-background"
                                            }>
                                            <HugeiconsIcon
                                                icon={!expanded ? ArrowDown01Icon : ArrowUp01Icon}
                                                size={17}
                                                color={
                                                    expanded
                                                        ? primaryForeground.color
                                                        : textLow.color
                                                }
                                            />
                                        </View>
                                    </View>

                                    {expanded ? (
                                        <Animated.View
                                            entering={FadeInDown
                                                .duration(250)}
                                            className="pb-5 pr-12"
                                        >
                                            <AppText
                                                variant="body"
                                                className="text-[14px] leading-[22px] text-text-low"
                                            >
                                                {item.answer}
                                            </AppText>
                                        </Animated.View>
                                    ) : null}

                                    {index <
                                        filteredItems.length - 1 ? (
                                        <View className="h-px bg-border" />
                                    ) : null}
                                </Pressable>
                            );
                        })}

                        {filteredItems.length === 0 ? (
                            <View className="items-center px-6 py-12">
                                <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-background">
                                    <HugeiconsIcon
                                        icon={Search01Icon}
                                        size={21}
                                        color={textLow.color}
                                        strokeWidth={1.8}
                                    />
                                </View>

                                <AppText
                                    variant="title"
                                    className="text-center text-text-high"
                                >
                                    {copy.faq.emptyTitle}
                                </AppText>

                                <AppText
                                    variant="body"
                                    className="mt-2 max-w-[260px] text-center text-text-low"
                                >
                                    {copy.faq.emptyBody}
                                </AppText>

                                <Pressable
                                    onPress={() => setQuery("")}
                                    className="mt-5 rounded-full bg-background px-5 py-3"
                                >
                                    <AppText
                                        variant="button"
                                        className="text-text-high"
                                    >
                                        {copy.faq.clearAction}
                                    </AppText>
                                </Pressable>
                            </View>
                        ) : null}
                    </View>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp
                        .duration(500)
                        .delay(300)}
                    className="mt-8"
                >
                    <View className="rounded-[28px] border border-border bg-background p-5">
                        <AppText
                            variant="title"
                            className="text-text-high"
                        >
                            {copy.faq.helpTitle}
                        </AppText>

                        <AppText
                            variant="body"
                            className="mt-2 text-text-low"
                        >
                            {copy.faq.helpBody}
                        </AppText>

                        <Pressable
                            onPress={() =>
                                navigation.navigate(
                                    "SendFeedback",
                                )
                            }
                            className="mt-5 h-12 items-center justify-center rounded-2xl bg-primary"
                        >
                            <AppText
                                variant="button"
                                className="text-primary-foreground"
                            >
                                {copy.faq.contactAction}
                            </AppText>
                        </Pressable>
                    </View>
                </Animated.View>
            </ScrollView>
        </View>
    );
}