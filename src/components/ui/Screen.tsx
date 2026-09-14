import React, { PropsWithChildren } from "react";
import { View, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<
  ViewProps & {
    padded?: boolean;
  }
>;

export default function Screen({
  children,
  padded = true,
  className,
  ...props
}: ScreenProps) {
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom"]}
    >
      <View
        {...props}
        className={`flex-1 ${
          padded ? "px-6" : ""
        } ${className ?? ""}`}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}