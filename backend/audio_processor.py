"""
Audio Processing Engine
Core module for processing and mixing vocals automatically.
Supports both DSP-based and ML-based processing.
"""

import numpy as np
import soundfile as sf
import librosa
from scipy import signal
from scipy.signal import butter, lfilter
from typing import Tuple, Optional
import tempfile
import os

# ML imports (optional - only if model is available)
try:
    import torch
    from ml_model import load_model
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    torch = None


class AudioProcessor:
    """Main audio processing class for vocal mixing"""
    
    def __init__(self, sample_rate: int = 44100, use_ml_model: bool = False, model_path: Optional[str] = None):
        """
        Initialize the audio processor
        
        Args:
            sample_rate: Target sample rate for processing (default: 44100 Hz)
            use_ml_model: Whether to use ML model for processing (default: False)
            model_path: Path to trained ML model (required if use_ml_model=True)
        """
        self.sample_rate = sample_rate
        self.use_ml_model = use_ml_model
        self.ml_model = None
        
        if use_ml_model:
            if not ML_AVAILABLE:
                raise ImportError("PyTorch not available. Install torch to use ML model.")
            if model_path is None:
                raise ValueError("model_path required when use_ml_model=True")
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found: {model_path}")
            
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            self.ml_model = load_model(model_path, model_type='time_domain', device=device)
            self.ml_model.eval()
            print(f"Loaded ML model from {model_path} on {device}")
    
    def load_audio(self, file_path: str) -> Tuple[np.ndarray, int]:
        """
        Load audio file and convert to mono if needed
        
        Args:
            file_path: Path to audio file
            
        Returns:
            Tuple of (audio_data, sample_rate)
        """
        audio, sr = librosa.load(file_path, sr=self.sample_rate, mono=False)
        
        # Convert to mono if stereo
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=0)
        
        return audio, sr
    
    def save_audio(self, audio: np.ndarray, file_path: str, sample_rate: int = None):
        """
        Save audio to file
        
        Args:
            audio: Audio data array
            file_path: Output file path
            sample_rate: Sample rate (defaults to self.sample_rate)
        """
        if sample_rate is None:
            sample_rate = self.sample_rate
        
        # Ensure audio is in correct format
        if len(audio.shape) == 1:
            audio = audio.reshape(-1, 1)
        
        sf.write(file_path, audio, sample_rate)
    
    def apply_eq(self, audio: np.ndarray, eq_params: dict) -> np.ndarray:
        """
        Apply parametric EQ (supports multi-band).
        
        Args:
            audio: Input audio
            eq_params: Dictionary with EQ parameters
        
        Returns:
            EQ'd audio
        """
        nyquist = self.sample_rate / 2
        processed = audio.copy()

        # Optional HPF / LPF (for "thin/tight" low cleanup and effect-bus filtering)
        hpf_freq = eq_params.get("hpf_freq")
        if hpf_freq:
            hpf_norm = min(max(hpf_freq / nyquist, 0.001), 0.99)
            b, a = butter(2, hpf_norm, btype="high")
            processed = lfilter(b, a, processed)

        lpf_freq = eq_params.get("lpf_freq")
        if lpf_freq:
            lpf_norm = min(max(lpf_freq / nyquist, 0.001), 0.99)
            b, a = butter(2, lpf_norm, btype="low")
            processed = lfilter(b, a, processed)
        
        # Low shelf boost/cut
        if eq_params.get('low_shelf_gain') is not None and eq_params.get('low_shelf_freq'):
            gain_db = eq_params['low_shelf_gain']
            shelf_freq = eq_params['low_shelf_freq']
            gain_linear = 10 ** (gain_db / 20)
            
            # Low-pass filter to extract low band
            low_freq_norm = min(shelf_freq / nyquist, 0.99)
            b, a = butter(2, low_freq_norm, btype='low')
            low_band = lfilter(b, a, processed)
            
            if gain_db > 0:
                # Boost: add boosted low band
                processed = processed + low_band * (gain_linear - 1.0) * 0.8
            else:
                # Cut: subtract reduced low band
                processed = processed - low_band * (1.0 - gain_linear) * 0.8
        
        # Mid frequency boost
        if eq_params.get('mid_gain') is not None and eq_params.get('mid_freq'):
            gain_db = eq_params['mid_gain']
            mid_freq = eq_params['mid_freq']
            q = eq_params.get('mid_q', 1.0)
            gain_linear = 10 ** (gain_db / 20)
            
            # Bandpass for mid frequencies
            bandwidth = mid_freq / q
            low_cut = max((mid_freq - bandwidth/2) / nyquist, 0.01)
            high_cut = min((mid_freq + bandwidth/2) / nyquist, 0.99)
            b, a = butter(2, [low_cut, high_cut], btype='band')
            mid_band = lfilter(b, a, processed)
            
            # Boost mid frequencies
            processed = processed + mid_band * (gain_linear - 1.0) * 0.9

        # Multi-band bell EQ (F6/Pro-Q style approximation)
        # eq_params["bands"] = [{"freq": 153, "gain_db": -2.9, "q": 2.8}, ...]
        bands = eq_params.get("bands")
        if isinstance(bands, list):
            # Make bell bands independent (closer to Pro-Q/F6 behavior):
            # extract each band from a fixed base signal to reduce band interaction.
            base_for_bells = processed.copy()
            for band in bands:
                try:
                    freq = float(band.get("freq"))
                    gain_db = float(band.get("gain_db"))
                    q = float(band.get("q", 1.0))
                except Exception:
                    continue

                if freq <= 0 or q <= 0 or abs(gain_db) < 0.01:
                    continue

                bandwidth = max(freq / q, 10.0)
                low_cut = max((freq - bandwidth / 2) / nyquist, 0.001)
                high_cut = min((freq + bandwidth / 2) / nyquist, 0.99)
                if low_cut >= high_cut:
                    continue

                b, a = butter(2, [low_cut, high_cut], btype="band")
                band_sig = lfilter(b, a, base_for_bells)
                gain_linear = 10 ** (gain_db / 20)
                processed = processed + band_sig * (gain_linear - 1.0) * 0.9
        
        # High shelf boost/cut
        if eq_params.get('high_shelf_gain') is not None and eq_params.get('high_shelf_freq'):
            gain_db = eq_params['high_shelf_gain']
            shelf_freq = eq_params['high_shelf_freq']
            gain_linear = 10 ** (gain_db / 20)
            
            # High-pass filter to extract high band
            high_freq_norm = max(shelf_freq / nyquist, 0.01)
            b, a = butter(2, high_freq_norm, btype='high')
            high_band = lfilter(b, a, processed)
            
            if gain_db > 0:
                # Boost: add boosted high band
                processed = processed + high_band * (gain_linear - 1.0) * 0.9
            else:
                # Cut: subtract reduced high band
                processed = processed - high_band * (1.0 - gain_linear) * 0.9
        
        return processed
    
    def apply_compressor(self, audio: np.ndarray, threshold: float = -12.0, 
                        ratio: float = 4.0, attack: float = 0.003, 
                        release: float = 0.1, makeup_gain: float = 0.0) -> np.ndarray:
        """
        Apply professional compression with look-ahead and smoother response
        
        Args:
            audio: Input audio
            threshold: Compression threshold in dB
            ratio: Compression ratio (e.g., 4:1)
            attack: Attack time in seconds
            release: Release time in seconds
            makeup_gain: Makeup gain in dB
        
        Returns:
            Compressed audio
        """
        threshold_linear = 10 ** (threshold / 20)
        makeup_gain_linear = 10 ** (makeup_gain / 20)
        
        # Efficient RMS envelope (no per-sample np.mean)
        rms_window = max(1, int(0.01 * self.sample_rate))  # 10ms
        sq = audio ** 2
        kernel = np.ones(rms_window, dtype=np.float32) / float(rms_window)
        rms = np.sqrt(np.convolve(sq, kernel, mode="same") + 1e-12)
        
        attack_coeff = np.exp(-1 / (max(attack, 1e-5) * self.sample_rate))
        release_coeff = np.exp(-1 / (max(release, 1e-5) * self.sample_rate))
        
        envelope = np.zeros_like(audio)
        gain_reduction = np.ones_like(audio)
        env = 0.0
        
        for i in range(len(audio)):
            r = float(rms[i])
            if r > env:
                env = attack_coeff * env + (1 - attack_coeff) * r
            else:
                env = release_coeff * env + (1 - release_coeff) * r
            envelope[i] = env
            
            # Gain reduction calculation with soft knee
            if envelope[i] > threshold_linear:
                # Soft knee for smoother compression
                knee_width = threshold_linear * 0.1
                if envelope[i] < threshold_linear + knee_width:
                    # Soft knee region
                    excess = envelope[i] - threshold_linear
                    compression = 1.0 + (ratio - 1.0) * (excess / knee_width) * 0.5
                else:
                    # Full compression
                    compression = ratio
                
                gain_reduction[i] = threshold_linear / envelope[i] + (1.0 - threshold_linear / envelope[i]) / compression
            else:
                gain_reduction[i] = 1.0
        
        # Smooth gain reduction to avoid artifacts
        smoothed_gain = np.convolve(gain_reduction, np.ones(5)/5, mode='same')
        
        # Apply gain reduction
        compressed = audio * smoothed_gain * makeup_gain_linear
        
        return compressed
    
    def apply_noise_gate(self, audio: np.ndarray, threshold: float = -40.0,
                        attack: float = 0.001, release: float = 0.05,
                        hold: float = 0.01) -> np.ndarray:
        """
        Apply noise gate to clear mud and background noise
        
        Args:
            audio: Input audio
            threshold: Gate threshold in dB
            attack: Attack time in seconds
            release: Release time in seconds
            hold: Hold time in seconds (keeps gate open briefly after signal drops)
        
        Returns:
            Gated audio
        """
        threshold_linear = 10 ** (threshold / 20)
        attack_coeff = np.exp(-1 / (max(attack, 1e-5) * self.sample_rate))
        release_coeff = np.exp(-1 / (max(release, 1e-5) * self.sample_rate))
        hold_samples = int(hold * self.sample_rate)
        
        # RMS envelope for detection
        rms_window = max(1, int(0.01 * self.sample_rate))  # 10ms window
        sq = audio ** 2
        kernel = np.ones(rms_window) / float(rms_window)
        rms = np.sqrt(np.convolve(sq, kernel, mode='same') + 1e-12)
        
        # Gate envelope
        gate_envelope = np.zeros_like(audio)
        gate_state = 0.0
        hold_counter = 0
        
        for i in range(len(audio)):
            if rms[i] > threshold_linear:
                # Signal above threshold - open gate
                gate_state = gate_state + (1.0 - gate_state) * (1 - attack_coeff)
                hold_counter = hold_samples
            else:
                # Signal below threshold
                if hold_counter > 0:
                    # Still in hold period - keep gate open
                    hold_counter -= 1
                    gate_state = gate_state + (1.0 - gate_state) * (1 - attack_coeff)
                else:
                    # Release gate
                    gate_state = gate_state * release_coeff
            
            gate_envelope[i] = gate_state
        
        # Apply gate
        gated = audio * gate_envelope
        
        return gated
    
    def apply_deesser(self, audio: np.ndarray, threshold: float = -6.0,
                      freq_low: float = 5000, freq_high: float = 10000,
                      reduction_db: float = -6.0) -> np.ndarray:
        """
        Apply professional de-essing to reduce sibilance
        
        Args:
            audio: Input audio
            threshold: Threshold for de-essing in dB
            freq_low: Low cutoff for sibilance detection band (Hz)
            freq_high: High cutoff for sibilance detection band (Hz)
        
        Returns:
            De-essed audio
        """
        nyquist = self.sample_rate / 2
        sibilant_freq_low = float(freq_low)
        sibilant_freq_high = float(freq_high)
        if sibilant_freq_low <= 0:
            sibilant_freq_low = 5000.0
        if sibilant_freq_high <= sibilant_freq_low:
            sibilant_freq_high = sibilant_freq_low + 2000.0
        
        # Bandpass filter for sibilant detection (5-10kHz)
        low_cut = min(max(sibilant_freq_low / nyquist, 0.001), 0.99)
        high_cut = min(max(sibilant_freq_high / nyquist, 0.001), 0.99)
        if low_cut >= high_cut:
            return audio
        b, a = butter(4, [low_cut, high_cut], btype='band')
        sibilant_band = lfilter(b, a, audio)
        
        # Efficient RMS envelope for detection (5ms moving average)
        rms_window = max(1, int(0.005 * self.sample_rate))
        sq = sibilant_band ** 2
        kernel = np.ones(rms_window, dtype=np.float32) / float(rms_window)
        sibilant_envelope = np.sqrt(np.convolve(sq, kernel, mode="same") + 1e-12)
        
        # Treat threshold as dB relative to detected sibilant band peak (more like plugin behavior)
        peak_env = float(np.max(sibilant_envelope)) + 1e-12
        threshold_linear = peak_env * (10 ** (threshold / 20))
        
        # Gain reduction (vectorized) - configurable reduction amount
        gain_reduction = np.ones_like(audio)
        mask = sibilant_envelope > threshold_linear
        over = np.zeros_like(sibilant_envelope)
        over[mask] = sibilant_envelope[mask] / threshold_linear
        
        # Calculate reduction based on reduction_db parameter
        reduction_linear = 10 ** (reduction_db / 20)  # e.g., -16dB = 0.158, -10dB = 0.316
        max_reduction = 1.0 - reduction_linear  # Maximum reduction amount
        
        reduction_amount = np.ones_like(sibilant_envelope)
        # Apply reduction when above threshold
        reduction_amount[mask] = 1.0 - (max_reduction / np.maximum(over[mask], 1.0))
        gain_reduction = np.clip(reduction_amount, reduction_linear, 1.0)
        
        # Smooth the gain reduction
        gain_reduction = np.convolve(gain_reduction, np.ones(10)/10, mode='same')
        
        # Apply reduction only to sibilant frequencies (time-domain for speed)
        # Multiply sibilant band by gain reduction, then subtract from original
        reduced_sibilant = sibilant_band * gain_reduction
        deessed = audio - sibilant_band + reduced_sibilant
        
        return deessed
    
    def apply_noise_gate(self, audio: np.ndarray, threshold: float = -40.0,
                        attack: float = 0.001, release: float = 0.05) -> np.ndarray:
        """
        Apply noise gate to clear mud and background noise
        
        Args:
            audio: Input audio
            threshold: Gate threshold in dB
            attack: Attack time in seconds
            release: Release time in seconds
        
        Returns:
            Gated audio
        """
        threshold_linear = 10 ** (threshold / 20)
        attack_coeff = np.exp(-1 / (max(attack, 1e-5) * self.sample_rate))
        release_coeff = np.exp(-1 / (max(release, 1e-5) * self.sample_rate))
        
        # RMS envelope for detection (10ms window)
        rms_window = max(1, int(0.01 * self.sample_rate))
        sq = audio ** 2
        kernel = np.ones(rms_window) / float(rms_window)
        rms = np.sqrt(np.convolve(sq, kernel, mode='same') + 1e-12)
        
        # Gate envelope
        gate_envelope = np.zeros_like(audio)
        gate_state = 0.0
        
        for i in range(len(audio)):
            if rms[i] > threshold_linear:
                # Signal above threshold - open gate
                gate_state = gate_state + (1.0 - gate_state) * (1 - attack_coeff)
            else:
                # Signal below threshold - close gate
                gate_state = gate_state * release_coeff
            
            gate_envelope[i] = gate_state
        
        # Apply gate
        gated = audio * gate_envelope
        
        return gated
    
    def apply_doubler(self, audio: np.ndarray, width: float = 2.0) -> np.ndarray:
        """
        Apply doubler effect to widen vocal
        
        Args:
            audio: Input audio (mono)
            width: Width amount (1.0 = no width, 2.0+ = wider)
        
        Returns:
            Widened audio (stereo-like, but we'll keep mono for now)
        """
        # Simple doubler: add slightly delayed and pitch-shifted copies
        # For mono output, we'll create a widened mono signal
        
        # Short delay (5-15ms) for width
        delay1_samples = int(0.005 * self.sample_rate)  # 5ms
        delay2_samples = int(0.012 * self.sample_rate)  # 12ms
        
        # Create delayed copies
        delayed1 = np.zeros_like(audio)
        delayed2 = np.zeros_like(audio)
        
        for i in range(len(audio)):
            if i >= delay1_samples:
                delayed1[i] = audio[i - delay1_samples]
            if i >= delay2_samples:
                delayed2[i] = audio[i - delay2_samples]
        
        # Mix with original for width
        # Panning simulation: original + delayed copies at different levels
        widened = audio + delayed1 * 0.3 * (width - 1.0) + delayed2 * 0.2 * (width - 1.0)
        
        # Normalize to prevent level increase
        max_orig = np.max(np.abs(audio)) + 1e-10
        max_widened = np.max(np.abs(widened)) + 1e-10
        if max_widened > max_orig:
            widened = widened * (max_orig / max_widened)
        
        return widened
    
    def apply_dynamic_eq(self, audio: np.ndarray, freq: float, q: float,
                        gain_db: float, threshold: float, ratio: float,
                        attack: float = 0.001, release: float = 0.05) -> np.ndarray:
        """
        Apply dynamic EQ band (compresses/expands specific frequency band)
        
        Args:
            audio: Input audio
            freq: Center frequency in Hz
            q: Q factor
            gain_db: Static gain in dB
            threshold: Dynamic threshold in dB
            ratio: Compression ratio (for negative gain_db, this reduces the boost when signal is loud)
            attack: Attack time
            release: Release time
        
        Returns:
            Processed audio
        """
        nyquist = self.sample_rate / 2
        bandwidth = freq / q
        low_cut = max((freq - bandwidth/2) / nyquist, 0.001)
        high_cut = min((freq + bandwidth/2) / nyquist, 0.99)
        
        if low_cut >= high_cut:
            return audio
        
        # Extract frequency band
        b, a = butter(2, [low_cut, high_cut], btype='band')
        band = lfilter(b, a, audio)
        
        # RMS envelope for dynamic control
        rms_window = max(1, int(0.005 * self.sample_rate))
        sq = band ** 2
        kernel = np.ones(rms_window) / float(rms_window)
        rms = np.sqrt(np.convolve(sq, kernel, mode='same') + 1e-12)
        
        threshold_linear = 10 ** (threshold / 20)
        attack_coeff = np.exp(-1 / (max(attack, 1e-5) * self.sample_rate))
        release_coeff = np.exp(-1 / (max(release, 1e-5) * self.sample_rate))
        
        # Dynamic gain reduction
        # Goal: +2dB static, but reduce by -4dB when loud (so final = -2dB when loud)
        target_reduction_db = -4.0  # How much to reduce when loud
        target_reduction_linear = 10 ** (target_reduction_db / 20)  # 0.631 for -4dB
        
        dynamic_gain = np.ones_like(audio)
        env = 0.0
        
        for i in range(len(audio)):
            if rms[i] > env:
                env = attack_coeff * env + (1 - attack_coeff) * rms[i]
            else:
                env = release_coeff * env + (1 - release_coeff) * rms[i]
            
            if env > threshold_linear:
                # Above threshold - apply compression to reduce the boost
                excess_db = 20 * np.log10(env / threshold_linear + 1e-10)
                # Calculate how much to reduce based on ratio
                # For ratio 3:1, every 3dB over threshold = 1dB reduction
                reduction_db = excess_db / ratio
                # Clamp to target reduction
                reduction_db = min(reduction_db, abs(target_reduction_db))
                reduction_linear = 10 ** (-reduction_db / 20)
                dynamic_gain[i] = reduction_linear
            else:
                dynamic_gain[i] = 1.0
        
        # Smooth gain
        dynamic_gain = np.convolve(dynamic_gain, np.ones(5)/5, mode='same')
        
        # Apply static gain + dynamic reduction
        gain_linear = 10 ** (gain_db / 20)
        # dynamic_gain reduces the boost when signal is loud
        # When quiet: dynamic_gain = 1.0, so band gets +2dB
        # When loud: dynamic_gain < 1.0, so boost is reduced (e.g., +2dB becomes -2dB)
        processed_band = band * gain_linear * dynamic_gain
        
        # Replace band in original
        processed = audio - band + processed_band
        
        return processed
    
    def apply_band_saturation(self, audio: np.ndarray, freq_low: float, freq_high: float,
                              drive: float, level_db: float) -> np.ndarray:
        """
        Apply gentle saturation to specific frequency band with level adjustment
        
        Args:
            audio: Input audio
            freq_low: Low frequency cutoff
            freq_high: High frequency cutoff
            drive: Saturation drive (0.0 to 1.0)
            level_db: Level adjustment in dB
        
        Returns:
            Processed audio
        """
        nyquist = self.sample_rate / 2
        n = len(audio)
        
        # Extract frequency band using FFT
        freqs = np.fft.rfftfreq(n, 1.0 / self.sample_rate)
        spec = np.fft.rfft(audio)
        
        # Band mask
        mask = (freqs >= freq_low) & (freqs <= freq_high)
        
        # Extract band
        band_spec = spec * mask
        band = np.fft.irfft(band_spec, n=n)
        
        # Apply gentle saturation (tanh-based, subtle)
        driven = band * (1.0 + drive * 2.0)  # Gentle drive
        saturated = np.tanh(driven * 0.6) * 1.1  # Soft clipping
        
        # Blend with original for subtlety
        processed_band = band * 0.7 + saturated * 0.3
        
        # Apply level adjustment
        level_linear = 10 ** (level_db / 20)
        processed_band = processed_band * level_linear
        
        # Replace band in original
        processed = audio - band + processed_band
        
        return processed

    def apply_multiband_tape_saturation(self, audio: np.ndarray, drive: float = 0.185) -> np.ndarray:
        """
        Multiband "warm tape" saturation (Saturn-like approximation).

        The goal is smooth, ear-pleasing harmonics + perceived tightness
        without harsh aggression.

        Bands based on your notes:
        - Band 1: 0 - 306 Hz, level -1.12 dB
        - Band 2: 306 - 2565 Hz, level 0.0 dB
        - Band 3: 2565 Hz+, level -0.25 dB
        """
        # Use FFT band-splitting to avoid phase/crossover cancellation from IIR filters.
        n = len(audio)
        if n < 2:
            return audio

        sr = self.sample_rate
        freqs = np.fft.rfftfreq(n, 1.0 / sr)
        spec = np.fft.rfft(audio)

        # Band masks
        m_low = freqs < 306
        m_mid = (freqs >= 306) & (freqs < 2565)
        m_high = freqs >= 2565

        def band_to_time(mask: np.ndarray) -> np.ndarray:
            s = spec * mask
            return np.fft.irfft(s, n=n).astype(np.float32)

        low = band_to_time(m_low)
        mid = band_to_time(m_mid)
        high = band_to_time(m_high)

        def tape_sat(x: np.ndarray, d: float) -> np.ndarray:
            # Mild drive mapping: 0.185 ~ gentle
            pre = 1.0 + d * 3.0
            y = np.tanh(x * pre)
            return x * 0.65 + y * 0.35

        low = tape_sat(low, drive) * (10 ** (-1.12 / 20))
        mid = tape_sat(mid, drive) * (10 ** (0.0 / 20))
        high = tape_sat(high, drive) * (10 ** (-0.25 / 20))

        return (low + mid + high).astype(np.float32)
    
    def apply_limiter(self, audio: np.ndarray, threshold: float = -0.3, 
                     release: float = 0.05) -> np.ndarray:
        """
        Apply professional limiter to tame harsh peaks
        
        Args:
            audio: Input audio
            threshold: Limiter threshold in dB (default -0.3dB)
            release: Release time in seconds
        
        Returns:
            Limited audio
        """
        threshold_linear = 10 ** (threshold / 20)
        release_coeff = np.exp(-1 / (release * self.sample_rate))
        
        # Look-ahead for smoother limiting (5ms)
        lookahead_samples = int(0.005 * self.sample_rate)
        lookahead_buffer = np.zeros(lookahead_samples)
        
        limited = np.zeros_like(audio)
        gain_reduction = 1.0
        
        for i in range(len(audio)):
            # Store in lookahead buffer
            lookahead_buffer[i % lookahead_samples] = audio[i]
            
            # Read from lookahead (what we'll output)
            if i >= lookahead_samples:
                read_idx = (i - lookahead_samples) % lookahead_samples
                sample = lookahead_buffer[read_idx]
            else:
                sample = audio[i]
            
            # Calculate peak
            peak = np.abs(sample)
            
            # Limiter: if peak exceeds threshold, reduce gain
            if peak > threshold_linear:
                # Calculate required gain reduction
                required_gain = threshold_linear / peak
                # Smooth gain reduction with release
                gain_reduction = gain_reduction + (required_gain - gain_reduction) * (1 - release_coeff)
            else:
                # Release gain reduction when below threshold
                gain_reduction = gain_reduction + (1.0 - gain_reduction) * (1 - release_coeff)
            
            # Apply gain reduction
            limited[i] = sample * gain_reduction
        
        return limited
    
    def apply_saturation(self, audio: np.ndarray, drive: float = 2.0) -> np.ndarray:
        """
        Apply harmonic saturation/warmth - Modern tube/tape style
        
        Args:
            audio: Input audio
            drive: Saturation drive amount
        
        Returns:
            Saturated audio
        """
        # Tube/tape style saturation with harmonic enhancement
        # This gives that polished, modern character
        driven = audio * (1.0 + drive * 0.3)
        
        # Soft clipping with tube-like characteristics
        saturated = np.tanh(driven * 0.8) * 1.1
        
        # Add subtle harmonic enhancement (even harmonics for warmth)
        harmonics = np.tanh(driven * 0.5) * 0.15
        saturated = saturated + harmonics
        
        # Blend with original for character without too much distortion
        saturated = audio * 0.7 + saturated * 0.3
        
        return saturated
    
    def apply_reverb(self, audio: np.ndarray, room_size: float = 0.5, 
                    damping: float = 0.5, wet_level: float = 0.3) -> np.ndarray:
        """
        Apply spacious, airy reverb effect - Studio Quality
        
        Args:
            audio: Input audio
            room_size: Room size (0.0 to 1.0)
            damping: Damping amount (0.0 to 1.0)
            wet_level: Wet signal level (0.0 to 1.0)
        
        Returns:
            Audio with reverb
        """
        # Spacious, airy reverb with longer delays for width
        # Use longer base delays for more spaciousness (50-150ms range)
        base_delay_ms = 50 + (room_size * 100)  # 50-150ms base delay
        base_delay = base_delay_ms / 1000.0
        
        # Multiple delay taps with varied lengths for spaciousness and diffusion
        # Use prime number ratios for better diffusion
        delay_times = [
            int(base_delay * self.sample_rate),
            int(base_delay * 1.618 * self.sample_rate),  # Golden ratio
            int(base_delay * 2.236 * self.sample_rate),  # sqrt(5)
            int(base_delay * 1.414 * self.sample_rate),  # sqrt(2)
            int(base_delay * 2.618 * self.sample_rate),  # Golden ratio squared
            int(base_delay * 1.732 * self.sample_rate),  # sqrt(3)
        ]
        
        delay_lines = [np.zeros(dt) for dt in delay_times]
        reverb_signal = np.zeros_like(audio)
        
        # Less aggressive high-frequency damping to keep it airy
        # Only damp very high frequencies to prevent harshness but keep air
        nyquist = self.sample_rate / 2
        damping_freq = (8000 + damping * 4000) / nyquist  # 8-12kHz range (less damping = more airy)
        b, a = butter(2, damping_freq, btype='low')
        
        # Decay factors for each delay line (longer decay for spaciousness)
        # Longer decay = more spacious, airy sound
        decay_factors = [0.75, 0.72, 0.68, 0.65, 0.62, 0.58]  # Longer decays for spaciousness
        
        # Early reflections for more realistic reverb
        early_reflections = [
            int(0.005 * self.sample_rate),   # 5ms
            int(0.012 * self.sample_rate),   # 12ms
            int(0.019 * self.sample_rate),   # 19ms
            int(0.031 * self.sample_rate),   # 31ms
        ]
        early_buffers = [np.zeros(er) for er in early_reflections]
        
        for i in range(len(audio)):
            # Sum early reflections (adds realism and spaciousness)
            early_sum = 0.0
            for j, early_buf in enumerate(early_buffers):
                if i >= len(early_buf):
                    read_idx = (i - len(early_buf)) % len(early_buf)
                    early_sum += early_buf[read_idx] * (0.3 ** j)
            
            # Sum all delay line outputs with varied amplitudes
            delayed_sum = 0.0
            for j, delay_line in enumerate(delay_lines):
                delay_time = len(delay_line)
                # Read from delay line (read what was written delay_time samples ago)
                if i >= delay_time:
                    read_idx = (i - delay_time) % delay_time
                    delayed = delay_line[read_idx]
                else:
                    delayed = 0
                # Varied amplitude for each tap (more variation = more spacious)
                amplitude = 0.85 ** j
                delayed_sum += delayed * amplitude
            
            # Combine early reflections and late reverb
            total_reverb = early_sum * 0.3 + delayed_sum * 0.7
            
            # Write to early reflection buffers
            for j, early_buf in enumerate(early_buffers):
                write_idx = i % len(early_buf)
                early_buf[write_idx] = audio[i] * (0.4 ** j)
            
            # Write to delay lines with proper decay (prevents buildup)
            for j, delay_line in enumerate(delay_lines):
                delay_time = len(delay_line)
                write_idx = i % delay_time
                # Each delay line gets input + its own delayed output with decay
                old_value = delay_line[write_idx]
                # Decay the old value and add new input (less input = more spacious)
                delay_line[write_idx] = audio[i] * 0.2 + old_value * decay_factors[j]
            
            # Mix dry and wet - keep it spacious but not 100% wet
            # Use lower wet mix to keep it airy and not muddy
            reverb_signal[i] = audio[i] * (1 - wet_level * 0.6) + total_reverb * wet_level * 0.6
        
        # Apply gentle high-frequency damping (keep it airy)
        reverb_signal = lfilter(b, a, reverb_signal)
        
        # High-pass filter to remove mud (cut below 200Hz in reverb)
        hp_freq = 200 / nyquist
        b_hp, a_hp = butter(2, hp_freq, btype='high')
        reverb_signal = lfilter(b_hp, a_hp, reverb_signal)
        
        # Mix back with original (reverb should be subtle and airy)
        return audio * (1 - wet_level * 0.5) + reverb_signal * wet_level * 0.5
    
    def apply_delay(self, audio: np.ndarray, delay_time: float, 
                   feedback: float = 0.3, wet_level: float = 0.25) -> np.ndarray:
        """
        Apply professional delay effect with proper filtering
        
        Args:
            audio: Input audio
            delay_time: Delay time in seconds
            feedback: Feedback amount (0.0 to 1.0)
            wet_level: Wet signal level (0.0 to 1.0)
        
        Returns:
            Audio with delay
        """
        delay_samples = int(delay_time * self.sample_rate)
        if delay_samples < 1:
            delay_samples = 1
        
        delay_buffer = np.zeros(delay_samples)
        
        # Strong high-frequency damping to delay (removes harsh highs)
        nyquist = self.sample_rate / 2
        damping_freq = 5000 / nyquist  # Damp frequencies above 5kHz (more aggressive)
        b, a = butter(4, damping_freq, btype='low')  # Stronger filter
        
        delayed_audio = np.zeros_like(audio)
        delayed_signal = np.zeros_like(audio)
        
        # Process delay with proper decay to prevent feedback buildup
        for i in range(len(audio)):
            # Read from delay buffer
            read_idx = (i - delay_samples) % delay_samples if i >= delay_samples else 0
            if i >= delay_samples:
                delayed = delay_buffer[read_idx]
            else:
                delayed = 0
            
            # Store delayed signal (will be filtered later)
            delayed_signal[i] = delayed
            
            # Write to delay buffer with controlled feedback and decay
            # Use decay to prevent infinite buildup
            write_idx = i % delay_samples
            if i >= delay_samples:
                # Decay the old value in buffer to prevent buildup
                old_value = delay_buffer[write_idx]
                delay_buffer[write_idx] = audio[i] + old_value * feedback * 0.6  # Reduced feedback with decay
            else:
                delay_buffer[write_idx] = audio[i]
        
        # Apply lowpass filter to remove harsh high frequencies
        delayed_signal = lfilter(b, a, delayed_signal)
        
        # Mix dry and wet with proper levels
        delayed_audio = audio * (1 - wet_level) + delayed_signal * wet_level
        
        return delayed_audio
    
    def apply_plate_reverb(self, audio: np.ndarray, decay: float = 0.71, 
                          wet_level: float = 0.25, predelay: float = 0.02,
                          high_cut: float = 7419) -> np.ndarray:
        """
        Apply plate reverb (short verb) - matches ValhallaVintageVerb Plate
        
        Args:
            audio: Input audio
            decay: Decay time in seconds
            wet_level: Wet signal level (0.0 to 1.0)
            predelay: Pre-delay in seconds
            high_cut: High frequency cutoff in Hz
        
        Returns:
            Audio with plate reverb
        """
        # Performance: use convolution reverb (fast) instead of per-sample delay lines.
        sr = self.sample_rate
        nyquist = sr / 2
        predelay_samples = max(0, int(predelay * sr))
        ir_len = max(256, int((decay + predelay) * sr))

        rng = np.random.default_rng(0)  # deterministic
        t = np.arange(ir_len) / sr
        env = np.exp(-t / max(decay, 1e-3))
        noise = rng.standard_normal(ir_len).astype(np.float32) * env.astype(np.float32)

        ir = np.zeros(ir_len, dtype=np.float32)
        if predelay_samples < ir_len:
            ir[predelay_samples:] = noise[: ir_len - predelay_samples]

        # Plate EQ: HPF 199Hz, LPF high_cut
        hp_norm = min(max(199 / nyquist, 0.001), 0.99)
        lp_norm = min(max(high_cut / nyquist, 0.001), 0.99)
        b_hp, a_hp = butter(2, hp_norm, btype="high")
        b_lp, a_lp = butter(2, lp_norm, btype="low")
        ir = lfilter(b_hp, a_hp, ir)
        ir = lfilter(b_lp, a_lp, ir)

        ir_peak = float(np.max(np.abs(ir))) if ir_len else 0.0
        if ir_peak > 0:
            ir = ir / ir_peak

        wet = signal.fftconvolve(audio, ir, mode="full")[: len(audio)]
        return audio * (1 - wet_level) + wet * wet_level
    
    def apply_hall_reverb(self, audio: np.ndarray, decay: float = 2.58,
                         wet_level: float = 0.45, predelay: float = 0.021,
                         high_cut: float = 6120) -> np.ndarray:
        """
        Apply hall reverb (long verb) - matches ValhallaVintageVerb Hall
        
        Args:
            audio: Input audio
            decay: Decay time in seconds
            wet_level: Wet signal level (0.0 to 1.0)
            predelay: Pre-delay in seconds
            high_cut: High frequency cutoff in Hz
        
        Returns:
            Audio with hall reverb
        """
        # Performance: convolution hall (fast) with longer, darker impulse response.
        sr = self.sample_rate
        nyquist = sr / 2
        predelay_samples = max(0, int(predelay * sr))
        ir_len = max(512, int((decay + predelay) * sr))

        rng = np.random.default_rng(1)  # deterministic, different from plate
        t = np.arange(ir_len) / sr
        env = np.exp(-t / max(decay, 1e-3))
        noise = rng.standard_normal(ir_len).astype(np.float32) * env.astype(np.float32)

        ir = np.zeros(ir_len, dtype=np.float32)
        if predelay_samples < ir_len:
            ir[predelay_samples:] = noise[: ir_len - predelay_samples]

        # Hall EQ: HPF 199Hz, LPF high_cut
        hp_norm = min(max(199 / nyquist, 0.001), 0.99)
        lp_norm = min(max(high_cut / nyquist, 0.001), 0.99)
        b_hp, a_hp = butter(2, hp_norm, btype="high")
        b_lp, a_lp = butter(2, lp_norm, btype="low")
        ir = lfilter(b_hp, a_hp, ir)
        ir = lfilter(b_lp, a_lp, ir)

        ir_peak = float(np.max(np.abs(ir))) if ir_len else 0.0
        if ir_peak > 0:
            ir = ir / ir_peak

        wet = signal.fftconvolve(audio, ir, mode="full")[: len(audio)]
        return audio * (1 - wet_level) + wet * wet_level
    
    def process_vocal(self, audio: np.ndarray, preset_config: dict) -> np.ndarray:
        """
        Process vocal - Supports both ML and DSP methods
        
        Args:
            audio: Input vocal audio
            preset_config: Preset configuration dictionary
        
        Returns:
            Processed vocal audio
        """
        # Use ML model if available and enabled
        if self.use_ml_model and self.ml_model is not None:
            return self._process_vocal_ml(audio)
        else:
            return self._process_vocal_dsp(audio, preset_config)
    
    def _process_vocal_ml(self, audio: np.ndarray) -> np.ndarray:
        """
        Process vocal using ML model
        
        Args:
            audio: Input vocal audio
        
        Returns:
            Processed vocal audio
        """
        device = next(self.ml_model.parameters()).device
        
        # Process in chunks with overlap to avoid boundary artifacts
        chunk_length = int(44100 * 4)  # 4 seconds
        overlap = int(44100 * 0.5)  # 0.5 second overlap for smooth blending
        hop_length = int(chunk_length - overlap)
        
        # If audio is shorter than chunk, process directly
        if len(audio) <= chunk_length:
            padded = np.zeros(chunk_length)
            padded[:len(audio)] = audio
            
            audio_tensor = torch.FloatTensor(padded).unsqueeze(0).unsqueeze(0).to(device)
            
            with torch.no_grad():
                output_tensor = self.ml_model(audio_tensor)
            
            output = output_tensor.cpu().numpy()[0, 0]
            output = output[:len(audio)]
            
            # Normalize
            max_val = np.max(np.abs(output))
            if max_val > 0:
                output = output * (0.966 / max_val)
            
            return output
        
        # Process with overlap-add to avoid boundary artifacts
        processed = np.zeros(len(audio))
        window = np.hanning(overlap * 2)  # Window for smooth blending
        
        for i in range(0, len(audio), hop_length):
            # Extract chunk
            end_idx = min(i + chunk_length, len(audio))
            chunk = audio[i:end_idx]
            
            # Pad if necessary
            if len(chunk) < chunk_length:
                padded = np.zeros(chunk_length)
                padded[:len(chunk)] = chunk
                chunk = padded
            
            # Convert to tensor
            audio_tensor = torch.FloatTensor(chunk).unsqueeze(0).unsqueeze(0).to(device)
            
            # Process
            with torch.no_grad():
                output_tensor = self.ml_model(audio_tensor)
            
            # Convert back to numpy
            output_chunk = output_tensor.cpu().numpy()[0, 0]
            
            # Trim to actual chunk length
            actual_length = end_idx - i
            if len(output_chunk) > actual_length:
                output_chunk = output_chunk[:actual_length]
            
            # Apply overlap-add with windowing
            if i == 0:
                # First chunk: no overlap
                processed[i:end_idx] = output_chunk
            else:
                # Blend with previous chunk
                overlap_start = i
                overlap_end = min(i + overlap, len(processed))
                overlap_len = overlap_end - overlap_start
                
                if overlap_len > 0:
                    # Create blend window
                    blend_window = window[overlap:overlap + overlap_len]
                    prev_window = window[:overlap_len]
                    
                    # Blend overlapping region
                    processed[overlap_start:overlap_end] = (
                        processed[overlap_start:overlap_end] * prev_window +
                        output_chunk[:overlap_len] * blend_window
                    )
                    
                    # Add non-overlapping part
                    if overlap_len < len(output_chunk):
                        processed[overlap_end:end_idx] = output_chunk[overlap_len:]
                else:
                    processed[i:end_idx] = output_chunk
        
        # Normalize to prevent clipping
        max_val = np.max(np.abs(processed))
        if max_val > 0:
            processed = processed * (0.966 / max_val)
        
        return processed
    
    def _process_vocal_dsp(self, audio: np.ndarray, preset_config: dict) -> np.ndarray:
        """
        Process vocal using DSP (PRESET v4)
        Thin vocal + subtle saturation (no reverb/delay)
        
        Args:
            audio: Input vocal audio
            preset_config: Preset configuration dictionary
        
        Returns:
            Processed vocal audio
        """
        # PRESET v4 - Thin + grit, still dry
        nyquist = self.sample_rate / 2
        processed = audio.copy()
        
        # 1. High-pass filter - thin the vocal (cut more low end)
        hp_freq = 110 / nyquist
        b_hp, a_hp = butter(2, hp_freq, btype='high')
        processed = lfilter(b_hp, a_hp, processed)
        
        # 2. EQ - reduce low-mids for "thinner" vocal
        processed = self.apply_eq(processed, {
            "low_shelf_freq": 200,
            "low_shelf_gain": -4.0,  # More low cut
            "high_shelf_freq": 8000,
            "high_shelf_gain": 1.0,  # Keep highs controlled (avoid harshness)
            "bands": [
                {"freq": 280, "q": 1.0, "gain_db": -2.5},  # low-mid cleanup
                {"freq": 450, "q": 1.0, "gain_db": -1.5},  # remove box/body
            ],
        })
        
        # 3. Light compression - just to control peaks, keep it natural
        processed = self.apply_compressor(processed, threshold=-12.0, ratio=2.0,
                                         attack=0.005, release=0.1, makeup_gain=1.0)

        # 4. Saturation - add grit/excitement (subtle)
        processed = self.apply_multiband_tape_saturation(processed, drive=0.14)
        
        # 5. Final limiter - prevent clipping
        processed = self.apply_limiter(processed, threshold=-0.3, release=0.05)
        
        # 6. Normalize to -0.3dB peak
        max_val = np.max(np.abs(processed))
        if max_val > 0:
            processed = processed * (0.966 / max_val)
        
        return processed
    
    def mix_vocal_with_instrumental(self, vocal: np.ndarray, instrumental: np.ndarray,
                                   vocal_level: float = 0.0, instrumental_level: float = 0.0) -> np.ndarray:
        """
        Mix processed vocal with instrumental
        
        Args:
            vocal: Processed vocal audio
            instrumental: Instrumental audio
            vocal_level: Vocal level adjustment in dB
            instrumental_level: Instrumental level adjustment in dB
        
        Returns:
            Mixed audio
        """
        # Ensure same length
        min_len = min(len(vocal), len(instrumental))
        vocal = vocal[:min_len]
        instrumental = instrumental[:min_len]
        
        # Convert dB to linear gain
        vocal_gain = 10 ** (vocal_level / 20)
        instrumental_gain = 10 ** (instrumental_level / 20)
        
        # Apply gains
        vocal = vocal * vocal_gain
        instrumental = instrumental * instrumental_gain
        
        # Mix
        mixed = vocal + instrumental
        
        # Normalize to prevent clipping
        max_val = np.max(np.abs(mixed))
        if max_val > 0.95:
            mixed = mixed * (0.95 / max_val)
        
        return mixed
    
    def analyze_audio(self, audio: np.ndarray) -> dict:
        """
        Analyze audio characteristics
        
        Args:
            audio: Input audio
            
        Returns:
            Dictionary with analysis results
        """
        # RMS level
        rms = np.sqrt(np.mean(audio ** 2))
        rms_db = 20 * np.log10(rms + 1e-10)
        
        # Peak level
        peak = np.max(np.abs(audio))
        peak_db = 20 * np.log10(peak + 1e-10)
        
        # Spectral centroid (brightness)
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=audio, sr=self.sample_rate))
        
        return {
            'rms_db': float(rms_db),
            'peak_db': float(peak_db),
            'spectral_centroid': float(spectral_centroid)
        }
