import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Moon01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import MirrorScreen from "@/screens/mirror/MirrorScreen";
import TimelineScreen from "@/screens/timeline/TimelineScreen";
import YouNavigator from "./YouNavigator";

type NavIconProps = {
  active: boolean;
  children: React.ReactNode;
};

function NavIcon({ active, children }: NavIconProps) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0.55, 1],
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.9, 1],
        ),
      },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}

export default function MainNavigator() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(1);

  const background = useResolveClassNames("bg-background");
  const activeColor = useResolveClassNames("text-text-high");
  const inactiveColor = useResolveClassNames("text-text-low");

  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({
      x: SCREEN_WIDTH * index,
      y: 0,
      animated: true,
    });

    setCurrentIndex(index);
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);

    setCurrentIndex(index);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x: SCREEN_WIDTH,
        y: 0,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [SCREEN_WIDTH]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={{
        flex: 1,
        backgroundColor: background.color,
      }}
    >
      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexDirection: "row",
          }}
        >
          <View
            style={{ width: SCREEN_WIDTH }}
            className="flex-1"
          >
            <TimelineScreen />
          </View>

          <View
            style={{ width: SCREEN_WIDTH }}
            className="flex-1"
          >
            <MirrorScreen />
          </View>

          <View
            style={{ width: SCREEN_WIDTH }}
            className="flex-1"
          >
            <YouNavigator />
          </View>
        </ScrollView>

        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: background.color,
          }}
        >
          <Animated.View
            entering={FadeInUp.duration(650)
              .delay(100)
              .springify()
              .damping(18)
              .stiffness(120)}
            className="h-[85px] flex-row items-center justify-around px-10"
          >
            <Pressable
              onPress={() => goToPage(0)}
              hitSlop={12}
              className="h-12 w-12 items-center justify-center"
            >
              <NavIcon active={currentIndex === 0}>
                <HugeiconsIcon
                  icon={Moon01Icon}
                  size={23}
                  color={
                    currentIndex === 0
                      ? activeColor.color
                      : inactiveColor.color
                  }
                  strokeWidth={1.8}
                />
              </NavIcon>
            </Pressable>

            <Pressable
              onPress={() => goToPage(1)}
              hitSlop={12}
              className="h-12 w-12 items-center justify-center"
            >
              <NavIcon active={currentIndex === 1}>
                <Image
                  source={require("@assets/splash-icon.png")}
                  resizeMode="contain"
                  className={`size-22 ${currentIndex !== 1 ? "opacity-70" : ""
                    }`}
                />
              </NavIcon>
            </Pressable>

            <Pressable
              onPress={() => goToPage(2)}
              hitSlop={12}
              className="h-12 w-12 items-center justify-center"
            >
              <NavIcon active={currentIndex === 2}>
                <HugeiconsIcon
                  icon={UserCircleIcon}
                  size={23}
                  color={
                    currentIndex === 2
                      ? activeColor.color
                      : inactiveColor.color
                  }
                  strokeWidth={1.8}
                />
              </NavIcon>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}