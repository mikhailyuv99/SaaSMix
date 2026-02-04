"""
Autotune basé sur CREPE (détection de pitch) + correction vers gamme.
100% open-source, pas de plugin commercial.
- Détection automatique de la tonalité (key) depuis le chant
- Retune speed: 0 = très naturel, 1 = très robotique (style T-Pain)
"""
from __future__ import annotations

import numpy as np
from typing import Optional

# CREPE optionnel (dépendance lourde)
try:
    import crepe
    CREPE_AVAILABLE = True
except ImportError:
    CREPE_AVAILABLE = False

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False

# Sample rate sur lequel CREPE est le plus fiable pour la voix
CREPE_SR = 16000

# Gamme majeure en demi-tons (relatif à la tonique)
MAJOR_SCALE = np.array([0, 2, 4, 5, 7, 9, 11])
MINOR_SCALE = np.array([0, 2, 3, 5, 7, 8, 10])


def hz_to_midi(hz: float) -> float:
    if hz <= 0:
        return 0.0
    return 12.0 * (np.log2(hz / 440.0)) + 69.0


def midi_to_hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def _nearest_scale_degree(semitone_in_octave: float, scale: np.ndarray) -> float:
    """Demi-ton dans l'octave (0-12) -> degré de gamme le plus proche (0,2,4,5,7,9,11 pour majeur)."""
    best = scale[0]
    best_dist = 999.0
    for d in scale:
        for offset in (-12, 0, 12):
            dist = abs(semitone_in_octave - (d + offset))
            if dist < best_dist:
                best_dist = dist
                best = d
    return best


def _midi_to_scale_midi(midi: float, root: int, scale: np.ndarray) -> float:
    """Quantize midi (float) vers la note la plus proche dans la gamme (root 0-11)."""
    if midi <= 0:
        return midi
    rel = (midi - root) % 12
    degree = _nearest_scale_degree(rel, scale)
    octave = int(round((midi - root) / 12.0))
    return root + octave * 12 + degree


def _detect_key_from_pitch(time_sec: np.ndarray, frequency: np.ndarray, confidence: np.ndarray) -> int:
    """Estime la tonique (0-11, C=0) à partir des pics de pitch CREPE."""
    voiced = (frequency > 80) & (confidence > 0.35)
    if not np.any(voiced):
        return 0  # défaut C
    midi = hz_to_midi(frequency[voiced])
    midi = midi[np.isfinite(midi) & (midi > 20) & (midi < 100)]
    if len(midi) == 0:
        return 0
    # Tonique = classe de hauteur la plus fréquente (histogramme)
    pitch_class = (np.round(midi) % 12).astype(int)
    hist, _ = np.histogram(pitch_class, bins=12, range=(0, 12))
    root = int(np.argmax(hist))
    return root


