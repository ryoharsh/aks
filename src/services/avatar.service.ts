import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "@/lib/supabase";

const bucket = "avatars";

export const avatarService = {
    async upload(userId: string, asset: ImagePickerAsset) {
        const response = await fetch(asset.uri);
        const file = await response.arrayBuffer();
        const path = `${userId}/avatar`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
            contentType: asset.mimeType ?? "image/jpeg",
            upsert: true,
        });
        if (error) throw error;

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return `${data.publicUrl}?v=${Date.now()}`;
    },

    async remove(userId: string) {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([`${userId}/avatar`]);
        if (error && !error.message.toLowerCase().includes("not found")) throw error;
    },
};
