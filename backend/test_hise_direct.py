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
EQ_PATHS = []  # [Path eq1, eq2, ... eq9] rempli depuis vst_config ou VST_BASE
_VST_MAP = {}  # stem -> Path, rempli quand VST_BASE est défini (pour diagnostic)
try:
    from vst_config import VST_PATHS
    def _vst_path(name):
        p = VST_PATHS.get(name) or ""
        return Path(p) if p else None
    # Chaîne principale : GlobalMix si dispo, sinon Project1
    _globalmix = _vst_path("globalmix")
    if _globalmix and _globalmix.exists():
        VST3_PATH = _globalmix
    else:
        _proj1 = _vst_path("hise_vocal_chain")
        if _proj1:
            VST3_PATH = _proj1
    EQ_PATHS = [_vst_path(f"eq{i}") for i in range(1, 10)]
    EQ_PATHS = [p for p in EQ_PATHS if p and p.exists()]
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
                # Sur Windows, .vst3 peut être un bundle (dossier) ou un DLL interne (Contents/.../X.vst3).
                # Préférer le bundle (dossier) pour que le host reçoive la racine du plugin.
                if stem not in _vst_map:
                    _vst_map[stem] = f
                elif f.is_dir() and not _vst_map[stem].is_dir():
                    _vst_map[stem] = f
        except Exception:
            pass
    _VST_MAP.clear()
    _VST_MAP.update(_vst_map)
    def _vst_by_name(name: str, alt: str = None) -> Path:
        for key in (name.lower(), (alt or "").lower()):
            if key and key in _vst_map:
                return _vst_map[key]
        for stem, p in _vst_map.items():
            if name.lower() in stem or (alt and alt.lower() in stem):
                return p
        return _base / f"{name}.vst3"

    VST3_PATH = _vst_map.get("globalmix") or _vst_by_name("globalmix") or _vst_map.get("project1") or _vst_by_name("project1")
    # EQ1..EQ9 : accepter eq1, eq 1, eq-1, eq_1 pour compatibilité noms sur VPS
    def _eq_path(i):
        for name in (f"eq{i}", f"eq {i}", f"eq-{i}", f"eq_{i}"):
            p = _vst_map.get(name) or _vst_by_name(name)
            if p and p.exists():
                return p
        return None
    EQ_PATHS = [_eq_path(i) for i in range(1, 10)]
    EQ_PATHS = [p for p in EQ_PATHS if p]
    MASTER_PATH = _vst_map.get("master") or _vst_by_name("master")
    REVERB1_PATH = _vst_map.get("reverb1") or _vst_by_name("reverb1")
    REVERB2_PATH = _vst_map.get("reverb2") or _vst_by_name("reverb2")
    REVERB3_PATH = _vst_map.get("reverb3new") or _vst_map.get("reverb3") or _vst_by_name("reverb3new", "reverb3")
    DOUBLER_PATH = _vst_map.get("doubler") or _vst_by_name("doubler")
    ROBOT_PATH = _vst_map.get("robot") or _vst_by_name("robot")

    # Fallback: structure HISE (name/Binaries/Compiled/VST3/name.vst3) si chemins plats absents
    def _vst_full(base: Path, name: str) -> Path:
        return base / name / "Binaries" / "Compiled" / "VST3" / f"{name}.vst3"

    if not VST3_PATH.exists():
        VST3_PATH = _vst_full(_base, "GlobalMix") if _base.joinpath("GlobalMix").exists() else _vst_full(_base, "Project1")
    if not EQ_PATHS or len(EQ_PATHS) < 9:
        EQ_PATHS = []
        for i in range(1, 10):
            p = _vst_full(_base, f"EQ{i}")
            if p.exists():
                EQ_PATHS.append(p)
            else:
                q = _base / f"eq{i}.vst3"
                if q.exists():
                    EQ_PATHS.append(q)
    if not MASTER_PATH.exists():
        MASTER_PATH = _vst_full(_base, "master")
    if not REVERB1_PATH.exists():
        REVERB1_PATH = _vst_full(_base, "reverb1")
    if not REVERB2_PATH.exists():
        REVERB2_PATH = _vst_full(_base, "reverb2")
    if not REVERB3_PATH.exists():
        REVERB3_PATH = _vst_full(_base, "reverb3new")
    if not DOUBLER_PATH.exists():
        DOUBLER_PATH = _vst_full(_base, "doubler")
    if not ROBOT_PATH.exists():
        ROBOT_PATH = _vst_full(_base, "robot")