def apply_autotune_crepe(
    audio: np.ndarray,
    sr: int,
    key: Optional[int] = None,
    scale: str = "major",
    retune_speed: float = 1.0,
    step_size_ms: int = 10,
    block_len: int = 2048,
    crossfade_len: int = 128,
) -> np.ndarray:
    """
    Applique une correction de pitch type autotune (CREPE + quantize gamme + pitch shift).

    - key: 0-11 (C=0). Si None, détection automatique depuis le chant.
    - scale: "major" ou "minor"
    - retune_speed: 0.0 = très lisse/naturel, 1.0 = snap instantané (robotique).
    """
    if not CREPE_AVAILABLE or not LIBROSA_AVAILABLE:
        return audio.copy()

    if audio.ndim == 2:
        mono = (audio[:, 0].astype(np.float64) + audio[:, 1].astype(np.float64)) / 2.0
        nch = 2
    else:
        mono = audio.flatten().astype(np.float64)
        nch = 1

    n_samples = len(mono)
    out = np.zeros(n_samples, dtype=np.float64)
    out[:] = mono

    # CREPE est plus fiable sur la voix à 16 kHz
    mono_norm = mono / (np.max(np.abs(mono)) + 1e-8)
    if sr != CREPE_SR:
        mono_crepe = librosa.resample(mono_norm.astype(np.float32), orig_sr=sr, target_sr=CREPE_SR)
    else:
        mono_crepe = mono_norm.astype(np.float32)

    try:
        time_sec, frequency, confidence, _ = crepe.predict(
            mono_crepe, CREPE_SR, step_size=step_size_ms, viterbi=True, verbose=0
        )
    except Exception:
        return audio.copy()

    time_sec = np.asarray(time_sec)
    frequency = np.asarray(frequency)
    confidence = np.asarray(confidence)

    scale_notes = MAJOR_SCALE if scale.lower() == "major" else MINOR_SCALE
    if key is None:
        root = _detect_key_from_pitch(time_sec, frequency, confidence)
    else:
        root = int(key) % 12

    # Courbe de pitch cible (quantisée à la gamme)
    n_frames = len(time_sec)
    target_midi = np.zeros(n_frames)
    for i in range(n_frames):
        if frequency[i] > 80 and confidence[i] > 0.12:
            midi = hz_to_midi(float(frequency[i]))
            target_midi[i] = _midi_to_scale_midi(midi, root, scale_notes)
        else:
            target_midi[i] = target_midi[i - 1] if i > 0 else 60.0

    # Lissage: retune_speed=1 => snap direct (robot)
    alpha = max(0.01, min(1.0, retune_speed))
    target_smooth = np.zeros_like(target_midi)
    target_smooth[0] = target_midi[0]
    for i in range(1, n_frames):
        target_smooth[i] = target_smooth[i - 1] + (target_midi[i] - target_smooth[i - 1]) * alpha

    # Pas d'overlap: un seul shift par bloc pour que l'effet soit net (hop = block_len)
    hop_len = block_len
    n_blocks = max(1, (n_samples - block_len) // hop_len + 1)
    cf = min(crossfade_len, block_len // 4)

    for b in range(n_blocks):
        start = b * hop_len
        end = min(start + block_len, n_samples)
        chunk_len = end - start
        if chunk_len < 64:
            continue

        chunk = mono[start:end].copy()
        if chunk_len < block_len:
            chunk = np.pad(chunk, (0, block_len - chunk_len), mode="constant", constant_values=0)

        t_center_sec = (start + block_len // 2) / sr
        frame_idx = int(round(t_center_sec * 1000 / step_size_ms))
        frame_idx = max(0, min(frame_idx, n_frames - 1))

        freq = frequency[frame_idx]
        conf = confidence[frame_idx]
        tgt = target_smooth[frame_idx]

        if freq > 60 and conf > 0.12:
            current_midi = hz_to_midi(float(freq))
            n_steps = float(tgt - current_midi)
            n_steps = max(-12, min(12, n_steps))
            # Arrondi au demi-ton pour un effet plus net / robot
            n_steps = round(n_steps * 2) / 2.0
        else:
            n_steps = 0.0

        if abs(n_steps) >= 0.25:
            try:
                shifted = librosa.effects.pitch_shift(
                    chunk.astype(np.float32), sr=sr, n_steps=n_steps, res_type="soxr_hq"
                ).astype(np.float64)
            except Exception:
                shifted = chunk
        else:
            shifted = chunk

        # Écriture avec crossfade aux bords pour éviter les clics
        if b == 0:
            out[start:end] = shifted[:chunk_len]
        else:
            # Crossfade: fin du bloc précédent (out[start-cf:start]) + début du bloc actuel (shifted[:cf])
            if start >= cf and chunk_len >= cf:
                out[start - cf : start] = (
                    out[start - cf : start] * np.linspace(1, 0, cf)
                    + shifted[:cf] * np.linspace(0, 1, cf)
                )
            out[start:end] = shifted[:chunk_len]

    if nch == 2:
        out = np.column_stack([out, out]).astype(np.float32)
    else:
        out = out.astype(np.float32)
    return out
