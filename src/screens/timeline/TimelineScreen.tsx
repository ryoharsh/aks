import { memo, useMemo, useState } from "react";
import {
    Pressable,
    SectionList,
    View,
} from "react-native";
import Animated, {
    FadeInUp,
} from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import {
    mockTimelineEvents,
    timelineFilters,
    timelineGroups,
    type TimelineEvent,
    type TimelineFilter,
} from "@/data/mockTimeline";
import { LinearGradient } from "expo-linear-gradient";

type TimelineSection = {
    title: string;
    data: TimelineEvent[];
};

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
    const [status] = useState<"ready" | "loading" | "error">("ready");
    const [refreshing, setRefreshing] = useState(false);

    const sections = useMemo<TimelineSection[]>(() => {
        const filtered =
            selectedFilter === "All"
                ? mockTimelineEvents
                : mockTimelineEvents.filter(
                    (event) => event.type === selectedFilter,
                );

        return timelineGroups
            .map((group) => ({
                title: group,
                data: filtered.filter((event) => event.group === group),
            }))
            .filter((section) => section.data.length > 0);
    }, [selectedFilter]);

    const refresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    if (status === "loading") {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <AppText variant="title" className="text-text-high">
                    Loading your timeline…
                </AppText>
                <AppText className="mt-2 text-center text-text-low">
                    Bringing your recent journey together.
                </AppText>
            </View>
        );
    }

    if (status === "error") {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <AppText variant="title" className="text-center text-text-high">
                    Unable to load your timeline.
                </AppText>
                <AppText className="mt-2 text-center text-text-low">
                    Please check your connection and try again.
                </AppText>
                <Pressable
                    onPress={refresh}
                    className="mt-6 rounded-full bg-primary px-6 py-3"
                >
                    <AppText variant="button" className="text-primary-foreground">
                        Try again
                    </AppText>
                </Pressable>
            </View>
        );
    }

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
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TimelineItem
                            item={item}
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
                            shouldEnter={shouldEnter}
                        />
                    }
                    ListEmptyComponent={
                        <View className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="title" className="text-text-high">
                                {selectedFilter === "All"
                                    ? "Your story starts here."
                                    : "Nothing here yet."}
                            </AppText>
                            <AppText className="mt-3 leading-6 text-text-low">
                                {selectedFilter === "All"
                                    ? "As you reflect, check in, experiment, and learn, your timeline will grow with you."
                                    : `You haven't recorded any ${selectedFilter.toLowerCase()} yet.`}
                            </AppText>
                        </View>
                    }
                    refreshing={refreshing}
                    onRefresh={refresh}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                    contentContainerClassName="px-5 pb-24"
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={7}
                />
            </Animated.View>
        </View>
    );
}

function TimelineHeader({
    selectedFilter,
    onFilterChange,
    onFilterGestureChange,
    shouldEnter,
}: {
    selectedFilter: TimelineFilter;
    onFilterChange: (filter: TimelineFilter) => void;
    onFilterGestureChange?: (pagerEnabled: boolean) => void;
    shouldEnter: boolean;
}) {
    const backgroundColor = useResolveClassNames('bg-background');
    const gradientEndColor = backgroundColor.color ?? "#F2F2F2";

    return (
        <>
            <Animated.View
                className="pt-8"
            >
                <AppText variant="title" className="text-[18px] text-text-high">
                    Timeline
                </AppText>
                <AppText variant="caption" className="mt-1 text-text-low">
                    Your journey with Aks, over time.
                </AppText>
            </Animated.View>

            <Animated.View
                className="mt-8"
            >
                <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">
                    YOUR JOURNEY
                </AppText>
                <AppText variant="display" className="text-text-high">
                    Your story, as it unfolds.
                </AppText>
                <AppText className="mt-3 leading-6 text-text-low">
                    See the moments, patterns, experiments, and learnings that
                    shaped your journey with Aks.
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
                    {timelineFilters.map((filter, index) => {
                        const selected = selectedFilter === filter;
                        const isLast = index === timelineFilters.length - 1;

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
}: {
    item: TimelineEvent;
}) {
    const iconColor = useResolveClassNames("text-text-medium").color;

    return (
        <Animated.View
            className="mb-3 rounded-[28px] border border-border bg-surface p-5"
        >
            <View className="flex-row items-start">
                <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                    <HugeiconsIcon
                        icon={item.icon}
                        size={21}
                        color={iconColor}
                    />
                </View>
                <View className="flex-1">
                    {item.annotation ? (
                        <View className="mb-2 self-start rounded-full bg-background px-3 py-1">
                            <AppText
                                variant="caption"
                                className="text-[10px] tracking-[0.8px] text-text-medium"
                            >
                                {item.annotation.toUpperCase()}
                            </AppText>
                        </View>
                    ) : null}
                    <AppText variant="button" className="text-text-high">
                        {item.title}
                    </AppText>
                    <AppText className="mt-2 leading-6 text-text-low">
                        {item.description}
                    </AppText>
                    <AppText variant="caption" className="mt-3 text-text-disabled">
                        {item.group} · {item.time}
                    </AppText>
                </View>
            </View>
        </Animated.View>
    );
});
