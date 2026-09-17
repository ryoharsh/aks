import { memo, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SectionList,
    View,
} from "react-native";
import Animated, {
    FadeInUp,
} from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Chat01Icon,
    CheckListIcon,
    Flag02Icon,
    Note01Icon,
    SparklesIcon,
    Target01Icon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";
import { LinearGradient } from "expo-linear-gradient";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { navigationBus } from "@/services/navigationBus";
import { groupTimelineItems, timelineTargetFor } from "@/services/timeline.service";
import { useTimeline } from "@/hooks/useTimeline";
import {
    TIMELINE_FILTERS,
    eventTypeToLabel,
    type TimelineFilter,
    type TimelineItem,
} from "@/types/timeline";

const eventTypeIcons: Record<TimelineItem["eventType"], IconSvgElement> = {
    reflection: Note01Icon,
    check_in: CheckListIcon,
    conversation: Chat01Icon,
    pattern: Flag02Icon,
    experiment: Target01Icon,
    learning: BookOpen01Icon,
    insight: SparklesIcon,
};

const emptyCopy: Record<TimelineFilter, { title: string; description: string }> = {
    All: {
        title: "Your story starts here.",
        description: "Conversations, reflections, check-ins, and the things Aks notices will gather here over time.",
    },
    Insights: {
        title: "No insights yet.",
        description: "Aks will surface insights here as patterns and experiments settle.",
    },
    Experiments: {
        title: "No experiments yet.",
        description: "Experiments you set up will appear here as you run them.",
    },
    "Check-ins": {
        title: "No check-ins yet.",
        description: "Your daily check-ins will appear here.",
    },
    Decisions: {
        title: "No decisions yet.",
        description: "Patterns Aks notices will appear here as they take shape.",
    },
};

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

type TimelineScreenProps = {
    shouldEnter: boolean;
    onFilterGestureChange?: (pagerEnabled: boolean) => void;
};

export default function TimelineScreen({
    shouldEnter,
    onFilterGestureChange,
}: TimelineScreenProps) {
    const [selectedFilter, setSelectedFilter] =
        useState<TimelineFilter>("All");
    const timeline = useTimeline(selectedFilter);
    const mediumColor = useResolveClassNames("text-text-medium").color;

    const sections = useMemo(
        () => groupTimelineItems(timeline.items),
        [timeline.items],
    );

    const copy = emptyCopy[selectedFilter];

    const handleLoadMore = () => {
        if (timeline.hasMore && !timeline.loadingMore) {
            void timeline.loadMore();
        }
    };

    const handleItemPress = (item: TimelineItem) => {
        const target = timelineTargetFor(item);
        if (target) navigationBus.requestTimelineNavigation(target);
    };

    return (
        <View
            pointerEvents={shouldEnter ? "auto" : "none"}
            style={{ opacity: shouldEnter ? 1 : 0 }}
            className="flex-1 bg-background"
        >
            <Animated.View
                key={shouldEnter ? "page-opened" : "page-waiting"}
                entering={shouldEnter ? FadeInUp.duration(400) : undefined}
                className="flex-1"
            >
                {timeline.loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={mediumColor} accessibilityLabel="Loading your timeline" />
                    </View>
                ) : timeline.error ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <View className="w-full rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="title" className="text-text-high">
                                Unable to load your timeline.
                            </AppText>
                            <AppText className="mt-3 text-text-low">
                                {timeline.error}
                            </AppText>
                            <Button
                                variant="secondary"
                                onPress={() => void timeline.refresh()}
                                className="mt-5"
                            >
                                <AppText variant="button" className="text-text-high">
                                    Try again
                                </AppText>
                            </Button>
                        </View>
                    </View>
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TimelineItem
                                item={item}
                                onPress={() => handleItemPress(item)}
                            />
                        )}
                        renderSectionHeader={({ section }) => (
                            <AppText
                                variant="caption"
                                className="bg-background pb-3 pt-7 tracking-[1.5px] text-text-low"
                            >
                                {section.title.toUpperCase()}
                            </AppText>
                        )}
                        ListHeaderComponent={
                            <TimelineHeader
                                selectedFilter={selectedFilter}
                                onFilterChange={setSelectedFilter}
                                onFilterGestureChange={onFilterGestureChange}
                            />
                        }
                        ListEmptyComponent={
                            <View className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                                <AppText variant="title" className="text-text-high">
                                    {copy.title}
                                </AppText>
                                <AppText className="mt-3 leading-6 text-text-low">
                                    {copy.description}
                                </AppText>
                            </View>
                        }
                        ListFooterComponent={
                            timeline.hasMore || timeline.loadMoreError ? (
                                <View className="items-center py-6">
                                    {timeline.loadingMore ? (
                                        <ActivityIndicator color={mediumColor} accessibilityLabel="Loading more timeline events" />
                                    ) : timeline.loadMoreError ? (
                                        <AppText variant="caption" className="text-red-600">
                                            {timeline.loadMoreError}
                                        </AppText>
                                    ) : null}
                                </View>
                            ) : null
                        }
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.4}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        contentContainerClassName="px-5 pb-24"
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={7}
                    />
                )}
            </Animated.View>
        </View>
    );
}

