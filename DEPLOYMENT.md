# Deployment Checklist

## 1. Before pushing to GitHub

1. Rotate the Cloudinary API key because the old secret was stored in source code.
2. Do not commit `serviceAccountKey.json`.
3. Replace the placeholder Render hostname in `netlify.toml` after Render creates the backend URL.

## 2. Deploy the backend on Render

1. Push this project to GitHub.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render reads `render.yaml` and creates `hospital-management-api`.
4. Enter these secret environment variables when prompted:

   - `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete contents of `serviceAccountKey.json`
   - `CLOUDINARY_CLOUD_NAME`: the Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: the new Cloudinary API key
   - `CLOUDINARY_API_SECRET`: the new Cloudinary API secret
   - `ALLOWED_EMAILS`: comma-separated Google accounts allowed to use the app
   - `ALLOWED_ORIGINS`: the final Netlify URL, for example `https://example.netlify.app`

5. Deploy and copy the generated URL, for example:

   `https://hospital-management-api.onrender.com`

6. Open that URL. A successful backend responds with `"ok"`.

## 3. Connect Netlify to Render

In `netlify.toml`, replace:

`https://REPLACE-WITH-YOUR-RENDER-SERVICE.onrender.com`

with the actual Render URL. Commit and push the change.

## 4. Deploy the frontend on Netlify

1. In Netlify, choose **Add new project > Import an existing project**.
2. Select the same GitHub repository.
3. Netlify reads `netlify.toml`.
4. Confirm:

   - Build command: leave empty
   - Publish directory: `frontend`

5. Deploy the site and copy its `https://...netlify.app` URL.

## 5. Enable Firebase login on the hosted domain

1. Open Firebase Console.
2. Go to **Authentication > Settings > Authorized domains**.
3. Add only the hostname, for example `example.netlify.app`.
4. Confirm Google is enabled in **Authentication > Sign-in method**.

## 6. Final test

1. Open the Netlify URL in a private browser window.
2. Sign in using an email listed in `ALLOWED_EMAILS`.
3. Search for a patient.
4. Add a test patient and visit.
5. Upload one test image.
6. Confirm an email not in `ALLOWED_EMAILS` receives an authorization error.

Do not use real patient medical data until the application has had an appropriate
security, privacy, backup, and regulatory review.
