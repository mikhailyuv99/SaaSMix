"""
Test direct : appelle hise_vst3_host.exe avec Project1.vst3 + de-esser léger
"""
import subprocess
import tempfile
import wave
import shutil
from pathlib import Path
import numpy as np
from scipy.signal import butter, lfilter

# Chemins
HOST_EXE = Path(r"c:\Users\mikha\Desktop\SaaS Mix\hise_vst3_host\build\hise_vst3_host_artefacts\Release\hise_vst3_host.exe")
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
except Exception:
    MASTER_PATH = Path(r"C:\Users\mikha\Desktop\HISE\master\Binaries\Compiled\VST3\master.vst3")
    _base = Path(r"C:\Users\mikha\Desktop\HISE\Project1\Binaries\Compiled\VST3")
    REVERB1_PATH = _base / "reverb1.vst3"
    REVERB2_PATH = _base / "reverb2.vst3"
    REVERB3_PATH = _base / "reverb3.vst3"


def read_wav(path: str):
    """Lit un WAV en float32 (16, 24 ou 32-bit)."""
    with wave.open(path, "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        nframes = wf.getnframes()
        sampwidth = wf.getsampwidth()
        raw = wf.readframes(nframes)

    if sampwidth == 2:  # 16-bit
        arr = np.frombuffer(raw, dtype=np.int16)
        audio = arr.astype(np.float32) / 32768.0
    elif sampwidth == 3:  # 24-bit
        arr = np.frombuffer(raw, dtype=np.uint8)
        arr = arr.reshape(-1, 3)
        # Little-endian 24-bit -> int32
        sample = (arr[:, 0].astype(np.int32) | (arr[:, 1].astype(np.int32) << 8) |
                  (arr[:, 2].astype(np.int32) << 16))
        sample = np.where(sample >= 0x800000, sample - 0x1000000, sample)
        audio = sample.astype(np.float32) / 8388608.0
    elif sampwidth == 4:  # 32-bit
        arr = np.frombuffer(raw, dtype=np.int32)
        audio = arr.astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Sample width {sampwidth} non supporté")

    audio = audio.reshape(-1, nch)
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


def render(input_wav: str, output_wav: str, deesser: bool = True, noise_gate: bool = True,
           delay: bool = False, bpm: float = 120.0,
           delay_division: str = "1/4",
           tone_low: int = 2, tone_mid: int = 2, tone_high: int = 2, air: bool = False,
           reverb: bool = False, reverb_mode: int = 2):
    if not HOST_EXE.exists():
        print(f"ERREUR: hise_vst3_host.exe introuvable: {HOST_EXE}")
        return False
    if not VST3_PATH.exists():
        print(f"ERREUR: VST3 introuvable: {VST3_PATH}")
        return False
    if not Path(input_wav).exists():
        print(f"ERREUR: Fichier d'entrée introuvable: {input_wav}")
        return False

    vst_input = input_wav
    temp_gated = None

    # Étape 0 : Noise gate (avant VST3)
    if noise_gate:
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

    # Étape 1 : Rendu VST3
    if deesser:
        temp_vst_output = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        vst_output = temp_vst_output
    else:
        vst_output = output_wav

    cmd = [str(HOST_EXE), str(VST3_PATH), vst_input, vst_output, "1024"]
    print("1. Rendu VST3...")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("ERREUR:", result.stderr or result.stdout)
        return False
    
    if not Path(vst_output).exists():
        print("ERREUR: Fichier de sortie VST3 non créé")
        return False
    
    print("   VST3 OK")
    
    # Étape 2 : De-esser (Python FFT, sans Pro-DS pour le SaaS)
    if deesser:
        print("2. De-esser (FFT)...")
        audio, sr = read_wav(vst_output)
        if audio.ndim == 2 and audio.shape[1] == 2:
            left = apply_deesser(audio[:, 0], sr, threshold_db=-15.0, range_db=12.0)
            right = apply_deesser(audio[:, 1], sr, threshold_db=-15.0, range_db=12.0)
            audio_out = np.column_stack([left, right])
        else:
            audio_out = apply_deesser(audio.flatten(), sr, threshold_db=-15.0, range_db=12.0)
        write_wav(output_wav, audio_out, sr)
        print("   De-esser OK")
        Path(temp_vst_output).unlink(missing_ok=True)

    # Étape 3 : Tone presets (avant delay)
    if tone_low != 2 or tone_mid != 2 or tone_high != 2 or air:
        print("3. Tone (low/mid/high + air)...")
        audio, sr = read_wav(output_wav)
        audio_tone = apply_tone_control(
            audio, sr, tone_low=tone_low, tone_mid=tone_mid, tone_high=tone_high, air=air
        )
        write_wav(output_wav, audio_tone, sr)
        print("   Tone OK")

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

    # Étape 5 : Reverb VST3 (1=leger, 2=moyen défaut, 3=large)
    if reverb:
        reverb_paths = {1: REVERB1_PATH, 2: REVERB2_PATH, 3: REVERB3_PATH}
        reverb_path = reverb_paths.get(max(1, min(3, reverb_mode)), REVERB2_PATH)
        if reverb_path and reverb_path.exists():
            print(f"5. Reverb (reverb{reverb_mode}.vst3)...")
            temp_reverb_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            cmd = [str(HOST_EXE), str(reverb_path), output_wav, temp_reverb_out, "1024"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0 and Path(temp_reverb_out).exists():
                shutil.copy(temp_reverb_out, output_wav)
                print("   Reverb OK")
            else:
                print("   Reverb skip:", result.stderr or result.stdout or "sortie absente")
            Path(temp_reverb_out).unlink(missing_ok=True)
        else:
            print(f"5. Reverb skip: reverb{reverb_mode}.vst3 introuvable ({reverb_path})")

    if temp_gated:
        Path(temp_gated).unlink(missing_ok=True)

    print("OK ->", output_wav)
    return True


def master_only(input_wav: str, output_wav: str) -> bool:
    """
    Applique uniquement master.vst3 sur un WAV déjà mixé.
    Retourne True si succès, False sinon.
    """
    if not HOST_EXE.exists():
        print(f"ERREUR: hise_vst3_host.exe introuvable: {HOST_EXE}")
        return False
    if not MASTER_PATH or not MASTER_PATH.exists():
        print(f"ERREUR: master.vst3 introuvable: {MASTER_PATH}")
        return False
    if not Path(input_wav).exists():
        print(f"ERREUR: Fichier introuvable: {input_wav}")
        return False
    temp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    try:
        cmd = [str(HOST_EXE), str(MASTER_PATH), input_wav, temp_out, "1024"]
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
        print("  --no-deesser     Skip de-esser")
        print("  --no-gate        Skip noise gate")
        print("  --delay          Add ping-pong delay")
        print("  --bpm=120        Set tempo (default: auto-detect)")
        print("  --div=1/4        Delay division: 1/4, 1/2, 1/8 (default 1/4)")
        print("  --tone-low=1|2|3   Low: 1=HPF 150Hz, 2=normal, 3=+2dB 150-200Hz (default 2)")
        print("  --tone-mid=1|2|3   Mid: 1=-2dB 400-4k, 2=normal, 3=+2dB 400-4k (default 2)")
        print("  --tone-high=1|2|3  High: 1=-2dB from 9k, 2=normal, 3=+2dB from 9k (default 2)")
        print("  --air              Air on: +2dB shelf from 12500Hz")
        print("  --reverb           Reverb en fin de chaîne (défaut: reverb2)")
        print("  --reverb=1|2|3     Reverb: 1=leger, 2=moyen, 3=large (défaut 2)")
        print("  --master-only      Uniquement master.vst3 (input = WAV déjà mixé, output = masterisé)")
        print("Chaîne: Gate → VST3 → De-esser → Tone → Gain → Delay → Reverb")
        sys.exit(1)

    # Mode master seul : input WAV mixé → master.vst3 → output
    if "--master-only" in sys.argv:
        input_wav = sys.argv[1]
        output_wav = sys.argv[2]
        if not Path(input_wav).exists():
            print(f"ERREUR: Fichier introuvable: {input_wav}")
            sys.exit(1)
        if not HOST_EXE.exists():
            print(f"ERREUR: hise_vst3_host.exe introuvable: {HOST_EXE}")
            sys.exit(1)
        if not MASTER_PATH or not MASTER_PATH.exists():
            print(f"ERREUR: master.vst3 introuvable: {MASTER_PATH}")
            sys.exit(1)
        print("Master seul (master.vst3)...")
        temp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        cmd = [str(HOST_EXE), str(MASTER_PATH), input_wav, temp_out, "1024"]
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

    render(sys.argv[1], sys.argv[2], deesser=not no_deesser, noise_gate=not no_gate,
           delay=use_delay, bpm=bpm, delay_division=div,
           tone_low=tone_low, tone_mid=tone_mid, tone_high=tone_high, air=air,
           reverb=use_reverb, reverb_mode=reverb_mode)
