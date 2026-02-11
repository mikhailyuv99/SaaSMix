"""
Test direct : appelle hise_vst3_host (Windows .exe ou Linux binaire depuis R2) avec Project1.vst3 + de-esser léger.
"""
import os

# Taille de bloc pour le host VST3 (plus grand = moins d'appels processBlock, rendu souvent plus rapide)
VST_BLOCK_SIZE = int(os.environ.get("VST_BLOCK_SIZE", "2048"))
import subprocess
import sys
import tempfile
import threading
import time
import wave
import shutil
import soundfile as sf
from pathlib import Path
from typing import Optional, Callable
import numpy as np
from scipy.signal import butter, lfilter

# Chemins (Windows par défaut ; écrasés sous Linux si R2 configuré)
_def = Path(r"c:\Users\mikha\Desktop\SaaS Mix\hise_vst3_host\build\hise_vst3_host_artefacts\Release\hise_vst3_host.exe")
# Fallback : chemin relatif au projet (VPS = C:\Users\Administrator\SaaSMix\...)
if not _def.exists():
    _project_root = Path(__file__).resolve().parent.parent
    _def = _project_root / "hise_vst3_host" / "build" / "hise_vst3_host_artefacts" / "Release" / "hise_vst3_host.exe"
HOST_EXE = _def
VST3_PATH = Path(r"C:\Users\mikha\Desktop\HISE\Project1\Binaries\Compiled\VST3\Project1.vst3")
try:
    from vst_config import VST_PATHS
    def _vst_path(name):
        p = VST_PATHS.get(name) or ""
        return Path(p) if p else None
    MASTER_PATH = _vst_path("master")
    REVERB1_PATH = _vst_path("reverb1")
    REVERB2_PATH = _vst_path("reverb2")
    REVERB3_PATH = _vst_path("reverb3")
    DOUBLER_PATH = _vst_path("doubler")
    ROBOT_PATH = _vst_path("robot")
except Exception:
    MASTER_PATH = Path(r"C:\Users\mikha\Desktop\HISE\master\Binaries\Compiled\VST3\master.vst3")
    _base = Path(r"C:\Users\mikha\Desktop\HISE\Project1\Binaries\Compiled\VST3")
    REVERB1_PATH = _base / "reverb1.vst3"
    REVERB2_PATH = _base / "reverb2.vst3"
    REVERB3_PATH = _base / "reverb3.vst3"
    DOUBLER_PATH = Path(r"C:\Users\mikha\Desktop\HISE\doubler\Binaries\Compiled\VST3\doubler.vst3")
    ROBOT_PATH = Path(r"C:\Users\mikha\Desktop\HISE\robot\Binaries\Compiled\VST3\robot.vst3")
if DOUBLER_PATH is None:
    DOUBLER_PATH = Path(r"C:\Users\mikha\Desktop\HISE\doubler\Binaries\Compiled\VST3\doubler.vst3")
if ROBOT_PATH is None:
    ROBOT_PATH = Path(r"C:\Users\mikha\Desktop\HISE\robot\Binaries\Compiled\VST3\robot.vst3")

# Serveur Windows (prod) : chemins par variables d’env (voir DEPLOY_WINDOWS.md)
if os.environ.get("HISE_VST3_HOST_EXE"):
    HOST_EXE = Path(os.environ["HISE_VST3_HOST_EXE"])
if os.environ.get("VST_BASE"):
    _base = Path(os.environ["VST_BASE"])
    # Scan récursif : tous les .vst3 sous VST_BASE, indexés par nom (stem)
    _vst_map = {}
    if _base.exists():
        try:
            for f in _base.rglob("*.vst3"):
                stem = f.stem.lower()
                if stem not in _vst_map:
                    _vst_map[stem] = f
        except Exception:
            pass
    def _vst_by_name(name: str, alt: str = None) -> Path:
        for key in (name.lower(), (alt or "").lower()):
            if key and key in _vst_map:
                return _vst_map[key]
        for stem, p in _vst_map.items():
            if name.lower() in stem or (alt and alt.lower() in stem):
                return p
        return _base / f"{name}.vst3"

    VST3_PATH = _vst_map.get("project1") or _vst_by_name("project1")
    MASTER_PATH = _vst_map.get("master") or _vst_by_name("master")
    REVERB1_PATH = _vst_map.get("reverb1") or _vst_by_name("reverb1")
    REVERB2_PATH = _vst_map.get("reverb2") or _vst_by_name("reverb2")
    REVERB3_PATH = _vst_map.get("reverb3new") or _vst_map.get("reverb3") or _vst_by_name("reverb3new", "reverb3")
    DOUBLER_PATH = _vst_map.get("doubler") or _vst_by_name("doubler")
    ROBOT_PATH = _vst_map.get("robot") or _vst_by_name("robot")

# Linux (production Render) : utiliser binaires téléchargés depuis R2
if sys.platform == "linux":
    try:
        from r2_assets import ensure_r2_assets, get_linux_host_path, get_linux_vst_path
        if ensure_r2_assets():
            host = get_linux_host_path()
            if host:
                HOST_EXE = host
                vst3 = get_linux_vst_path("Project1")
                if vst3:
                    VST3_PATH = vst3
                master = get_linux_vst_path("master")
                if master:
                    MASTER_PATH = master
                r1 = get_linux_vst_path("reverb1")
                if r1:
                    REVERB1_PATH = r1
                r2 = get_linux_vst_path("reverb2")
                if r2:
                    REVERB2_PATH = r2
                r3 = get_linux_vst_path("reverb3new")
                if r3:
                    REVERB3_PATH = r3
                d = get_linux_vst_path("doubler")
                if d:
                    DOUBLER_PATH = d
                r = get_linux_vst_path("robot")
                if r:
                    ROBOT_PATH = r
    except Exception as e:
        print("Linux/R2: chaîne HISE non disponible:", e)


