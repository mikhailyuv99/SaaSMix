# Mapping EQ VST3 → ancien Tone (Basses / Mids / Aigus)

Les **9 EQ VST3** (EQ1 à EQ9) remplacent les anciens réglages Tone (basses 1–3, mids 1–3, highs 1–3). Chaque EQ est un plugin VST3 exporté depuis HISE.

---

## Correspondance

| VST3   | Remplace      | Ancien réglage UI |
|--------|----------------|-------------------|
| **EQ1** | tone bass 1   | Basses = 1 (HPF 150 Hz) |
| **EQ2** | tone bass 2   | Basses = 2 (neutre)     |
| **EQ3** | tone bass 3   | Basses = 3 (+2 dB 150–200 Hz) |
| **EQ4** | tone mids 1   | Mids = 1 (-2 dB 400–4k)  |
| **EQ5** | tone mids 2   | Mids = 2 (neutre)       |
| **EQ6** | tone mids 3   | Mids = 3 (+2 dB 400–4k)  |
| **EQ7** | tone highs 1  | Aigus = 1 (-2 dB from 9k) |
| **EQ8** | tone highs 2  | Aigus = 2 (neutre)       |
| **EQ9** | tone highs 3  | Aigus = 3 (+2 dB from 9k) |

**Air** reste géré à part (Python ou futur VST dédié), il n’est pas remplacé par ces EQ.

---

## Position dans la chaîne

Les EQ sont en **début de chaîne**, avant le VST3 principal (GlobalMix / Project1) :

```
[EQ Basses] → [EQ Mids] → [EQ Highs] → Gate → [FX téléphone] → VST3 principal → De-esser → Air → …
```

- **EQ Basses** = un seul parmi EQ1, EQ2, EQ3 (selon choix utilisateur 1, 2 ou 3).
- **EQ Mids**  = un seul parmi EQ4, EQ5, EQ6 (selon choix 1, 2 ou 3).
- **EQ Highs** = un seul parmi EQ7, EQ8, EQ9 (selon choix 1, 2 ou 3).

Donc **3 VST3 en série** au début (basses → mids → highs), pas les 9 en même temps.

---

## Implémentation (quand les VST3 sont prêts)

1. **Chemins** : ajouter dans `vst_config.py` (ou équivalent) les clés `eq1` … `eq9` pointant vers `eq1.vst3` … `eq9.vst3`.
2. **Backend** : dans `test_hise_direct.py` (ou le module qui gère la chaîne), en début de chaîne :
   - lire les paramètres `tone_low`, `tone_mid`, `tone_high` (1, 2 ou 3) ;
   - enchaîner 3 appels au host : `EQ{tone_low+0}.vst3` (basses), `EQ{tone_mid+3}.vst3` (mids), `EQ{tone_high+6}.vst3` (highs).
3. **Frontend** : réintroduire les 3 sélecteurs (Basses 1|2|3, Mids 1|2|3, Aigus 1|2|3) et renvoyer ces valeurs à l’API.

Fichiers à toucher : `backend/test_hise_direct.py`, `backend/vst_config.py`, `backend/main.py` (Form + kwargs), `frontend/app/page.tsx` (MixParams + UI).

---

*Référence : ancien `apply_tone_control()` et § Tone dans CHAINE_EFFETS_ORDRE.md.*
