import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import LegalWebView from "@/components/common/LegalWebView";
import type { AuthStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<
    AuthStackParamList,
    "Terms"
>;

const TERMS_URL = "https://hirixa.vercel.app/terms";

export default function TermsScreen({
    navigation,
}: Props) {
    return (
        <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 bg-background"
        >
            <LegalWebView
                title="Terms of Service"
                url={TERMS_URL}
                onBack={() => navigation.goBack()}
            />
        </SafeAreaView>
    );
}