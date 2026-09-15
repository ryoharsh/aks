import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Learnings">;

const items = [
    { id: "learning-1", title: "Space helps me focus", description: "A less structured first hour may help me start the day with more clarity.", meta: "From Phone-free first hour" },
    { id: "learning-2", title: "Movement resets my energy", description: "A short walk can make the afternoon feel more manageable.", meta: "From Walk after lunch" },
    { id: "learning-3", title: "Starting smaller reduces friction", description: "I begin more consistently when the first step feels easy to finish.", meta: "From Smaller first task" },
];

export default function LearningsDataScreen({ navigation }: Props) {
    return <DataCategoryScreen headerTitle="Learnings" eyebrow="YOUR LEARNINGS" title="What you've discovered." description="Review the conclusions you've chosen to keep from your experiments and reflections." icon={BookOpen01Icon} items={items} emptyTitle="No learnings yet." emptyDescription="Learnings will appear here as you complete experiments and reflect on their outcomes." onBack={() => navigation.goBack()} />;
}
