import { View } from "react-native";

import AppLogo from "../ui/AppLogo";
import AppText from "../ui/Text";
import { copy } from "@/constants/copy";

export default function LogoMark() {
    return (
        <View className="h-16 flex-row items-center gap-1">
            <AppLogo className="size-16 -ml-3.5" />

            <AppText
                variant="title"
                className="text-xl font-satoshi-medium text-text-high"
            >
                {copy.brand.name}
            </AppText>
        </View>
    );
}