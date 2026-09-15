import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type MirrorScreenProps = {
  shouldEnter: boolean;
};

export default function MirrorScreen({ shouldEnter }: MirrorScreenProps) {
  return (
    <View
      pointerEvents={shouldEnter ? "auto" : "none"}
      style={{ opacity: shouldEnter ? 1 : 0 }}
    >
      <Animated.View
        key={shouldEnter ? "opened" : "waiting"}
        entering={shouldEnter ? FadeIn.duration(450) : undefined}
      >
        <Text>Mirror Screen</Text>
      </Animated.View>
    </View>
  );
}
