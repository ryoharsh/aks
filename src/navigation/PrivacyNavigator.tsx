import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PrivacyHomeScreen from "@/screens/you/privacy/PrivacyHomeScreen";
import DataUsageScreen from "@/screens/you/privacy/DataUsageScreen";
import DataAccessScreen from "@/screens/you/privacy/DataAccessScreen";
import ExportDataScreen from "@/screens/you/privacy/ExportDataScreen";
import DeleteDataScreen from "@/screens/you/privacy/DeleteDataScreen";
import type { PrivacyStackParamList } from "@/navigation/routes";

const Stack = createNativeStackNavigator<PrivacyStackParamList>();

export default function PrivacyNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="PrivacyHome"
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="PrivacyHome" component={PrivacyHomeScreen} />
            <Stack.Screen name="DataUsage" component={DataUsageScreen} />
            <Stack.Screen name="DataAccess" component={DataAccessScreen} />
            <Stack.Screen name="ExportData" component={ExportDataScreen} />
            <Stack.Screen name="DeleteData" component={DeleteDataScreen} />
        </Stack.Navigator>
    );
}
