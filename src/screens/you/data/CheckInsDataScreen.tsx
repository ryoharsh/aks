import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CheckListIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useCheckIns } from "@/hooks/useYourData";
import { formatDateTime } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "CheckIns">;

function summary(checkIn: ReturnType<typeof useCheckIns>["items"][number]) {
    const values = [
        checkIn.energy == null ? null : `Energy ${checkIn.energy}`,
        checkIn.focus == null ? null : `Focus ${checkIn.focus}`,
        checkIn.stress == null ? null : `Stress ${checkIn.stress}`,
    ].filter(Boolean);
    return values.join(" · ") || checkIn.notes || "No additional details";
}

export default function CheckInsDataScreen({ navigation }: Props) {
    const data = useCheckIns();
    const items = data.items.map((checkIn) => ({
        id: checkIn.id,
        title: checkIn.mood ? `${checkIn.mood.charAt(0).toUpperCase()}${checkIn.mood.slice(1)} check-in` : "Check-in",
        description: summary(checkIn),
        meta: formatDateTime(checkIn.createdAt),
    }));
    return <DataCategoryScreen headerTitle="Check-ins" eyebrow="YOUR CHECK-INS" title="Small moments, remembered." description="Review the check-ins you've used to capture how things felt over time." icon={CheckListIcon} items={items} emptyTitle="No check-ins yet." emptyDescription="Your check-ins will appear here once you begin recording them." loading={data.loading} loadingMore={data.loadingMore} hasMore={data.hasMore} error={data.error} loadMoreError={data.loadMoreError} onRetry={() => void data.refresh()} onLoadMore={() => void data.loadMore()} onBack={() => navigation.goBack()} />;
}
