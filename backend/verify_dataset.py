"""
Quick script to verify your dataset is ready for training
"""

import os
from pathlib import Path

def verify_dataset(raw_dir: str, mixed_dir: str):
    """
    Verify dataset structure and matching pairs
    """
    print("=" * 60)
    print("DATASET VERIFICATION")
    print("=" * 60)
    print()
    
    # Check if directories exist
    if not os.path.exists(raw_dir):
        print(f"❌ ERROR: Raw directory not found: {raw_dir}")
        return False
    
    if not os.path.exists(mixed_dir):
        print(f"❌ ERROR: Mixed directory not found: {mixed_dir}")
        return False
    
    print(f"✓ Raw directory found: {raw_dir}")
    print(f"✓ Mixed directory found: {mixed_dir}")
    print()
    
    # Get all audio files
    audio_extensions = {'.wav', '.mp3', '.flac'}
    
    raw_files = {f for f in os.listdir(raw_dir) 
                 if any(f.lower().endswith(ext) for ext in audio_extensions)}
    mixed_files = {f for f in os.listdir(mixed_dir)
                   if any(f.lower().endswith(ext) for ext in audio_extensions)}
    
    print(f"Raw files found: {len(raw_files)}")
    print(f"Mixed files found: {len(mixed_files)}")
    print()
    
    # Find matching pairs
    matches = raw_files & mixed_files
    raw_only = raw_files - mixed_files
    mixed_only = mixed_files - raw_files
    
    print(f"✓ Matching pairs: {len(matches)}")
    
    if len(matches) == 0:
        print("❌ ERROR: No matching pairs found!")
        print("   Make sure filenames match exactly in both folders")
        return False
    
    if raw_only:
        print(f"⚠️  WARNING: {len(raw_only)} raw files without matches:")
        for f in list(raw_only)[:5]:
            print(f"   - {f}")
        if len(raw_only) > 5:
            print(f"   ... and {len(raw_only) - 5} more")
    
    if mixed_only:
        print(f"⚠️  WARNING: {len(mixed_only)} mixed files without matches:")
        for f in list(mixed_only)[:5]:
            print(f"   - {f}")
        if len(mixed_only) > 5:
            print(f"   ... and {len(mixed_only) - 5} more")
    
    print()
    print("=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"✓ Ready to train with {len(matches)} pairs!")
    print()
    
    if len(matches) < 20:
        print("⚠️  Note: Small dataset detected (< 20 pairs)")
        print("   Use optimized settings from VERY_SMALL_DATASET_GUIDE.md")
    elif len(matches) < 50:
        print("✓ Good dataset size (20-50 pairs)")
        print("   Use settings from SMALL_DATASET_GUIDE.md")
    else:
        print("✓ Excellent dataset size (50+ pairs)")
        print("   Standard training settings should work well")
    
    print()
    print("Sample matching pairs:")
    for f in list(matches)[:5]:
        print(f"   ✓ {f}")
    if len(matches) > 5:
        print(f"   ... and {len(matches) - 5} more")
    
    return True

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python verify_dataset.py <raw_dir> <mixed_dir>")
        print()
        print("Example:")
        print("  python verify_dataset.py dataset/raw dataset/mixed")
        sys.exit(1)
    
    raw_dir = sys.argv[1]
    mixed_dir = sys.argv[2]
    
    success = verify_dataset(raw_dir, mixed_dir)
    
    if success:
        print()
        print("🚀 Dataset is ready! You can start training now.")
        sys.exit(0)
    else:
        print()
        print("❌ Please fix the issues above before training.")
        sys.exit(1)
