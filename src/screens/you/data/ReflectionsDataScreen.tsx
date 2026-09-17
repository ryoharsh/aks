import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Note01Icon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useReflections } from "@/hooks/useYourData";
import { formatDateTime } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "Reflections">;

export default function ReflectionsDataScreen({ navigation }: Props) {
    const data = useReflections();
    const items = data.items.map((reflection) => ({
        id: reflection.id,
        title: "Reflection",
        description: reflection.content,
        meta: formatDateTime(reflection.createdAt),
    }));
    return <DataCategoryScreen headerTitle="Reflections" eyebrow="YOUR REFLECTIONS" title="Things you've shared." description="Review the reflections that give Aks context about your experiences." icon={Note01Icon} items={items} emptyTitle="No reflections yet." emptyDescription="Your reflections will appear here when you begin sharing them with Aks." loading={data.loading} loadingMore={data.loadingMore} hasMore={data.hasMore} error={data.error} loadMoreError={data.loadMoreError} onRetry={() => void data.refresh()} onLoadMore={() => void data.loadMore()} onBack={() => navigation.goBack()} />;
}
