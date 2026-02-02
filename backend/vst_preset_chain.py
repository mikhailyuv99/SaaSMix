"""
Chaîne VST : recrée le preset FL (LEAD 1 → LEAD 2 → PCOMP/DELAY/VERB/DOUBLER en parallèle → master).
Utilise Pedalboard pour charger les VST. Configure les chemins dans vst_config.py.
"""
from __future__ import annotations

# Évite l'erreur WMIC sur certains Windows (JUCE/Pedalboard)
import os
os.environ.setdefault("JUCE_DISABLE_CPU_FEATURE_DETECTION", "1")

import subprocess
import tempfile
import wave
import numpy as np
import soundfile as sf
from pathlib import Path

try:
    from pedalboard import load_plugin, Pedalboard, Gain
    from pedalboard.io import AudioFile
except ImportError:
    load_plugin = Pedalboard = Gain = AudioFile = None

# Import config (copier vst_config.example.py en vst_config.py)
try:
    from vst_config import VST_PATHS, SAMPLE_RATE, WAVES_PLUGIN_NAMES
except ImportError:
    VST_PATHS = {}
    SAMPLE_RATE = 48000
    WAVES_PLUGIN_NAMES = {}


def _load(path: str, waves_key: str | None = None):
    if not path or not Path(path).exists():
        return None
    if load_plugin is None:
        raise ImportError("pip install pedalboard")
    plugin_name = WAVES_PLUGIN_NAMES.get(waves_key) if waves_key else None
    try:
        if plugin_name:
            return load_plugin(path, plugin_name=plugin_name)
        return load_plugin(path)
    except ValueError as e:
        # Plugin not in this shell (e.g. WaveShell1 has only Clarity Vx; NLS is in another shell)
        if "matched no plugins" in str(e) or "contains" in str(e):
            return None
        raise


def _set_params(plugin, **kwargs):
    for key, value in kwargs.items():
        if value is None:
            continue
        key_lower = key.lower().replace(" ", "_")
        if hasattr(plugin, key_lower):
            setattr(plugin, key_lower, value)
        elif hasattr(plugin, key):
            setattr(plugin, key, value)
        # Sinon: lancer print(plugin.parameters.keys()) pour voir les noms réels


def _hise_host_exe() -> Path | None:
    """Chemin vers hise_vst3_host.exe (Option A = rendu identique HISE)."""
    exe = os.environ.get("HISE_VST3_HOST_EXE", "").strip()
    if exe and Path(exe).is_file():
        return Path(exe)
    # Par défaut : repo/hise_vst3_host/build/Release/hise_vst3_host.exe (Windows)
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent
    for rel in [
        "hise_vst3_host/build/hise_vst3_host_artefacts/Release/hise_vst3_host.exe",
        "hise_vst3_host/build/Release/hise_vst3_host.exe",
        "hise_vst3_host/build/Debug/hise_vst3_host.exe",
    ]:
        p = repo_root / rel
        if p.is_file():
            return p
    return None


