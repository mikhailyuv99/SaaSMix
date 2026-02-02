"""
Mixing Service
Main service that orchestrates the vocal mixing process
"""

import os
import tempfile
from typing import Tuple, Optional
from audio_processor import AudioProcessor
from presets import get_preset, apply_user_parameters
import librosa


class MixingService:
    """Service for processing and mixing vocals"""
    
    def __init__(self, use_ml_model: bool = False, model_path: str = "./models/best_model.pt"):
        """
        Initialize mixing service
        
        Args:
            use_ml_model: Whether to use ML model (default: True)
            model_path: Path to ML model file (default: "./models/best_model.pt")
        """
        if use_ml_model and os.path.exists(model_path):
            self.processor = AudioProcessor(use_ml_model=True, model_path=model_path)
            print(f"[OK] Using ML model: {model_path}")
        else:
            self.processor = AudioProcessor(use_ml_model=False)
            if use_ml_model:
                print(f"[!] ML model not found at {model_path}, using DSP instead")
            else:
                print("[OK] Using DSP processing")
    
    def detect_bpm(self, audio_path: str) -> float:
        """
        Detect BPM from audio file
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Detected BPM
        """
        try:
            y, sr = librosa.load(audio_path, sr=None)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            return float(tempo)
        except:
            # Default to 120 BPM if detection fails
            return 120.0
    
    def process_mix(self, vocal_path: str, instrumental_path: Optional[str] = None,
                   preset_id: str = "modern_clean",
                   reverb_intensity: float = 0.3,
                   delay_tempo: Optional[float] = None,
                   delay_intensity: float = 0.25,
                   manual_bpm: Optional[float] = None) -> Tuple[str, Optional[str]]:
        """
        Process vocal and optionally create full mix with instrumental
        
        Args:
            vocal_path: Path to raw vocal WAV file
            instrumental_path: Path to instrumental WAV file (optional)
            preset_id: Preset identifier
            reverb_intensity: Reverb intensity (0.0 to 1.0)
            delay_tempo: Delay tempo in BPM (None for auto-detect)
            delay_intensity: Delay intensity (0.0 to 1.0)
            manual_bpm: Manual BPM override
        
        Returns:
            Tuple of (processed_vocal_path, full_mix_path or None)
        """
        # Get preset
        preset = get_preset(preset_id)
        
        # Detect BPM - use instrumental if available, otherwise default to 120
        bpm = manual_bpm
        if bpm is None:
            if delay_tempo is not None:
                bpm = delay_tempo
            elif instrumental_path and os.path.exists(instrumental_path):
                bpm = self.detect_bpm(instrumental_path)
            else:
                bpm = 120.0  # Default BPM if no instrumental
        
        # Apply user parameters
        preset = apply_user_parameters(
            preset,
            reverb_intensity=reverb_intensity,
            delay_time=None,  # Will be calculated from BPM
            delay_intensity=delay_intensity,
            bpm=bpm
        )
        
        # Add BPM to preset config for processing
        preset['bpm'] = bpm
        
        # Load vocal audio
        vocal_audio, vocal_sr = self.processor.load_audio(vocal_path)
        
        # Ensure same sample rate
        if vocal_sr != self.processor.sample_rate:
            vocal_audio = librosa.resample(vocal_audio, orig_sr=vocal_sr, target_sr=self.processor.sample_rate)
        
        # Process vocal
        processed_vocal = self.processor.process_vocal(vocal_audio, preset)
        
        # Create temporary output files
        temp_dir = tempfile.gettempdir()
        processed_vocal_path = os.path.join(temp_dir, f"processed_vocal_{os.getpid()}.wav")
        
        # Save processed vocal
        self.processor.save_audio(processed_vocal, processed_vocal_path)
        
        # Mix with instrumental if provided
        full_mix_path = None
        if instrumental_path and os.path.exists(instrumental_path):
            instrumental_audio, instrumental_sr = self.processor.load_audio(instrumental_path)
            
            # Ensure same sample rate
            if instrumental_sr != self.processor.sample_rate:
                instrumental_audio = librosa.resample(
                    instrumental_audio, 
                    orig_sr=instrumental_sr, 
                    target_sr=self.processor.sample_rate
                )
            
            # Mix vocal with instrumental
            mixing_params = preset.get("mixing", {})
            full_mix = self.processor.mix_vocal_with_instrumental(
                processed_vocal,
                instrumental_audio,
                vocal_level=mixing_params.get("vocal_level", 0.0),
                instrumental_level=mixing_params.get("instrumental_level", 0.0)
            )
            
            full_mix_path = os.path.join(temp_dir, f"full_mix_{os.getpid()}.wav")
            self.processor.save_audio(full_mix, full_mix_path)
        
        return processed_vocal_path, full_mix_path
