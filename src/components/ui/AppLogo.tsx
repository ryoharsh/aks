import React from "react";
import { Image, type ImageProps } from "react-native";

import { cn } from "@/lib/cn";

type AppLogoProps = Omit<ImageProps, "source"> & {
    className?: string;
};

export default function AppLogo({
    className,
    ...props
}: AppLogoProps) {
    return (
        <Image
            {...props}
            source={require("@assets/splash-icon.png")}
            className={cn("size-60", className)}
            resizeMode="contain"
            accessibilityLabel="Aks logo"
        />
    );
}