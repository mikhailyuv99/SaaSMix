# Ordre de la chaîne d’effets (vocal mix)

Ordre **établi** à respecter dans `test_hise_direct.py`.

## Chaîne complète (ordre des étapes)

| # | Étape | Détail |
|---|--------|--------|
| 0a | **EQ Basses / Mids / Highs** | EQ1–EQ9 (3 VST3 en série selon réglages Basses/Mids/Aigus 1–2–3), avant Gate |
| 1 | **Noise gate** | Threshold -50 dB, lookahead 10 ms |
| 2 | **FX téléphone** (si coché) | EQ Python (HPF 900, peak 1650, LPF 5500) — voir § FX téléphone |
| 3 | **GlobalMix (VST3)** | Chaîne principale (remplace Project1.vst3) |
| 4 | **De-esser** | FFT, 3 modes : léger (1), moyen (2), fort (3) — avant Delay |
| 5 | **Air** | +2 dB shelf from 12,5 kHz (Python) |
| 6 | **Gain +4.5 dB** | Uniquement si Reverb 2 ou 3 |
| 7 | **Delay** | Ping-pong, BPM + division (1/4, 1/2, 1/8) |
| 8 | **Reverb** | reverb1 / reverb2 / reverb3 (VST3) |
| 9 | **Doubler** (si coché) | DSP Python (stéréo symétrique, cross-delay ~20 ms, wet 0.4) |
| 10 | **FX robot** (si coché) | robot.vst3 (HISE) |

---

## FX téléphone (si coché)

- **Position** : après le gate, juste avant le 1er VST3.
- **Implémentation** : EQ en Python (pas de VST).
- **Paramètres** :
  - **HPF** : 900 Hz (ordre 2)
  - **Peak** : +2,5 dB @ 1650 Hz, Q = 2
  - **LPF** : 5500 Hz (ordre 2)

---

## Air (seul reste de l’ancien Tone)

- **Position** : après De-esser, avant Gain / Delay.
- **Effet** : shelf +2 dB à partir de 12,5 kHz (implémentation Python `apply_tone_control(..., air=True)`).

---

## EQ VST3 (début de chaîne)

Les réglages **Basses 1|2|3**, **Mids 1|2|3**, **Aigus 1|2|3** (UI) sont reliés aux **9 VST3** EQ1–EQ9 en **début de chaîne** (avant Gate et FX téléphone) :

- **EQ1** = Basses 1, **EQ2** = Basses 2, **EQ3** = Basses 3  
- **EQ4** = Mids 1, **EQ5** = Mids 2, **EQ6** = Mids 3  
- **EQ7** = Aigus 1, **EQ8** = Aigus 2, **EQ9** = Aigus 3  

Détails : **`EQ_VST3_MAPPING.md`**.

## De-esser (3 modes)

- **Position** : après GlobalMix, avant Delay.
- **Modes** : 1 = léger (threshold -12 dB, range 6 dB), 2 = moyen (-15 dB, 12 dB), 3 = fort (-18 dB, 16 dB).
- **UI** : case « De-esser » + select Léger / Moyen / Fort sur la même ligne.

---

*Ne pas modifier l’ordre sans alignement.*
