# Indexation : Google, Bing, ChatGPT

Ce guide décrit comment faire indexer **siberiamix.com** par Google, Bing et (indirectement) ChatGPT.

## Déjà en place dans le projet

- **Favicon / logo** : `favicon.ico` (onglet) et `logo-black.png` (partages, Open Graph, Twitter, Apple touch icon).
- **SEO** : métadonnées (title, description, keywords), Open Graph, Twitter cards, JSON-LD (WebApplication + Organization), `metadataBase` pour les URLs absolues.
- **Sitemap** : généré automatiquement à l’URL `https://siberiamix.com/sitemap.xml` (pages : accueil, mentions légales, confidentialité, CGU, connexion, inscription).
- **robots.txt** : généré à `https://siberiamix.com/robots.txt` — tout le site est autorisé pour tous les robots, y compris **OAI-SearchBot** (utilisé par ChatGPT pour la recherche). Seuls les chemins sous `/api/` sont interdits.
- **llms.txt** : fichier `public/llms.txt` servi à `https://siberiamix.com/llms.txt` — résumé du projet et liens principaux pour les crawlers / LLM (format [llmstxt.org](https://llmstxt.org)).

---

## 1. Indexation Google

1. Va sur [Google Search Console](https://search.google.com/search-console).
2. Ajoute une propriété pour **siberiamix.com** (et éventuellement **www.siberiamix.com** si tu utilises le www).
3. Vérifie la propriété (balise HTML dans le site, fichier sur le serveur, ou enregistrement DNS, selon la méthode proposée).
4. Une fois vérifié : **Sitemaps** → « Ajouter un sitemap » → entre `https://siberiamix.com/sitemap.xml` → Envoyer.
5. Optionnel : **Inspection d’URL** → entre l’URL de ta page d’accueil → « Demander une indexation » pour accélérer la prise en compte.

Ensuite Google crawlera le site et le sitemap régulièrement.

---

## 2. Indexation Bing (important pour ChatGPT)

ChatGPT s’appuie beaucoup sur l’index Bing. Si ton site est bien indexé sur Bing, il a plus de chances d’apparaître dans les réponses de ChatGPT.

1. Va sur [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Ajoute ton site **siberiamix.com** et vérifie la propriété (méthode proposée par Bing).
3. Envoie ton sitemap : **Sitemaps** → ajouter `https://siberiamix.com/sitemap.xml`.
4. Tu peux importer tes paramètres depuis Google Search Console pour gagner du temps (option proposée par Bing).

---

## 3. Indexation ChatGPT

Il n’existe **pas** de formulaire pour « soumettre son site à ChatGPT ». Le contenu utilisé par ChatGPT pour la recherche vient surtout de :

1. **L’index Bing** — d’où l’importance d’être bien indexé sur Bing (étape 2).
2. **Le robot OAI-SearchBot** — il doit pouvoir crawler ton site. C’est déjà prévu dans `app/robots.ts` : **OAI-SearchBot** est autorisé sur tout le site (sauf `/api/`). Ne mets pas `Disallow: /` pour ce robot.
3. **Contenu et SEO** : bon titre, description, contenu lisible (SSR ou HTML correctement rendu), données structurées (JSON-LD) aident les moteurs et donc indirectement les réponses ChatGPT.

En résumé : **sitemap + robots.txt + indexation Bing + bon SEO** donnent les meilleures chances d’apparaître dans les réponses de ChatGPT. Vérifier que `https://siberiamix.com/robots.txt` contient bien une règle qui **autorise** OAI-SearchBot (pas de `Disallow: /` pour ce bot).

---

## Variable d’environnement (optionnel)

En production, tu peux définir :

```env
NEXT_PUBLIC_SITE_URL=https://siberiamix.com
```

pour que les URLs absolues (sitemap, Open Graph, JSON-LD) utilisent toujours ce domaine. Si elle n’est pas définie, le code utilise `https://siberiamix.com` par défaut.

---

## Vérifications rapides

- **Favicon / partage** : ouvrir `https://siberiamix.com` → onglet du navigateur (icône) et partage sur un réseau social (image + titre).
- **Sitemap** : ouvrir `https://siberiamix.com/sitemap.xml` → liste d’URLs en XML.
- **robots.txt** : ouvrir `https://siberiamix.com/robots.txt` → voir les règles et le lien vers le sitemap, et confirmer qu’il n’y a pas de `Disallow: /` pour OAI-SearchBot.
