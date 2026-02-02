# Preset Version History

Track all versions of the vocal processing preset so we can revert if needed.

## PRESET v1
**Date:** Previous
**Description:** Clean implementation based on PLUGINS.txt
- Removed all analysis-based tweaks
- Direct implementation of PLUGINS.txt chain
- Complex multi-stage processing

**Status:** Too complex, sounded bad

## PRESET v2
**Date:** Previous
**Description:** Basic mixing chain
- Had reverb and delay
- Too much processing

**Status:** Too much reverb/delay, vocal drowned

## PRESET v3
**Date:** Previous
**Description:** SIMPLE - Just EQ, no reverb, no delay
- 80Hz high-pass filter
- Basic EQ (gentle low cut, gentle high boost)
- Light compression (just to control peaks)
- Final limiter
- Normalization
- NO reverb
- NO delay
- NO saturation
- NO de-esser

**Status:** Baseline - clean, vocal clearly heard

## PRESET v4
**Date:** Current
**Description:** Thin vocal + subtle saturation (still dry)
- HPF moved up to ~110Hz (thinner)
- Stronger low shelf cut + low-mid cuts (280Hz/450Hz)
- Added subtle tape saturation for grit/excitement
- Still NO reverb / NO delay

**Status:** Active (v5 reverted)

## PRESET v5
**Date:** Previous
**Description:** Complete professional chain with all buses
- Noise gate (clears mud)
- De-esser 1 (split band, -40 threshold, -16dB reduction)
- EQ 1 (HPF 120Hz, bells at 140/250/550/5500Hz, high shelf 10kHz +5dB)
- Dual compression (4:1 ratio, +2dB louder, tighter)
- Multiband saturation (0-300Hz -2dB, 5k-20kHz +1dB, both 25% drive)
- EQ 2 (HPF 130Hz, bells at 200/330Hz, dynamic 9kHz +2dB/-4dB)
- De-esser 2 (wide band, -40 threshold, -10dB reduction)
- Limiter (output -1dB)
- Parallel compression bus (tighten, no volume increase)
- Delay bus (1/2 note)
- Reverb bus (large hall, 35% mix)
- Doubler bus (widen vocal)

**Status:** Reverted (sounded bad)
