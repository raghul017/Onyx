# OAuth Setup — Google & GitHub Sign-In for Onyx

This guide gets the "Continue with Google / GitHub" buttons working. It is written
for the **server-side redirect flow** Onyx uses: the browser hits our backend, the
backend talks to the provider using the **client secret** (never exposed to the browser),
then issues our own JWT and redirects back to the app.

You set **5 environment variables** on the server. Until they're set, the buttons show a
graceful "not configured" message — nothing breaks.

> Verified against the Google Cloud Console and GitHub developer settings as of June 2026.
> Onyx only requests basic profile scopes, so **no Google verification / security review is
> needed** and there is **no 7-day refresh-token limit** to worry about.

---

## 0. Decide your URLs first

You need your **backend (server) base URL** — this is `SERVER_URL`. Onyx builds the OAuth
callback from it as `<SERVER_URL>/api/auth/<provider>/callback`.

| Environment | SERVER_URL | Google + GitHub callback URL |
|---|---|---|
| **Local dev** | `http://localhost:3000` | `http://localhost:3000/api/auth/google/callback` and `.../github/callback` |
| **Production (Render)** | `https://<your-app>.onrender.com` | `https://<your-app>.onrender.com/api/auth/google/callback` and `.../github/callback` |

> GitHub allows **only one callback URL per OAuth app**. So if you want both local and prod,
> create **two GitHub apps** (one with the localhost callback, one with the prod callback) and
> use the matching credentials in each environment. Google lets you list **multiple** redirect
> URIs in one client, so a single Google client can cover both.

---

## 1. Google — create an OAuth Client ID

**Console:** https://console.cloud.google.com

### 1a. Project
1. Top-left project dropdown → **New Project**.
2. Name it `Onyx` → **Create** → select it from the dropdown.

### 1b. OAuth consent screen (the "Google Auth Platform" branding step)
1. Left sidebar → **APIs & Services → OAuth consent screen** (newer consoles label this **Google Auth Platform → Branding**).
2. Click **Get started**.
3. **App Information**: App name `Onyx`, user support email = your email → **Next**.
4. **Audience**: choose **External** (any Google account) → **Next**.
   *(Internal is only for Google Workspace orgs and limits sign-in to your org.)*
5. **Contact Information**: your email → **Next**.
6. Check **I agree to the Google API Services: User Data Policy** → **Continue / Create**.
7. **Data Access** (scopes): Onyx only needs the basic ones. If asked, add
   `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. These are **not**
   "sensitive/restricted", so no Google review is required.
8. **Audience → Test users**: click **Add users** and add **your own Google email**
   (and any teammates). While the app is in "Testing", only listed test users can sign in.
   *(Optional: click **Publish app** to go to Production and lift the test-user restriction.
   With only basic scopes, this needs no verification.)*

### 1c. Create the OAuth client
1. Left sidebar → **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. **Application type: Web application**.
4. **Name**: `Onyx Web`.
5. **Authorized redirect URIs → + Add URI** — add (one line each):
   ```
   http://localhost:3000/api/auth/google/callback
   https://<your-render-app>.onrender.com/api/auth/google/callback
   ```
   *(Add only the ones you'll use. The path must match exactly — `/api/auth/google/callback`.)*
6. (Optional) **Authorized JavaScript origins**: not required for this server-side flow; you
   can leave it blank or add `http://localhost:8080`.
7. **Create**. A dialog shows the **Client ID** and **Client secret** — copy both now.

### 1d. Set the env vars (server)
```
GOOGLE_CLIENT_ID=<paste client id>
GOOGLE_CLIENT_SECRET=<paste client secret>
```

---

## 2. GitHub — register an OAuth App

**Console:** https://github.com/settings/developers  (**Settings → Developers → OAuth Apps**)

1. Click **New OAuth App** (or **Register a new application**).
2. **Application name**: `Onyx` (this is shown to users on the consent screen).
3. **Homepage URL**: your app's front-end URL — `http://localhost:8080` for local,
   or your Vercel URL for prod.
4. **Authorization callback URL** — this must be the **backend** callback:
   ```
   http://localhost:3000/api/auth/github/callback        # local
   https://<your-render-app>.onrender.com/api/auth/github/callback   # prod
   ```
   *(One per app — see the note in section 0 about creating two apps for local + prod.)*
5. **Register application**.
6. On the app page: the **Client ID** is shown immediately. Click
   **Generate a new client secret** and copy it right away (you can't view it again later).

### Set the env vars (server)
```
GITHUB_CLIENT_ID=<paste client id>
GITHUB_CLIENT_SECRET=<paste client secret>
```

---

## 3. Put it all together

In **`server/.env`** (local) — and in **Render → Environment** (prod) — set:

```
SERVER_URL=http://localhost:3000          # prod: your Render URL, no trailing slash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

(`CLIENT_URL` should already be set to your front-end origin, e.g. `http://localhost:8080`
locally or your Vercel URL in prod — the backend redirects back to `CLIENT_URL/auth/callback`.)

**Restart the server** after editing `.env`. No frontend env vars or rebuild needed — the
front-end just navigates to `/api/auth/google` and the backend handles everything.

---

## 4. Test it

1. Start backend + frontend (`cd server && npm run dev`, `cd client && npm run dev`).
2. Open the app, go to **Sign in**, click **Google** (or **GitHub**).
3. You should be redirected to the provider's consent screen, approve, and land back on
   `/auth/callback` → then `/dashboard`, signed in.
4. If a provider isn't configured, its button lands on a clean "Social sign-in is not
   configured yet" page instead of crashing.

### Common gotchas
- **redirect_uri_mismatch (Google)** or **The redirect_uri MUST match (GitHub)**: the
  callback URL registered in the provider must match `<SERVER_URL>/api/auth/<provider>/callback`
  **exactly** (scheme, host, port, path, no trailing slash). Fix `SERVER_URL` or the registered URI.
- **Google "Access blocked / app not verified"**: you're in Testing mode and signing in with an
  account that isn't a **Test user** — add your email under Audience → Test users (section 1b.8),
  or Publish the app.
- **GitHub "no verified email"**: make sure your GitHub account has a verified primary email.
  Onyx requests `user:email` and reads the primary verified address.
- After changing `.env`, **restart the server** — env vars are read at boot.
