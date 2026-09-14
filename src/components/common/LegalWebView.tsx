import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
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

    const handleLoadStart = () => {
        setLoading(true);
        setError(false);
    };

    const handleLoadEnd = () => {
        setLoading(false);
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar style="dark" />

            <View className="h-16 flex-row items-center border-b border-border px-5 mt-10">
                <IconButton onPress={onBack} className="mr-4">
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

            <View className="flex-1 overflow-hidden">
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

                        <View className="mt-6">
                            <IconButton
                                onPress={() => {
                                    setError(false);
                                    setLoading(true);
                                }}
                            >
                                <AppText
                                    variant="button"
                                    className="text-text-high"
                                >
                                    Try again
                                </AppText>
                            </IconButton>
                        </View>
                    </View>
                ) : (
                    <View className="flex-1">
                        <WebView
                            key={url}
                            source={{ uri: url }}
                            style={{
                                flex: 1,
                            }}
                            originWhitelist={["*"]}
                            javaScriptEnabled
                            domStorageEnabled
                            sharedCookiesEnabled
                            thirdPartyCookiesEnabled
                            cacheEnabled
                            startInLoadingState={false}
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            bounces={false}
                            onLoadStart={handleLoadStart}
                            onLoadEnd={handleLoadEnd}
                            onError={handleError}
                            onHttpError={(event) => {
                                console.log(
                                    "WebView HTTP error:",
                                    event.nativeEvent.statusCode,
                                    event.nativeEvent.description
                                );
                            }}
                        />

                        {loading && (
                            <View className="absolute inset-0 items-center justify-center bg-background">
                                <ActivityIndicator
                                    size="small"
                                    color="#171717"
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}