import { Clipboard, Share } from "react-native";

/**
 * Native Clipboard / Share sheet for message actions.
 *
 * Only the text the user can see is ever handed to these APIs — never hidden
 * metadata, prompts, provider names or internal ids (9.8, 9.9).
 */
export const messageActionsService = {
    async copy(text: string): Promise<boolean> {
        const value = text.trim();
        if (!value) return false;
        try {
            Clipboard.setString(value);
            return true;
        } catch {
            return false;
        }
    },

    async share(text: string): Promise<boolean> {
        const value = text.trim();
        if (!value) return false;
        try {
            const result = await Share.share({ message: value });
            return result.action !== Share.dismissedAction;
        } catch {
            return false;
        }
    },
};