def get_vst_status():
    """État de TOUS les chemins VST (host + chaque plugin) pour diagnostic déploiement."""
    def _info(name, p):
        if p is None:
            return {"path": None, "exists": False}
        return {"path": str(p), "exists": p.exists()}

    vst_base = os.environ.get("VST_BASE", "NOT SET")
    host_env = os.environ.get("HISE_VST3_HOST_EXE", "NOT SET")

    return {
        "env": {
            "HISE_VST3_HOST_EXE": host_env,
            "VST_BASE": vst_base,
            "VST_BLOCK_SIZE": VST_BLOCK_SIZE,
        },
        "HOST_EXE": _info("host", HOST_EXE),
        "Project1 (VST3_PATH)": _info("Project1", VST3_PATH),
        "master": _info("master", MASTER_PATH),
        "reverb1": _info("reverb1", REVERB1_PATH),
        "reverb2": _info("reverb2", REVERB2_PATH),
        "reverb3": _info("reverb3", REVERB3_PATH),
        "doubler": _info("doubler", DOUBLER_PATH),
        "robot": _info("robot", ROBOT_PATH),
    }


def read_wav(path: str):
    """Lit un WAV en float32. Supporte PCM 16/24/32-bit, float, et WAVE_FORMAT_EXTENSIBLE (65534)."""
    try:
        audio, sr = sf.read(path, dtype="float32")
    except Exception as e:
        # Fallback pour .wav basique si soundfile échoue (fichier corrompu, etc.)
        try:
            with wave.open(path, "rb") as wf:
                sr = wf.getframerate()
                nch = wf.getnchannels()
                nframes = wf.getnframes()
                sampwidth = wf.getsampwidth()
                raw = wf.readframes(nframes)
            if sampwidth == 2:
                arr = np.frombuffer(raw, dtype=np.int16)
                audio = arr.astype(np.float32) / 32768.0
            elif sampwidth == 3:
                arr = np.frombuffer(raw, dtype=np.uint8)
                arr = arr.reshape(-1, 3)
                sample = (arr[:, 0].astype(np.int32) | (arr[:, 1].astype(np.int32) << 8) |
                          (arr[:, 2].astype(np.int32) << 16))
                sample = np.where(sample >= 0x800000, sample - 0x1000000, sample)
                audio = sample.astype(np.float32) / 8388608.0
            elif sampwidth == 4:
                arr = np.frombuffer(raw, dtype=np.int32)
                audio = arr.astype(np.float32) / 2147483648.0
            else:
                raise ValueError(f"Sample width {sampwidth} non supporté")
            audio = audio.reshape(-1, nch)
        except Exception:
            raise e
    if audio.ndim == 1:
        audio = audio.reshape(-1, 1)
    return audio, sr


def write_wav(path: str, audio: np.ndarray, sr: int):
    """Écrit un WAV depuis float32."""
    if audio.ndim == 1:
        audio = audio.reshape(-1, 1)
    nch = audio.shape[1]
    data = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(nch)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(data.tobytes())


