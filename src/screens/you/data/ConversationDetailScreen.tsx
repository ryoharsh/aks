import { ActivityIndicator, ScrollView, View } from "react-native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, Chat01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useConversation } from "@/hooks/useConversations";
import { formatDateTime } from "@/lib/date";
import type { RootStackParamList, YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "ConversationDetail">;

export default function ConversationDetailScreen({ navigation, route }: Props) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    const data = useConversation(route.params.conversationId);
    const rootNavigation = navigation.getParent()?.getParent<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="flex-1 text-text-high" numberOfLines={1}>{data.conversation?.title ?? "Conversation"}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                {data.loading ? <View className="items-center py-12"><ActivityIndicator color={iconColor} accessibilityLabel="Loading conversation" /></View> : data.error ? (
                    <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Conversation unavailable.</AppText><AppText className="mt-3 text-text-low">{data.error}</AppText><Button variant="secondary" onPress={() => void data.refresh()} className="mt-5"><AppText variant="button" className="text-text-high">Try again</AppText></Button></View>
                ) : data.conversation ? (
                    <>
                        <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                            <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">CONVERSATION HISTORY</AppText>
                            <AppText variant="display" className="text-text-high">{data.conversation.title}</AppText>
                            <AppText variant="caption" className="mt-3 text-text-low">Started {formatDateTime(data.conversation.createdAt)}</AppText>
                        </Animated.View>
                        <Button onPress={() => rootNavigation?.navigate("AiConversation", { conversationId: route.params.conversationId })} className="mt-6"><AppText variant="button" className="text-primary-foreground">Continue in Mirror</AppText></Button>
                        {data.hasMore ? <Button variant="ghost" onPress={() => void data.loadMore()} loading={data.loadingMore} className="mt-6"><AppText variant="button" className="text-text-medium">Load earlier messages</AppText></Button> : null}
                        {data.loadMoreError ? <AppText variant="caption" className="mt-3 text-center text-red-600">{data.loadMoreError}</AppText> : null}
                        <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 gap-4">
                            {data.messages.length ? data.messages.map((message) => {
                                const fromUser = message.role === "user";
                                return <View key={message.id} className={fromUser ? "ml-8" : "mr-8"}><View className="mb-2 flex-row items-center"><View className="mr-2 size-7 items-center justify-center rounded-full bg-surface"><HugeiconsIcon icon={fromUser ? UserIcon : Chat01Icon} size={15} color={iconColor} /></View><AppText variant="caption" className="text-text-low">{fromUser ? "You" : message.role === "assistant" ? "Aks" : "System"} · {formatDateTime(message.createdAt)}</AppText></View><View className={fromUser ? "rounded-3xl border border-border bg-surface p-4" : "rounded-3xl bg-background p-4"}><AppText className="leading-6 text-text-high">{message.content}</AppText></View></View>;
                            }) : <View className="rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">No messages yet.</AppText></View>}
                        </Animated.View>
                    </>
                ) : <View className="mt-8 rounded-[28px] border border-border bg-surface p-5"><AppText variant="title" className="text-text-high">Conversation unavailable.</AppText><AppText className="mt-3 text-text-low">It may have been archived or removed.</AppText></View>}
            </ScrollView>
        </View>
    );
}
