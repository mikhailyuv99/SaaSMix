# Ordre de la chaîne d’effets (vocal mix)

Ordre **établi** à respecter dans `test_hise_direct.py`.

## Chaîne complète (ordre des étapes)

| # | Étape | Détail |
|---|--------|--------|
| 1 | **Noise gate** | Avant VST3 (threshold -50 dB, lookahead 10 ms) |
| 2 | **FX téléphone** (si coché) | EQ après le gate, juste avant le 1er VST3 — voir § FX téléphone |
| 3 | **VST3** | Project1.vst3 (chaîne HISE) |
| 4 | **De-esser** | FFT (threshold -15 dB, range 12 dB, 7–14 kHz) |
| 5 | **Tone** | Basses / Mids / Aigus / Air — voir § Tone (ordre interne ci‑dessous) |
| 6 | **Gain +4.5 dB** | Uniquement si Reverb 2 ou 3 |
| 7 | **Delay** | Ping-pong, BPM + division (1/4, 1/2, 1/8) |
| 8 | **Reverb** | reverb1 / reverb2 / reverb3 (VST3) |
| 9 | **Doubler** (si coché) | doubler.vst3 (HISE) |
| 10 | **FX robot** (si coché) | robot.vst3 (HISE) — après doubler si coché, sinon après reverb |

---

## FX téléphone (si coché)

- **Position** : après le gate, juste avant le 1er VST3.
- **Implémentation** : EQ en Python (pas de VST).
- **Paramètres** :
  - **HPF** : 900 Hz (ordre 2)
  - **Peak** : +2,5 dB @ 1650 Hz, Q = 2
  - **LPF** : 5500 Hz (ordre 2)

---

## Tone (Basses, Mids, Aigus, Air)

- **Position** : après De-esser, avant Gain / Delay.
- **Ordre d’application** dans le bloc Tone (un seul passage `apply_tone_control`) :
  1. **Basses** (tone_low)
  2. **Mids** (tone_mid)
  3. **Aigus** (tone_high)
  4. **Air**

### Paramètres par réglage

| Réglage | Valeur UI | Effet | Paramètres techniques |
|---------|-----------|--------|------------------------|
| **Basses** | 1 | Coupe en dessous de 150 Hz | HPF 150 Hz (Butterworth ordre 2) |
| **Basses** | 2 | Neutre | Aucun traitement |
| **Basses** | 3 | Boost 150–200 Hz | Bande 150–200 Hz (LP 200 Hz + HP 150 Hz), +2 dB |
| **Mids** | 1 | Coupe 400 Hz–4 kHz | Bande 400–4 kHz (HP 400 Hz + LP 4 kHz), -2 dB |
| **Mids** | 2 | Neutre | Aucun traitement |
| **Mids** | 3 | Boost 400 Hz–4 kHz | Même bande, +2 dB |
| **Aigus** | 1 | Coupe au-dessus de 9 kHz | Shelf haut : contenu > 9 kHz (HP 9 kHz), -2 dB |
| **Aigus** | 2 | Neutre | Aucun traitement |
| **Aigus** | 3 | Boost au-dessus de 9 kHz | Shelf haut : contenu > 9 kHz, +2 dB |
| **Air** | off | Rien | — |
| **Air** | on | Boost au-dessus de 12,5 kHz | Shelf haut : contenu > 12 500 Hz (HP 12,5 kHz), +2 dB |

Tous les boosts/coupes sont en **±2 dB** (sauf FX téléphone). Filtres : Butterworth ordre 2. Les bandes sont extraites puis additionnées au signal avec le gain correspondant (`boost_2` = 10^(2/20)-1, `cut_2` = 10^(-2/20)-1).

---

*Ne pas modifier l’ordre sans alignement.*
