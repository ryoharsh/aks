import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { HelpFeedbackStackParamList } from "@/navigation/routes";
import HelpFeedbackScreen from "@/screens/you/help/HelpFeedbackScreen";
import FAQScreen from "@/screens/you/help/FAQScreen";
import ReportProblemScreen from "@/screens/you/help/ReportProblemScreen";
import SendFeedbackScreen from "@/screens/you/help/SendFeedbackScreen";

const Stack = createNativeStackNavigator<HelpFeedbackStackParamList>();

export default function HelpFeedbackNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="HelpFeedbackHome"
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen
                name="HelpFeedbackHome"
                component={HelpFeedbackScreen}
            />
            <Stack.Screen name="FAQ" component={FAQScreen} />
            <Stack.Screen
                name="ReportProblem"
                component={ReportProblemScreen}
            />
            <Stack.Screen
                name="SendFeedback"
                component={SendFeedbackScreen}
            />
        </Stack.Navigator>
    );
}