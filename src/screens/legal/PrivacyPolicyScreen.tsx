import React from "react";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import LegalWebView from "@/components/common/LegalWebView";

const PRIVACY_URL = "https://hirixa.vercel.app/privacy";

export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();

    return (
        <LegalWebView
            title="Privacy Policy"
            url={PRIVACY_URL}
            onBack={() => navigation.goBack()}
        />
    );
}