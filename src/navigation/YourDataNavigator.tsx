import { createNativeStackNavigator } from "@react-navigation/native-stack";

import YourDataScreen from "@/screens/you/data/YourDataScreen";
import ReflectionsDataScreen from "@/screens/you/data/ReflectionsDataScreen";
import CheckInsDataScreen from "@/screens/you/data/CheckInsDataScreen";
import PatternsDataScreen from "@/screens/you/data/PatternsDataScreen";
import ExperimentsDataScreen from "@/screens/you/data/ExperimentsDataScreen";
import LearningsDataScreen from "@/screens/you/data/LearningsDataScreen";
import type { YourDataStackParamList } from "@/navigation/routes";

const Stack = createNativeStackNavigator<YourDataStackParamList>();

export default function YourDataNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="YourDataHome"
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="YourDataHome" component={YourDataScreen} />
            <Stack.Screen name="Reflections" component={ReflectionsDataScreen} />
            <Stack.Screen name="CheckIns" component={CheckInsDataScreen} />
            <Stack.Screen name="Patterns" component={PatternsDataScreen} />
            <Stack.Screen name="Experiments" component={ExperimentsDataScreen} />
            <Stack.Screen name="Learnings" component={LearningsDataScreen} />
        </Stack.Navigator>
    );
}