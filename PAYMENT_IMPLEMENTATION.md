# Paiement – Plan d’implémentation (Stripe)

Intégration d’un système de paiement pour **Siberia Mix** : un seul plan Pro (accès aux téléchargements), Stripe Checkout + webhooks.

---

## Ce que tu fais maintenant (Stripe Dashboard)

1. Va sur [dashboard.stripe.com](https://dashboard.stripe.com) (utilise **Mode test** en haut à droite pour commencer).
2. **Produits** → **Add product** :
   - **Name** : `Siberia Mix Pro`
   - **Description** (optionnel) : ex. « Accès aux téléchargements mix + master et sauvegarde de projets »
3. **Prix** : tu ajoutes **deux prix** sur ce produit (recurring) :
   - **Mensuel** : 9,99 €, facturation **monthly** → enregistre le **Price ID** (commence par `price_...`).
   - **Annuel** : 99,99 €, facturation **yearly** → enregistre l’autre **Price ID**.
4. Tu en auras besoin dans le backend pour créer les sessions Checkout (et éventuellement dans le front pour afficher les bons boutons).

Les webhooks Stripe, tu les configureras plus tard quand le backend aura l’endpoint (section 2.4).

---

## 1. Offres retenues

| Plan    | Prix              | Contenu |
|---------|-------------------|--------|
| Gratuit | 0 €               | Mix + écoute illimités, **aucun téléchargement** (mix ni master). |
| Pro     | **9,99 €/mois** ou **99,99 €/an** | Téléchargements mix + master + sauvegarde de projets (illimité ou quota très haut en backend). |

Les actions **Télécharger le mix** et **Masteriser** sont déjà protégées par `get_current_user` ; il reste à vérifier que l’user a le plan Pro (sinon 402) et à brancher Stripe.

---

## 2. Étapes techniques

### 2.1 Stripe (Dashboard + produits)

1. Compte [Stripe](https://dashboard.stripe.com) (mode test puis live).
2. **Produits** : un produit « Siberia Mix Pro » avec **deux prix** :
   - Pro mensuel : **9,99 €** / mois (recurring).
   - Pro annuel : **99,99 €** / an (recurring).
3. Noter les **Price ID** (ex. `price_xxx` mensuel, `price_yyy` annuel) pour les utiliser dans `POST /api/billing/checkout`.
4. **Webhooks** (plus tard) : endpoint ex. `https://api.siberiamix.com/api/webhooks/stripe` pour les événements :
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - (optionnel) `invoice.paid` pour log / facturation.

Clé secrète : `STRIPE_SECRET_KEY`, clé webhook : `STRIPE_WEBHOOK_SECRET` (à mettre dans `.env` backend).

---

### 2.2 Backend – Schéma et quotas

1. **Modèle `User`** (ou table dédiée `subscriptions` / `usage`) :
   - `plan` : `free` | `pro` | `studio` (défaut `free`).
   - `stripe_customer_id` : nullable, pour lier le compte Stripe.
   - `stripe_subscription_id` : nullable, pour savoir si abo actif.
   - `exports_used_this_month` : int, défaut 0.
   - `masters_used_this_month` : int, défaut 0.
   - `quota_reset_at` : date de début de la période (ex. 1er du mois) pour réinitialiser les compteurs.

2. **Migration** : ajouter ces colonnes à `users` (ou créer une table `user_usage` liée à `users.id`). Si tu utilises SQLite sans migrations, un `ALTER TABLE` ou recréation de la table au premier run.

3. **Logique quotas** :
   - Au début de `render_mix` et `master_render` : récupérer l’utilisateur (DB), vérifier `plan` et si `exports_used_this_month` / `masters_used_this_month` sont sous la limite (ex. Pro : 10 exports, 5 masters). Si dépassé ou plan `free` sans « essai » : retourner **402 Payment Required** avec un message du type « Quota dépassé – passez en Pro ».
   - Après succès de l’appel : incrémenter le compteur et sauvegarder. Optionnel : réinitialiser les compteurs si `quota_reset_at` est dans le passé (nouveau mois), puis mettre à jour `quota_reset_at`.

---

### 2.3 Backend – Stripe Checkout

1. **Endpoint** `POST /api/billing/checkout` (protégé par `get_current_user`) :
   - Body : `{ "priceId": "price_xxx" }` (mensuel ou annuel).
   - Créer ou récupérer un **Stripe Customer** (via `stripe_customer_id` de l’user).
   - Créer une **Checkout Session** en mode subscription, avec `success_url` et `cancel_url` pointant vers le front (ex. `https://siberiamix.com?checkout=success` et `?checkout=cancel`).
   - Retourner `{ "url": session.url }` pour que le front redirige l’utilisateur vers Stripe.

2. **Lib** : `pip install stripe`, utiliser `stripe.Customer`, `stripe.checkout.Session.create` avec `mode="subscription"`, `line_items=[{"price": priceId, "quantity": 1}]`.

---

### 2.4 Backend – Webhook Stripe

1. **Endpoint** `POST /api/webhooks/stripe` (sans auth JWT ; vérifier la signature Stripe) :
   - Lire le body brut et le header `Stripe-Signature`.
   - `stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)`.
   - Pour `customer.subscription.created` / `updated` : récupérer `subscription.customer`, `subscription.status`, `subscription.items.data[0].price.id` ; trouver l’user par `stripe_customer_id`, mettre à jour `plan` (ex. actif → `pro`), `stripe_subscription_id`, et réinitialiser les quotas si passage à payant.
   - Pour `customer.subscription.deleted` : mettre `plan = free`, `stripe_subscription_id = null`, éventuellement garder les compteurs ou les remettre à zéro.

---

### 2.5 Backend – Infos plan / usage pour le front

1. **Endpoint** `GET /api/billing/me` (protégé) :
   - Retourner `{ "plan": "free"|"pro"|"studio", "exportsUsed": 10, "exportsLimit": 10, "mastersUsed": 3, "mastersLimit": 5 }` (ou équivalent) pour afficher la jauge et le CTA « Passer en Pro » si besoin.

---

### 2.6 Frontend

1. **Page ou section Tarifs** :
   - Grille Free / Pro (9 €/mois, 79 €/an), boutons « Passer en Pro ».
   - Clic → appel `POST /api/billing/checkout` avec le `priceId` choisi → redirection vers `session.url` (Stripe Checkout).

2. **Après retour de Stripe** :
   - `success_url` avec `?checkout=success` : afficher un message « Merci, vous êtes Pro » et rafraîchir les infos (appel `GET /api/billing/me`).
   - Gérer `cancel_url` si l’utilisateur annule.

3. **Boutons « Télécharger le mix » / « Masteriser »** :
   - Si l’API retourne **402** ou un message de quota / plan : afficher une modale ou un message « Quota dépassé » / « Réservé aux abonnés Pro » avec lien vers la page Tarifs ou vers Stripe Checkout.

4. **(Optionnel)** Dans le header ou les paramètres : afficher le plan actuel et l’usage (ex. « 5 / 10 exports ce mois ») en appelant `GET /api/billing/me`.

---

## 3. Ordre de réalisation suggéré

1. **Stripe** : compte, produit Pro, deux prix (mensuel / annuel), récupérer les Price ID.
2. **Backend** : colonnes plan + quotas sur `User`, logique de vérification + incrément dans `render_mix` et `master_render`, endpoint `GET /api/billing/me`.
3. **Backend** : `POST /api/billing/checkout`, `POST /api/webhooks/stripe`, tests en local avec Stripe CLI (`stripe listen --forward-to localhost:8000/api/webhooks/stripe`).
4. **Frontend** : page Tarifs, boutons Checkout, gestion 402 et `?checkout=success`.
5. **Déploiement** : ajouter `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` en production, configurer l’URL du webhook en live.

---

## 4. Variables d’environnement

**Backend** (`.env`) :
- `STRIPE_SECRET_KEY` : clé secrète Stripe (sk_test_… ou sk_live_…)
- `STRIPE_WEBHOOK_SECRET` : secret du webhook (whsec_…)

**Frontend** (`.env.local` ou Netlify) :
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : clé publique Stripe (pk_test_… ou pk_live_…)
- `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` : Price ID du plan mensuel (price_…)
- `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` : Price ID du plan annuel (price_…)

---

## 5. Fichiers créés / modifiés (implémentation actuelle)

| Fichier | Action |
|---------|--------|
| `backend/.env` | Ajouter `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `backend/requirements.txt` | Ajouter `stripe` |
| `backend/models.py` | Colonnes `plan`, `stripe_customer_id`, `stripe_subscription_id` |
| `backend/routers/billing.py` | `GET /api/billing/me`, `POST /api/billing/create-subscription` (Stripe Elements, pas Checkout) |
| `backend/main.py` | Migration billing au démarrage, webhook `POST /api/webhooks/stripe`, vérification Pro sur `render_mix` et `master_render` (402 si free) |
| `frontend/app/components/SubscriptionModal.tsx` | Modal Stripe Elements (carte dans la page, sans quitter le site) |
| `frontend/app/page.tsx` | État `isPro`, `fetchBilling`, gestion 402 → ouverture modal, bouton « Passer en Pro » dans le menu, badge Pro |

Dès que tu valides les chiffres (limites Pro : 10 exports, 5 masters ou autre), on peut détailler les messages d’erreur et les textes de la page Tarifs.
