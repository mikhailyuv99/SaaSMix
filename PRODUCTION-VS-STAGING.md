# Production vs staging — nothing we do must affect the live website

## Source of truth (your real setup)

| What | Value |
|------|--------|
| **Repo** | https://github.com/mikhailyuv99/SaaSMix |
| **Production branch** | **`master`** — this is what the live site uses. Do not push here except when shipping. |
| **Live frontend** | siberiamix.com (Netlify deploys from `master`) |
| **Live backend** | Your VPS (backend + Caddy); code deployed from `master` |
| **Staging branch** | **`staging`** — all development and testing. Staging Netlify and staging backend use this only. |

If in doubt: **production = `master` + siberiamix.com + the VPS backend that serves the live API.** We never touch those except when doing a deliberate "go live."

---

**Rule:** The **original website** (what your users see) is **production**. Everything we do for development and testing happens in **staging**. We **never** change production until you explicitly decide to ship.

**Hard rule — staging must be fully isolated:** Staging must **never** use production. That means: staging frontend must **never** point at the production API URL; staging must **never** use the production database or production Stripe (live) keys. Staging = separate backend, separate DB, test Stripe keys only. If a step would connect staging to anything live, it is wrong. You should never have to wonder whether something might affect the live website.

---

## What is production (the original website — DO NOT TOUCH)

| Thing | Production | Used by |
|-------|------------|--------|
| **Frontend** | Netlify site that deploys from branch **`master`** | siberiamix.com |
| **Backend** | The backend service running on your **VPS** (the one that serves api.siberiamix.com or your live API URL) | The live frontend + real users |
| **Database** | The database used by that VPS backend | Real user accounts, projects, payments |
| **Branch** | **`master`** (and only `master`) | What production frontend deploys from |
| **Stripe** | **Live** keys (real payments) | Production backend + frontend |

**We do not:** push to `master`, deploy to the production Netlify site, restart the production backend on the VPS, or change production env vars / database / Caddy config for the live API — unless we are doing a **single, intentional “ship to production”** step at the end.

---

## What is staging (our sandbox — safe to break)

| Thing | Staging | Used by |
|-------|---------|--------|
| **Frontend** | A **different** Netlify site that deploys **only** from branch **`staging`** | You only (staging URL, e.g. something.netlify.app) |
| **Backend** | Either a second service on the VPS (different port) **or** a separate host (Render, etc.) — **never** the same process as production | Staging frontend only |
| **Database** | A **separate** DB (or test DB) used only by the staging backend | No real users |
| **Branch** | **`staging`** | Staging frontend + staging backend (if deployed from repo) |
| **Stripe** | **Test** keys on staging (optional) so no real money | Staging only |

**We do:** all development and testing here. Push to `staging`, deploy the staging Netlify site, run/restart only the **staging** backend. Production stays untouched.

---

## What we will never do (so the original website is never affected)

1. **Never** push commits to `master` unless we are intentionally shipping a finished, tested change.
2. **Never** change the production Netlify site’s branch (it must stay `master`) or trigger a production deploy for testing.
3. **Never** restart or reconfigure the **production** backend service on the VPS while we are “just testing” or developing.
4. **Never** point the production frontend (siberiamix.com) at a different API or change production env vars for “testing.”
5. **Never** run migrations or scripts against the **production** database while developing; only staging DB (if any).
6. **Never** merge `staging` into `master` until you have tested on the **staging URL** and decided to go live.
7. **Never** point staging frontend at the production API, or use production DB or live Stripe keys on staging. Staging must be fully isolated.

---

## The only moment production changes (intentional ship)

Production changes **only** when you do a deliberate “go live”:

1. You have tested everything on the **staging** URL and you’re satisfied.
2. You deploy the **production backend** on the VPS (pull new code, restart the production backend service).
3. You merge `staging` into `master` and push, so the **production** Netlify site deploys the new frontend.

Until you do those steps, **the original website (production) is unchanged.**

---

## Quick check before any action

Before you run a command or change a setting, ask:

- **Am I pushing to `master` or deploying the production Netlify site or restarting the production backend?**  
  → If yes, only do it when you are intentionally shipping. Otherwise, use `staging` and staging services only.

- **Am I on branch `staging` and using only staging URLs / staging backend?**  
  → If yes, you’re safe; the original website is not affected.

Keeping this in mind guarantees that everything we do now does **not** affect the original website until you decide to go live.
