# Testing in real conditions without touching the live site

You want to test the site with all your changes in **real conditions** (real auth, real API, real flows) while **never** affecting the running website (siberiamix.com) or your real users.

**Your production setup:** The live backend and Caddy run as **services on your VPS** (not on your PC). The frontend is on Netlify. So "deploy production backend" means: update the code on the VPS and restart the backend service there. Your PC is for development (git, editing); production and staging run on servers.

There are two ways to do it. Pick one based on how much setup you want.

**Hard rule — staging must never use production:** Staging frontend must **never** point at the production API. Staging must **never** use the production database or production (live) Stripe keys. Staging = fully isolated: separate backend URL, separate DB, Stripe **test** keys only. You should never have to worry that something might affect the live website.

---

## Option A — Staging frontend only (simplest)

**Idea:** A second Netlify site that shows your **staging branch** (your work in progress). It must **never** talk to the production API — only to a **staging backend** (separate URL, separate DB, test Stripe). So you get real login, real mix, real projects — but the **URL** users see never changes (they stay on siberiamix.com).

**What you get:**
- Real conditions for: login, signup, projects, mix flow, mastering, UI, performance.
- No impact on the live site: only you use the staging URL.

**What to be careful about:**
- If you use the **same Stripe keys** on staging, then testing payment on staging will create **real** subscriptions and hit the **real** database. So on this setup: **do not complete a real payment** on staging. Test everything except “click Pay and use a real card.” For payment, either skip or use Option B.

**Setup:**

1. **Create a second Netlify site** (staging)
   - Netlify → Add new site → Import same GitHub repo.
   - Branch to deploy: **`staging`** (not `master`).
   - Build settings: same as production (base: `frontend`, command: `npm run build`, plugin Next.js).

2. **Set environment variables for the staging site only**
   - In Netlify: Site → Site configuration → Environment variables.
   - **Staging only — never production.** Set:
     - `NEXT_PUBLIC_API_URL` = **staging backend URL only** (never production API)
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = **test** key only (pk_test_...). Never live key if you don’t want to test payment here)
     - `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` / `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` = **test** Price IDs only. Never live.
     - `NEXT_PUBLIC_SITE_URL` = your **staging** URL (e.g. `https://siberiamix-staging.netlify.app`) so links and redirects stay on staging.

3. **Use one dedicated test user**
   - Create one account (e.g. test@yourdomain.com) and use it only for staging tests. That way you don’t pollute production with dozens of test accounts.

4. **Workflow**
   - Develop on `staging` branch → push → Netlify builds **staging** site.
   - Open the **staging** Netlify URL and test everything (login, mix, projects). Do **not** test live payment here.
   - When everything is good → merge `staging` into `master` → production Netlify deploys siberiamix.com (see `DEPLOYMENT_WORKFLOW.md`).

**Summary:** Real conditions for app and API; payment testing avoided or done elsewhere. Live site is never touched.

---

## Option B — Full staging (frontend + backend) for 100% real conditions

**Idea:** A full copy of the app: **staging frontend** (Netlify) + **staging backend** (same code, separate deploy, separate DB, **Stripe test keys**). You can test **including payment** with test cards (4242 4242 4242 4242) without creating real subscriptions or touching production.

**What you get:**
- Real conditions for **everything**: auth, mix, projects, **and** payment (test mode).
- Zero impact on production: different API, different DB, Stripe test mode.

**What you need:**
- A second backend deploy (e.g. Render, Railway, or a second VPS) with the same backend code.
- A separate database (new PostgreSQL instance or copy).
- Stripe **test** keys and **test** Price IDs on the staging backend and staging frontend.
- CORS on the staging backend allowing your staging Netlify origin.

**Setup (outline):**

1. **Staging backend**
   - Deploy your backend again (e.g. “Siberia Mix Staging” on Render).
   - Env: new DB URL, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET` for a test webhook, Stripe **test** price IDs. Set CORS to allow `https://your-staging-site.netlify.app`.

2. **Staging frontend (Netlify)**
   - Same as Option A, but:
   - `NEXT_PUBLIC_API_URL` = **staging backend URL** (e.g. `https://siberiamix-api-staging.onrender.com`).
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = **pk_test_...**
   - `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` / `_ANNUAL` = Stripe **test** price IDs.
   - `NEXT_PUBLIC_SITE_URL` = staging Netlify URL.

3. **Stripe test webhook**
   - In Stripe Dashboard (Test mode): create a webhook pointing to your staging backend URL (e.g. `https://staging-api.../api/webhooks/stripe`). Use that webhook’s signing secret in staging backend env.

4. **Test**
   - Use staging URL for all tests. Pay with Stripe test card `4242 4242 4242 4242`. No real money, no production data.

**Summary:** Full real conditions including payment; more setup, zero risk to the running website.

