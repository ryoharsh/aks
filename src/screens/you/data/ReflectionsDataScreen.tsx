import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Note01Icon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Reflections">;

const items = [
    { id: "reflection-1", title: "A quieter start", description: "I felt more focused after leaving the first hour of the day unscheduled.", meta: "Today" },
    { id: "reflection-2", title: "Energy after lunch", description: "A short walk seemed to help me return with more energy.", meta: "Yesterday" },
    { id: "reflection-3", title: "What helped this week", description: "Smaller tasks made it easier to begin when motivation was low.", meta: "3 days ago" },
];

export default function ReflectionsDataScreen({ navigation }: Props) {
    return <DataCategoryScreen headerTitle="Reflections" eyebrow="YOUR REFLECTIONS" title="Things you've shared." description="Review the reflections that give Aks context about your experiences." icon={Note01Icon} items={items} emptyTitle="No reflections yet." emptyDescription="Your reflections will appear here when you begin sharing them with Aks." onBack={() => navigation.goBack()} />;
}
