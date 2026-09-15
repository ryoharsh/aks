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
import { LinearGradient } from "expo-linear-gradient";
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
  const [openedPages, setOpenedPages] = useState<ReadonlySet<number>>(
    () => new Set([1]),
  );
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);

  const background = useResolveClassNames("bg-background");
  const backgroundColor = background.color ?? "#F2F2F2";
  const activeColor = useResolveClassNames("text-text-high");
  const inactiveColor = useResolveClassNames("text-text-low");

  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({
      x: SCREEN_WIDTH * index,
      y: 0,
      animated: true,
    });
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);

    setCurrentIndex(index);
    setOpenedPages((previous) => {
      if (previous.has(index)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(index);
      return next;
    });
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{
        flex: 1,
        backgroundColor,
      }}
    >
      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={pagerScrollEnabled}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
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
            <TimelineScreen
              shouldEnter={openedPages.has(0)}
              onFilterGestureChange={setPagerScrollEnabled}
            />
          </View>

          <View
            style={{ width: SCREEN_WIDTH }}
            className="flex-1"
          >
            <MirrorScreen shouldEnter={openedPages.has(1)} />
          </View>

          <View
            style={{ width: SCREEN_WIDTH }}
            className="flex-1"
          >
            <YouNavigator shouldEnter={openedPages.has(2)} />
          </View>
        </ScrollView>

        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor,
            zIndex: 1,
          }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", backgroundColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: "absolute",
              top: -20,
              right: 0,
              left: 0,
              height: 20,
            }}
          />
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