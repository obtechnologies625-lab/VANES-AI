# VANES AI Firebase setup (Cloud console clicks only)

VANES uses Firebase for three things:

1. **Real accounts** — email + password and Google sign-in (`vanes-firebase.js`).
2. **Cloud sync** — the learner's profile, conversations, study plans and shelf follow the account to any device (`vanes-sync.js` → Firestore collection `learners`).
3. **A tamper-proof free trial** — the Cloudflare Worker verifies the learner's Firebase ID token and keeps the answer count in the D1 table `vanes_quota`, so clearing browser storage cannot create new free answers.

The Firebase **web config is already in the repository** (`vanes-firebase.js`). That config is a public identifier, not a credential — Firebase ships it to every browser, and access is governed by the Firestore rules below. Never add a *service account* key or any private key to this repo.

Everything below happens in the [Firebase console](https://console.firebase.google.com) for the project **vanes-ai**. You do not need Node.js, wrangler or a terminal.

## 1. Create the Firestore database

Until this exists, VANES still works — the account card says *Cloud sync: off — Firestore is unreachable* and data stays on the device.

1. Open the project **vanes-ai**.
2. Left sidebar → **Build → Firestore Database**.
3. Click **Create database**.
4. Choose **Start in production mode** (the rules in step 2 decide access, not this choice).
5. Pick the location closest to your learners — for Tanzania, `nam5` or `eur3` are both reasonable. The location cannot be changed later.
6. Click **Enable** and wait for it to finish.

## 2. Publish the security rules

The file `firestore.rules` in this repository is the whole access policy: a learner can read and write **only** their own `learners/{uid}` document, only the listed fields, and only up to ~950 kB. Everything else is denied.

1. **Build → Firestore Database → Rules** tab.
2. Delete whatever is in the editor.
3. Paste the contents of `firestore.rules`.
4. Click **Publish**.

Without this step every sync attempt fails with *permission-denied*, which VANES shows as a readable toast.

## 3. Switch on the sign-in methods

1. **Build → Authentication → Sign-in method** tab.
2. **Email/Password** → click it → toggle **Enable** → **Save**.
   If this is off, the gate shows *"Email/password sign-in is switched off in Firebase"* and offers a device-only account instead.
3. **Google** → toggle **Enable** → set the project support email → **Save**.
   Without this the Google button on the gate answers *"This sign-in method is not enabled"*.

## 4. Authorise the domains VANES is served from

1. **Build → Authentication → Settings → Authorized domains**.
2. `localhost` is already listed (that is why local testing works).
3. Click **Add domain** and add:
   - `vanes-ai.obtechnologies625.workers.dev` — the production Worker
   - `obtechnologies625-lab.github.io` — the GitHub Pages mirror

Missing domains produce *auth/unauthorized-domain* or a Google pop-up that closes immediately; VANES translates both into a readable message.

## 5. Worker variables (Cloudflare dashboard)

**Workers & Pages → vanes-ai → Settings → Variables and Secrets**:

| Name | Type | Purpose |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Variable | Defaults to `vanes-ai`. Only set it if the Firebase project is ever renamed. |
| `VANES_FREE_LIMIT` | Variable | Free AI answers per window. Default `15`. |
| `VANES_TRIAL_DAYS` | Variable | Length of the window in days. Default `30`. |
| `VANES_PREMIUM_CODES` | **Secret** | Comma-separated upgrade codes you hand out after a donation, e.g. `VANES-PRO-7K2M9,VANES-PRO-Q4XD2`. A code unlocks Premium only if it appears here. |

`VANES_PREMIUM_CODES` is the important one: the app asks the Worker to validate an upgrade code, so a learner editing their own `localStorage` cannot unlock Premium. Until the secret exists, codes are refused and learners stay on the free trial.

## 6. Verify it worked

1. Open `https://vanes-ai.obtechnologies625.workers.dev`, create an account, then open **Settings**.
   The account card should read **Cloud sync: on — your data follows this account**.
2. In **Firestore Database → Data**, a `learners` collection should hold one document per account.
3. Ask VANES one question, then open
   `https://vanes-ai.obtechnologies625.workers.dev/api/health`
   and check `"quotaEnabled":true`.
4. `GET /api/quota` with a signed-in learner's token returns `{limit, used, left, premium, renewsInDays}` — the same numbers the account card shows.

## 7. Cleaning up test accounts

Verification created a throwaway account you may want to delete:

- **Build → Authentication → Users** → `escape@vanes.test` → ⋮ → **Delete account**.

Its Firestore document (if any) is under `learners/mT6qQgG0ocYs0wYBgSApMaRwT9M2`.

## How the pieces fit

```
browser                      Firebase                     Cloudflare Worker
────────                     ────────                     ─────────────────
vanes-firebase.js  ──auth──► Authentication
vanes-sync.js      ──data──► Firestore learners/{uid}
vanes-access.js    ──ID token (Authorization: Bearer)────► src/firebase-auth.js verifies it
                                                            against Google's public keys
                                                     ─────► src/quota.js counts the answer
                                                            in D1 vanes_quota
```

The Worker verifies tokens with Google's **public** signing keys, so no Firebase secret is stored on Cloudflare. A token that fails verification is answered with `401` and a readable reason; requests with no token at all (device-only accounts, offline use) keep working and are metered on the device instead.
