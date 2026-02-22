"""
Chaîne de mix B (expérimentale).
Même chaîne que la prod (Tone → Gate → FX phone → Core VST3 → De-esser → Air → Delay → Reverb → Doubler → Robot),
mais le "core" (VST3 principal) est lu depuis MAIN_CHAIN_CORE (mixchain sur staging).
Usage : API /api/track/mix (staging) ou CLI run_chain_b.py.
"""
import os
import shutil
import numpy as np
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Optional, Callable

# Réutilisation de toute la logique DSP et des chemins reverb/robot/host depuis la chaîne actuelle
from test_hise_direct import (
    HOST_EXE,
    VST_BLOCK_SIZE,
    REVERB1POINT5_PATH,
    REVERB2_PATH,
    REVERB3_PATH,
    ROBOT_PATH,
    GATE1_PATH,
    GATE2_PATH,
    GATE2POINT5_PATH,
    GATE3_PATH,
    read_wav,
    write_wav,
    apply_phone_eq,
    apply_deesser,
    apply_tone_control,
    apply_air_only,
    apply_pingpong_delay,
    apply_doubler_stereo,
    DEESSER_PRESETS,
    DELAY_PRESETS,
)

try:
    from vst_config import VST_PATHS, CHAIN_B_CORE
except ImportError:
    VST_PATHS = {}
    CHAIN_B_CORE = "mixchain"


def _get_chain_b_core_path(core_override: Optional[str] = None):
    """Chemin du VST3 core pour la chaîne B. Sur VPS (VST_BASE), utilise les chemins résolus de test_hise_direct."""
    key = (core_override or CHAIN_B_CORE or "mixchain").strip() or "mixchain"
    try:
        from test_hise_direct import RESOLVED_CORE_PATHS
        if RESOLVED_CORE_PATHS:
            p = RESOLVED_CORE_PATHS.get(key) or RESOLVED_CORE_PATHS.get("mixchain")
            if p and getattr(p, "exists", lambda: False)():
                return p
    except (ImportError, AttributeError):
        pass
    p = VST_PATHS.get(key) or VST_PATHS.get("mixchain") or ""
    return Path(p) if p else None


def _ensure_stereo(audio: np.ndarray) -> np.ndarray:
    """Convertit mono (N,) ou (N,1) en stéréo (N,2) pour éviter 'index 1 out of bounds'."""
    if audio.ndim == 1:
        return np.column_stack([audio, audio])
    if audio.ndim == 2 and audio.shape[1] == 1:
        return np.column_stack([audio[:, 0], audio[:, 0]])
    return audio


