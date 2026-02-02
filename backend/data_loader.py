"""
Data Loading Pipeline for Neural Audio Training
Handles raw/mixed vocal pairs for training
"""

import os
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
import librosa
import soundfile as sf
from typing import Tuple, List, Optional
import random


class VocalPairDataset(Dataset):
    """
    Dataset for raw/mixed vocal pairs
    Expects directory structure:
    dataset/
        raw/
            vocal1.wav
            vocal2.wav
            ...
        mixed/
            vocal1.wav
            vocal2.wav
            ...
    """
    
    def __init__(
        self,
        raw_dir: str,
        mixed_dir: str,
        sample_rate: int = 44100,
        segment_length: int = 44100 * 4,  # 4 seconds
        augment: bool = True,
        skip_silence: bool = True
    ):
        """
        Initialize dataset
        
        Args:
            raw_dir: Directory with raw vocal files
            mixed_dir: Directory with mixed vocal files (same names)
            sample_rate: Target sample rate
            segment_length: Length of audio segments in samples
            augment: Whether to apply data augmentation
        """
        self.raw_dir = raw_dir
        self.mixed_dir = mixed_dir
        self.sample_rate = sample_rate
        self.segment_length = segment_length
        self.augment = augment
        self.skip_silence = skip_silence
        
        # Find matching pairs
        self.pairs = self._find_pairs()
        
        if len(self.pairs) == 0:
            raise ValueError(f"No matching pairs found in {raw_dir} and {mixed_dir}")
        
        print(f"Found {len(self.pairs)} vocal pairs")
    
    def _find_pairs(self) -> List[Tuple[str, str]]:
        """Find matching raw/mixed file pairs"""
        pairs = []
        
        if not os.path.exists(self.raw_dir) or not os.path.exists(self.mixed_dir):
            return pairs
        
        raw_files = {f for f in os.listdir(self.raw_dir) if f.endswith(('.wav', '.mp3', '.flac'))}
        mixed_files = {f for f in os.listdir(self.mixed_dir) if f.endswith(('.wav', '.mp3', '.flac'))}
        
        # Find matching files
        for filename in raw_files:
            if filename in mixed_files:
                raw_path = os.path.join(self.raw_dir, filename)
                mixed_path = os.path.join(self.mixed_dir, filename)
                pairs.append((raw_path, mixed_path))
        
        return pairs
    
    def _load_audio(self, file_path: str) -> np.ndarray:
        """Load and preprocess audio file"""
        try:
            audio, sr = librosa.load(file_path, sr=self.sample_rate, mono=True)
            return audio
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
            # Return silence if file can't be loaded
            return np.zeros(self.segment_length)
    
    def _normalize(self, audio: np.ndarray) -> np.ndarray:
        """Normalize audio to prevent clipping"""
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            # Normalize to -0.3dB peak
            audio = audio * (0.966 / max_val)
        return audio
    
    def _augment(self, raw: np.ndarray, mixed: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Apply data augmentation - Enhanced for small datasets"""
        if not self.augment:
            return raw, mixed
        
        # Random gain variation (±6dB) - more variation for small datasets
        if random.random() > 0.3:  # 70% chance
            gain_db = random.uniform(-6, 6)
            gain = 10 ** (gain_db / 20)
            raw = raw * gain
            mixed = mixed * gain
        
        # Random time shift (small)
        if random.random() > 0.3 and len(raw) > 1000:
            shift = random.randint(-200, 200)
            raw = np.roll(raw, shift)
            mixed = np.roll(mixed, shift)
        
        # Random pitch shift (subtle, ±2 semitones) - creates more variety
        if random.random() > 0.5 and len(raw) > 1000:
            try:
                import librosa
                pitch_shift = random.uniform(-2, 2)
                raw = librosa.effects.pitch_shift(raw, sr=self.sample_rate, n_steps=pitch_shift)
                mixed = librosa.effects.pitch_shift(mixed, sr=self.sample_rate, n_steps=pitch_shift)
            except:
                pass  # Skip if librosa pitch_shift not available
        
        # Random time stretch (subtle, ±10%) - DISABLED to avoid size mismatch
        # Time stretch changes length, causing batch collation errors
        # if random.random() > 0.7 and len(raw) > 1000:
        #     try:
        #         import librosa
        #         stretch = random.uniform(0.9, 1.1)
        #         raw = librosa.effects.time_stretch(raw, rate=stretch)
        #         mixed = librosa.effects.time_stretch(mixed, rate=stretch)
        #     except:
        #         pass
        
        # Ensure both have exact same length (critical for batching)
        min_len = min(len(raw), len(mixed))
        raw = raw[:min_len]
        mixed = mixed[:min_len]
        
        return raw, mixed
    
    def _detect_vocal_regions(self, audio: np.ndarray, threshold_db: float = -40.0) -> List[Tuple[int, int]]:
        """
        Detect regions with vocal activity (skip silence)
        
        Args:
            audio: Audio signal
            threshold_db: RMS threshold in dB (below this is considered silence)
        
        Returns:
            List of (start, end) sample indices for vocal regions
        """
        # Calculate RMS in windows
        window_size = int(0.1 * self.sample_rate)  # 100ms windows
        hop_size = window_size // 2
        
        vocal_regions = []
        current_start = None
        
        threshold_linear = 10 ** (threshold_db / 20)
        
        for i in range(0, len(audio) - window_size, hop_size):
            window = audio[i:i + window_size]
            rms = np.sqrt(np.mean(window ** 2))
            
            if rms > threshold_linear:
                # Vocal detected
                if current_start is None:
                    current_start = i
            else:
                # Silence detected
                if current_start is not None:
                    # End of vocal region
                    vocal_regions.append((current_start, i + window_size))
                    current_start = None
        
        # Handle case where audio ends during vocal
        if current_start is not None:
            vocal_regions.append((current_start, len(audio)))
        
        # Merge nearby regions (within 0.5 seconds)
        if len(vocal_regions) > 1:
            merged = []
            merge_distance = int(0.5 * self.sample_rate)
            
            current_start, current_end = vocal_regions[0]
            for start, end in vocal_regions[1:]:
                if start - current_end < merge_distance:
                    # Merge regions
                    current_end = end
                else:
                    # Save current region, start new one
                    merged.append((current_start, current_end))
                    current_start, current_end = start, end
            
            merged.append((current_start, current_end))
            vocal_regions = merged
        
        return vocal_regions
    
    def _extract_segment(self, audio: np.ndarray, start_idx: Optional[int] = None, 
                        skip_silence: bool = True) -> np.ndarray:
        """
        Extract segment from audio, optionally skipping silent parts
        
        Args:
            audio: Audio signal
            start_idx: Specific start index (if None, picks random vocal region)
            skip_silence: If True, only extract from vocal regions
        """
        if len(audio) <= self.segment_length:
            # Pad if too short
            padded = np.zeros(self.segment_length)
            padded[:len(audio)] = audio
            return padded
        
        if skip_silence:
            # Detect vocal regions
            vocal_regions = self._detect_vocal_regions(audio)
            
            if len(vocal_regions) == 0:
                # No vocals detected, fall back to random
                if start_idx is None:
                    start_idx = random.randint(0, len(audio) - self.segment_length)
                return audio[start_idx:start_idx + self.segment_length]
            
            # Filter regions that are long enough
            valid_regions = [(s, e) for s, e in vocal_regions if (e - s) >= self.segment_length]
            
            if len(valid_regions) == 0:
                # No region long enough, use longest region and pad if needed
                if vocal_regions:
                    longest = max(vocal_regions, key=lambda x: x[1] - x[0])
                    start_idx = longest[0]
                    segment = audio[start_idx:min(start_idx + self.segment_length, longest[1])]
                    # Pad if needed
                    if len(segment) < self.segment_length:
                        padded = np.zeros(self.segment_length)
                        padded[:len(segment)] = segment
                        return padded
                    return segment
                else:
                    # Fall back to random
                    if start_idx is None:
                        start_idx = random.randint(0, len(audio) - self.segment_length)
                    return audio[start_idx:start_idx + self.segment_length]
            
            # Pick a random valid vocal region
            if start_idx is None:
                region_start, region_end = random.choice(valid_regions)
                # Pick random start within this region
                max_start = region_end - self.segment_length
                start_idx = random.randint(region_start, max_start)
        
        # Extract segment
        if start_idx is None:
            start_idx = random.randint(0, len(audio) - self.segment_length)
        
        return audio[start_idx:start_idx + self.segment_length]
    
    def __len__(self) -> int:
        return len(self.pairs)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Get a training pair
        
        Returns:
            (raw_audio, mixed_audio) as tensors
        """
        raw_path, mixed_path = self.pairs[idx]
        
        # Load audio
        raw = self._load_audio(raw_path)
        mixed = self._load_audio(mixed_path)
        
        # Ensure same length
        min_len = min(len(raw), len(mixed))
        raw = raw[:min_len]
        mixed = mixed[:min_len]
        
        # Extract segment (skip silence if enabled)
        if len(raw) > self.segment_length:
            # Find start position (from vocal regions if skip_silence is enabled)
            if self.skip_silence:
                # Detect vocal regions in raw audio
                vocal_regions = self._detect_vocal_regions(raw)
                if vocal_regions:
                    # Filter regions that are long enough
                    valid_regions = [(s, e) for s, e in vocal_regions if (e - s) >= self.segment_length]
                    if valid_regions:
                        # Pick random valid vocal region
                        region_start, region_end = random.choice(valid_regions)
                        max_start = region_end - self.segment_length
                        start_idx = random.randint(region_start, max_start)
                    else:
                        # No region long enough, use longest region
                        longest = max(vocal_regions, key=lambda x: x[1] - x[0])
                        start_idx = longest[0]
                else:
                    # No vocals detected, fall back to random
                    start_idx = random.randint(0, len(raw) - self.segment_length)
            else:
                # Random position
                start_idx = random.randint(0, len(raw) - self.segment_length)
            
            # Extract from same position for both (to keep them aligned)
            raw = self._extract_segment(raw, start_idx, skip_silence=False)  # Already found vocal region
            mixed = self._extract_segment(mixed, start_idx, skip_silence=False)
        else:
            # Audio too short, just pad
            raw = self._extract_segment(raw, skip_silence=False)
            mixed = self._extract_segment(mixed, skip_silence=False)
        
        # Normalize
        raw = self._normalize(raw)
        mixed = self._normalize(mixed)
        
        # Augment
        raw, mixed = self._augment(raw, mixed)
        
        # CRITICAL: Ensure exact segment_length (pad or trim)
        if len(raw) < self.segment_length:
            # Pad with zeros
            padded_raw = np.zeros(self.segment_length)
            padded_mixed = np.zeros(self.segment_length)
            padded_raw[:len(raw)] = raw
            padded_mixed[:len(mixed)] = mixed
            raw = padded_raw
            mixed = padded_mixed
        elif len(raw) > self.segment_length:
            # Trim to exact length
            raw = raw[:self.segment_length]
            mixed = mixed[:self.segment_length]
        
        # Convert to tensors (add channel dimension: [1, samples])
        raw_tensor = torch.FloatTensor(raw).unsqueeze(0)
        mixed_tensor = torch.FloatTensor(mixed).unsqueeze(0)
        
        return raw_tensor, mixed_tensor


def create_dataloader(
    raw_dir: str,
    mixed_dir: str,
    batch_size: int = 8,
    sample_rate: int = 44100,
    segment_length: int = 44100 * 4,
    augment: bool = True,
    shuffle: bool = True,
    num_workers: int = 4,
    skip_silence: bool = True
) -> DataLoader:
    """
    Create DataLoader for training
    
    Args:
        raw_dir: Directory with raw vocals
        mixed_dir: Directory with mixed vocals
        batch_size: Batch size
        sample_rate: Target sample rate
        segment_length: Segment length in samples
        augment: Apply augmentation
        shuffle: Shuffle data
        num_workers: Number of worker processes
    
    Returns:
        DataLoader
    """
    dataset = VocalPairDataset(
        raw_dir=raw_dir,
        mixed_dir=mixed_dir,
        sample_rate=sample_rate,
        segment_length=segment_length,
        augment=augment,
        skip_silence=skip_silence
    )
    
    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=True if torch.cuda.is_available() else False
    )
    
    return dataloader
