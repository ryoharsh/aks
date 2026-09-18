import { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import YourDataScreen from "@/screens/you/data/YourDataScreen";
import ConversationsScreen from "@/screens/you/data/ConversationsScreen";
import ConversationDetailScreen from "@/screens/you/data/ConversationDetailScreen";
import ReflectionsDataScreen from "@/screens/you/data/ReflectionsDataScreen";
import CheckInsDataScreen from "@/screens/you/data/CheckInsDataScreen";
import PatternsDataScreen from "@/screens/you/data/PatternsDataScreen";
import MemoryDetailScreen from "@/screens/you/data/MemoryDetailScreen";
import MemoriesDataScreen from "@/screens/you/data/MemoriesDataScreen";
import PatternDetailScreen from "@/screens/you/data/PatternDetailScreen";
import ExperimentsDataScreen from "@/screens/you/data/ExperimentsDataScreen";
import LearningsDataScreen from "@/screens/you/data/LearningsDataScreen";
import LearningDetailScreen from "@/screens/you/data/LearningDetailScreen";
import InsightsDataScreen from "@/screens/you/data/InsightsDataScreen";
import InsightDetailScreen from "@/screens/you/data/InsightDetailScreen";
import ExperimentSetupScreen from "@/screens/you/data/ExperimentSetupScreen";
import ExperimentDetailScreen from "@/screens/you/data/ExperimentDetailScreen";
import type { YourDataStackParamList } from "@/navigation/routes";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { navigationBus } from "@/services/navigationBus";

const Stack = createNativeStackNavigator<YourDataStackParamList>();

type Props = NativeStackScreenProps<import("@/navigation/routes").YouStackParamList, "YourData">;

export default function YourDataNavigator({ route }: Props) {
    useEffect(() => {
        return () => {
            if (route.params?.returnToTimeline) {
                navigationBus.requestMainPage(0);
            }
        };
    }, [route.params?.returnToTimeline]);

    return (
        <Stack.Navigator
            initialRouteName="YourDataHome"
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="YourDataHome" component={YourDataScreen} />
            <Stack.Screen name="Conversations" component={ConversationsScreen} />
            <Stack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
            <Stack.Screen name="Reflections" component={ReflectionsDataScreen} />
            <Stack.Screen name="CheckIns" component={CheckInsDataScreen} />
            <Stack.Screen name="Memories" component={MemoriesDataScreen} />
            <Stack.Screen name="Patterns" component={PatternsDataScreen} />
            <Stack.Screen name="MemoryDetail" component={MemoryDetailScreen} />
            <Stack.Screen name="PatternDetail" component={PatternDetailScreen} />
            <Stack.Screen name="Experiments" component={ExperimentsDataScreen} />
            <Stack.Screen name="ExperimentSetup" component={ExperimentSetupScreen} />
            <Stack.Screen name="ExperimentDetail" component={ExperimentDetailScreen} />
            <Stack.Screen name="Learnings" component={LearningsDataScreen} />
            <Stack.Screen name="LearningDetail" component={LearningDetailScreen} />
            <Stack.Screen name="Insights" component={InsightsDataScreen} />
            <Stack.Screen name="InsightDetail" component={InsightDetailScreen} />
        </Stack.Navigator>
    );
}
