# Lier le site à ton domaine (Netlify)

Domaine : **siberiamix.com** (acheté sur GoDaddy).  
Le frontend est déployé sur **Netlify**.

---

## 1. Ajouter le domaine dans Netlify

1. Va sur [app.netlify.com](https://app.netlify.com) et ouvre ton site (SaaS Mix).
2. **Site configuration** → **Domain management** → **Add domain** (ou **Add custom domain**).
3. Saisis **siberiamix.com** (Netlify proposera aussi **www.siberiamix.com**).
4. Netlify te dira si le domaine est déjà pris par un autre site ou s’il est libre.

---

## 2. Configurer le DNS sur GoDaddy

Deux options.

### Option A : Utiliser les serveurs DNS de Netlify (recommandé)

1. Dans Netlify : **Domain management** → **Set up Netlify DNS** pour **siberiamix.com**.
2. Netlify te donne des **nameservers** (ex. `dns1.p01.nsone.net`, `dns2.p01.nsone.net`). Note-les.
3. Sur **GoDaddy** :
   - Va sur [godaddy.com](https://www.godaddy.com) → **Mes produits** → clique sur **siberiamix.com**.
   - Ouvre **Gérer le DNS** (ou **DNS** / **Nameservers**).
   - Choisis **Changer les nameservers** (ou **Modifier** à côté de "Nameservers").
   - Sélectionne **Personnalisés** et entre les 2 (ou 4) nameservers fournis par Netlify.
   - Enregistre. La propagation peut prendre de quelques minutes à 48 h.
4. Netlify gère ensuite les enregistrements et le SSL pour siberiamix.com et www.siberiamix.com.

### Option B : Garder le DNS chez GoDaddy

1. Dans Netlify, après avoir ajouté **siberiamix.com**, va dans **Domain management** → **Configure DNS** (ou **Set up DNS**). Netlify affiche les enregistrements à créer.
2. Sur **GoDaddy** : **Mes produits** → **siberiamix.com** → **Gérer le DNS** → **Ajouter** (ou **Modifier** les enregistrements existants).
3. Crée au minimum :
   - **Type A** : Nom `@` (ou laisser vide pour la racine), Valeur = l’**IP Netlify** indiquée dans Netlify (ex. `75.2.60.5`), TTL 600.
   - **Type CNAME** : Nom `www`, Valeur = **ton-site.netlify.app** (l’URL Netlify de ton site), TTL 600.
4. Supprime ou désactive les anciens A/CNAME qui pointaient ailleurs pour `@` et `www` s’il y en a.
5. Attendre la propagation.

---

## 3. HTTPS (SSL)

Une fois le domaine pointé vers Netlify, Netlify provisionne un certificat **Let’s Encrypt** automatiquement. Tu peux forcer HTTPS dans **Site configuration** → **SSL/TLS** → **Force HTTPS** si tu veux.

---

## 4. Variable d’environnement API (production)

Le frontend appelle le backend via `NEXT_PUBLIC_API_URL`. En local c’est `http://localhost:8000`. En production il faut pointer vers ton backend (VPS, etc.).

1. Dans Netlify : **Site configuration** → **Environment variables**.
2. Ajoute (ou modifie) :
   - **Key :** `NEXT_PUBLIC_API_URL`
   - **Value :** l’URL de ton API en production, ex. `https://api.siberiamix.com` si le backend est sur un sous-domaine, ou l’URL de ton VPS.
3. Redéploie le site (ou déclenche un nouveau deploy) pour que la variable soit prise en compte.

---

## Récap (siberiamix.com sur GoDaddy)

| Étape | Où | Action |
|--------|-----|--------|
| 1 | Netlify | Add domain **siberiamix.com** (+ www) |
| 2 | GoDaddy | Changer les nameservers vers Netlify (option A) ou ajouter A + CNAME (option B) |
| 3 | Netlify | SSL automatique, option Force HTTPS |
| 4 | Netlify | `NEXT_PUBLIC_API_URL` = URL du backend en prod |
