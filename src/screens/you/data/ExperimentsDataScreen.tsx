import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Target01Icon } from "@hugeicons/core-free-icons";
import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useExperiments } from "@/hooks/useExperiments";
import { formatDate } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Experiments">;
export default function ExperimentsDataScreen({ navigation }: Props) {
    const experiments = useExperiments();
    return <DataCategoryScreen headerTitle="Experiments" eyebrow="YOUR EXPERIMENTS" title="Small tests, useful evidence." description="Experiments help you test a possible pattern without treating it as fact." icon={Target01Icon} items={experiments.items.map((experiment) => ({ id: experiment.id, title: experiment.title, description: experiment.hypothesis, meta: `${statusLabel(experiment.status)} · ${experiment.observationCount} observations · ${formatDate(experiment.updatedAt)}` }))} emptyTitle="No experiments yet." emptyDescription="When a pattern is worth testing, you can run a small experiment around it." onBack={() => navigation.goBack()} onItemPress={(experimentId) => navigation.navigate("ExperimentDetail", { experimentId })} loading={experiments.loading} loadingMore={experiments.loadingMore} hasMore={experiments.hasMore} error={experiments.error} loadMoreError={experiments.loadMoreError} onRetry={() => void experiments.refresh()} onLoadMore={() => void experiments.loadMore()} />;
}

function statusLabel(status: string) {
    return status === "active" ? "Active" : status === "completed" ? "Completed" : status === "cancelled" ? "Cancelled" : "Draft";
}