def apply_deesser(audio: np.ndarray, sr: int, threshold_db: float = -15.0,
                  freq_low: float = 7000, freq_high: float = 14000,
                  range_db: float = 12.0) -> np.ndarray:
    """
    De-esser FFT spectral : pas de filtres IIR, pas d'artefacts de phase.
    Réduit uniquement les bins 6-12 kHz quand sibilance détectée.
    """
    n_fft = 2048
    hop = 512
    win = np.hanning(n_fft).astype(np.float32)
    
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    sibilant_mask = (freqs >= freq_low) & (freqs <= freq_high)
    sibilant_bins = np.where(sibilant_mask)[0]
    
    if len(sibilant_bins) == 0:
        return audio.copy()
    
    # Padding
    n_frames = max(1, (len(audio) - n_fft) // hop + 1)
    pad_len = (n_frames - 1) * hop + n_fft
    if pad_len < len(audio):
        pad_len = len(audio) + n_fft
        n_frames = (pad_len - n_fft) // hop + 1
    x = np.pad(audio.astype(np.float32), (0, max(0, pad_len - len(audio))))
    
    # Pass 1 : énergie sibilante par frame
    envelope = np.zeros(n_frames, dtype=np.float32)
    mags = []
    phases = []
    
    for i in range(n_frames):
        start = i * hop
        frame = x[start:start + n_fft] * win
        spec = np.fft.rfft(frame)
        mag = np.abs(spec)
        phase = np.angle(spec)
        mags.append(mag)
        phases.append(phase)
        
        envelope[i] = np.sqrt(np.mean(mag[sibilant_bins] ** 2) + 1e-12)
    
    # Lookahead : max sur fenêtre glissante (anticipation)
    lookahead_frames = max(1, int(0.005 * sr / hop))  # ~5ms
    envelope_la = np.zeros_like(envelope)
    for i in range(n_frames):
        end = min(i + lookahead_frames + 1, n_frames)
        envelope_la[i] = np.max(envelope[i:end])
    
    # Seuil relatif au pic du fichier
    peak = np.percentile(envelope_la, 92) + 1e-12
    threshold = peak * (10 ** (threshold_db / 20))
    min_gain = 10 ** (-range_db / 20)
    
    # Gain par frame (compression douce ~3:1)
    gains = np.ones(n_frames, dtype=np.float32)
    for i in range(n_frames):
        if envelope_la[i] > threshold:
            ratio = envelope_la[i] / threshold
            g = 1.0 / (ratio ** 0.67)  # ~3:1
            gains[i] = np.clip(g, min_gain, 1.0)
    
    # Smooth gain (attack 0.5ms, release 15ms)
    attack_frames = max(1, int(0.0005 * sr / hop))
    release_frames = max(1, int(0.020 * sr / hop))
    gains_smooth = np.ones_like(gains)
    gains_smooth[0] = gains[0]
    for i in range(1, n_frames):
        if gains[i] < gains_smooth[i - 1]:
            alpha = 1.0 - np.exp(-1.0 / attack_frames)
        else:
            alpha = 1.0 - np.exp(-1.0 / release_frames)
        gains_smooth[i] = (1 - alpha) * gains_smooth[i - 1] + alpha * gains[i]
    
    # Pass 2 : appliquer gain et ISTFT
    output = np.zeros(pad_len, dtype=np.float32)
    window_sum = np.zeros(pad_len, dtype=np.float32)
    
    for i in range(n_frames):
        start = i * hop
        mag = mags[i].copy()
        phase = phases[i]
        
        mag[sibilant_bins] *= gains_smooth[i]
        spec_new = mag * np.exp(1j * phase)
        frame_out = np.fft.irfft(spec_new, n=n_fft).real.astype(np.float32) * win
        
        output[start:start + n_fft] += frame_out
        window_sum[start:start + n_fft] += win ** 2
    
    window_sum[window_sum < 1e-6] = 1.0
    output /= window_sum
    
    return output[:len(audio)].astype(np.float32)


def detect_bpm(audio: np.ndarray, sr: int) -> float:
    """Détection automatique du BPM."""
    try:
        import librosa
        # Mono pour la détection
        if audio.ndim == 2:
            mono = np.mean(audio, axis=1)
        else:
            mono = audio
        tempo, _ = librosa.beat.beat_track(y=mono.astype(np.float32), sr=sr)
        # tempo peut être un array numpy
        if hasattr(tempo, '__len__'):
            tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
        else:
            tempo = float(tempo)
        return tempo if 60 < tempo < 200 else 120.0
    except ImportError:
        print("   (librosa non dispo, BPM par défaut: 120)")
        return 120.0
    except Exception:
        return 120.0


def apply_pingpong_delay(audio: np.ndarray, sr: int, bpm: float = None,
                         note_division: str = "1/4", feedback: float = 0.48,
                         wet_mix: float = 0.22, highcut: float = 4200,
                         lowcut: float = 200, feedback_filter_hz: float = 2400) -> np.ndarray:
    """
    Delay ping-pong stéréo, style dreamy : wet discret, répétitions sombres et diffus.
    """
    # Détection auto du BPM si pas fourni
    if bpm is None:
        bpm = detect_bpm(audio, sr)
        print(f"   BPM détecté: {bpm:.1f}")
    
    # Calcul du temps de delay
    beat_duration = 60.0 / bpm
    if note_division == "1/2":
        delay_time = beat_duration * 2
    elif note_division == "1/4":
        delay_time = beat_duration
    elif note_division == "1/8":
        delay_time = beat_duration / 2
    else:
        delay_time = beat_duration
    
    delay_samples = int(delay_time * sr)
    if delay_samples < 1:
        delay_samples = 1
    
    # Mono input pour le delay
    if audio.ndim == 1:
        mono = audio
        stereo_in = np.column_stack([audio, audio])
    else:
        mono = np.mean(audio, axis=1)
        stereo_in = audio
    
    n_samples = len(mono)
    
    # Filtres pour le delay
    nyquist = sr / 2
    b_lp, a_lp = butter(2, min(highcut / nyquist, 0.99), btype='low')
    b_hp, a_hp = butter(2, max(lowcut / nyquist, 0.001), btype='high')
    
    # One-pole lowpass dans la boucle de feedback (chaque répétition plus sombre = plus diffus)
    fc = min(feedback_filter_hz, sr / 2.5)
    feedback_lp_coeff = 1.0 - np.exp(-2.0 * np.pi * fc / sr)
    
    # Ping-pong : 2 buffers séparés (L et R)
    buf_l = np.zeros(delay_samples, dtype=np.float32)
    buf_r = np.zeros(delay_samples, dtype=np.float32)
    wet_l = np.zeros(n_samples, dtype=np.float32)
    wet_r = np.zeros(n_samples, dtype=np.float32)
    state_l = 0.0
    state_r = 0.0
    
    write_idx = 0
    
    for i in range(n_samples):
        # Indices de lecture (delay complet)
        read_idx = (write_idx - delay_samples) % delay_samples
        
        # Lire depuis les buffers (sortie du delay)
        delayed_l = buf_l[read_idx]
        delayed_r = buf_r[read_idx]
        
        # Lowpass sur le feedback pour rendre la queue plus douce / diffuse
        state_l = state_l + (delayed_l - state_l) * feedback_lp_coeff
        state_r = state_r + (delayed_r - state_r) * feedback_lp_coeff
        
        # Écrire : input mono dans L, feedback filtré de R vers L
        buf_l[write_idx] = mono[i] + state_r * feedback
        buf_r[write_idx] = state_l * feedback
        
        wet_l[i] = delayed_l
        wet_r[i] = delayed_r
        
        write_idx = (write_idx + 1) % delay_samples
    
    # Filtrer le wet (highcut plus bas = son plus diffus)
    wet_l = lfilter(b_lp, a_lp, wet_l)
    wet_l = lfilter(b_hp, a_hp, wet_l)
    wet_r = lfilter(b_lp, a_lp, wet_r)
    wet_r = lfilter(b_hp, a_hp, wet_r)
    
    # Mix dry + wet stéréo
    output = np.zeros((n_samples, 2), dtype=np.float32)
    output[:, 0] = stereo_in[:, 0] * (1 - wet_mix) + wet_l * wet_mix
    output[:, 1] = stereo_in[:, 1] * (1 - wet_mix) + wet_r * wet_mix
    
    return output


def apply_noise_gate(audio: np.ndarray, sr: int, threshold_db: float = -45.0,
                     attack: float = 0.0005, release: float = 0.08,
                     hold: float = 0.03, lookahead_ms: float = 5.0) -> np.ndarray:
    """
    Noise gate avec lookahead pour ne pas manger les débuts de phrase.
    """
    threshold_linear = 10 ** (threshold_db / 20)
    attack_coeff = np.exp(-1 / (max(attack, 1e-5) * sr))
    release_coeff = np.exp(-1 / (max(release, 1e-5) * sr))
    hold_samples = int(hold * sr)
    lookahead_samples = int(lookahead_ms * sr / 1000)

    # RMS envelope
    rms_window = max(1, int(0.01 * sr))
    sq = audio ** 2
    kernel = np.ones(rms_window) / float(rms_window)
    rms = np.sqrt(np.convolve(sq, kernel, mode='same') + 1e-12)

    # Lookahead : anticiper l'ouverture du gate
    if lookahead_samples > 0:
        rms_ahead = np.roll(rms, -lookahead_samples)
        rms_ahead[-lookahead_samples:] = rms[-lookahead_samples:]
        rms = np.maximum(rms, rms_ahead)

    gate_state = 0.0
    hold_counter = 0
    gate_env = np.zeros_like(audio)

    for i in range(len(audio)):
        if rms[i] > threshold_linear:
            gate_state = gate_state + (1.0 - gate_state) * (1 - attack_coeff)
            hold_counter = hold_samples
        else:
            if hold_counter > 0:
                hold_counter -= 1
                gate_state = gate_state + (1.0 - gate_state) * (1 - attack_coeff)
            else:
                gate_state = gate_state * release_coeff
        gate_env[i] = gate_state

    return audio * gate_env


def apply_doubler_stereo(audio: np.ndarray, sr: int,
                         detune_cents: float = 7.0, delay_ms: float = 8.0,
                         wet_gain: float = 0.22) -> np.ndarray:
    """
    Micro-pitch doubler : élargit le stéréo en créant deux copies légèrement
    détunées (+N cents à gauche, -N cents à droite) avec un petit delay Haas.
    Sonne comme un vrai doublage vocal, pas comme un chorus.
    """
    if audio.ndim == 1:
        audio = np.column_stack([audio, audio])
    n = audio.shape[0]

    # Mono sum pour créer les copies doublées
    mono = (audio[:, 0].astype(np.float64) + audio[:, 1].astype(np.float64)) * 0.5

    # Pitch shift par resampling (quelques cents = naturel, pas de chorus)
    shift_up = 2.0 ** (detune_cents / 1200.0)    # ~1.004
    shift_down = 2.0 ** (-detune_cents / 1200.0)  # ~0.996

    indices_up = np.arange(n, dtype=np.float64) * shift_up
    indices_down = np.arange(n, dtype=np.float64) * shift_down

    def _resample(signal, indices):
        idx = np.clip(indices, 0, len(signal) - 1)
        lo = np.floor(idx).astype(int)
        hi = np.minimum(lo + 1, len(signal) - 1)
        frac = idx - lo
        return signal[lo] * (1.0 - frac) + signal[hi] * frac

    doubled_L = _resample(mono, indices_up)
    doubled_R = _resample(mono, indices_down)

    # Petit delay Haas pour renforcer la largeur
    delay_samples = max(0, min(n - 1, int(delay_ms * sr / 1000.0)))
    if delay_samples > 0:
        doubled_L = np.concatenate([np.zeros(delay_samples), doubled_L[:-delay_samples]])
        doubled_R = np.concatenate([np.zeros(delay_samples), doubled_R[:-delay_samples]])

    # Mix : signal original + copies détunées à faible volume
    L_out = audio[:, 0].astype(np.float64) + wet_gain * doubled_L
    R_out = audio[:, 1].astype(np.float64) + wet_gain * doubled_R

    out = np.column_stack([L_out, R_out]).astype(np.float32)
    np.clip(out, -1.0, 1.0, out=out)
    return out


def apply_tone_control(audio: np.ndarray, sr: int,
                       tone_low: int = 2, tone_mid: int = 2, tone_high: int = 2,
                       air: bool = False) -> np.ndarray:
    """
    Tone presets (1/2/3) + Air on/off.
    Low: 1=HPF 150Hz, 2=normal, 3=+2dB 150-200Hz
    Mid: 1=-2dB 400-4k, 2=normal, 3=+2dB 400-4k
    High: 1=shelf -2dB from 9k, 2=normal, 3=shelf +2dB from 9k
    Air: on = +2dB shelf from 12500Hz
    """
    if tone_low == 2 and tone_mid == 2 and tone_high == 2 and not air:
        return audio.copy()
    nyq = sr / 2
    order = 2
    b_hp_150, a_hp_150 = butter(order, 150 / nyq, btype='high')
    b_lp_200, a_lp_200 = butter(order, 200 / nyq, btype='low')
    b_hp_400, a_hp_400 = butter(order, 400 / nyq, btype='high')
    b_lp_4k, a_lp_4k = butter(order, 4000 / nyq, btype='low')
    b_hp_9k, a_hp_9k = butter(order, min(9000, nyq * 0.99) / nyq, btype='high')
    b_hp_12500, a_hp_12500 = butter(order, min(12500, nyq * 0.99) / nyq, btype='high')
    boost_2 = 10 ** (2 / 20) - 1
    cut_2 = 10 ** (-2 / 20) - 1

    def process_channel(x):
        out = x.astype(np.float64)
        if tone_low == 1:
            out = lfilter(b_hp_150, a_hp_150, out)
        if tone_low == 3:
            band = lfilter(b_lp_200, a_lp_200, out)
            band = lfilter(b_hp_150, a_hp_150, band)
            out = out + band * boost_2
        if tone_mid == 1:
            band = lfilter(b_hp_400, a_hp_400, out)
            band = lfilter(b_lp_4k, a_lp_4k, band)
            out = out + band * cut_2
        if tone_mid == 3:
            band = lfilter(b_hp_400, a_hp_400, out)
            band = lfilter(b_lp_4k, a_lp_4k, band)
            out = out + band * boost_2
        if tone_high == 1:
            band = lfilter(b_hp_9k, a_hp_9k, out)
            out = out + band * cut_2
        if tone_high == 3:
            band = lfilter(b_hp_9k, a_hp_9k, out)
            out = out + band * boost_2
        if air:
            band = lfilter(b_hp_12500, a_hp_12500, out)
            out = out + band * boost_2
        return out.astype(np.float32)

    if audio.ndim == 1:
        return process_channel(audio)
    return np.column_stack([process_channel(audio[:, 0]), process_channel(audio[:, 1])])


def _biquad_peaking(sr: int, freq_hz: float, gain_db: float, q: float):
    """Coeffs biquad peaking EQ (Audio EQ Cookbook)."""
    from math import sin, cos, sqrt, pi
    a = 10 ** (gain_db / 40.0)
    w0 = 2 * pi * freq_hz / sr
    alpha = sin(w0) / (2 * q)
    b0 = 1 + alpha * a
    b1 = -2 * cos(w0)
    b2 = 1 - alpha * a
    a0 = 1 + alpha / a
    a1 = -2 * cos(w0)
    a2 = 1 - alpha / a
    return [b0 / a0, b1 / a0, b2 / a0], [1.0, a1 / a0, a2 / a0]


def apply_phone_eq(audio: np.ndarray, sr: int,
                   hpf_hz: float = 900.0,
                   peak_hz: float = 1650.0, peak_gain_db: float = 2.5, peak_q: float = 2.0,
                   lpf_hz: float = 5500.0) -> np.ndarray:
    """
    FX téléphone : EQ après le gate, avant le 1er VST3.
    HPF 900 Hz, boost +2.5 dB @ 1650 Hz Q=2, LPF 5500 Hz.
    """
    nyq = sr / 2
    out = audio.astype(np.float64).copy()
    if out.ndim == 1:
        chans = [out]
    else:
        chans = [out[:, 0], out[:, 1]]

    for ch in chans:
        # HPF 900 Hz (ordre 2)
        bh, ah = butter(2, max(hpf_hz / nyq, 0.001), btype='high')
        ch[:] = lfilter(bh, ah, ch)
        # Peak +2.5 dB @ 1650 Hz Q=2
        bp, ap = _biquad_peaking(sr, peak_hz, peak_gain_db, peak_q)
        ch[:] = lfilter(bp, ap, ch)
        # LPF 5500 Hz (ordre 2)
        bl, al = butter(2, min(lpf_hz / nyq, 0.99), btype='low')
        ch[:] = lfilter(bl, al, ch)

    np.clip(out, -1.0, 1.0, out=out)
    return out.astype(np.float32)



# De-esser : 1=leger, 2=moyen, 3=fort (threshold_db, range_db)
DEESSER_PRESETS = {
    1: (-12.0, 6.0),   # léger
    2: (-15.0, 12.0),  # moyen (défaut)
    3: (-18.0, 16.0),  # fort
}



# Delay intensity : 1=discret, 2=moyen, 3=fort (wet_mix, feedback)
DELAY_PRESETS = {
    1: (0.12, 0.38),   # discret
    2: (0.22, 0.48),   # moyen (défaut)
    3: (0.35, 0.55),   # fort
}


def render(input_wav: str, output_wav: str, deesser: bool = True, deesser_mode: int = 2,
           noise_gate: bool = True,
           delay: bool = False, delay_intensity: int = 2, bpm: float = 120.0,
           delay_division: str = "1/4",
           tone_low: int = 2, tone_mid: int = 2, tone_high: int = 2, air: bool = False,
           reverb: bool = False, reverb_mode: int = 2,
           phone_fx: bool = False, robot: bool = False, doubler: bool = False,
           progress_callback: Optional[Callable[[int, str], None]] = None):
    """Retourne (True, None) en cas de succès, (False, message_erreur) sinon.
    progress_callback(percent, step_name) appelé à chaque étape (0-100).
    Pourcentage pondéré par le temps réel des étapes (VST3 principal et reverb = lourds)."""
    # Poids par étape (reflète le temps réel : chaîne VST3 et reverb dominent)
    WEIGHTS = {
        "Noise gate": 2,
        "FX téléphone": 2,
        "Chaîne principale (VST3)": 52,
        "De-esser": 5,
        "Tone": 4,
        "Delay": 4,
        "Reverb": 18,
        "Doubler": 4,
        "FX robot": 4,
    }
    _steps = []
    if noise_gate:
        _steps.append("Noise gate")
    if phone_fx:
        _steps.append("FX téléphone")
    _steps.append("Chaîne principale (VST3)")
    if deesser:
        _steps.append("De-esser")
    if tone_low != 2 or tone_mid != 2 or tone_high != 2 or air:
        _steps.append("Tone")
    if delay:
        _steps.append("Delay")
    if reverb:
        _steps.append("Reverb")
    if doubler:
        _steps.append("Doubler")
    if robot:
        _steps.append("FX robot")
    _total_weight = sum(WEIGHTS.get(s, 5) for s in _steps) or 100
    _cumul_weight = [0]  # mutable

    def _step_weight(step_label: str) -> int:
        """Poids pour un libellé de fin d'étape (ex. 'Noise gate OK', 'VST3 OK')."""
        for key in WEIGHTS:
            if step_label.startswith(key) or (key == "Chaîne principale (VST3)" and "VST3" in step_label):
                return WEIGHTS[key]
        return 5

    def _progress(step: str, done: bool = False):
        if progress_callback:
            if done:
                _cumul_weight[0] += _step_weight(step)
            pct = round((_cumul_weight[0] / _total_weight) * 100) if _total_weight else 100
            progress_callback(min(100, pct), step)

    if not HOST_EXE.exists():
        msg = f"hise_vst3_host introuvable: {HOST_EXE}"
        print(f"ERREUR: {msg}")
        return False, msg
    if not VST3_PATH.exists():
        msg = f"VST3 introuvable: {VST3_PATH}"
        print(f"ERREUR: {msg}")
        return False, msg
    if not Path(input_wav).exists():
        msg = f"Fichier d'entrée introuvable: {input_wav}"
        print(f"ERREUR: {msg}")
        return False, msg

    vst_input = input_wav
    temp_gated = None
    temp_phone = None

    _progress("Préparation")
    # Étape 0 : Noise gate (avant VST3)
    if noise_gate:
        _progress("Noise gate")
        print("0. Noise gate...")
        audio, sr = read_wav(input_wav)
        if audio.ndim == 2 and audio.shape[1] == 2:
            left = apply_noise_gate(audio[:, 0], sr, threshold_db=-50.0, lookahead_ms=10.0)
            right = apply_noise_gate(audio[:, 1], sr, threshold_db=-50.0, lookahead_ms=10.0)
            gated = np.column_stack([left, right])
        else:
            gated = apply_noise_gate(audio.flatten(), sr, threshold_db=-50.0, lookahead_ms=10.0)
        temp_gated = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        write_wav(temp_gated, gated, sr)
        vst_input = temp_gated
        print("   Gate OK")
        _progress("Noise gate OK", done=True)

    # Étape 0b : FX téléphone (EQ HPF 900, +2.5dB @ 1650 Q=2, LPF 5500) — après gate, juste avant 1er VST3
    if phone_fx:
        _progress("FX téléphone")
        print("0b. FX téléphone (EQ)...")
        audio, sr = read_wav(vst_input)
        audio = apply_phone_eq(audio, sr)
        temp_phone = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        write_wav(temp_phone, audio, sr)
        vst_input = temp_phone
        print("   FX téléphone OK")
        _progress("FX téléphone OK", done=True)

    # Étape 1 : Rendu VST3
    if deesser:
        temp_vst_output = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        vst_output = temp_vst_output
    else:
        vst_output = output_wav

    _progress("Chaîne principale (VST3)")
    cmd = [str(HOST_EXE), str(VST3_PATH), vst_input, vst_output, str(VST_BLOCK_SIZE)]
    print("1. Rendu VST3...")
    cwd = str(VST3_PATH.parent) if VST3_PATH.parent else None
    vst_weight = WEIGHTS["Chaîne principale (VST3)"]
    start_pct = round((_cumul_weight[0] / _total_weight) * 100) if _total_weight else 0
    end_pct = round(((_cumul_weight[0] + vst_weight) / _total_weight) * 100) if _total_weight else 100
    result_holder = []

    def _run_vst():
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
        result_holder.append((r.returncode, r.stdout, r.stderr))

    thr = threading.Thread(target=_run_vst)
    thr.start()
    vst_start = time.time()
    while thr.is_alive():
        time.sleep(1.2)
        elapsed = time.time() - vst_start
        ratio = min(0.92, elapsed / 50.0)
        pct = round(start_pct + (end_pct - start_pct) * ratio)
        if progress_callback:
            progress_callback(min(99, pct), "Chaîne principale (VST3)")
    thr.join()
    result = result_holder[0] if result_holder else (1, "", "timeout")
    returncode, stdout, stderr = result

    if returncode != 0:
        err = (stderr or stdout or "").strip() or f"code sortie {returncode}"
        print("ERREUR:", err, f"(code sortie {returncode})")
        return False, err

    if not Path(vst_output).exists():
        msg = "Fichier de sortie VST3 non créé"
        print("ERREUR:", msg)
        return False, msg

    print("   VST3 OK")
    _progress("VST3 OK", done=True)

    # Étape 2 : De-esser (Python FFT) — 3 modes : léger (1), moyen (2), fort (3)
    if deesser:
        _progress("De-esser")
        mode = max(1, min(3, deesser_mode))
        th_db, rng_db = DEESSER_PRESETS.get(mode, DEESSER_PRESETS[2])
        print(f"2. De-esser (FFT, mode {mode} = {'léger' if mode == 1 else 'moyen' if mode == 2 else 'fort'})...")
        audio, sr = read_wav(vst_output)
        if audio.ndim == 2 and audio.shape[1] == 2:
            left = apply_deesser(audio[:, 0], sr, threshold_db=th_db, range_db=rng_db)
            right = apply_deesser(audio[:, 1], sr, threshold_db=th_db, range_db=rng_db)
            audio_out = np.column_stack([left, right])
        else:
            audio_out = apply_deesser(audio.flatten(), sr, threshold_db=th_db, range_db=rng_db)
        write_wav(output_wav, audio_out, sr)
        print("   De-esser OK")
        Path(temp_vst_output).unlink(missing_ok=True)
        _progress("De-esser OK", done=True)

    # Étape 3 : Tone presets (avant delay)
    if tone_low != 2 or tone_mid != 2 or tone_high != 2 or air:
        _progress("Tone")
        print("3. Tone (low/mid/high + air)...")
        audio, sr = read_wav(output_wav)
        audio_tone = apply_tone_control(
            audio, sr, tone_low=tone_low, tone_mid=tone_mid, tone_high=tone_high, air=air
        )
        write_wav(output_wav, audio_tone, sr)
        print("   Tone OK")
        _progress("Tone OK", done=True)

    # Gain +4.5 dB avant delay uniquement pour reverb2 et reverb3 (reverb1 pas assez présente)
    if reverb and reverb_mode in (2, 3):
        print("   Gain +4.5 dB...")
        audio, sr = read_wav(output_wav)
        gain_linear = 10 ** (4.5 / 20.0)
        audio = (audio * gain_linear).astype(np.float32)
        np.clip(audio, -1.0, 1.0, out=audio)
        write_wav(output_wav, audio, sr)

    # Étape 4 : Delay ping-pong (optionnel) — 3 intensités
    if delay:
        _progress("Delay")
        d_mode = max(1, min(3, delay_intensity))
        d_wet, d_fb = DELAY_PRESETS.get(d_mode, DELAY_PRESETS[2])
        print(f"4. Delay ping-pong ({delay_division}, intensité {d_mode} = {'discret' if d_mode == 1 else 'moyen' if d_mode == 2 else 'fort'})...")
        audio, sr = read_wav(output_wav)
        auto_bpm = bpm if bpm != 120.0 else None
        audio_delayed = apply_pingpong_delay(
            audio, sr, bpm=auto_bpm, note_division=delay_division,
            feedback=d_fb, wet_mix=d_wet, highcut=4200, lowcut=200,
            feedback_filter_hz=2400
        )
        write_wav(output_wav, audio_delayed, sr)
        print("   Delay OK")
        _progress("Delay OK", done=True)

    # Étape 5 : Reverb VST3 (1=leger, 2=moyen défaut, 3=large)
    if reverb:
        reverb_paths = {1: REVERB1_PATH, 2: REVERB2_PATH, 3: REVERB3_PATH}
        reverb_path = reverb_paths.get(max(1, min(3, reverb_mode)), REVERB2_PATH)
        if reverb_path and reverb_path.exists():
            _progress("Reverb")
            print(f"5. Reverb (reverb{reverb_mode}.vst3)...")
            temp_reverb_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            cmd = [str(HOST_EXE), str(reverb_path), output_wav, temp_reverb_out, str(VST_BLOCK_SIZE)]
            rvb_weight = WEIGHTS["Reverb"]
            rvb_start_pct = round((_cumul_weight[0] / _total_weight) * 100) if _total_weight else 0
            rvb_end_pct = round(((_cumul_weight[0] + rvb_weight) / _total_weight) * 100) if _total_weight else 100
            reverb_result = []

            def _run_reverb():
                r = subprocess.run(cmd, capture_output=True, text=True)
                reverb_result.append((r.returncode, r.stdout, r.stderr))

            rvb_thr = threading.Thread(target=_run_reverb)
            rvb_thr.start()
            rvb_start = time.time()
            while rvb_thr.is_alive():
                time.sleep(1.0)
                elapsed = time.time() - rvb_start
                ratio = min(0.92, elapsed / 18.0)
                pct = round(rvb_start_pct + (rvb_end_pct - rvb_start_pct) * ratio)
                if progress_callback:
                    progress_callback(min(99, pct), "Reverb")
            rvb_thr.join()
            result = reverb_result[0] if reverb_result else (1, "", "")
            if result[0] == 0 and Path(temp_reverb_out).exists():
                shutil.copy(temp_reverb_out, output_wav)
                print("   Reverb OK")
                _progress("Reverb OK", done=True)
            else:
                print("   Reverb skip:", result[2] or result[1] or "sortie absente")
                _progress("Reverb skip", done=True)
            Path(temp_reverb_out).unlink(missing_ok=True)
        else:
            print(f"5. Reverb skip: reverb{reverb_mode}.vst3 introuvable ({reverb_path})")
            _progress("Reverb skip", done=True)

    # Étape 6 : Doubler (DSP stéréo symétrique) — après Reverb, avant Robot
    if doubler:
        _progress("Doubler")
        print("6. Doubler (DSP)...")
        audio, sr = read_wav(output_wav)
        audio_out = apply_doubler_stereo(audio, sr, delay_ms=20.0, wet_gain=0.4)
        write_wav(output_wav, audio_out, sr)
        print("   Doubler OK")
        _progress("Doubler OK", done=True)

    # Étape 7 : FX robot (robot.vst3) — après Doubler si coché, sinon après Reverb
    if robot and ROBOT_PATH and ROBOT_PATH.exists():
        _progress("FX robot")
        print("7. FX robot (robot.vst3)...")
        temp_robot_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        cmd = [str(HOST_EXE), str(ROBOT_PATH), output_wav, temp_robot_out, str(VST_BLOCK_SIZE)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and Path(temp_robot_out).exists():
            shutil.copy(temp_robot_out, output_wav)
            print("   FX robot OK")
            _progress("FX robot OK", done=True)
        else:
            print("   FX robot skip:", result.stderr or result.stdout or "sortie absente")
            _progress("FX robot skip", done=True)
        Path(temp_robot_out).unlink(missing_ok=True)
    elif robot:
        print("7. FX robot skip: robot.vst3 introuvable")
        _progress("FX robot skip", done=True)

    if temp_gated:
        Path(temp_gated).unlink(missing_ok=True)
    if temp_phone:
        Path(temp_phone).unlink(missing_ok=True)

    _progress("Terminé")
    print("OK ->", output_wav)
    return True, None


def master_only(input_wav: str, output_wav: str) -> bool:
    """
    Applique uniquement master.vst3 sur un WAV déjà mixé.
    Retourne True si succès, False sinon.
    """
    if not HOST_EXE.exists():
        print(f"ERREUR: hise_vst3_host introuvable: {HOST_EXE}")
        return False
    if not MASTER_PATH or not MASTER_PATH.exists():
        print(f"ERREUR: master.vst3 introuvable: {MASTER_PATH}")
        return False
    if not Path(input_wav).exists():
        print(f"ERREUR: Fichier introuvable: {input_wav}")
        return False
    temp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    try:
        cmd = [str(HOST_EXE), str(MASTER_PATH), input_wav, temp_out, str(VST_BLOCK_SIZE)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and Path(temp_out).exists():
            shutil.copy(temp_out, output_wav)
            return True
        print("ERREUR:", result.stderr or result.stdout or "sortie absente")
        return False
    finally:
        Path(temp_out).unlink(missing_ok=True)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python test_hise_direct.py <input.wav> <output.wav> [options]")
        print("Options:")
        print("  --no-deesser       Skip de-esser")
        print("  --deesser-mode=1|2|3  De-esser: 1=leger, 2=moyen, 3=fort (default 2)")
        print("  --no-gate        Skip noise gate")
        print("  --delay            Add ping-pong delay")
        print("  --delay-intensity=1|2|3  Delay: 1=discret, 2=moyen, 3=fort (default 2)")
        print("  --bpm=120          Set tempo (default: auto-detect)")
        print("  --div=1/4          Delay division: 1/4, 1/2, 1/8 (default 1/4)")
        print("  --tone-low=1|2|3   Low: 1=HPF 150Hz, 2=normal, 3=+2dB 150-200Hz (default 2)")
        print("  --tone-mid=1|2|3   Mid: 1=-2dB 400-4k, 2=normal, 3=+2dB 400-4k (default 2)")
        print("  --tone-high=1|2|3  High: 1=-2dB from 9k, 2=normal, 3=+2dB from 9k (default 2)")
        print("  --air              Air on: +2dB shelf from 12500Hz")
        print("  --reverb           Reverb en fin de chaîne (défaut: reverb2)")
        print("  --reverb=1|2|3     Reverb: 1=leger, 2=moyen, 3=large (défaut 2)")
        print("  --master-only      Uniquement master.vst3 (input = WAV déjà mixé, output = masterisé)")
        print("Chaîne: Gate → [FX téléphone EQ] → VST3 → De-esser → Tone → Gain → Delay → Reverb → [Doubler DSP] → [robot.vst3]")
        sys.exit(1)

    # Mode master seul : input WAV mixé → master.vst3 → output
    if "--master-only" in sys.argv:
        input_wav = sys.argv[1]
        output_wav = sys.argv[2]
        if not Path(input_wav).exists():
            print(f"ERREUR: Fichier introuvable: {input_wav}")
            sys.exit(1)
        if not HOST_EXE.exists():
            print(f"ERREUR: hise_vst3_host introuvable: {HOST_EXE}")
            sys.exit(1)
        if not MASTER_PATH or not MASTER_PATH.exists():
            print(f"ERREUR: master.vst3 introuvable: {MASTER_PATH}")
            sys.exit(1)
        print("Master seul (master.vst3)...")
        temp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        cmd = [str(HOST_EXE), str(MASTER_PATH), input_wav, temp_out, str(VST_BLOCK_SIZE)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and Path(temp_out).exists():
            shutil.copy(temp_out, output_wav)
            print("OK ->", output_wav)
        else:
            print("ERREUR:", result.stderr or result.stdout or "sortie absente")
            sys.exit(1)
        Path(temp_out).unlink(missing_ok=True)
        sys.exit(0)

    no_deesser = "--no-deesser" in sys.argv
    deesser_mode = 2
    for arg in sys.argv:
        if arg.startswith("--deesser-mode="):
            try:
                deesser_mode = max(1, min(3, int(arg.split("=")[1])))
            except Exception:
                pass
    no_gate = "--no-gate" in sys.argv
    use_delay = "--delay" in sys.argv
    delay_intensity = 2
    for arg in sys.argv:
        if arg.startswith("--delay-intensity="):
            try:
                delay_intensity = max(1, min(3, int(arg.split("=")[1])))
            except Exception:
                pass
    use_reverb = "--reverb" in sys.argv or any(a.startswith("--reverb=") for a in sys.argv)
    reverb_mode = 2
    for arg in sys.argv:
        if arg.startswith("--reverb="):
            try:
                reverb_mode = int(arg.split("=")[1])
                reverb_mode = max(1, min(3, reverb_mode))
            except Exception:
                pass

    # Parse BPM
    bpm = 120.0
    for arg in sys.argv:
        if arg.startswith("--bpm="):
            try:
                bpm = float(arg.split("=")[1])
            except Exception:
                pass

    # Parse division (default 1/4)
    div = "1/4"
    for arg in sys.argv:
        if arg.startswith("--div="):
            div = arg.split("=")[1]

    tone_low = 2
    tone_mid = 2
    tone_high = 2
    air = "--air" in sys.argv
    for arg in sys.argv:
        if arg.startswith("--tone-low="):
            try:
                tone_low = int(arg.split("=")[1])
                tone_low = max(1, min(3, tone_low))
            except Exception:
                pass
        elif arg.startswith("--tone-mid="):
            try:
                tone_mid = int(arg.split("=")[1])
                tone_mid = max(1, min(3, tone_mid))
            except Exception:
                pass
        elif arg.startswith("--tone-high="):
            try:
                tone_high = int(arg.split("=")[1])
                tone_high = max(1, min(3, tone_high))
            except Exception:
                pass

    ok, err = render(sys.argv[1], sys.argv[2], deesser=not no_deesser, deesser_mode=deesser_mode,
                     noise_gate=not no_gate,
                     delay=use_delay, delay_intensity=delay_intensity, bpm=bpm, delay_division=div,
                     tone_low=tone_low, tone_mid=tone_mid, tone_high=tone_high, air=air,
                     reverb=use_reverb, reverb_mode=reverb_mode)
    if not ok:
        sys.exit(1)