function TimelineHeader({
    selectedFilter,
    onFilterChange,
    onFilterGestureChange,
}: {
    selectedFilter: TimelineFilter;
    onFilterChange: (filter: TimelineFilter) => void;
    onFilterGestureChange?: (pagerEnabled: boolean) => void;
}) {
    const backgroundColor = useResolveClassNames("bg-background");
    const gradientEndColor = backgroundColor.color ?? "#F2F2F2";

    return (
        <>
            <Animated.View className="pt-8">
                <AppText variant="title" className="text-[18px] text-text-high">
                    Timeline
                </AppText>
                <AppText variant="caption" className="mt-1 text-text-low">
                    Your journey with Aks, over time.
                </AppText>
            </Animated.View>

            <View className="relative">
                <Animated.ScrollView
                    horizontal
                    nestedScrollEnabled
                    directionalLockEnabled
                    showsHorizontalScrollIndicator={false}
                    onTouchStart={() => onFilterGestureChange?.(false)}
                    onTouchEnd={() => onFilterGestureChange?.(true)}
                    onMomentumScrollEnd={() => onFilterGestureChange?.(true)}
                    onScrollEndDrag={() => onFilterGestureChange?.(true)}
                    contentContainerClassName="pr-5"
                    className="-mx-5 mt-7 px-5"
                >
                    {TIMELINE_FILTERS.map((filter, index) => {
                        const selected = selectedFilter === filter;
                        const isLast = index === TIMELINE_FILTERS.length - 1;

                        return (
                            <Pressable
                                key={filter}
                                onPress={() => onFilterChange(filter)}
                                className={cn(
                                    "rounded-full border px-4 py-2.5",
                                    isLast ? "mr-8" : "mr-2.5",
                                    selected
                                        ? "border-primary bg-primary"
                                        : "border-border bg-surface",
                                )}
                            >
                                <AppText
                                    variant="caption"
                                    className={
                                        selected
                                            ? "text-primary-foreground"
                                            : "text-text-medium"
                                    }
                                >
                                    {filter}
                                </AppText>
                            </Pressable>
                        );
                    })}
                </Animated.ScrollView>

                <LinearGradient
                    pointerEvents="none"
                    colors={["transparent", gradientEndColor]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="absolute right-0 top-0 bottom-0 w-10 -mr-5"
                />
            </View>
        </>
    );
}

const TimelineItem = memo(function TimelineItem({
    item,
    onPress,
}: {
    item: TimelineItem;
    onPress: () => void;
}) {
    const iconColor = useResolveClassNames("text-text-medium").color;

    return (
        <Pressable
            onPress={onPress}
            className="mb-3 rounded-[28px] border border-border bg-surface p-5"
        >
            <View className="flex-row items-start">
                <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                    <HugeiconsIcon
                        icon={eventTypeIcons[item.eventType]}
                        size={21}
                        color={iconColor}
                    />
                </View>
                <View className="flex-1">
                    <AppText variant="button" className="text-text-high">
                        {item.title}
                    </AppText>
                    {item.description ? (
                        <AppText className="mt-2 leading-6 text-text-low">
                            {item.description}
                        </AppText>
                    ) : null}
                    <AppText variant="caption" className="mt-3 text-text-disabled">
                        {eventTypeToLabel[item.eventType]} · {formatTime(item.createdAt)}
                    </AppText>
                </View>
                <View className="ml-3 self-center">
                    <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={18}
                        color={iconColor}
                        strokeWidth={1.6}
                    />
                </View>
            </View>
        </Pressable>
    );
});