import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CheckListIcon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useCheckIns } from "@/hooks/useYourData";
import { formatDateTime } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "CheckIns">;

function summary(checkIn: ReturnType<typeof useCheckIns>["items"][number]) {
    const values = [
        checkIn.energy == null ? null : copy.checkIns.energy(checkIn.energy),
        checkIn.focus == null ? null : copy.checkIns.focus(checkIn.focus),
        checkIn.stress == null ? null : copy.checkIns.stress(checkIn.stress),
    ].filter(Boolean);
    return values.join(" · ") || checkIn.notes || copy.checkIns.noDetails;
}

export default function CheckInsDataScreen({ navigation }: Props) {
    const data = useCheckIns();
    const items = data.items.map((checkIn) => ({
        id: checkIn.id,
        title: checkIn.mood ? copy.checkIns.itemTitle(checkIn.mood.charAt(0).toUpperCase() + checkIn.mood.slice(1)) : copy.checkIns.itemFallback,
        description: summary(checkIn),
        meta: formatDateTime(checkIn.createdAt),
    }));
    return <DataCategoryScreen headerTitle={copy.checkIns.header} eyebrow={copy.checkIns.eyebrow} title={copy.checkIns.title} description={copy.checkIns.description} icon={CheckListIcon} items={items} emptyTitle={copy.checkIns.emptyTitle} emptyDescription={copy.checkIns.emptyBody} loading={data.loading} loadingMore={data.loadingMore} hasMore={data.hasMore} error={data.error} loadMoreError={data.loadMoreError} onRetry={() => void data.refresh()} onLoadMore={() => void data.loadMore()} onBack={() => navigation.goBack()} />;
}
