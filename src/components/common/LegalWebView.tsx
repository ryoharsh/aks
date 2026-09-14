import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeftIcon } from "@hugeicons/core-free-icons";

import AppText from "@/components/ui/Text";
import IconButton from "../ui/IconButton";

type LegalWebViewProps = {
    title: string;
    url: string;
    onBack: () => void;
};

export default function LegalWebView({
    title,
    url,
    onBack,
}: LegalWebViewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    return (
        <View className="flex-1 bg-background">
            <StatusBar style="dark" />

            <View className="h-16 flex-row items-center border-b border-border px-6">
                <IconButton
                    onPress={onBack}
                    className="mr-4"
                >
                    <HugeiconsIcon
                        icon={ArrowLeftIcon}
                        size={22}
                    />
                </IconButton>

                <AppText
                    variant="title"
                    className="text-text-high"
                >
                    {title}
                </AppText>
            </View>

            <View className="flex-1">
                {loading && (
                    <View className="absolute inset-0 z-10 items-center justify-center bg-background">
                        <ActivityIndicator
                            size="small"
                            color="#171717"
                        />
                    </View>
                )}

                {error ? (
                    <View className="flex-1 items-center justify-center px-8">
                        <AppText
                            variant="title"
                            className="text-center text-text-high"
                        >
                            Unable to load this page
                        </AppText>

                        <AppText
                            variant="body"
                            className="mt-2 text-center text-text-low"
                        >
                            Please check your internet connection and try
                            again.
                        </AppText>
                    </View>
                ) : (
                    <WebView
                        source={{ uri: url }}
                        style={{
                            flex: 1,
                            backgroundColor: "#F2F2F2",
                        }}
                        onLoadStart={() => {
                            setLoading(true);
                            setError(false);
                        }}
                        onLoadEnd={() => {
                            setLoading(false);
                        }}
                        onError={(event) => {
                            console.log(
                                "WebView error:",
                                event.nativeEvent,
                            );
                            setLoading(false);
                            setError(true);
                        }}
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        javaScriptEnabled
                        domStorageEnabled
                        bounces={false}
                    />
                )}
            </View>
        </View>
    );
}