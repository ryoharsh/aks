import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useLearnings } from "@/hooks/useLearnings";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Learnings">;
export default function LearningsDataScreen({ navigation }: Props) {
    const learnings = useLearnings();
    return <DataCategoryScreen headerTitle="Learnings" eyebrow="YOUR LEARNINGS" title="What the evidence suggests." description="Careful takeaways from experiments you've completed and observations you recorded." icon={BookOpen01Icon} items={learnings.items.map((learning) => ({ id: learning.id, title: learning.title, description: learning.description, meta: `${learning.status === "revised" ? "Revised" : "Active"} · ${learning.evidenceCount} observations · ${formatDate(learning.updatedAt)}` }))} emptyTitle="No learnings yet." emptyDescription="Once you've tested something and gathered enough evidence, Aks can help make sense of what changed." onBack={() => navigation.goBack()} onItemPress={(learningId) => navigation.navigate("LearningDetail", { learningId })} loading={learnings.loading} loadingMore={learnings.loadingMore} hasMore={learnings.hasMore} error={learnings.error} loadMoreError={learnings.loadMoreError} onRetry={() => void learnings.refresh()} onLoadMore={() => void learnings.loadMore()} />;
}
