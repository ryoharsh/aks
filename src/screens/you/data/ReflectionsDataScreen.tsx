import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Note01Icon } from "@hugeicons/core-free-icons";

import DataCategoryScreen from "@/components/data/DataCategoryScreen";
import { useReflections } from "@/hooks/useYourData";
import { formatDateTime } from "@/lib/date";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "Reflections">;

export default function ReflectionsDataScreen({ navigation }: Props) {
    const data = useReflections();
    const items = data.items.map((reflection) => ({
        id: reflection.id,
        title: copy.reflections.itemTitle,
        description: reflection.content,
        meta: formatDateTime(reflection.createdAt),
    }));
    return <DataCategoryScreen headerTitle={copy.reflections.header} eyebrow={copy.reflections.eyebrow} title={copy.reflections.title} description={copy.reflections.description} icon={Note01Icon} items={items} emptyTitle={copy.reflections.emptyTitle} emptyDescription={copy.reflections.emptyBody} loading={data.loading} loadingMore={data.loadingMore} hasMore={data.hasMore} error={data.error} loadMoreError={data.loadMoreError} onRetry={() => void data.refresh()} onLoadMore={() => void data.loadMore()} onBack={() => navigation.goBack()} />;
}
