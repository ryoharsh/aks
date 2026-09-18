import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";

type DataItem = {
    id: string;
    title: string;
    description: string;
    meta: string;
};

type DataCategoryScreenProps = {
    headerTitle: string;
    eyebrow: string;
    title: string;
    description: string;
    icon: IconSvgElement;
    items: DataItem[];
    emptyTitle: string;
    emptyDescription: string;
    onBack: () => void;
    loading?: boolean;
    loadingMore?: boolean;
    hasMore?: boolean;
    error?: string | null;
    loadMoreError?: string | null;
    onRetry?: () => void;
    onLoadMore?: () => void;
    onItemPress?: (id: string) => void;
};

export default function DataCategoryScreen({
    headerTitle,
    eyebrow,
    title,
    description,
    icon,
    items,
    emptyTitle,
    emptyDescription,
    onBack,
    loading = false,
    loadingMore = false,
    hasMore = false,
    error,
    loadMoreError,
    onRetry,
    onLoadMore,
    onItemPress,
}: DataCategoryScreenProps) {
    const iconColor = useResolveClassNames("text-text-medium").color;

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={onBack} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">{headerTitle}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{description}</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">RECENT</AppText>
                    {loading ? (
                        <View className="items-center py-10"><ActivityIndicator color={iconColor} accessibilityLabel={`Loading ${headerTitle}`} /></View>
                    ) : error ? (
                        <View className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="title" className="text-text-high">Unable to load this data.</AppText>
                            <AppText className="mt-3 text-text-low">{error}</AppText>
                            {onRetry ? <Button variant="secondary" onPress={onRetry} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button> : null}
                        </View>
                    ) : items.length > 0 ? (
                        <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                            {items.map((item, index) => (
                                <Pressable key={item.id} disabled={!onItemPress} onPress={() => onItemPress?.(item.id)} className={`flex-row px-5 py-5 ${index < items.length - 1 ? "border-b border-border" : ""}`}>
                                    <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                        <HugeiconsIcon icon={icon} size={21} color={iconColor} />
                                    </View>
                                    <View className="flex-1">
                                        <AppText variant="button" className="text-text-high">{item.title}</AppText>
                                        <AppText variant="caption" className="mt-1 leading-5 text-text-low">{item.description}</AppText>
                                        <AppText variant="caption" className="mt-2 text-text-disabled">{item.meta}</AppText>
                                    </View>
                                </Pressable>
                            ))}
                            {hasMore && onLoadMore ? (
                                <Button variant="ghost" onPress={onLoadMore} loading={loadingMore} className="border-t border-border">
                                    <AppText variant="button" className="text-text-medium">Load more</AppText>
                                </Button>
                            ) : null}
                            {loadMoreError ? <AppText variant="caption" className="px-5 py-3 text-red-600">{loadMoreError}</AppText> : null}
                        </View>
                    ) : (
                        <View className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="title" className="text-text-high">{emptyTitle}</AppText>
                            <AppText className="mt-3 leading-6 text-text-low">{emptyDescription}</AppText>
                        </View>
                    )}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">A NOTE FROM AKS</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">These are placeholder entries until your account data is connected.</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
