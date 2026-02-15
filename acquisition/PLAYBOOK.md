# Playbook d'acquisition — Siberia Mix (SaaS)

Système reproductible pour amener des leads vers le produit (site + paiement déjà en ligne) et atteindre **10 clients payants dans le premier mois**, puis stabiliser et scaler. Format desk-only (pas de vidéo, pas de face cam), automatisé au maximum, handoff-ready.

---

## 1. Plan par phases

| Phase | Période | Objectif | Critère de succès |
|-------|---------|----------|--------------------|
| **Phase 1** | Semaines 1–2 | Lancement + premier trafic | Site vérifié (SEO, sitemap, indexation), 5+ annuaires soumis, 1 canal social configuré, premiers contenus prêts |
| **Phase 2** | Semaines 3–4 | Premiers 10 clients payants | 10 abonnements payants (mensuel ou annuel), suivi trafic + conversion dans un tableau |
| **Phase 3** | Mois 2+ | Stabiliser et scaler | Processus répétable documenté, règles de budget et de décision claires, possible handoff à un employé |

---

## 2. Règles de budget

- **Ads (Meta / Google)** : max **15 €/jour** ou **300 €/mois** en test. Arrêter ou réduire si CPA > 30 € après 10 conversions. Doubler uniquement si CPA < 15 € et volume stable.
- **Outils** : privilégier gratuit (Search Console, Bing Webmaster, Netlify analytics si dispo). Payant accepté : outil de planification social (Buffer / Typefully ~10 €/mois) et éventuellement un outil SEO basique (Ubersuggest ou équivalent), plafond **30 €/mois** tant que < 20 clients payants.
- **Décision** : chaque vendredi, regarder dépenses + conversions. Si 0 conversion après 150 € dépensés en ads → pause ads, focus 100 % organique (SEO + annuaires + social).

---

## 3. Mix de canaux (FR, no filming/talking)

| Canal | Rôle | Effort | Automatisation |
|-------|------|--------|----------------|
| **SEO (technique + contenu)** | Trafic long terme | Config une fois + 1–2 articles/mois | Sitemap, robots, llms.txt déjà en place ; scripts ping + briefs contenu |
| **Annuaires / listes SaaS** | Backlinks + visibilité | 1–2 h une fois puis suivi | Script de soumission (liste d’URLs + instructions) |
| **Twitter/X ou LinkedIn (marque)** | Un compte, posts texte + liens | 3–5 posts/semaine planifiés | Buffer ou Typefully, pas de face/voix |
| **Ads (optionnel)** | Accélérer les 10 premiers clients | Budget capé, ciblage FR | Règles strictes (voir §2) |
| **Reddit / forums (optionnel)** | Détecter questions “mix vocal / master” | 1–2 réponses utiles/semaine, pas de spam | Guide de bonnes pratiques (voir checklist) |

Pas de YouTube / TikTok / Instagram contenu (hors lien en bio si besoin).

---

## 4. Phase 1 — Semaines 1–2 (Lancement + premier trafic)

### 4.1 SEO technique (déjà en place à vérifier)

- [ ] Sitemap : `https://siberiamix.com/sitemap.xml` accessible et soumis (Google Search Console + Bing Webmaster).
- [ ] robots.txt : `https://siberiamix.com/robots.txt` autorise les crawlers (voir `INDEXING.md` à la racine du repo).
- [ ] llms.txt : `https://siberiamix.com/llms.txt` en place pour crawlers LLM.
- [ ] Exécuter une fois le script de ping des sitemaps (voir `scripts/ping_sitemaps.ps1`).

### 4.2 Annuaires et listes

- [ ] Ouvrir la liste `scripts/directories_list.txt` et le guide `scripts/SUBMIT_DIRECTORIES.md`.
- [ ] Soumettre le site à au moins 5 annuaires (SaaS, outils créatifs, musique/audio) en une session.
- [ ] Noter dans `acquisition/log/submissions.log` (date + URL de l’annuaire).

### 4.3 Un canal social (marque uniquement)

