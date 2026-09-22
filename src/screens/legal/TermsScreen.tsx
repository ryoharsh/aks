import React from "react";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import LegalWebView from "@/components/common/LegalWebView";
import { copy } from "@/constants/copy";

const TERMS_URL = "https://aks-olive.vercel.app/terms";

export default function TermsScreen() {
    const navigation = useNavigation();

    return (
        <LegalWebView
            title={copy.legal.termsTitle}
            url={TERMS_URL}
            onBack={() => navigation.goBack()}
        />
    );
}