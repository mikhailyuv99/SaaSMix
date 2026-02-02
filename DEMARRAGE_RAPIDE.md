# SaaS Mix – Étapes pour démarrer (débutant)

Guide pas à pas pour lancer le projet et tester l’API.

---

## Étape 1 : Ouvrir un terminal dans le dossier du projet

1. Ouvre **Cursor** (ou ton éditeur) avec le projet **SaaS Mix**.
2. Ouvre un terminal intégré : **Terminal → New Terminal** (ou `Ctrl+ù`).
3. Tu dois être dans un dossier du type `C:\Users\mikha\Desktop\SaaS Mix\...`.

---

## Étape 2 : Aller dans le dossier backend

Dans le terminal, tape :

```powershell
cd backend
```

Tu dois voir quelque chose comme : `PS C:\Users\mikha\Desktop\SaaS Mix\backend>`

---

## Étape 3 : (Une seule fois) Installer les dépendances Python

Si c’est la **première fois** ou si tu n’as jamais fait ça :

```powershell
python -m pip install "uvicorn[standard]" fastapi python-multipart
```

Attends que l’installation se termine. Si tout est déjà installé, tu peux passer à l’étape 4.

---

## Étape 4 : Lancer le serveur (l’API)

Toujours dans le dossier **backend**, tape :

```powershell
python -m uvicorn main:app --reload
```

- **Ne ferme pas ce terminal** : tant que le serveur tourne, tu dois le laisser ouvert.
- Tu dois voir : `Uvicorn running on http://127.0.0.1:8000`

Le serveur est lancé. L’API écoute sur **http://127.0.0.1:8000**.

---

## Étape 5 : Tester que l’API répond

1. Ouvre ton **navigateur** (Chrome, Edge, etc.).
2. Va sur : **http://127.0.0.1:8000**
3. Tu dois voir un message du type : `{"message":"SaaS Mix API is running!","status":"healthy"}`

Si tu vois ça, l’API fonctionne.

---

## Étape 6 : (Optionnel) Tester l’interface Swagger

1. Dans le navigateur, va sur : **http://127.0.0.1:8000/docs**
2. Tu vois la liste des endpoints (ex. `GET /`, `POST /api/track/mix`, etc.).
3. Tu peux cliquer sur un endpoint, puis sur **« Try it out »** puis **« Execute »** pour le tester.

Pour **POST /api/track/mix** : il faut envoyer un fichier WAV. Tu peux choisir un fichier sur ton PC dans le champ `file`.

---

## Récap – À faire à chaque fois que tu travailles sur le projet

| Ordre | Action | Commande |
|-------|--------|----------|
| 1 | Ouvrir un terminal dans le projet | — |
| 2 | Aller dans `backend` | `cd backend` |
| 3 | Lancer le serveur | `python -m uvicorn main:app --reload` |
| 4 | Laisser le terminal ouvert et aller sur http://127.0.0.1:8000 ou http://127.0.0.1:8000/docs | — |

Pour **arrêter** le serveur : dans le terminal où il tourne, appuie sur **Ctrl+C**.

---

## Lancer le frontend (UI pistes)

1. **Garder le backend lancé** (terminal 1 avec `uvicorn`).
2. Ouvrir un **deuxième terminal**.
3. Aller à la racine du projet, puis dans `frontend` :
   ```powershell
   cd frontend
   ```
4. Installer les dépendances (une seule fois) :
   ```powershell
   npm install
   ```
5. Lancer le site :
   ```powershell
   npm run dev
   ```
6. Ouvrir dans le navigateur : **http://localhost:3000**

Tu verras la page avec « Ajouter une piste », upload WAV, catégorie, gain, bouton **Mix** (pour Lead vocal / Adlibs), et après un mix le bouton **Sans mix (avant)** / **Avec mix** pour comparer.
