import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { usePatterns } from "@/hooks/usePatterns";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Patterns">;
export default function PatternsDataScreen({ navigation }: Props) {
    const patterns = usePatterns();
    return <DataCategoryScreen
        headerTitle={copy.patterns.header}
        eyebrow={copy.patterns.eyebrow}
        title={copy.patterns.title}
        description={copy.patterns.description}
        icon={SparklesIcon}
        items={patterns.items.map((pattern) => ({ id: pattern.id, title: pattern.title, description: pattern.description, meta: `${statusLabel(pattern.status)} · ${copy.patterns.observationsCount(pattern.evidenceCount)} · ${formatDate(pattern.lastObservedAt)}` }))}
        emptyTitle={copy.patterns.emptyTitle}
        emptyDescription={copy.patterns.emptyBody}
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
    const labels = copy.patterns.status;
    return status === "possible" ? labels.possible : status === "not_supported" ? labels.notSupported : status === "supported" ? labels.supported : status === "testing" ? labels.testing : labels.fallback;
}
