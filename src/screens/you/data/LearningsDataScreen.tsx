import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useLearnings } from "@/hooks/useLearnings";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Learnings">;
export default function LearningsDataScreen({ navigation }: Props) {
    const learnings = useLearnings();
    return <DataCategoryScreen headerTitle={copy.learnings.header} eyebrow={copy.learnings.eyebrow} title={copy.learnings.title} description={copy.learnings.description} icon={BookOpen01Icon} items={learnings.items.map((learning) => ({ id: learning.id, title: learning.title, description: learning.description, meta: `${learning.status === "revised" ? copy.learnings.statusRevised : copy.learnings.statusActive} · ${copy.learnings.observationsCount(learning.evidenceCount)} · ${formatDate(learning.updatedAt)}` }))} emptyTitle={copy.learnings.emptyTitle} emptyDescription={copy.learnings.emptyBody} onBack={() => navigation.goBack()} onItemPress={(learningId) => navigation.navigate("LearningDetail", { learningId })} loading={learnings.loading} loadingMore={learnings.loadingMore} hasMore={learnings.hasMore} error={learnings.error} loadMoreError={learnings.loadMoreError} onRetry={() => void learnings.refresh()} onLoadMore={() => void learnings.loadMore()} />;
}
