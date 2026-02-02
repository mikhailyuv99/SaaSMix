"""
Script de vérification finale du dataset avant training Diff-MST
Vérifie : noms correspondants, sample rate, nombre de fichiers, etc.
"""

import os
import soundfile as sf
from pathlib import Path

def verify_dataset(raw_dir, mixed_dir):
    """Vérifie que le dataset est prêt pour l'entraînement"""
    
    print("=" * 60)
    print("VERIFICATION DU DATASET")
    print("=" * 60)
    print()
    
    # 1. Vérifier que les dossiers existent
    if not os.path.exists(raw_dir):
        print(f"[ERROR] Dossier raw introuvable: {raw_dir}")
        return False
    
    if not os.path.exists(mixed_dir):
        print(f"[ERROR] Dossier mixed introuvable: {mixed_dir}")
        return False
    
    print(f"[OK] Dossier raw: {raw_dir}")
    print(f"[OK] Dossier mixed: {mixed_dir}")
    print()
    
    # 2. Lister les fichiers
    raw_files = sorted([f for f in os.listdir(raw_dir) if f.endswith(('.wav', '.mp3', '.flac'))])
    mixed_files = sorted([f for f in os.listdir(mixed_dir) if f.endswith(('.wav', '.mp3', '.flac'))])
    
    print(f"Fichiers raw trouvés: {len(raw_files)}")
    print(f"Fichiers mixed trouvés: {len(mixed_files)}")
    print()
    
    # 3. Vérifier le nombre
    if len(raw_files) != len(mixed_files):
        print(f"⚠️  ATTENTION: Nombre différent de fichiers!")
        print(f"   Raw: {len(raw_files)}, Mixed: {len(mixed_files)}")
        print()
    
    # 4. Vérifier les noms correspondants
    print("Vérification des noms correspondants...")
    missing_pairs = []
    extra_raw = []
    extra_mixed = []
    
    raw_set = set(raw_files)
    mixed_set = set(mixed_files)
    
    for raw_file in raw_files:
        if raw_file not in mixed_set:
            missing_pairs.append(raw_file)
            extra_raw.append(raw_file)
    
    for mixed_file in mixed_files:
        if mixed_file not in raw_set:
            extra_mixed.append(mixed_file)
    
    if missing_pairs:
        print(f"[ERROR] {len(missing_pairs)} fichiers raw sans mixed correspondant:")
        for f in missing_pairs[:10]:  # Afficher max 10
            print(f"   - {f}")
        if len(missing_pairs) > 10:
            print(f"   ... et {len(missing_pairs) - 10} autres")
        print()
    else:
        print("[OK] Tous les fichiers raw ont un mixed correspondant")
        print()
    
    if extra_mixed:
        print(f"[WARNING] {len(extra_mixed)} fichiers mixed sans raw correspondant:")
        for f in extra_mixed[:10]:
            print(f"   - {f}")
        if len(extra_mixed) > 10:
            print(f"   ... et {len(extra_mixed) - 10} autres")
        print()
    
    # 5. Vérifier sample rate et channels
    print("Vérification sample rate et channels...")
    sample_rates_raw = {}
    sample_rates_mixed = {}
    channels_raw = {}
    channels_mixed = {}
    
    # Vérifier quelques fichiers raw
    checked_raw = 0
    for raw_file in raw_files[:min(50, len(raw_files))]:  # Vérifier max 50
        raw_path = os.path.join(raw_dir, raw_file)
        try:
            info = sf.info(raw_path)
            sr = info.samplerate
            ch = info.channels
            sample_rates_raw[sr] = sample_rates_raw.get(sr, 0) + 1
            channels_raw[ch] = channels_raw.get(ch, 0) + 1
            checked_raw += 1
        except Exception as e:
            print(f"[WARNING] Erreur lecture {raw_file}: {e}")
    
    # Vérifier quelques fichiers mixed
    checked_mixed = 0
    for mixed_file in mixed_files[:min(50, len(mixed_files))]:
        mixed_path = os.path.join(mixed_dir, mixed_file)
        try:
            info = sf.info(mixed_path)
            sr = info.samplerate
            ch = info.channels
            sample_rates_mixed[sr] = sample_rates_mixed.get(sr, 0) + 1
            channels_mixed[ch] = channels_mixed.get(ch, 0) + 1
            checked_mixed += 1
        except Exception as e:
            print(f"[WARNING] Erreur lecture {mixed_file}: {e}")
    
    print(f"   Vérifié {checked_raw} fichiers raw, {checked_mixed} fichiers mixed")
    print()
    
    # Afficher les résultats
    print("Sample rates trouvés:")
    print(f"   Raw: {dict(sample_rates_raw)}")
    print(f"   Mixed: {dict(sample_rates_mixed)}")
    
    if len(sample_rates_raw) > 1 or len(sample_rates_mixed) > 1:
        print("[WARNING] ATTENTION: Plusieurs sample rates differents!")
    elif 48000 in sample_rates_raw and 48000 in sample_rates_mixed:
        print("[OK] Sample rate cohérent: 48000 Hz")
    else:
        print("[WARNING] Sample rate different de 48000 Hz")
    
    print()
    print("Channels trouvés:")
    print(f"   Raw: {dict(channels_raw)}")
    print(f"   Mixed: {dict(channels_mixed)}")
    
    if 1 in channels_mixed:
        print("[OK] Mixed en mono (parfait)")
    elif 2 in channels_mixed:
        print("[WARNING] Mixed en stereo (OK mais plus lourd)")
    
    print()
    
    # 6. Résumé final
    print("=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    
    issues = []
    if len(raw_files) != len(mixed_files):
        issues.append(f"Nombre différent: {len(raw_files)} raw vs {len(mixed_files)} mixed")
    if missing_pairs:
        issues.append(f"{len(missing_pairs)} fichiers raw sans mixed")
    if extra_mixed:
        issues.append(f"{len(extra_mixed)} fichiers mixed sans raw")
    if len(sample_rates_raw) > 1 or len(sample_rates_mixed) > 1:
        issues.append("Sample rates incohérents")
    if not (48000 in sample_rates_raw and 48000 in sample_rates_mixed):
        issues.append("Sample rate différent de 48000 Hz")
    
    if issues:
        print("[WARNING] PROBLEMES DETECTES:")
        for issue in issues:
            print(f"   - {issue}")
        print()
        print("[ERROR] Dataset pas pret - Corrige les problemes ci-dessus")
        return False
    else:
        print("[OK] DATASET PRET POUR L'ENTRAINEMENT!")
        print()
        print(f"   [OK] {len(raw_files)} paires raw/mixed")
        print(f"   [OK] Tous les noms correspondent")
        print(f"   [OK] Sample rate: 48000 Hz")
        print(f"   [OK] Pret pour Diff-MST fine-tuning")
        return True

if __name__ == "__main__":
    raw_dir = r"C:\Users\mikha\Desktop\dataset\raw"
    mixed_dir = r"C:\Users\mikha\Desktop\dataset\mixed"
    
    is_ready = verify_dataset(raw_dir, mixed_dir)
    
    if is_ready:
        print("\n[OK] On peut lancer le fine-tuning Diff-MST!")
    else:
        print("\n[WARNING] Corrige les problemes avant de continuer")
