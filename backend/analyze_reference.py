"""
Analyze Reference Mix
Compares raw vocal with professionally mixed vocal to extract processing characteristics
"""

import numpy as np
import librosa
import soundfile as sf
from scipy import signal
from scipy.signal import butter, lfilter

def analyze_vocals(raw_path: str, mixed_path: str):
    """
    Analyze raw vs mixed vocal to understand processing applied
    
    Args:
        raw_path: Path to raw vocal WAV
        mixed_path: Path to professionally mixed vocal WAV
    """
    print("Analyzing Reference Mix...\n")
    
    # Load both files
    print("Loading audio files...")
    raw, sr_raw = librosa.load(raw_path, sr=44100, mono=True)
    mixed, sr_mixed = librosa.load(mixed_path, sr=44100, mono=True)
    
    # Ensure same length
    min_len = min(len(raw), len(mixed))
    raw = raw[:min_len]
    mixed = mixed[:min_len]
    
    print(f"Loaded {min_len/sr_raw:.2f} seconds of audio\n")
    
    # 1. Level Analysis
    print("Level Analysis:")
    raw_rms = np.sqrt(np.mean(raw ** 2))
    mixed_rms = np.sqrt(np.mean(mixed ** 2))
    raw_peak = np.max(np.abs(raw))
    mixed_peak = np.max(np.abs(mixed))
    
    print(f"   Raw RMS: {20*np.log10(raw_rms+1e-10):.2f} dB")
    print(f"   Mixed RMS: {20*np.log10(mixed_rms+1e-10):.2f} dB")
    print(f"   Gain applied: {20*np.log10(mixed_rms/raw_rms+1e-10):.2f} dB")
    print(f"   Raw Peak: {20*np.log10(raw_peak+1e-10):.2f} dB")
    print(f"   Mixed Peak: {20*np.log10(mixed_peak+1e-10):.2f} dB\n")
    
    # 2. Frequency Analysis
    print("Frequency Analysis:")
    raw_fft = np.fft.rfft(raw)
    mixed_fft = np.fft.rfft(mixed)
    freqs = np.fft.rfftfreq(len(raw), 1/sr_raw)
    
    raw_mag = np.abs(raw_fft)
    mixed_mag = np.abs(mixed_fft)
    
    # Calculate EQ curve
    eq_curve = 20 * np.log10(mixed_mag / (raw_mag + 1e-10))
    
    # Analyze key frequency bands
    bands = {
        "Low (20-200 Hz)": (20, 200),
        "Low-Mid (200-800 Hz)": (200, 800),
        "Mid (800-3000 Hz)": (800, 3000),
        "High-Mid (3000-8000 Hz)": (3000, 8000),
        "High (8000-20000 Hz)": (8000, 20000)
    }
    
    for band_name, (low_freq, high_freq) in bands.items():
        mask = (freqs >= low_freq) & (freqs <= high_freq)
        if np.any(mask):
            band_gain = np.mean(eq_curve[mask])
            print(f"   {band_name}: {band_gain:+.2f} dB")
    
    print()
    
    # 3. Dynamics Analysis (Compression)
    print("Dynamics Analysis (Compression):")
    raw_dynamic_range = np.max(raw) - np.min(raw)
    mixed_dynamic_range = np.max(mixed) - np.min(mixed)
    compression_ratio = raw_dynamic_range / (mixed_dynamic_range + 1e-10)
    
    print(f"   Raw dynamic range: {raw_dynamic_range:.4f}")
    print(f"   Mixed dynamic range: {mixed_dynamic_range:.4f}")
    print(f"   Estimated compression ratio: {compression_ratio:.2f}:1\n")
    
    # 4. Reverb Analysis (look for tail)
    print("Reverb Analysis:")
    # Find where audio ends
    raw_energy = np.abs(raw)
    mixed_energy = np.abs(mixed)
    
    # Find end of main signal (where energy drops below threshold)
    threshold = np.max(raw_energy) * 0.01
    raw_end = np.where(raw_energy > threshold)[0]
    if len(raw_end) > 0:
        raw_end_idx = raw_end[-1]
        # Check if mixed has energy after raw ends (reverb tail)
        tail_energy = np.sum(mixed_energy[raw_end_idx:])
        main_energy = np.sum(mixed_energy[:raw_end_idx])
        reverb_amount = tail_energy / (main_energy + tail_energy + 1e-10)
        print(f"   Estimated reverb wet level: {reverb_amount*100:.1f}%")
        print(f"   Reverb tail length: {(len(mixed) - raw_end_idx)/sr_raw:.2f} seconds\n")
    
    # 5. Spectral Centroid (brightness)
    print("Brightness Analysis:")
    raw_centroid = np.mean(librosa.feature.spectral_centroid(y=raw, sr=sr_raw))
    mixed_centroid = np.mean(librosa.feature.spectral_centroid(y=mixed, sr=sr_raw))
    print(f"   Raw spectral centroid: {raw_centroid:.1f} Hz")
    print(f"   Mixed spectral centroid: {mixed_centroid:.1f} Hz")
    print(f"   Brightness change: {mixed_centroid - raw_centroid:+.1f} Hz\n")
    
    # 6. Summary
    print("Processing Summary:")
    print("   Based on analysis, the mix likely includes:")
    print("   - EQ adjustments (see frequency bands above)")
    print("   - Compression (see dynamics analysis)")
    if reverb_amount > 0.05:
        print("   - Reverb (detected tail)")
    print("   - Overall gain boost")
    print()
    
    # Save EQ curve for reference
    print("Saving analysis results...")
    np.save("eq_curve.npy", eq_curve)
    np.save("frequencies.npy", freqs)
    print("   Saved EQ curve to eq_curve.npy")
    print("   Saved frequencies to frequencies.npy")
    print()
    
    print("Analysis complete!")
    return {
        "gain_db": 20*np.log10(mixed_rms/raw_rms+1e-10),
        "compression_ratio": compression_ratio,
        "reverb_amount": reverb_amount,
        "eq_curve": eq_curve,
        "frequencies": freqs
    }

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python analyze_reference.py <raw_vocal.wav> <mixed_vocal.wav>")
        print("\nExample:")
        print('  python analyze_reference.py "C:\\Users\\mikha\\Desktop\\2myllraw.wav" "C:\\Users\\mikha\\Desktop\\2myllmixed.wav"')
        sys.exit(1)
    
    raw_path = sys.argv[1]
    mixed_path = sys.argv[2]
    
    try:
        results = analyze_vocals(raw_path, mixed_path)
        print("\nUse these insights to improve the processing algorithms!")
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
