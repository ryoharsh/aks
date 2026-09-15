import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CreditCardIcon, CrownIcon } from "@hugeicons/core-free-icons";

import SettingsDetailScreen from "@/components/setting/SettingsDetailScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Subscription">;

export default function SubscriptionScreen({ navigation }: Props) {
    return (
        <SettingsDetailScreen
            headerTitle="Subscription"
            eyebrow="YOUR PLAN"
            title="Aks plan and billing."
            description="Review your current plan and billing status. Subscription management can be connected when billing is available."
            items={[
                { label: "Current plan", value: "Free", icon: CrownIcon },
                { label: "Billing", value: "No payment method", icon: CreditCardIcon },
            ]}
            note="No billing changes are made from this placeholder screen."
            onBack={() => navigation.goBack()}
        />
    );
}
