import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, Chat01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { mockConversations } from "@/data/mockConversations";
import type { YourDataStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YourDataStackParamList, "ConversationDetail">;

export default function ConversationDetailScreen({ navigation, route }: Props) {
    const iconColor = useResolveClassNames("text-text-medium").color;
    const conversation = mockConversations.find((item) => item.id === route.params.conversationId);

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="flex-1 text-text-high" numberOfLines={1}>Conversation</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                {conversation ? (
                    <>
                        <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                            <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">CONVERSATION HISTORY</AppText>
                            <AppText variant="display" className="text-text-high">{conversation.title}</AppText>
                            <AppText variant="caption" className="mt-3 text-text-low">{conversation.group} · {conversation.messages.at(0)?.createdAt}</AppText>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9 gap-4">
                            {conversation.messages.map((message) => {
                                const fromUser = message.role === "user";
                                return (
                                    <View key={message.id} className={fromUser ? "ml-8" : "mr-8"}>
                                        <View className="mb-2 flex-row items-center">
                                            <View className="mr-2 size-7 items-center justify-center rounded-full bg-surface">
                                                <HugeiconsIcon icon={fromUser ? UserIcon : Chat01Icon} size={15} color={iconColor} />
                                            </View>
                                            <AppText variant="caption" className="text-text-low">{fromUser ? "You" : "Aks"} · {message.createdAt}</AppText>
                                        </View>
                                        <View className={fromUser ? "rounded-3xl border border-border bg-surface p-4" : "rounded-3xl bg-background p-4"}>
                                            <AppText className="leading-6 text-text-high">{message.content}</AppText>
                                        </View>
                                    </View>
                                );
                            })}
                        </Animated.View>

                        <Animated.View entering={FadeInUp.duration(450).delay(230)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="caption" className="tracking-[1.5px] text-text-low">ABOUT THIS HISTORY</AppText>
                            <AppText className="mt-3 leading-6 text-text-low">This view preserves the conversation itself. Any patterns or observations derived from it remain separate unless a real connection is available.</AppText>
                        </Animated.View>
                    </>
                ) : (
                    <Animated.View entering={FadeInUp.duration(400)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                        <AppText variant="title" className="text-text-high">Conversation unavailable.</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">This conversation could not be found in the current placeholder history.</AppText>
                    </Animated.View>
                )}
            </ScrollView>
        </View>
    );
}
