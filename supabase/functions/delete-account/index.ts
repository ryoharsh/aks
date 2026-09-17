import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers });
    }

    const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { error: storageError } = await admin.storage.from("avatars").remove([`${user.id}/avatar`]);
    if (storageError && !storageError.message.toLowerCase().includes("not found")) {
        return new Response(JSON.stringify({ error: "Unable to remove account files" }), { status: 500, headers });
    }

    let exportPaths: string[] = [];
    try {
        const { data: exportObjects, error: listError } = await admin.storage
            .from("exports")
            .list(user.id, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
        if (listError) {
            const listErrorMessage = listError.message.toLowerCase();
            if (!listErrorMessage.includes("not found") && !listErrorMessage.includes("bucket")) {
                return new Response(JSON.stringify({ error: "Unable to remove account files" }), { status: 500, headers });
            }
        } else {
            exportPaths = (exportObjects ?? []).map((object) => `${user.id}/${object.name}`);
        }
    } catch {
        return new Response(JSON.stringify({ error: "Unable to remove account files" }), { status: 500, headers });
    }
    if (exportPaths.length > 0) {
        const { error: exportCleanupError } = await admin.storage.from("exports").remove(exportPaths);
        if (exportCleanupError && !exportCleanupError.message.toLowerCase().includes("not found")) {
            return new Response(JSON.stringify({ error: "Unable to remove account files" }), { status: 500, headers });
        }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
        return new Response(JSON.stringify({ error: "Unable to delete account" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers });
});
