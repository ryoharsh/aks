import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type DataSource = Database["public"]["Tables"]["data_sources"]["Row"];

export type ExportResult = {
    fileName: string;
    url: string;
    expiresAt: string;
};

export class PrivacyError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean,
    ) {
        super(message);
        this.name = "PrivacyError";
    }
}

async function invokeOnce<T>(functionName: string): Promise<T> {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
        method: "POST",
    });
    if (error) {
        const context = (error as { context?: Response }).context;
        let message = "Something went wrong. Please try again.";
        if (context) {
            try {
                const payload = (await context.clone().json()) as { error?: { code?: string; message?: string } };
                if (payload.error?.message) message = payload.error.message;
            } catch {
                // Fall back to the generic message.
            }
        }
        throw new PrivacyError(message, true);
    }
    return data as T;
}

async function downloadOnWeb(url: string, fileName: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new PrivacyError("The export link has expired. Please request a new export.", true);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

async function downloadOnNative(url: string, fileName: string): Promise<void> {
    const exportDirectory = new Directory(Paths.cache, "exports");
    await exportDirectory.create({ idempotent: true, intermediates: true });
    const destination = new File(exportDirectory, fileName);
    const downloaded = await File.downloadFileAsync(url, destination);
    if (!downloaded) {
        throw new PrivacyError("The download was interrupted. Please try again.", true);
    }
    const available = await Sharing.isAvailableAsync();
    if (!available) {
        throw new PrivacyError("Sharing isn't available on this device. Please try again.", true);
    }
    await Sharing.shareAsync(downloaded.uri, {
        dialogTitle: "Save your Aks export",
        mimeType: "application/json",
        UTI: "public.json",
    });
}

export const privacyService = {
    async listDataSources(userId: string): Promise<DataSource[]> {
        const { data, error } = await supabase
            .from("data_sources")
            .select("*")
            .eq("user_id", userId)
            .order("connected_at", { ascending: false });
        if (error) {
            throw new PrivacyError("Couldn't load your connected sources. Please try again.", true);
        }
        return (data ?? []).map((row) => ({ ...row }));
    },

    async requestExport(): Promise<ExportResult> {
        const result = await invokeOnce<ExportResult>("export-data");
        if (!result || typeof result.url !== "string" || typeof result.fileName !== "string" || typeof result.expiresAt !== "string") {
            throw new PrivacyError("The export response was incomplete. Please try again.", true);
        }
        return result;
    },

    async downloadExport(result: ExportResult): Promise<void> {
        if (Platform.OS === "web") {
            await downloadOnWeb(result.url, result.fileName);
            return;
        }
        await downloadOnNative(result.url, result.fileName);
    },

    async requestAccountDeletion(): Promise<void> {
        await invokeOnce<{ deleted: boolean }>("delete-account");
    },

    async deleteAccount(): Promise<void> {
        await this.requestAccountDeletion();
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw new PrivacyError("Your account data is being deleted, but clearing this device needs another attempt.", true);
    },
};