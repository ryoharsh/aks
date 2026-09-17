import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useMemories } from "@/hooks/useMemories";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Memories">;

export default function MemoriesDataScreen({ navigation }: Props) {
    const memories = useMemories();
    return <DataCategoryScreen headerTitle="What Aks remembers" eyebrow="WHAT AKS REMEMBERS" title="Useful context, carefully kept." description="Things Aks has picked up from repeated, evidence-backed information you've shared." icon={SparklesIcon} items={memories.items.map((memory) => ({ id: memory.id, title: memory.content, description: memory.memoryType.replaceAll("_", " "), meta: `${memory.evidenceCount} ${memory.evidenceCount === 1 ? "observation" : "observations"} · Last noticed ${formatDate(memory.lastObservedAt)}` }))} emptyTitle="Aks is still getting to know your patterns." emptyDescription="Repeated, useful context will appear here when there is enough evidence to remember it." onBack={() => navigation.goBack()} onItemPress={(memoryId) => navigation.navigate("MemoryDetail", { memoryId })} loading={memories.loading} loadingMore={memories.loadingMore} hasMore={memories.hasMore} error={memories.error} loadMoreError={memories.loadMoreError} onRetry={() => void memories.refresh()} onLoadMore={() => void memories.loadMore()} />;
}
