import { View, Text } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Home01Icon } from "@hugeicons/core-free-icons";

export function Probe() {
    return (
        <View>
            <Text>hi</Text>
            <HugeiconsIcon icon={Home01Icon} size={24} color="#000" />
        </View>
    );
}