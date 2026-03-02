# CDN OVH — Guide de mise en place pour Siberia Mix

## Tarifs (CDN Infrastructure OVH)

| Élément | Prix |
|--------|------|
| **Abonnement** | **10,99 € HT/mois** (~13,19 € TTC) |
| **Bande passante incluse** | 1 To/mois offert |
| **+1 To supplémentaire** | 9,99 € HT (~12 € TTC) |

Sans engagement. Couverture Europe + USA. Anti-DDoS inclus. SSL Let's Encrypt inclus.

---

## Pourquoi un CDN ?

Les fichiers WAV (mix, master) sont servis directement par le backend sur `api.siberiamix.com`. Le serveur a 1 Gbps, mais le goulot d’étranglement est le chemin réseau jusqu’à l’utilisateur. Un CDN sert les fichiers depuis des points de présence proches des utilisateurs, ce qui réduit la latence et améliore le débit.

---

## Architecture actuelle

```
User → api.siberiamix.com (DNS → IP VPS) → Caddy → FastAPI (port 8000)
```

**Endpoints de téléchargement :**
- `GET /api/download/mixed-track?id={uuid}` — pistes mixées (pas d’auth)
- `GET /api/download/render?id={uuid}&type=mix|master` — mix et master (auth requise)

---

## Architecture avec CDN

```
User → api.siberiamix.com (DNS → IP Anycast CDN) → CDN edge
         → si cache hit : réponse directe
         → si cache miss : CDN → VPS (backend) → réponse → cache
```

---

## Étapes de configuration

### 1. Commander le CDN OVH

1. OVH Manager → **Bare Metal Cloud** → **Content Delivery Network**
2. **Commander** → CDN Infrastructure
3. Choisir l’offre (~10,99 € HT/mois)
4. Après activation, récupérer l’**IP Anycast** du CDN (fournie par OVH)

---

### 2. Configurer le domaine et le backend

1. Dans le manager CDN : **Ajouter un nom de domaine**
2. Domaine : `api.siberiamix.com` (ou `api-staging.siberiamix.com` pour tester en staging)
3. **IP backend (origine)** : IP publique de ton VPS (celle de `ns3043653.ip-51-255-91.eu`)
4. Port backend : **443** (HTTPS) ou **80** (HTTP) selon la config Caddy

---

### 3. Règles de mise en cache

Créer des règles pour ne mettre en cache que les téléchargements :

| Chemin | Action | TTL (exemple) |
|--------|--------|---------------|
| `/api/download/*` | Mettre en cache | 1 h (3600 s) |
| Tout le reste | Ne pas mettre en cache (ou bypass) | - |

Dans l’interface OVH CDN : **Règles de mise en cache** → ajouter une règle pour `/api/download/` avec TTL 3600.

---

### 4. Modifier le DNS

1. OVH DNS (ou ton gestionnaire DNS) → zone `siberiamix.com`
2. Enregistrement actuel : `api` A → IP du VPS
3. **Remplacer** par : `api` A → **IP Anycast du CDN** (fournie par OVH)

Ou, si OVH propose un CNAME : `api` CNAME → `xxx.web.cdn.anycast.me` (ou équivalent).

---

### 5. Vérifier que le backend accepte les requêtes du CDN

Le CDN envoie les requêtes vers ton VPS avec les headers d’origine (Host, Cookie, etc.). Caddy et FastAPI gèrent cela sans changement.

**Optionnel** : ajouter des headers `Cache-Control` dans le backend pour que le CDN sache combien de temps garder en cache :

```python
# Dans les FileResponse de /api/download/mixed-track et /api/download/render
headers={
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",  # 1 h
}
```

---

## Tester en staging d’abord

Pour valider sans impacter la prod :

1. Configurer le CDN avec `api-staging.siberiamix.com` et l’IP du VPS en backend
2. Modifier le DNS : `api-staging` A → IP Anycast CDN
3. Tester les téléchargements sur https://stagingsiberiamix.netlify.app
4. Si tout est OK, faire pareil pour `api.siberiamix.com`

---

## Points d’attention

- **Auth** : les endpoints `/api/download/render` exigent un cookie de session. Le CDN transmet les cookies au backend en cas de cache miss. En cache hit, la réponse est servie sans revalidation : l’UUID dans l’URL reste la seule protection (non devinable).
- **Purge** : si tu dois invalider le cache (fichier modifié), utiliser la purge dans le manager OVH (par règle ou par domaine).
- **Quota** : 1 To inclus. Un WAV de 20 Mo × 50 000 téléchargements ≈ 1 To. Au-delà, prévoir des crédits supplémentaires.

---

## Résumé des commandes / actions

| Étape | Action |
|-------|--------|
| 1 | OVH Manager → CDN → Commander |
| 2 | CDN → Ajouter domaine `api.siberiamix.com` → IP backend = IP VPS |
| 3 | CDN → Règle cache `/api/download/*` TTL 3600 |
| 4 | DNS → `api.siberiamix.com` A → IP Anycast CDN |
| 5 | (Optionnel) Backend → ajouter `Cache-Control` sur les endpoints download |

---

## Liens utiles

- [OVH CDN Infrastructure](https://www.ovhcloud.com/fr/network/cdn/)
- [Commande CDN](https://www.ovh.com/fr/cdn/commande/?type=dedicated)
- [Aide OVH CDN](https://help.ovhcloud.com/csm/fr-network-cdn-infrastructure)
