# PRESET v4 - Exact Settings

This document shows exactly what "plugins" and settings are used in PRESET v4, so you can give me specific feedback.

## Processing Chain (in order):

### 1. High-Pass Filter
**Type:** Butterworth 2nd order
**Frequency:** 110 Hz
**Purpose:** Remove rumble, thin the vocal

### 2. EQ (Parametric)
**Type:** Multi-band EQ with shelves
**Settings:**
- **Low Shelf:** 200 Hz, -4.0 dB (cut)
- **High Shelf:** 8000 Hz, +1.0 dB (boost)
- **Bell 1:** 280 Hz, Q=1.0, -2.5 dB (low-mid cleanup)
- **Bell 2:** 450 Hz, Q=1.0, -1.5 dB (remove box/body)

### 3. Compressor
**Type:** RMS-based compressor with soft knee
**Settings:**
- **Threshold:** -12.0 dB
- **Ratio:** 2.0:1
- **Attack:** 5 ms (0.005s)
- **Release:** 100 ms (0.1s)
- **Makeup Gain:** +1.0 dB

### 4. Saturation
**Type:** Multiband tape saturation (Saturn-style)
**Settings:**
- **Drive:** 14% (0.14)
- **Style:** Warm tape (multiband: 0-306Hz, 306-2565Hz, 2565Hz+)

### 5. Limiter
**Type:** Look-ahead limiter
**Settings:**
- **Threshold:** -0.3 dB
- **Release:** 50 ms (0.05s)
- **Look-ahead:** 5 ms

### 6. Normalization
**Type:** Peak normalization
**Target:** -0.3 dB peak

---

## How to Give Me Instructions:

**Good instructions:**
- "The vocal is too thin, add back some low-mids around 300Hz"
- "The saturation is too much, reduce the drive"
- "The compression is too aggressive, make it gentler"
- "Add a de-esser, the sibilance is harsh"
- "The high shelf boost is too much, reduce it"

**Bad instructions:**
- "Make it sound better" (too vague)
- "Match my mix" (I can't hear it)
- "Fix everything" (not specific)

**Best format:**
1. What sounds wrong? (too thin, too harsh, too compressed, etc.)
2. What frequency range? (lows, low-mids, mids, high-mids, highs)
3. What should change? (more/less, add/remove)

Example: "The vocal needs more body in the 200-400Hz range, and the saturation is too aggressive - reduce it"