# Linux (production Render) : utiliser binaires téléchargés depuis R2
if sys.platform == "linux":
    try:
        from r2_assets import ensure_r2_assets, get_linux_host_path, get_linux_vst_path
        if ensure_r2_assets():
            host = get_linux_host_path()
            if host:
                HOST_EXE = host
                vst3 = get_linux_vst_path("GlobalMix") or get_linux_vst_path("Project1")
                if vst3:
                    VST3_PATH = vst3
                eq_list = [get_linux_vst_path(f"eq{i}") for i in range(1, 10)]
                EQ_PATHS = [p for p in eq_list if p and p.exists()]
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
    """État des chemins VST (host + plugin principal) pour diagnostic déploiement."""
    vst_base = os.environ.get("VST_BASE", "")
    base_exists = Path(vst_base).exists() if vst_base else False
    return {
        "HOST_EXE": str(HOST_EXE),
        "HOST_EXE_exists": HOST_EXE.exists(),
        "VST3_PATH": str(VST3_PATH),
        "VST3_PATH_exists": VST3_PATH.exists(),
        "VST_BASE": vst_base or "(not set)",
        "VST_BASE_exists": base_exists,
        "plugins_in_VST_BASE": sorted(_VST_MAP.keys()) if _VST_MAP else [],
        "main_plugin": "GlobalMix" if (VST3_PATH and "globalmix" in str(VST3_PATH).lower()) else "Project1",
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
                         delay_ms: float = 20.0, wet_gain: float = 0.4) -> np.ndarray:
    """
    Doubler stéréo symétrique (DSP) : L_out = L + R_retardé * wet, R_out = R + L_retardé * wet.
    Remplace doubler.vst3. Si entrée mono, duplique en stéréo puis applique le cross-delay.
    """
    if audio.ndim == 1:
        audio = np.column_stack([audio, audio])
    n = audio.shape[0]
    delay_samples = max(0, min(n - 1, int(delay_ms * sr / 1000)))
    if delay_samples == 0:
        return audio.copy()
    L = audio[:, 0].astype(np.float64)
    R = audio[:, 1].astype(np.float64)
    # Retard : décalage sans wrap (zéros au début)
    L_delayed = np.zeros_like(L)
    L_delayed[delay_samples:] = R[:-delay_samples]
    R_delayed = np.zeros_like(R)
    R_delayed[delay_samples:] = L[:-delay_samples]
    L_out = L + wet_gain * L_delayed
    R_out = R + wet_gain * R_delayed
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


