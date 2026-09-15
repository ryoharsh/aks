import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CheckListIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "CheckIns">;

const items = [
    { id: "check-in-1", title: "Morning check-in", description: "Energy steady · Focus clear", meta: "Today, 8:20 AM" },
    { id: "check-in-2", title: "Evening check-in", description: "Energy low · Mood calm", meta: "Yesterday, 9:10 PM" },
    { id: "check-in-3", title: "Afternoon check-in", description: "Energy improving · Focus mixed", meta: "2 days ago" },
];

export default function CheckInsDataScreen({ navigation }: Props) {
    return <DataCategoryScreen headerTitle="Check-ins" eyebrow="YOUR CHECK-INS" title="Small moments, remembered." description="Review the check-ins you've used to capture how things felt over time." icon={CheckListIcon} items={items} emptyTitle="No check-ins yet." emptyDescription="Your check-ins will appear here once you begin recording them." onBack={() => navigation.goBack()} />;
}
