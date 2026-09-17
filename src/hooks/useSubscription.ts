import { useContext } from "react";

import {
    SubscriptionContext,
    type SubscriptionContextValue,
} from "@/providers/SubscriptionProvider";

export function useSubscription(): SubscriptionContextValue {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error(
            "useSubscription must be used within a SubscriptionProvider",
        );
    }
    return context;
}