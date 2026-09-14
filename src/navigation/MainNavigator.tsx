import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "./routes";

import MirrorScreen from "@/screens/mirror/MirrorScreen";
import TimelineScreen from "@/screens/timeline/TimelineScreen";
import YouScreen from "@/screens/you/YouScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Mirror"
        component={MirrorScreen}
      />

      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
      />

      <Tab.Screen
        name="You"
        component={YouScreen}
      />
    </Tab.Navigator>
  );
}