def render(input_wav: str, output_wav: str, deesser: bool = True, deesser_mode: int = 2,
           noise_gate: bool = True,
           delay: bool = False, bpm: float = 120.0,
           delay_division: str = "1/4",
           tone_low: int = 2, tone_mid: int = 2, tone_high: int = 2,
           air: bool = False,
           reverb: bool = False, reverb_mode: int = 2,
           phone_fx: bool = False, robot: bool = False, doubler: bool = False,
           progress_callback: Optional[Callable[[int, str], None]] = None):
    """Retourne (True, None) en cas de succès, (False, message_erreur) sinon.
    progress_callback(percent, step_name) appelé à chaque étape (0-100).
    Pourcentage pondéré par le temps réel des étapes (VST3 principal et reverb = lourds)."""
    # Poids par étape (reflète le temps réel : chaîne VST3 et reverb dominent)
    WEIGHTS = {
        "EQ Basses": 2,
        "EQ Mids": 2,
        "EQ Highs": 2,
        "Noise gate": 2,
        "FX téléphone": 2,
        "Chaîne principale (VST3)": 52,
        "De-esser": 5,
        "Air": 4,
        "Delay": 4,
        "Reverb": 18,
        "Doubler": 4,
        "FX robot": 4,
    }
    _steps = []
    use_eq_chain = len(EQ_PATHS) >= 9
    if use_eq_chain:
        _steps.extend(["EQ Basses", "EQ Mids", "EQ Highs"])
    if noise_gate:
        _steps.append("Noise gate")
    if phone_fx:
        _steps.append("FX téléphone")
    _steps.append("Chaîne principale (VST3)")
    if deesser:
        _steps.append("De-esser")
    if air:
        _steps.append("Air")
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

    # Log résolution VST3 (diagnostic déploiement VPS : GlobalMix vs Project1, EQs)
    _vst_base = os.environ.get("VST_BASE", "(not set)")
    _main_plugin = "GlobalMix" if (VST3_PATH and "globalmix" in str(VST3_PATH).lower()) else "Project1"
    print(f"[VST] VST_BASE={_vst_base}")
    print(f"[VST] HOST_EXE={HOST_EXE} exists={HOST_EXE.exists()}")
    print(f"[VST] Main plugin: {_main_plugin} -> VST3_PATH={VST3_PATH} exists={VST3_PATH.exists()}")
    if _main_plugin != "GlobalMix":
        print(f"[VST] WARNING: GlobalMix not used (path has no 'globalmix'); using {_main_plugin}. Check VST_BASE contains GlobalMix.vst3.")
    print(f"[VST] EQ_PATHS count={len(EQ_PATHS)} use_eq_chain={len(EQ_PATHS) >= 9}")
    if EQ_PATHS:
        for i, p in enumerate(EQ_PATHS[:4]):
            print(f"[VST]   EQ{i+1}={p} exists={p.exists()}")
        if len(EQ_PATHS) > 4:
            print(f"[VST]   ... EQ5..EQ{len(EQ_PATHS)}")
    else:
        print(f"[VST]   (no EQs: put eq1.vst3..eq9.vst3 or EQ1..EQ9 in VST_BASE, or use subfolders EQ1/Binaries/Compiled/VST3/EQ1.vst3)")

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
        vst_base = os.environ.get("VST_BASE", "(not set)")
        msg = (
            f"hise_vst3_host introuvable: {HOST_EXE}. "
            f"Sur le VPS, définir HISE_VST3_HOST_EXE (ex: C:\\app\\hise_vst3_host.exe). "
            f"VST_BASE={vst_base}"
        )
        print(f"ERREUR: {msg}")
        return False, msg
    if not VST3_PATH.exists():
        vst_base = os.environ.get("VST_BASE", "(not set)")
        plugins = sorted(_VST_MAP.keys()) if _VST_MAP else []
        msg = (
            f"VST3 principal (GlobalMix/Project1) introuvable: {VST3_PATH}. "
            f"VST_BASE={vst_base} (exists={Path(vst_base).exists() if vst_base else False}). "
            f"Plugins trouvés dans VST_BASE: {plugins or 'aucun'}. "
            f"Sur le VPS, mettre GlobalMix.vst3 (ou Project1.vst3) dans le dossier VST_BASE et définir VST_BASE dans le service (NSSM)."
        )
        print(f"ERREUR: {msg}")
        return False, msg
    if os.environ.get("REQUIRE_GLOBALMIX", "").strip().lower() in ("1", "true", "yes"):
        if "globalmix" not in str(VST3_PATH).lower():
            msg = f"REQUIRE_GLOBALMIX=1 but main plugin is not GlobalMix: {VST3_PATH}. Put GlobalMix.vst3 in VST_BASE."
            print(f"ERREUR: {msg}")
            return False, msg
    if not Path(input_wav).exists():
        msg = f"Fichier d'entrée introuvable: {input_wav}"
        print(f"ERREUR: {msg}")
        return False, msg

    # Normaliser en PCM 16-bit : hise_vst3_host ne gère pas le format 65534 (extensible/float)
    normalized_input = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    try:
        audio_norm, sr_norm = read_wav(input_wav)
        write_wav(normalized_input, audio_norm, sr_norm)
    except Exception as e:
        Path(normalized_input).unlink(missing_ok=True)
        return False, str(e)
    vst_input = normalized_input
    temp_gated = None
    temp_phone = None
    temp_eq = None

    _progress("Préparation")
    # Étape 0a : EQ Basses, Mids, Highs en parallèle (même entrée pour les 3, puis mix = comme un seul EQ multi-bandes)
    if use_eq_chain:
        tl, tm, th = max(1, min(3, tone_low)), max(1, min(3, tone_mid)), max(1, min(3, tone_high))
        cwd = str(EQ_PATHS[0].parent) if EQ_PATHS[0].parent else None
        temp_basses = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        temp_mids = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        temp_highs = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        try:
            for step_name, eq_idx, temp_out in [
                ("EQ Basses", tl - 1, temp_basses),
                ("EQ Mids", 3 + (tm - 1), temp_mids),
                ("EQ Highs", 6 + (th - 1), temp_highs),
            ]:
                _progress(step_name)
                eq_path = EQ_PATHS[eq_idx]
                cmd_eq = [str(HOST_EXE), str(eq_path), normalized_input, temp_out, str(VST_BLOCK_SIZE)]
                r = subprocess.run(cmd_eq, capture_output=True, text=True, cwd=cwd)
                if r.returncode != 0 or not Path(temp_out).exists():
                    err = (r.stderr or r.stdout or "").strip() or f"EQ {step_name} a échoué"
                    Path(normalized_input).unlink(missing_ok=True)
                    return False, err
                _progress(f"{step_name} OK", done=True)
            # Combiner les 3 sorties (moyenne) = comme un seul EQ qui traite les 3 bandes en même temps
            audio_b, sr_b = read_wav(temp_basses)
            audio_m, sr_m = read_wav(temp_mids)
            audio_h, sr_h = read_wav(temp_highs)
            n_samples = min(audio_b.shape[0], audio_m.shape[0], audio_h.shape[0])
            audio_combined = (audio_b[:n_samples].astype(np.float64) + audio_m[:n_samples].astype(np.float64) + audio_h[:n_samples].astype(np.float64)) / 3.0
            audio_combined = np.clip(audio_combined, -1.0, 1.0).astype(np.float32)
            temp_eq = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            write_wav(temp_eq, audio_combined, sr_b)
            vst_input = temp_eq
        finally:
            for p in (temp_basses, temp_mids, temp_highs):
                Path(p).unlink(missing_ok=True)

    # Étape 0 : Noise gate (avant VST3)
    if noise_gate:
        _progress("Noise gate")
        print("0. Noise gate...")
        audio, sr = read_wav(vst_input)
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
    cwd = str(VST3_PATH.parent) if VST3_PATH.parent else None
    print("1. Rendu GlobalMix (VST3)...")
    print(f"[VST] Run: cmd={cmd} cwd={cwd}")
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
        print("ERREUR hise_vst3_host (GlobalMix):", err, f"(code sortie {returncode})")
        if stdout:
            print("[VST] stdout:", stdout)
        if stderr:
            print("[VST] stderr:", stderr)
        Path(normalized_input).unlink(missing_ok=True)
        return False, err

    if not Path(vst_output).exists():
        msg = "Fichier de sortie VST3 non créé"
        print("ERREUR:", msg)
        Path(normalized_input).unlink(missing_ok=True)
        return False, msg

    print("   VST3 OK")
    _progress("VST3 OK", done=True)

    # Étape 2 : De-esser (Python FFT) — 3 modes : léger (1), moyen (2), fort (3), avant delay
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

    # Air : +2 dB shelf from 12.5 kHz (sans tone low/mid/high)
    if air:
        _progress("Air")
        print("3. Air (+2dB from 12.5kHz)...")
        audio, sr = read_wav(output_wav)
        audio_air = apply_tone_control(audio, sr, tone_low=2, tone_mid=2, tone_high=2, air=True)
        write_wav(output_wav, audio_air, sr)
        print("   Air OK")
        _progress("Air OK", done=True)

    # Gain +4.5 dB avant delay uniquement pour reverb2 et reverb3 (reverb1 pas assez présente)
    if reverb and reverb_mode in (2, 3):
        print("   Gain +4.5 dB...")
        audio, sr = read_wav(output_wav)
        gain_linear = 10 ** (4.5 / 20.0)
        audio = (audio * gain_linear).astype(np.float32)
        np.clip(audio, -1.0, 1.0, out=audio)
        write_wav(output_wav, audio, sr)

    # Étape 4 : Delay ping-pong (optionnel)
    if delay:
        _progress("Delay")
        print(f"4. Delay ping-pong ({delay_division})...")
        audio, sr = read_wav(output_wav)
        auto_bpm = bpm if bpm != 120.0 else None
        audio_delayed = apply_pingpong_delay(
            audio, sr, bpm=auto_bpm, note_division=delay_division,
            feedback=0.48, wet_mix=0.22, highcut=4200, lowcut=200,
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
    if temp_eq:
        Path(temp_eq).unlink(missing_ok=True)
    Path(normalized_input).unlink(missing_ok=True)

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
        print("  --delay          Add ping-pong delay")
        print("  --bpm=120        Set tempo (default: auto-detect)")
        print("  --div=1/4        Delay division: 1/4, 1/2, 1/8 (default 1/4)")
        print("  --air              Air: +2dB shelf from 12.5kHz")
        print("  --reverb           Reverb en fin de chaîne (défaut: reverb2)")
        print("  --reverb=1|2|3     Reverb: 1=leger, 2=moyen, 3=large (défaut 2)")
        print("  --master-only      Uniquement master.vst3 (input = WAV déjà mixé, output = masterisé)")
        print("  --tone-low=1|2|3   Basses: 1=EQ1, 2=EQ2, 3=EQ3 (default 2)")
        print("  --tone-mid=1|2|3   Mids: 1=EQ4, 2=EQ5, 3=EQ6 (default 2)")
        print("  --tone-high=1|2|3  Aigus: 1=EQ7, 2=EQ8, 3=EQ9 (default 2)")
        print("Chaîne: [EQ1-9] → Gate → [FX téléphone] → GlobalMix → De-esser → [Air] → Gain → Delay → Reverb → [Doubler DSP] → [robot]")
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

    use_air = "--air" in sys.argv
    tone_low, tone_mid, tone_high = 2, 2, 2
    for arg in sys.argv:
        if arg.startswith("--tone-low="):
            try:
                tone_low = max(1, min(3, int(arg.split("=")[1])))
            except Exception:
                pass
        elif arg.startswith("--tone-mid="):
            try:
                tone_mid = max(1, min(3, int(arg.split("=")[1])))
            except Exception:
                pass
        elif arg.startswith("--tone-high="):
            try:
                tone_high = max(1, min(3, int(arg.split("=")[1])))
            except Exception:
                pass

    ok, err = render(sys.argv[1], sys.argv[2], deesser=not no_deesser, deesser_mode=deesser_mode,
                     noise_gate=not no_gate,
                     delay=use_delay, bpm=bpm, delay_division=div,
                     tone_low=tone_low, tone_mid=tone_mid, tone_high=tone_high,
                     air=use_air,
                     reverb=use_reverb, reverb_mode=reverb_mode)
    if not ok:
        sys.exit(1)
