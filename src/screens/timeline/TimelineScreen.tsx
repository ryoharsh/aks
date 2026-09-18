import { memo, useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
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
import {
    curateTimelineEntries,
    groupTimelineEntries,
    timelineTargetFor,
} from "@/services/timeline.service";
import { useTimeline } from "@/hooks/useTimeline";
import {
    TIMELINE_FILTERS,
    type TimelineEntry,
    type TimelineFilter,
} from "@/types/timeline";

const entryIcons: Record<TimelineEntry["type"], IconSvgElement> = {
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
        title: "Your story is still unfolding.",
        description: "As you talk with Aks, meaningful moments, patterns, experiments, and learnings will appear here.",
    },
    Insights: {
        title: "No insights yet.",
        description: "Meaningful insights will appear here as Aks sees enough evidence over time.",
    },
    Experiments: {
        title: "No experiments yet.",
        description: "Experiments you set up will appear here as you run them.",
    },
    "Check-ins": {
        title: "No check-ins yet.",
        description: "Your meaningful check-ins will appear here.",
    },
    Decisions: {
        title: "No decisions yet.",
        description: "Decisions and patterns Aks notices will appear here as they take shape.",
    },
    Learnings: {
        title: "No learnings yet.",
        description: "New learnings will appear here as your story becomes clearer.",
    },
};

function formatMetadata(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const created = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = Math.round((today.getTime() - created.getTime()) / 86_400_000);
    const prefix = day === 0 ? "Today" : day === 1 ? "Yesterday" : day < 7 ? "This week" : "Older";
    const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
    return `${prefix} · ${time}`;
}

type TimelineScreenProps = {
    shouldEnter: boolean;
    onFilterGestureChange?: (pagerEnabled: boolean) => void;
};

