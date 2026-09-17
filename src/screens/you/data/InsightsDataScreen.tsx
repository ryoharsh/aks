import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useInsights } from "@/hooks/useInsights";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Insights">;

export default function InsightsDataScreen({ navigation }: Props) {
    const insights = useInsights();
    return <DataCategoryScreen headerTitle="Insights" eyebrow="INSIGHTS" title="Something worth noticing." description="A small set of timely observations grounded in what you've tested and learned." icon={SparklesIcon} items={insights.items.map((insight) => ({ id: insight.id, title: insight.title, description: insight.content, meta: `${insight.status === "new" ? "New" : "Seen"} · ${formatDate(insight.createdAt)}` }))} emptyTitle="No insights yet." emptyDescription="As Aks sees enough evidence over time, useful things will start to stand out." onBack={() => navigation.goBack()} onItemPress={(insightId) => navigation.navigate("InsightDetail", { insightId })} loading={insights.loading} loadingMore={insights.loadingMore} hasMore={insights.hasMore} error={insights.error} loadMoreError={insights.loadMoreError} onRetry={() => void insights.refresh()} onLoadMore={() => void insights.loadMore()} />;
}