def _process_via_hise_host(plugin_path: str, audio: np.ndarray, sr: int) -> np.ndarray | None:
    """
    Traite l'audio via l'exe hise_vst3_host (rendu identique à FL Studio).
    Retourne l'audio traité ou None si échec.
    """
    exe = _hise_host_exe()
    if exe is None:
        return None
    plugin_path = str(Path(plugin_path).resolve())
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fin:
        in_wav = fin.name
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fout:
        out_wav = fout.name
    try:
        # Écrire input WAV (stéréo 48 kHz attendu par le host)
        if audio.ndim == 1:
            audio = np.stack([audio, audio], axis=1)
        elif audio.shape[0] == 1:
            audio = np.repeat(audio, 2, axis=0).T
        else:
            audio = audio.T
        with wave.open(in_wav, "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            data = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
            wf.writeframes(data.tobytes())
        cmd = [str(exe), plugin_path, in_wav, out_wav, "1024"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            return None
        if not Path(out_wav).is_file():
            return None
        out, _ = _read_wav(out_wav)
        return out
    except (subprocess.TimeoutExpired, OSError, Exception):
        return None
    finally:
        for p in (in_wav, out_wav):
            try:
                Path(p).unlink(missing_ok=True)
            except Exception:
                pass


# ---------- LEAD 1 ----------
def build_lead1():
    path = VST_PATHS.get("autotune_pro")
    if not path:
        return None
    p = _load(path)
    if p is None:
        return None
    # Autotune Pro: retune speed 0, humanize 0, classic mode
    _set_params(p, retune_speed=0, humanize=0)  # adapter noms selon plugin.parameters
    return p


# ---------- LEAD 2 ----------
def build_lead2():
    board = Pedalboard()
    # 1. DeReverb Pro Mono
    p = _load(VST_PATHS.get("dereverb_pro_mono", ""), "dereverb_pro_mono")
    if p:
        _set_params(p, strength_multiplier=1.5, reduce_reverb=60, presence=0.5, tail_smoothing=0)
        board.append(p)
    # 2. NLS Channel Mono
    p = _load(VST_PATHS.get("nls_channel_mono", ""), "nls_channel_mono")
    if p:
        _set_params(p, drive=7)  # SPIKE, VCA GROUP 1, Output 0
        board.append(p)
    # 3. R Deesser Mono
    p = _load(VST_PATHS.get("r_deesser_mono", ""), "r_deesser_mono")
    if p:
        _set_params(p, frequency=5500, threshold=-40.0, range_val=-16)  # Mode Split
        board.append(p)
    # 4. F6 RTA Mono (EQ - beaucoup de bandes, à affiner avec .parameters)
    p = _load(VST_PATHS.get("f6_rta_mono", ""), "f6_rta_mono")
    if p:
        # HPF 127 Hz Q 12, bandes 1-6 comme dans PLUGINS.txt
        board.append(p)
    # 5. CLA-76 Mono
    p = _load(VST_PATHS.get("cla_76_mono", ""), "cla_76_mono")
    if p:
        _set_params(p, input_gain=-26.9, output_gain=-18.0, attack=2.10, release=7.0, ratio=4)
        board.append(p)
    # 6. RVOX Mono
    p = _load(VST_PATHS.get("rvox_mono", ""), "rvox_mono")
    if p:
        _set_params(p, comp=-7.0, gain=-3.3)
        board.append(p)
    # 7. R Compressor Mono
    p = _load(VST_PATHS.get("r_compressor_mono", ""), "r_compressor_mono")
    if p:
        _set_params(p, threshold=-20.5, ratio=1.69, attack=4.65, release=57.6, mix=1.0, trim=0)
        board.append(p)
    # 8. Saturn 2
    p = _load(VST_PATHS.get("saturn_2", ""))
    if p:
        # Band 1: 0-306 Hz -1.12 dB warm tape 18.5%, Band 2: 306-2565 0 dB 18.5%, Band 3: 2565-end -0.25 dB 18.5%
        _set_params(p, mix=1.0)
        board.append(p)
    # 9. F6 RTA Mono (deuxième instance)
    p = _load(VST_PATHS.get("f6_rta_mono", ""), "f6_rta_mono")
    if p:
        board.append(p)
    # 10. Pro-DS
    p = _load(VST_PATHS.get("pro_ds", ""))
    if p:
        _set_params(p, threshold=-44.38, range_val=10.27, lookahead=12)
        board.append(p)
    return board if len(board) else None


# ---------- PCOMP (parallel bus) ----------
# Fruity Chorus, Limiter, Flanger = pas de VST → on applique un gain -23.5 dB pour simuler le limiter
def build_pcomp():
    board = Pedalboard()
    p = _load(VST_PATHS.get("r_deesser_mono", ""), "r_deesser_mono")
    if p:
        _set_params(p, frequency=8648, threshold=-45.7, range_val=-15.0)
        board.append(p)
    p = _load(VST_PATHS.get("f6_rta_mono", ""), "f6_rta_mono")
    if p:
        board.append(p)
    p = _load(VST_PATHS.get("r_compressor_mono", ""), "r_compressor_mono")
    if p:
        _set_params(p, threshold=-35.1, ratio=2.34, gain=19.5, attack=2.49, release=66.1, mix=1.0, trim=0)
        board.append(p)
    p = _load(VST_PATHS.get("rvox_mono", ""), "rvox_mono")
    if p:
        _set_params(p, comp=-4.5, gain=-29.1)
        board.append(p)
    # Fruity Chorus / Flanger : pas de VST → skip ou ajouter un VST chorus
    # Fruity Limiter -23.5 dB : gain linéaire (Gain = Pedalboard built-in)
    if Gain is not None:
        board.append(Gain(gain_db=-23.5))
    p = _load(VST_PATHS.get("pro_ds", ""))
    if p:
        _set_params(p, threshold=-31.70, range_val=6.0, lookahead=15)
        board.append(p)
    p = _load(VST_PATHS.get("r_deesser_mono", ""), "r_deesser_mono")
    if p:
        _set_params(p, frequency=8920, threshold=-44.7, range_val=-19.0)
        board.append(p)
    p = _load(VST_PATHS.get("pro_q4", ""))
    if p:
        # HPF 108 Hz 12 dB/oct
        board.append(p)
    return board if len(board) else None


# ---------- DELAY ----------
def build_delay(bpm: float = 120):
    board = Pedalboard()
    # 1/4 et 1/2 BPM → delay time en ms
    t_quarter = 60_000 / bpm
    t_half = 2 * t_quarter
    p = _load(VST_PATHS.get("timeless_3", ""))
    if p:
        _set_params(p, mix=0.30, delay_time_ms=t_quarter)
        board.append(p)
    p = _load(VST_PATHS.get("timeless_3", ""))
    if p:
        _set_params(p, mix=0.30, delay_time_ms=t_half)
        board.append(p)
    return board if len(board) else None


# ---------- SHORT VERB ----------
def build_short_verb():
    board = Pedalboard()
    p = _load(VST_PATHS.get("nls_channel_stereo", ""), "nls_channel_stereo")
    if p:
        _set_params(p, drive=0)
        board.append(p)
    p = _load(VST_PATHS.get("valhalla_vintage_verb", ""))
    if p:
        # Mode Plate, Vocal Plate, Mix 25%, Predelay 20ms, Decay 0.71s
        _set_params(p, mix=0.25, predelay=20.0, decay=0.71)
        board.append(p)
    p = _load(VST_PATHS.get("f6_rta_mono", ""), "f6_rta_mono")  # F6 RTA STEREO si tu as
    if p:
        board.append(p)
    return board if len(board) else None


# ---------- LONG VERB ----------
def build_long_verb():
    board = Pedalboard()
    p = _load(VST_PATHS.get("nls_channel_stereo", ""), "nls_channel_stereo")
    if p:
        _set_params(p, drive=0)
        board.append(p)
    p = _load(VST_PATHS.get("valhalla_vintage_verb", ""))
    if p:
        # Large R HALL, Mix 45%, Predelay 21.32ms, Decay 2.58s
        _set_params(p, mix=0.45, predelay=21.32, decay=2.58)
        board.append(p)
    p = _load(VST_PATHS.get("f6_rta_mono", ""), "f6_rta_mono")
    if p:
        board.append(p)
    return board if len(board) else None


# ---------- DOUBLER ----------
def build_doubler():
    board = Pedalboard()
    p = _load(VST_PATHS.get("nls_channel_stereo", ""), "nls_channel_stereo")
    if p:
        _set_params(p, drive=0)
        board.append(p)
    p = _load(VST_PATHS.get("doubler2_stereo", ""), "doubler2_stereo")
    if p:
        _set_params(p, direct_gain=0.0, voice1_gain=-6.7, voice1_pan=-0.45, voice2_gain=-6.7, voice2_pan=0.45)
        board.append(p)
    p = _load(VST_PATHS.get("sa_imager_stereo", ""), "sa_imager_stereo")
    if p:
        _set_params(p, gain=0.0, width=2.07)
        board.append(p)
    return board if len(board) else None


def process_chain(audio: np.ndarray, sr: int, bpm: float = 120) -> np.ndarray:
    """
    Traite l'audio : si hise_vocal_chain est configuré, utilise uniquement ce plugin ; sinon LEAD1 → LEAD2 → bus.
    audio: (samples,) ou (channels, samples), float32, -1..1
    """
    if audio.ndim == 1:
        audio = audio.reshape(1, -1)

    # Option : plugin HISE unique (ta chaîne vocal exportée en VST3)
    # Si hise_vst3_host.exe est dispo → rendu identique à FL Studio (Option A)
    hise_path = (VST_PATHS.get("hise_vocal_chain") or "").strip()
    if hise_path and Path(hise_path).exists():
        out = _process_via_hise_host(hise_path, audio, sr)
        if out is not None:
            return out
        # Fallback Pedalboard (peut donner des artéfacts avec HISE)
        plugin = _load(hise_path)
        if plugin is not None:
            board = Pedalboard([plugin])
            audio_in = np.ascontiguousarray(audio.T)
            if audio_in.shape[1] == 1:
                audio_in = np.repeat(audio_in, 2, axis=1)
            block_size = 1024
            n_samples = audio_in.shape[0]
            out_chunks = []
            for i, start in enumerate(range(0, n_samples, block_size)):
                end = min(start + block_size, n_samples)
                block = audio_in[start:end]
                reset = i == 0
                out_block = board(block, sr, reset=reset)
                out_chunks.append(out_block)
            out = np.concatenate(out_chunks, axis=0)
            return out

    if audio.shape[0] > 1:
        # Ton preset est surtout mono (LEAD) ; on travaille en mono pour LEAD puis on spread en stereo sur les bus
        vocal_mono = np.mean(audio, axis=0, keepdims=True)
    else:
        vocal_mono = audio

    # LEAD 1
    lead1 = build_lead1()
    if lead1 is not None:
        vocal_mono = lead1(vocal_mono, sr)

    # LEAD 2
    lead2 = build_lead2()
    if lead2 is not None:
        vocal_mono = lead2(vocal_mono, sr)

    # Dupliquer en stereo pour les bus qui sont stereo
    n_samples = vocal_mono.shape[1]
    vocal_stereo = np.vstack([vocal_mono, vocal_mono]) if vocal_mono.shape[0] == 1 else vocal_mono

    # Bus parallèles (tous reçoivent la même source)
    outs = []
    for name, builder in [
        ("pcomp", build_pcomp),
        ("delay", lambda: build_delay(bpm)),
        ("short_verb", build_short_verb),
        ("long_verb", build_long_verb),
        ("doubler", build_doubler),
    ]:
        bus = builder()
        if bus is not None:
            # PCOMP peut être mono, les autres souvent stereo
            in_bus = vocal_stereo if bus_accepts_stereo(bus) else vocal_mono
            out = bus(in_bus, sr)
            if out.ndim == 1:
                out = np.vstack([out, out])
            outs.append(out)
        else:
            outs.append(np.zeros_like(vocal_stereo))

    # Somme des bus (ajuster gains si besoin : 0.2 chacun = 1.0 total)
    out = sum(outs)
    if out.shape[0] == 2:
        out = out / max(1, len(outs))  # normaliser pour éviter clip
    return out


def bus_accepts_stereo(board) -> bool:
    # Simplification : si le premier plugin a 2 inputs, on envoie du stereo
    return True


def _read_wav(path: str):
    """Lit un WAV en float32 (samples, channels). Utilise wave pour éviter soucis soundfile."""
    with wave.open(path, "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        nframes = wf.getnframes()
        raw = wf.readframes(nframes)
    arr = np.frombuffer(raw, dtype=np.int16)
    arr = arr.reshape(-1, nch)
    audio = arr.astype(np.float32) / 32768.0
    return audio, sr


def process_file(input_path: str, output_path: str, bpm: float = 120) -> None:
    """Charge un WAV, applique la chaîne, sauvegarde."""
    audio, sr = _read_wav(input_path)
    # (samples, channels) -> (channels, samples) pour process_chain
    if audio.ndim == 1:
        audio = audio.reshape(-1, 1).T
    else:
        audio = np.ascontiguousarray(audio.T)
    if sr != SAMPLE_RATE:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)
        sr = SAMPLE_RATE
    out = process_chain(audio, sr, bpm=bpm)
    out = np.ascontiguousarray(out.astype(np.float32))
    # out from HISE branch is (samples, channels); from other branch can be (channels, samples)
    if out.ndim == 2:
        if out.shape[1] == 1:
            out = np.ravel(out)
        elif out.shape[0] == 1:
            out = np.ravel(out)
        elif out.shape[1] > 2:
            out = out[:, :2]
    # stdlib wave: mono (samples,) or stereo (samples, 2) interleaved
    out_int = np.clip(out * 32767, -32768, 32767).astype(np.int16)
    nch = 1 if out.ndim == 1 else min(out.shape[1], 2)
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(nch)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(out_int.tobytes())


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python vst_preset_chain.py input.wav output.wav [bpm=120]")
        sys.exit(1)
    inp = sys.argv[1]
    out = sys.argv[2]
    bpm = float(sys.argv[3]) if len(sys.argv) > 3 else 120
    process_file(inp, out, bpm=bpm)
    print("Done:", out)