export default function TimelineScreen({ shouldEnter, onFilterGestureChange }: TimelineScreenProps) {
    const [selectedFilter, setSelectedFilter] = useState<TimelineFilter>("All");
    const timeline = useTimeline(selectedFilter);
    const mediumColor = useResolveClassNames("text-text-medium").color;
    const entries = useMemo(() => curateTimelineEntries(timeline.items), [timeline.items]);
    const sections = useMemo(() => groupTimelineEntries(entries), [entries]);
    const copy = emptyCopy[selectedFilter];

    const handleLoadMore = () => {
        if (timeline.hasMore && !timeline.loadingMore) void timeline.loadMore();
    };

    const handleEntryPress = (entry: TimelineEntry) => {
        const target = timelineTargetFor(entry.source);
        if (target) navigationBus.requestTimelineNavigation(target);
    };

    return (
        <View pointerEvents={shouldEnter ? "auto" : "none"} style={{ opacity: shouldEnter ? 1 : 0 }} className="flex-1 bg-background">
            <Animated.View key={shouldEnter ? "page-opened" : "page-waiting"} entering={shouldEnter ? FadeInUp.duration(400) : undefined} className="flex-1">
                {timeline.error ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <View className="w-full rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="title" className="text-text-high">Couldn't load your timeline.</AppText>
                            <AppText className="mt-3 text-text-low">Your story is still here. Try again in a moment.</AppText>
                            <Button variant="secondary" onPress={() => void timeline.refresh()} className="mt-5">
                                <AppText variant="button" className="text-text-high">Try again</AppText>
                            </Button>
                        </View>
                    </View>
                ) : (
                    <SectionList
                        sections={timeline.loading ? [] : sections}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item, index }) => <TimelineEntryCard entry={item} index={index} onPress={() => handleEntryPress(item)} />}
                        renderSectionHeader={({ section }) => <AppText variant="caption" className="bg-background pb-3 pt-7 tracking-[1.5px] text-text-low">{section.title.toUpperCase()}</AppText>}
                        ListHeaderComponent={<TimelineHeader selectedFilter={selectedFilter} onFilterChange={setSelectedFilter} onFilterGestureChange={onFilterGestureChange} />}
                        ListEmptyComponent={timeline.loading ? <TimelineSkeleton /> : <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">{copy.title}</AppText><AppText className="mt-3 leading-6 text-text-low">{copy.description}</AppText></View>}
                        ListFooterComponent={timeline.hasMore || timeline.loadMoreError ? <View className="items-center py-6">{timeline.loadingMore ? <TimelineSkeleton compact /> : timeline.loadMoreError ? <AppText variant="caption" className="text-red-600">Couldn't load more of your story.</AppText> : null}</View> : null}
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

function TimelineHeader({ selectedFilter, onFilterChange, onFilterGestureChange }: { selectedFilter: TimelineFilter; onFilterChange: (filter: TimelineFilter) => void; onFilterGestureChange?: (pagerEnabled: boolean) => void }) {
    const backgroundColor = useResolveClassNames("bg-background").color ?? "#F2F2F2";
    return (
        <>
            <Animated.View entering={FadeIn.duration(350)} className="pt-8">
                <AppText variant="title" className="text-[18px] text-text-high">Timeline</AppText>
                <AppText variant="caption" className="mt-1 text-text-low">Your journey with Aks, over time.</AppText>
            </Animated.View>
            <Animated.View entering={FadeInUp.duration(450).delay(80)} className="mt-8">
                <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">YOUR JOURNEY</AppText>
                <AppText variant="display" className="text-text-high">Your story, as it unfolds.</AppText>
                <AppText className="mt-3 leading-6 text-text-low">See the moments, patterns, experiments, and learnings that shaped your journey with Aks.</AppText>
            </Animated.View>
            <View className="relative">
                <Animated.ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} onTouchStart={() => onFilterGestureChange?.(false)} onTouchEnd={() => onFilterGestureChange?.(true)} onMomentumScrollEnd={() => onFilterGestureChange?.(true)} onScrollEndDrag={() => onFilterGestureChange?.(true)} contentContainerClassName="pr-5" className="-mx-5 mt-7 px-5">
                    {TIMELINE_FILTERS.map((filter, index) => (
                        <Pressable key={filter} onPress={() => onFilterChange(filter)} className={cn("rounded-full border px-4 py-2.5", index === TIMELINE_FILTERS.length - 1 ? "mr-8" : "mr-2.5", selectedFilter === filter ? "border-text-high bg-text-high" : "border-border bg-surface")}>
                            <AppText variant="caption" className={selectedFilter === filter ? "text-background" : "text-text-medium"}>{filter}</AppText>
                        </Pressable>
                    ))}
                </Animated.ScrollView>
                <LinearGradient pointerEvents="none" colors={["transparent", backgroundColor]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="absolute bottom-0 right-0 top-0 -mr-5 w-10" />
            </View>
        </>
    );
}

const TimelineEntryCard = memo(function TimelineEntryCard({ entry, index, onPress }: { entry: TimelineEntry; index: number; onPress: () => void }) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    return (
        <Animated.View entering={FadeInUp.duration(350).delay(Math.min(index, 5) * 45)}>
            <Pressable onPress={onPress} className="mb-3 rounded-[28px] border border-border bg-surface p-5">
                <View className="flex-row items-start">
                    <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                        <HugeiconsIcon icon={entryIcons[entry.type]} size={21} color={iconColor} />
                    </View>
                    <View className="flex-1">
                        {entry.eyebrow ? (
                            <AppText
                                variant="caption"
                                className="self-start mb-2 rounded-full bg-background px-2.5 py-1 text-[11px] tracking-[1.2px] text-text-low"
                            >
                                {entry.eyebrow}
                            </AppText>
                        ) : null}
                        <AppText variant="button" className="text-text-high">{entry.title}</AppText>
                        {entry.description ? <AppText className="mt-2 leading-6 text-text-low">{entry.description}</AppText> : null}
                        <AppText variant="caption" className="mt-3 text-text-disabled">{formatMetadata(entry.createdAt)}</AppText>
                    </View>
                    <View className="ml-3 self-center"><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={iconColor} strokeWidth={1.6} /></View>
                </View>
            </Pressable>
        </Animated.View>
    );
});

function TimelineSkeleton({ compact = false }: { compact?: boolean }) {
    return <View className={cn("w-full rounded-[28px] border border-border bg-surface p-5", compact ? "h-20" : "mt-8 h-32")}><View className="h-3 w-28 rounded-full bg-background" /><View className="mt-4 h-4 w-3/4 rounded-full bg-background" /><View className="mt-3 h-3 w-1/2 rounded-full bg-background" /></View>;
}
