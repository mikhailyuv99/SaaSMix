# Siberia Mix – Pricing

Proposition de grille tarifaire et de limites par offre.

---

## 1. Ce qui existe déjà côté technique

- **Sans compte** : upload de pistes, mix par piste (lead / adlibs), réglages (tone, reverb, delay…), écoute avant/après.
- **Avec compte (login)** : **Télécharger le mix** (render) et **Masteriser** sont déjà protégés par `get_current_user` → on peut les réserver aux offres payantes ou limiter par quota.

---

## 2. Proposition d’offres

### Gratuit (Free)

| Fonctionnalité | Inclus |
|----------------|--------|
| Pistes (lead, adlibs, instrumental) | Illimité |
| Mix par piste (paramètres, avant/après) | Illimité |
| Écoute en ligne | Illimité |
| **Télécharger le mix (WAV)** | **0** (ou 1 par mois pour essai) |
| **Masteriser + télécharger le master** | **Non** |
| Sauvegarde de projets | Non (ou 1 projet) |

**Objectif** : faire tester le son et l’UX, puis pousser vers un plan payant pour exporter.

---

### Pro (payant)

| Fonctionnalité | Inclus |
|----------------|--------|
| Tout du Gratuit | ✓ |
| **Télécharger le mix (WAV)** | **X exports / mois** (ex. 10 ou illimité) |
| **Masteriser + télécharger le master** | **X masters / mois** (ex. 5 ou 10) |
| Sauvegarde de projets | Oui (ex. 5 ou 10 projets) |

**Prix suggéré** : **9 €/mois** ou **79 €/an** (environ 2 mois gratuits).

---

### Studio (optionnel, plus tard)

- Exports / masters illimités ou très hauts.
- Projets illimités.
- Qualité “studio” (sample rate plus élevé, options avancées) si tu l’implémentes plus tard.

**Prix suggéré** : **19 €/mois** ou **159 €/an**.

---

## 3. Chiffres à trancher

| Élément | Option A | Option B | À décider |
|--------|----------|----------|-----------|
| Exports mix (Pro) | 10 / mois | Illimité | Selon coût serveur et abus |
| Masters (Pro) | 5 / mois | 10 / mois | Idem |
| Projets sauvegardés (Pro) | 5 | 10 | UX |
| Prix Pro / mois | 9 € | 12 € | Marché (Landr, eMastered ~10–15 €/mois) |
| Essai gratuit | 0 export | 1 mix + 1 master | Pour conversion |

---

## 4. Comparaison concurrents directs : Cryo Mix vs Roex vs Siberia Mix

### Roex (Automix) — roexaudio.com

| Offre | Prix | Contenu |
|-------|------|--------|
| **Intro (gratuit)** | 0 € | 1 Go de stockage, créer et **prévisualiser** mix + master, **pas de téléchargement** |
| **Pay As You Go** | **5,99 $ / crédit** | 1 crédit = 1 téléchargement (mix ou master). Bundles 5 et 10 pistes en réduction |
| **Pro** | **9,99 $ / mois** | 5 Go stockage, **100 téléchargements / mois** (WAV, MP3, FLAC), export DAW (Ableton, Bitwig, Studio One), stems traités, Audio Cleanup, Reference Match, Mix Reports |

**Modèle** : gratuit pour tester, puis soit à la carte (~6 $/piste), soit abo 10 $/mois pour 100 downloads.

---

### Cryo Mix — cryo-mix.com

| Offre | Prix | Contenu |
|-------|------|--------|
| **Essential** | À partir de ~29 $/mois (ordre de grandeur) | **Un seul** outil au choix : Mix & Master **ou** Mastering **ou** Beat Optimizer **ou** Separator. Stockage illimité, exports WAV. Crédits consommés au **téléchargement** (pas à la préview) |
| **Creator** | (voir site) | “Most popular”, plusieurs outils |
| **Pro** | (voir site) | **Tous** les outils : Mix & Master illimité, Mastering, Beat Optimizer, Separator, + crédits artwork (10/mois). Jusqu’à 8 lead + 8 backings, stems vocaux mixés + master WAV |
| **Pro Annual** | (voir site) | Meilleur rapport annuel (“Best value”) |
| **Expert** | (voir site) | Pro + feedback expert sur tes masters (actuellement “Sold out”) |

**Modèle** : abonnement par palier ; crédits utilisés uniquement au download (préview / itération gratuite). Positionnement premium (ingé reconnu, “platinum certified”).

---

### Tableau récap : positionnement

| Critère | Roex Automix | Cryo Mix | **Siberia Mix** (proposé) |
|---------|----------------|----------|----------------------------|
| **Gratuit** | Prévisualisation seule, 1 Go | Limité (1 outil sur Essential) | Mix + écoute illimités, 0 export |
| **Prix d’entrée payant** | 5,99 $/piste ou 9,99 $/mois | ~29 $/mois (Essential) | **9 €/mois** (Pro) |
| **Volume inclus (abo)** | 100 downloads/mois (Pro) | Illimité (selon outil) | À définir (ex. 10–20 exports + 5–10 masters) |
| **Mix vocal + instrumental** | Oui | Oui (8 lead + 8 backs) | Oui (pistes configurables) |
| **Mastering** | Oui | Oui | Oui |
| **Stems / export DAW** | Pro (stems, export DAW) | Stems WAV inclus | À ajouter plus tard si besoin |
| **Cible** | Producers, musicians | Artistes / pros (positionnement premium) | **Artistes indés, prix accessible** |

**Conclusion** : Roex est très agressif en gratuit (preview illimitée) et en prix (10 $/mois pour 100 downloads). Cryo Mix vise plus haut (abo à partir de ~29 $, image premium). **Siberia Mix** peut se placer **entre les deux** : plus accessible que Cryo, offre claire (mix + master) avec un **Pro à 9 €/mois** et des quotas raisonnables (ex. 10 exports + 5 masters), sans viser les 100 downloads/mois de Roex au début.

---

## 5. Implémentation technique (à faire)

1. **Stripe**  
   - Créer des produits/prix : Pro mensuel, Pro annuel, (optionnel) Studio.  
   - Checkout ou Customer Portal pour gérer l’abonnement.

2. **Backend**  
   - Table ou champs `users` : `plan` (free | pro | studio), `subscription_id` (Stripe), `exports_used_this_month`, `masters_used_this_month`, `reset_quota_at` (début de mois).  
   - Avant chaque `render_mix` et `master` : vérifier `plan` et quotas, incrémenter après succès.

3. **Frontend**  
   - Afficher la grille (page Pricing ou section dans le site).  
   - Si pas Pro (et quota dépassé ou pas connecté) : boutons “Télécharger le mix” / “Masteriser” → “Passer en Pro” (lien Stripe Checkout ou page abonnement).

4. **Webhooks Stripe**  
   - `customer.subscription.updated` / `deleted` pour mettre à jour `plan` et quotas (réinitialisation si passage à Pro, etc.).

---

## 6. Récap à valider

- **Gratuit** : tout sauf export mix + master (ou 1 export “découverte”).  
- **Pro 9 €/mois** : X exports + X masters + projets sauvegardés.  
- **Studio** (plus tard) : illimité ou très large + options avancées.  

Dès que tu valides les chiffres (quotas, prix), on peut détailler les endpoints et le schéma DB pour les quotas et Stripe.
