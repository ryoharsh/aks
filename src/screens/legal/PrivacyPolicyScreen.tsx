import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import LegalWebView from "@/components/common/LegalWebView";
import type { AuthStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<
    AuthStackParamList,
    "PrivacyPolicy"
>;

const PRIVACY_URL = "https://hirixa.vercel.app/privacy";

export default function PrivacyPolicyScreen({
    navigation,
}: Props) {
    return (
        <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 bg-background"
        >
            <LegalWebView
                title="Privacy Policy"
                url={PRIVACY_URL}
                onBack={() => navigation.goBack()}
            />
        </SafeAreaView>
    );
}