import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Target01Icon } from "@hugeicons/core-free-icons";
import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useExperiments } from "@/hooks/useExperiments";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Experiments">;
export default function ExperimentsDataScreen({ navigation }: Props) {
    const experiments = useExperiments();
    return <DataCategoryScreen headerTitle={copy.experiments.header} eyebrow={copy.experiments.eyebrow} title={copy.experiments.title} description={copy.experiments.description} icon={Target01Icon} items={experiments.items.map((experiment) => ({ id: experiment.id, title: experiment.title, description: experiment.hypothesis, meta: `${statusLabel(experiment.status)} · ${copy.experiments.observationsCount(experiment.observationCount)} · ${formatDate(experiment.updatedAt)}` }))} emptyTitle={copy.experiments.emptyTitle} emptyDescription={copy.experiments.emptyBody} onBack={() => navigation.goBack()} onItemPress={(experimentId) => navigation.navigate("ExperimentDetail", { experimentId })} loading={experiments.loading} loadingMore={experiments.loadingMore} hasMore={experiments.hasMore} error={experiments.error} loadMoreError={experiments.loadMoreError} onRetry={() => void experiments.refresh()} onLoadMore={() => void experiments.loadMore()} />;
}

function statusLabel(status: string) {
    const labels = copy.experiments.status;
    return status === "active" ? labels.active : status === "completed" ? labels.completed : status === "cancelled" ? labels.cancelled : labels.fallback;
}