def render_chain_b(
    input_wav: str,
    output_wav: str,
    deesser: bool = True,
    deesser_mode: int = 2,
    noise_gate: bool = True,
    noise_gate_mode: int = 2,
    delay: bool = False,
    delay_intensity: int = 2,
    bpm: float = 120.0,
    delay_division: str = "1/4",
    tone_low: int = 3,
    tone_mid: int = 3,
    tone_high: int = 3,
    air: bool = False,
    reverb: bool = False,
    reverb_mode: int = 2,
    phone_fx: bool = False,
    robot: bool = False,
    doubler: bool = False,
    core_override: Optional[str] = None,
    progress_callback: Optional[Callable[[int, str], None]] = None,
):
    """
    Chaîne B : Tone → Gate (VST3 GATE1/2/2.5/3) → FX phone → Core (MIXCHAIN) → De-esser → Air → Delay → Reverb (REVERB1Point5/2/3) → Doubler → Robot.
    Retourne (True, None) ou (False, message_erreur).
    """
    WEIGHTS = {
        "Tone": 4,
        "Noise gate": 2,
        "FX téléphone": 2,
        "Chaîne principale (VST3)": 52,
        "De-esser": 5,
        "Air": 1,
        "Delay": 4,
        "Reverb": 18,
        "Doubler": 4,
        "FX robot": 4,
    }
    core_path = _get_chain_b_core_path(core_override)
    if not core_path or not core_path.exists():
        return False, f"Chaîne B: core VST3 introuvable (core={core_override or CHAIN_B_CORE})"
    if not HOST_EXE.exists():
        return False, "hise_vst3_host introuvable"
    if not Path(input_wav).exists():
        return False, f"Fichier d'entrée introuvable: {input_wav}"

    _steps = []
    if tone_low != 3 or tone_mid != 3 or tone_high != 3:
        _steps.append("Tone")
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
    _cumul_weight = [0]

    def _step_weight(step_label: str) -> int:
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

    vst_input = input_wav
    temp_tone = None
    temp_gated = None
    temp_phone = None

    _progress("Préparation")

    # 0 : Tone (Low/Mid/High 5 niveaux, 3=neutre) — first in chain, before gate
    if tone_low != 3 or tone_mid != 3 or tone_high != 3:
        _progress("Tone")
        audio, sr = read_wav(input_wav)
        audio = _ensure_stereo(audio)
        audio_tone = apply_tone_control(
            audio, sr,
            tone_low=tone_low, tone_mid=tone_mid, tone_high=tone_high
        )
        temp_tone = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        write_wav(temp_tone, audio_tone, sr)
        vst_input = temp_tone
        _progress("Tone OK", done=True)

    # 0b : Noise gate (VST3 GATE1 / GATE2 / GATE2.5 / GATE3)
    if noise_gate:
        _progress("Noise gate")
        mode = max(1, min(4, noise_gate_mode))
        gate_keys = {1: "gate1", 2: "gate2", 3: "gate2point5", 4: "gate3"}
        gate_key = gate_keys.get(mode, "gate1")
        gate_path = None
        p = VST_PATHS.get(gate_key)
        if p:
            gate_path = Path(p) if isinstance(p, str) else p
        if not gate_path or not gate_path.exists():
            gate_path = (GATE1_PATH if mode == 1 else GATE2_PATH if mode == 2 else GATE2POINT5_PATH if mode == 3 else GATE3_PATH)
        if gate_path and gate_path.exists():
            temp_gated = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            in_abs = str(Path(vst_input).resolve())
            out_abs = str(Path(temp_gated).resolve())
            gate_abs = str(gate_path.resolve())
            cmd = [str(HOST_EXE), gate_abs, in_abs, out_abs, str(VST_BLOCK_SIZE)]
            r = subprocess.run(cmd, capture_output=True, text=True)
            out_file = Path(temp_gated)
            if r.returncode == 0 and out_file.exists() and out_file.stat().st_size > 0:
                vst_input = str(out_file.resolve())
                _progress("Noise gate OK", done=True)
            else:
                Path(temp_gated).unlink(missing_ok=True)
                temp_gated = None
                _progress("Noise gate OK", done=True)
        else:
            _progress("Noise gate OK", done=True)

    # 0c : FX téléphone
    if phone_fx:
        _progress("FX téléphone")
        audio, sr = read_wav(vst_input)
        audio = _ensure_stereo(audio)
        audio = apply_phone_eq(audio, sr)
        temp_phone = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        write_wav(temp_phone, audio, sr)
        vst_input = temp_phone
        _progress("FX téléphone OK", done=True)

    # 1 : Core VST3 (chaîne B = MIXCHAIN sur staging)
    if deesser:
        temp_vst_output = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        vst_output = temp_vst_output
    else:
        vst_output = output_wav

    _progress("Chaîne principale (VST3)")
    cmd = [str(HOST_EXE), str(core_path), vst_input, vst_output, str(VST_BLOCK_SIZE)]
    cwd = str(core_path.parent) if core_path.parent else None
    vst_weight = WEIGHTS["Chaîne principale (VST3)"]
    start_pct = round((_cumul_weight[0] / _total_weight) * 100) if _total_weight else 0
    end_pct = round(((_cumul_weight[0] + vst_weight) / _total_weight) * 100) if _total_weight else 100
    result_holder = []

    def _run_vst():
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
            result_holder.append((r.returncode, r.stdout or "", r.stderr or ""))
        except Exception as e:
            result_holder.append((1, "", str(e)))

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
        return False, err
    if not Path(vst_output).exists():
        return False, "Fichier de sortie VST3 non créé"
    if temp_tone:
        Path(temp_tone).unlink(missing_ok=True)

    _progress("VST3 OK", done=True)

    # 2 : De-esser
    if deesser:
        _progress("De-esser")
        mode = max(1, min(3, deesser_mode))
        th_db, rng_db = DEESSER_PRESETS.get(mode, DEESSER_PRESETS[2])
        audio, sr = read_wav(vst_output)
        audio = _ensure_stereo(audio)
        if audio.ndim == 2 and audio.shape[1] == 2:
            left = apply_deesser(audio[:, 0], sr, threshold_db=th_db, range_db=rng_db)
            right = apply_deesser(audio[:, 1], sr, threshold_db=th_db, range_db=rng_db)
            audio_out = np.column_stack([left, right])
        else:
            audio_out = apply_deesser(audio.flatten(), sr, threshold_db=th_db, range_db=rng_db)
        write_wav(output_wav, audio_out, sr)
        Path(temp_vst_output).unlink(missing_ok=True)
        _progress("De-esser OK", done=True)

    # 2b : Air (after De-esser, before +4.5 / delay)
    if air:
        _progress("Air")
        audio, sr = read_wav(output_wav)
        audio = _ensure_stereo(audio)
        audio = apply_air_only(audio, sr)
        write_wav(output_wav, audio, sr)
        _progress("Air OK", done=True)

    # Gain +4.5 dB avant delay pour reverb 1/2/3
    if reverb and reverb_mode in (1, 2, 3):
        audio, sr = read_wav(output_wav)
        audio = _ensure_stereo(audio)
        gain_linear = 10 ** (4.5 / 20.0)
        audio = (audio * gain_linear).astype(np.float32)
        np.clip(audio, -1.0, 1.0, out=audio)
        write_wav(output_wav, audio, sr)

    # 4 : Delay
    if delay:
        _progress("Delay")
        d_mode = max(1, min(3, delay_intensity))
        d_wet, d_fb = DELAY_PRESETS.get(d_mode, DELAY_PRESETS[2])
        audio, sr = read_wav(output_wav)
        audio = _ensure_stereo(audio)
        auto_bpm = bpm if bpm != 120.0 else None
        audio_delayed = apply_pingpong_delay(
            audio, sr, bpm=auto_bpm, note_division=delay_division,
            feedback=d_fb, wet_mix=d_wet, highcut=4200, lowcut=200,
            feedback_filter_hz=2400
        )
        write_wav(output_wav, audio_delayed, sr)
        _progress("Delay OK", done=True)

    # 5 : Reverb (1=REVERB1Point5 Léger, 2=Moyen, 3=Fort)
    if reverb and REVERB1POINT5_PATH and REVERB2_PATH and REVERB3_PATH:
        reverb_paths = {1: REVERB1POINT5_PATH, 2: REVERB2_PATH, 3: REVERB3_PATH}
        reverb_path = reverb_paths.get(max(1, min(3, reverb_mode)), REVERB2_PATH)
        if reverb_path and reverb_path.exists():
            _progress("Reverb")
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
            res = reverb_result[0] if reverb_result else (1, "", "")
            if res[0] == 0 and Path(temp_reverb_out).exists():
                shutil.copy(temp_reverb_out, output_wav)
                _progress("Reverb OK", done=True)
            else:
                _progress("Reverb skip", done=True)
            Path(temp_reverb_out).unlink(missing_ok=True)
        else:
            _progress("Reverb skip", done=True)

    # 6 : Doubler (DSP)
    if doubler:
        _progress("Doubler")
        audio, sr = read_wav(output_wav)
        audio = _ensure_stereo(audio)
        audio_out = apply_doubler_stereo(audio, sr)
        write_wav(output_wav, audio_out, sr)
        _progress("Doubler OK", done=True)

    # 7 : FX robot
    if robot and ROBOT_PATH and ROBOT_PATH.exists():
        _progress("FX robot")
        temp_robot_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        cmd = [str(HOST_EXE), str(ROBOT_PATH), output_wav, temp_robot_out, str(VST_BLOCK_SIZE)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and Path(temp_robot_out).exists():
            shutil.copy(temp_robot_out, output_wav)
            _progress("FX robot OK", done=True)
        else:
            _progress("FX robot skip", done=True)
        Path(temp_robot_out).unlink(missing_ok=True)
    elif robot:
        _progress("FX robot skip", done=True)

    if temp_gated:
        Path(temp_gated).unlink(missing_ok=True)
    if temp_phone:
        Path(temp_phone).unlink(missing_ok=True)

    _progress("Terminé")
    return True, None
