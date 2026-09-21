import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useMemories } from "@/hooks/useMemories";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Memories">;

export default function MemoriesDataScreen({ navigation }: Props) {
    const memories = useMemories();
    return <DataCategoryScreen headerTitle={copy.memories.header} eyebrow={copy.memories.eyebrow} title={copy.memories.title} description={copy.memories.description} icon={SparklesIcon} items={memories.items.map((memory) => ({ id: memory.id, title: memory.content, description: memory.memoryType.replaceAll("_", " "), meta: `${copy.memories.observationsCount(memory.evidenceCount)} · ${copy.memories.lastNoticed(formatDate(memory.lastObservedAt))}` }))} emptyTitle={copy.memories.emptyTitle} emptyDescription={copy.memories.emptyBody} onBack={() => navigation.goBack()} onItemPress={(memoryId) => navigation.navigate("MemoryDetail", { memoryId })} loading={memories.loading} loadingMore={memories.loadingMore} hasMore={memories.hasMore} error={memories.error} loadMoreError={memories.loadMoreError} onRetry={() => void memories.refresh()} onLoadMore={() => void memories.loadMore()} />;
}
