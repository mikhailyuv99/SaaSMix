# Deployment workflow — keep users safe

**Golden rule:** Active users only ever see the **production** site (siberiamix.com). They must never hit bugs or half-finished work. All changes are tested on **staging** first, then promoted to production only when ready.

---

## Roles

| Environment | Branch | URL | Who sees it |
|-------------|--------|-----|-------------|
| **Staging** | `staging` (or `develop`) | e.g. siberiamix-staging.netlify.app | You only. For testing. |
| **Production** | `master` | siberiamix.com | All users. Must stay stable. |

---

## Workflow (every time you change the site)

### 1. Work only on the staging branch

```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix"
git fetch origin
git checkout staging
git pull origin staging
```

(If `staging` doesn’t exist yet: `git checkout -b staging` then `git push -u origin staging`.)

Do all edits, new features, and fixes on this branch. **Never** commit directly to `master` for site changes.

---

### 2. Test locally (optional but recommended)

```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix\frontend"
npm run build
npm run start
```

Open http://localhost:3000 and click through: home, login, subscription, mix flow, etc. If the build fails or something breaks, fix it on `staging` and repeat.

---

### 3. Push to staging and test on the real staging URL

```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix"
git add .
git status
git commit -m "Short description of the change"
git push origin staging
```

Wait for Netlify to finish building the **staging** site. Open the **staging** URL (not siberiamix.com) and test again:

- [ ] Homepage loads
- [ ] Login / signup work
- [ ] Subscription / payment flow works (use Stripe test mode on staging if possible)
- [ ] Main app flow (upload, mix, download) works
- [ ] No console errors (F12 → Console)
- [ ] Mobile looks OK (resize or DevTools)

If anything is wrong, fix on `staging`, push again, and re-test on the staging URL. **Do not merge to `master` until staging is good.**

---

### 4. Promote to production only when staging is fully OK

When the staging site looks and works exactly as you want for users:

```powershell
cd "C:\Users\mikha\Desktop\SaaS Mix"
git checkout master
git pull origin master
git merge staging
git push origin master
```

Netlify will build and deploy **production** (siberiamix.com). Users only see this after you’ve approved it on staging.

---

### 5. Keep staging in sync for next time

```powershell
git checkout staging
git pull origin master
git merge master
git push origin staging
```

So next time you work on `staging`, it already includes the last production state.

---

## Never do this

- **Don’t** commit or push broken or half-done work to `master`.
- **Don’t** test “just this one thing” on siberiamix.com; test on staging.
- **Don’t** skip the staging test step because the change “seems small.”
- **Don’t** change production env vars (Stripe live keys, API URL) without a reason and without re-testing on staging first if it affects the frontend.

---

## If something bad gets to production

1. Revert the last commit on `master`:
   ```powershell
   git checkout master
   git pull origin master
   git revert HEAD --no-edit
   git push origin master
   ```
2. Netlify will redeploy the previous version. Users get the old, working state back.
3. Fix the bug on `staging`, test again, then merge to `master` when it’s ready.

---

## When you change both frontend and backend

If you’re changing **presets, mix chain, controls, or UI** (and the backend API that supports them), you need a **staging backend** as well as a staging frontend. Otherwise you can’t test the full stack without risking production.

- **Setup:** See `STAGING_AND_TESTING.md` → Option B (full staging) and **Full-stack changes (frontend + backend)**.
- **Test:** Develop on `staging`, deploy staging backend then staging frontend, test on the staging URL until everything is good.
- **Ship:** Deploy **production backend first**, then merge `staging` → `master` so production frontend deploys. That way the live site always has matching backend and frontend; users never see broken or half-updated behaviour.

---

## Quick reference

| I want to… | Do this |
|------------|--------|
| Start working on a change | `git checkout staging` → edit → commit → `git push origin staging` |
| Test my change (frontend only) | Staging frontend points at prod API → open **staging** URL, click through. |
| Test my change (frontend + backend) | Deploy staging backend → deploy staging frontend (points at staging API) → open **staging** URL, test full flow. |
| Ship to users (frontend only) | Staging OK → `git checkout master` → `git pull` → `git merge staging` → `git push origin master` |
| Ship to users (frontend + backend) | Staging OK → deploy **production backend** → then merge `staging` → `master` and push (production frontend deploys). |
| Undo last production deploy | On `master`: `git revert HEAD` → `git push origin master` (frontend). If you must roll back backend too, redeploy the previous backend version. |
| Sync staging with production | `git checkout staging` → `git merge master` → `git push origin staging` |

User retention depends on reliability. This workflow keeps production stable and gives you a safe place to work.
