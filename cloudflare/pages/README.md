# Free Cloudflare Pages endpoint for Bratva avatar uploads

This is a separate Pages project, intended to provide a second upload route without changing the existing production Worker or the live Firebase app until it has been verified.

## Create the Pages project

1. In Cloudflare Dashboard, open **Workers & Pages** and create a **Pages** project connected to this GitHub repository.
2. Choose the branch `fix/free-pages-avatar-upload` for the initial test (or merge this PR only after review).
3. Set the project root directory to `cloudflare/pages`.
4. Set the build command to empty / no build command and the output directory to `public`.
5. In the Pages project settings, add an **R2 bucket binding** named `AVATARS_BUCKET` pointing to the existing bucket `bratva-avatars`.
6. Add `FIREBASE_API_KEY` as a Pages environment variable. Use the same Firebase Web API key already used by the Bratva Firebase app; do not commit it into this repository.
7. Deploy and test the Pages URL from a network in Russia before changing the app's upload endpoint.

The expected default URL is `https://bratva-avatar-upload.pages.dev` only if that Pages project name is available and chosen. If Cloudflare assigns another name, update `AVATAR_UPLOAD_URL` in `src/services/avatarStorage.ts` before enabling this route.

## Security and behavior

- Accepts only authenticated Firebase ID tokens.
- Validates JPEG data URLs and enforces the existing 512 KiB image limit.
- Writes objects through the private R2 binding; it does not enable anonymous R2 writes.
- Stores an owner UID in R2 object metadata.
- Allows CORS only from the two existing Firebase Hosting origins.
- Returns the direct public R2 URL so image reads continue to use the endpoint already working in Russia.

Do not merge or publish the app-side endpoint change until the Pages project is deployed and its upload route has been tested. The current Worker and live app remain unchanged by this standalone Pages function.