---

## Full-stack changes (frontend + backend)

When you change **both** frontend and backend — e.g. new presets, new mix chain, new controls, UI changes — you need **Option B**: a **staging backend** and a **staging frontend** that talk only to each other. Otherwise you’d be testing new UI against the old API, or deploying backend changes to production and risking breakage for current users.

**Your case:** presets, controls, mixing chain, UI → all of that is full-stack. Use the flow below.

### What you need

- **One repo, one `staging` branch** with both frontend and backend changes.
- **Staging backend:** same backend code, deployed to a separate URL (e.g. Render “Siberia Mix Staging”), with its own DB and Stripe test keys (see Option B above). This is where you deploy new presets, new chain, new API for controls.
- **Staging frontend:** Netlify from `staging` branch, with `NEXT_PUBLIC_API_URL` = **staging backend URL only**. So the staging site never calls the production API on your VPS.

**VPS note:** Because production backend and Caddy run on your VPS, you can run the staging backend on the same VPS as a second service (different port, separate env/DB), with Caddy proxying e.g. `api-staging.siberiamix.com` to it. Or use a separate host (Render, Railway, etc.). Production stays untouched.

### Workflow for full-stack work

1. **Develop on `staging`**
   - Edit backend (presets, chain, new endpoints for controls) and frontend (UI, new controls, API calls) on the same `staging` branch.
   - Commit and push when you want to test.

2. **Deploy staging backend first**
   - **If staging backend is on the same VPS:** pull `staging` on the VPS (e.g. in a separate app directory or branch), install deps if needed, restart the **staging** backend service only (production backend service stays running).
   - **If staging backend is on Render/Railway/other:** that service deploys from `staging` (set branch in the service settings). Wait until it’s up and healthy.

3. **Deploy staging frontend**
   - Netlify builds from `staging` and deploys the staging site. It already has `NEXT_PUBLIC_API_URL` = staging backend URL.
   - Staging frontend now talks only to staging backend.

4. **Test in real conditions on the staging URL**
   - Open the **staging** Netlify URL (not siberiamix.com).
   - Test: new presets, new controls, full mix chain, UI, projects, login, and payment (test card) if you use Stripe test keys on staging.
   - Fix any bugs on `staging`, push, redeploy staging backend and/or frontend as needed. Repeat until everything is good.

5. **Promote to production (only when staging is fully OK)**
   - **Deploy production backend first:** on your **VPS**, pull the new code (from `master` after merge, or from `staging` if you merge after), then **restart the production backend service** (and Caddy only if you changed its config). The live API (e.g. api.siberiamix.com) now serves the new presets and chain.
   - Then **merge `staging` into `master`** and push so Netlify deploys the production frontend (siberiamix.com). That way the new UI and new API go live together.

**Order matters:** production backend on VPS → then production frontend. If you deploy the new frontend first, it might call new endpoints that aren’t on the VPS backend yet.

### Summary

| Step | Where | What |
|------|--------|------|
| 1 | `staging` branch | Change presets, chain, controls, UI (frontend + backend). |
| 2 | Staging backend | Deploy from `staging`, get staging API URL. |
| 3 | Staging frontend | Deploy from `staging` (points at staging API). |
| 4 | Staging URL | Test full flow; fix and redeploy until good. |
| 5 | Production | Deploy **backend** first, then merge to `master` and deploy **frontend**. |

Users on siberiamix.com are never touched until step 5, and they always get a backend and frontend that match.

---

## Recommendation

- **Frontend-only changes:** Option A is enough (staging frontend + production API). Merge to `master` when ready (see `DEPLOYMENT_WORKFLOW.md`).
- **Frontend + backend changes** (presets, chain, controls, UI): use **Option B** and the full-stack workflow above. Staging backend + staging frontend; test; then production backend first, then production frontend.

---

## Testing checklist (use on staging before merging to main)

Run through this on the **staging** URL before you merge `staging` → `master` (and before you deploy production backend):

- [ ] Homepage loads, no console errors (F12).
- [ ] Sign up (with test user) works.
- [ ] Login works.
- [ ] Logout works.
- [ ] Upload track(s), run mix — mix completes and plays.
- [ ] **New presets / new chain:** verify the sound and behaviour match what you expect.
- [ ] **New controls:** every new control affects the mix (or UI) as intended.
- [ ] Render mix (if you’re Pro or testing that path).
- [ ] Master flow (if applicable).
- [ ] Projects: create, load, delete (or whatever you have).
- [ ] Subscription modal opens (and, if Option B: test payment with 4242...).
- [ ] Responsive: resize to mobile width, main actions still work.
- [ ] No broken links (e.g. footer, legal pages).

When everything is checked: deploy **production backend** first, then merge to `master` so production frontend deploys. The running website stays untouched until that moment.
