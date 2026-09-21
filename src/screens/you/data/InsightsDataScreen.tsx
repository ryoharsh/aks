import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useInsights } from "@/hooks/useInsights";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Insights">;

export default function InsightsDataScreen({ navigation }: Props) {
    const insights = useInsights();
    return <DataCategoryScreen headerTitle={copy.insights.header} eyebrow={copy.insights.eyebrow} title={copy.insights.title} description={copy.insights.description} icon={SparklesIcon} items={insights.items.map((insight) => ({ id: insight.id, title: insight.title, description: insight.content, meta: `${insight.status === "new" ? copy.insights.statusNew : copy.insights.statusSeen} · ${formatDate(insight.createdAt)}` }))} emptyTitle={copy.insights.emptyTitle} emptyDescription={copy.insights.emptyBody} onBack={() => navigation.goBack()} onItemPress={(insightId) => navigation.navigate("InsightDetail", { insightId })} loading={insights.loading} loadingMore={insights.loadingMore} hasMore={insights.hasMore} error={insights.error} loadMoreError={insights.loadMoreError} onRetry={() => void insights.refresh()} onLoadMore={() => void insights.loadMore()} />;
}
