import React from "react";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import LegalWebView from "@/components/common/LegalWebView";

const TERMS_URL = "https://hirixa.vercel.app/terms";

export default function TermsScreen() {
    const navigation = useNavigation();

    return (
        <LegalWebView
            title="Terms of Service"
            url={TERMS_URL}
            onBack={() => navigation.goBack()}
        />
    );
}