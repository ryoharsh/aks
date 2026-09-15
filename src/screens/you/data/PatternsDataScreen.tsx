import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SparklesIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Patterns">;

const items = [
    { id: "pattern-1", title: "Unscheduled mornings", description: "Your focus often feels clearer on mornings with fewer early commitments.", meta: "Based on recent entries" },
    { id: "pattern-2", title: "Movement and energy", description: "Brief walks often appear near check-ins where your energy improved.", meta: "Possible pattern" },
    { id: "pattern-3", title: "Task size and momentum", description: "Smaller first steps may make difficult tasks easier to begin.", meta: "Worth exploring" },
];

export default function PatternsDataScreen({ navigation }: Props) {
    return <DataCategoryScreen headerTitle="Patterns" eyebrow="YOUR PATTERNS" title="Connections worth noticing." description="Review possible patterns Aks has organized from the activity you provide." icon={SparklesIcon} items={items} emptyTitle="No patterns yet." emptyDescription="Patterns will appear as you add enough reflections, check-ins, and experiment outcomes." onBack={() => navigation.goBack()} />;
}
