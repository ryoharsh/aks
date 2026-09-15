import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Target01Icon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Experiments">;

const items = [
    { id: "experiment-1", title: "Phone-free first hour", description: "Notice whether delaying notifications changes morning focus.", meta: "Active · Day 5 of 7" },
    { id: "experiment-2", title: "Walk after lunch", description: "Track afternoon energy after a short walk.", meta: "Completed" },
    { id: "experiment-3", title: "Smaller first task", description: "Begin with one task that can be finished in fifteen minutes.", meta: "Completed" },
];

export default function ExperimentsDataScreen({ navigation }: Props) {
    return <DataCategoryScreen headerTitle="Experiments" eyebrow="YOUR EXPERIMENTS" title="What you've tried." description="Review experiments you've started and the outcomes you've chosen to record." icon={Target01Icon} items={items} emptyTitle="No experiments yet." emptyDescription="Experiments will appear here when you begin testing small changes." onBack={() => navigation.goBack()} />;
}
