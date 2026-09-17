import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { usePatterns } from "@/hooks/usePatterns";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Patterns">;
export default function PatternsDataScreen({ navigation }: Props) {
    const patterns = usePatterns();
    return <DataCategoryScreen
        headerTitle="Patterns"
        eyebrow="YOUR PATTERNS"
        title="Connections worth noticing."
        description="Possible relationships grounded in repeated signals from what you've shared."
        icon={SparklesIcon}
        items={patterns.items.map((pattern) => ({ id: pattern.id, title: pattern.title, description: pattern.description, meta: `${statusLabel(pattern.status)} · ${pattern.evidenceCount} observations · ${formatDate(pattern.lastObservedAt)}` }))}
        emptyTitle="No patterns yet."
        emptyDescription="Aks needs a little more time and evidence before it can spot useful connections."
        onBack={() => navigation.goBack()}
        onItemPress={(patternId) => navigation.navigate("PatternDetail", { patternId })}
        loading={patterns.loading}
        loadingMore={patterns.loadingMore}
        hasMore={patterns.hasMore}
        error={patterns.error}
        loadMoreError={patterns.loadMoreError}
        onRetry={() => void patterns.refresh()}
        onLoadMore={() => void patterns.loadMore()}
    />;
}

function statusLabel(status: string) {
    return status === "possible" ? "Possible pattern" : status === "not_supported" ? "Not supported" : status === "supported" ? "Supported" : status === "testing" ? "Being tested" : "Candidate";
}
