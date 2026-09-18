const appRedirectUrl = "aks://auth/callback";

Deno.serve((request) => {
    const requestUrl = new URL(request.url);
    const redirectUrl = new URL(appRedirectUrl);

    redirectUrl.search = requestUrl.search;
    redirectUrl.hash = requestUrl.hash;

    return Response.redirect(redirectUrl.toString(), 302);
});