- [ ] Choisir **un** canal : Twitter/X **ou** LinkedIn (page entreprise / marque Siberia Mix).
- [ ] Créer le compte (pas de nom perso, pas de photo de toi).
- [ ] Installer Buffer ou Typefully, connecter le compte.
- [ ] Rédiger 5 premiers posts (texte + lien siberiamix.com) : mix vocal en ligne, pour qui, bénéfice en 1 phrase. Ex. : « Mixer ses stems et son instrumental en quelques secondes, sans logiciel. Pour rappeurs et chanteurs. → [lien] »
- [ ] Planifier 3–5 posts pour la semaine (même rythme chaque semaine).

### 4.4 Contenu SEO (bases)

- [ ] Lire `scripts/CONTENT_BRIEF_TEMPLATE.md` et générer 1 brief pour une page ou un article (ex. « Comment mixer sa voix sur un beat en ligne »).
- [ ] Optionnel : créer 1 page ou 1 article sur le site (ou dans un doc partagé) à partir du brief, puis l’ajouter au sitemap si c’est une page du site.

---

## 5. Phase 2 — Semaines 3–4 (Premiers 10 clients payants)

### 5.1 Suivi trafic et conversion

- [ ] Créer un tableau (Google Sheet ou Excel) : colonnes **Date | Source (organique / annuaire / social / ads) | Visites (approx) | Inscriptions | Paiements | Notes**.
- [ ] Remplir chaque vendredi (données Search Console, Netlify, Stripe, manuel si besoin).

### 5.2 Conversion sur le site

- [ ] Vérifier que la page d’accueil et le tunnel inscription / paiement sont clairs (CTA, prix, avantages en 1 coup d’œil).
- [ ] Si trafic > 0 mais 0 conversion : relire la page avec un œil “nouveau visiteur”, simplifier le message et le parcours.

### 5.3 Ads (optionnel, budget capé)

- [ ] Si budget OK : campagne Meta ou Google, ciblage FR (intérêts : musique, rap, production musicale, home studio). Budget max 15 €/jour, objectif “trafic” ou “conversions” selon plateforme.
- [ ] Chaque vendredi : si CPA > 30 € après 5+ conversions → réduire ou arrêter ; si CPA < 15 € → maintenir, ne pas dépasser 300 €/mois sans revue.

### 5.4 Reddit / forums (optionnel, low-volume)

- [ ] Lire `CHECKLIST_REDDIT_FORUMS.md`.
- [ ] Identifier 2–3 subreddits ou forums FR (musique, rap, home studio, mixage). Répondre à 1–2 questions par semaine de façon utile, avec lien vers siberiamix.com seulement si pertinent (pas de spam).

---

## 6. Phase 3 — Mois 2+ (Stabiliser et scaler)

### 6.1 Processus répétable

- [ ] Chaque lundi : planifier les posts social de la semaine.
- [ ] Chaque vendredi : mettre à jour le tableau trafic/conversion, appliquer les règles de budget (ads).
- [ ] 1 fois par mois : soumettre 1–2 nouveaux annuaires ou listes, et générer 1 brief contenu (ou 1 nouvel article).

### 6.2 Décisions scale

- Si **CPA ads < 15 €** et **revenus > coût ads** : augmenter budget ads progressivement (ex. +5 €/jour par semaine), sans dépasser 50 €/jour sans validation.
- Si **trafic organique > trafic payant** et **conversions stables** : prioriser SEO + contenu, garder ads en maintenance.

### 6.3 Handoff

- [ ] Un nouveau responsable suit ce playbook + les checklists dans `acquisition/`.
- [ ] Lui transmettre : accès Search Console, Bing, compte social, Stripe (vue ventes), et le tableau trafic/conversion.
- [ ] Il exécute les scripts dans `scripts/` et remplit les checklists sans avoir besoin de l’historique oral.

---

## 7. Fichiers du système

- **Ce playbook** : `acquisition/PLAYBOOK.md`
- **Checklists détaillées** : `acquisition/CHECKLIST_PHASE1.md`, `CHECKLIST_PHASE2.md`, `CHECKLIST_PHASE3.md`, `CHECKLIST_REDDIT_FORUMS.md`
- **Scripts** : `acquisition/scripts/` (ping sitemaps, liste annuaires, template brief contenu, log soumissions)
- **Handoff** : `acquisition/HANDOFF.md` (résumé pour un employé ou un agent IA)

Résultat attendu : une **machine marketing** qui alimente le site (machine à cashflow) avec un effort minimal “performance” (pas de tournage, pas de voix), reproductible par une autre personne.
