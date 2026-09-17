import { useEffect } from "react";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { YourDataStackParamList, YouStackParamList } from "@/navigation/routes";
import { navigationBus } from "@/services/navigationBus";
import type { TimelineNavigationTarget } from "@/types/timeline";

export function useTimelineNavigation<RouteName extends keyof YouStackParamList>(
    navigation: NativeStackNavigationProp<YouStackParamList, RouteName>,
) {
    useEffect(() => {
        return navigationBus.subscribe((target) => {
            navigation.navigate("YourData", nestedRoute(target));
        });
    }, [navigation]);
}

function nestedRoute(
    target: TimelineNavigationTarget,
): NavigatorScreenParams<YourDataStackParamList> {
    switch (target.screen) {
        case "Reflections":
        case "CheckIns":
            return { screen: target.screen };
        case "ConversationDetail":
            return { screen: "ConversationDetail", params: target.params };
        case "ExperimentDetail":
            return { screen: "ExperimentDetail", params: target.params };
        case "LearningDetail":
            return { screen: "LearningDetail", params: target.params };
        case "PatternDetail":
            return { screen: "PatternDetail", params: target.params };
        case "InsightDetail":
            return { screen: "InsightDetail", params: target.params };
    }
}