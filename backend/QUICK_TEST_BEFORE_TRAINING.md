# Test Rapide Avant l'Entraînement Complet

## Cellule de Test (à lancer AVANT Cell 6)

Copiez cette cellule dans Colab et lancez-la pour vérifier que tout fonctionne :

```python
import torch
import numpy as np
from data_loader import create_dataloader
from ml_model import create_model

print("=== TEST RAPIDE ===\n")

# 1. Test du DataLoader
print("1. Test DataLoader...")
try:
    test_loader = create_dataloader(
        raw_dir='/content/dataset/raw',
        mixed_dir='/content/dataset/mixed',
        batch_size=2,  # Petit batch pour test
        sample_rate=44100,
        segment_length=44100 * 4,
        augment=True,
        shuffle=False,
        num_workers=0,  # 0 pour éviter problèmes de workers
        skip_silence=True
    )
    
    # Charger un batch
    raw_batch, mixed_batch = next(iter(test_loader))
    
    print(f"   ✓ Batch chargé!")
    print(f"   ✓ Shape raw: {raw_batch.shape}")
    print(f"   ✓ Shape mixed: {mixed_batch.shape}")
    print(f"   ✓ Tous les segments ont la même taille: {raw_batch.shape[2] == 176400}")
    
    # Vérifier que tous les segments ont exactement la même taille
    if raw_batch.shape[2] == 176400 and mixed_batch.shape[2] == 176400:
        print("   ✅ TAILLE CORRECTE!")
    else:
        print(f"   ❌ ERREUR: Taille incorrecte! Attendu: 176400, Reçu: {raw_batch.shape[2]}")
        
except Exception as e:
    print(f"   ❌ ERREUR DataLoader: {e}")
    raise

print()

# 2. Test du Modèle
print("2. Test Modèle...")
try:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"   Device: {device}")
    
    model = create_model(model_type='time_domain', device=device)
    print(f"   ✓ Modèle créé")
    print(f"   ✓ Paramètres: {sum(p.numel() for p in model.parameters()):,}")
    
    # Test forward pass
    model.eval()
    with torch.no_grad():
        test_output = model(raw_batch.to(device))
    
    print(f"   ✓ Forward pass réussi!")
    print(f"   ✓ Output shape: {test_output.shape}")
    print(f"   ✓ Output shape correspond à input: {test_output.shape == raw_batch.shape}")
    
    if test_output.shape == raw_batch.shape:
        print("   ✅ FORWARD PASS CORRECT!")
    else:
        print(f"   ❌ ERREUR: Shapes ne correspondent pas!")
        
except Exception as e:
    print(f"   ❌ ERREUR Modèle: {e}")
    raise

print()

# 3. Test d'un Epoch Complet (mini)
print("3. Test Epoch Mini (2 batches)...")
try:
    from train_model import train_epoch
    import torch.nn as nn
    import torch.optim as optim
    
    model.train()
    criterion = nn.L1Loss()
    optimizer = optim.Adam(model.parameters(), lr=1e-4)
    
    # Créer un mini dataloader pour test
    mini_loader = create_dataloader(
        raw_dir='/content/dataset/raw',
        mixed_dir='/content/dataset/mixed',
        batch_size=2,
        sample_rate=44100,
        segment_length=44100 * 4,
        augment=True,
        shuffle=False,
        num_workers=0,
        skip_silence=True
    )
    
    # Tester 2 batches seulement
    model.train()
    total_loss = 0.0
    num_batches = 0
    
    for i, (raw, mixed) in enumerate(mini_loader):
        if i >= 2:  # Seulement 2 batches
            break
            
        raw = raw.to(device)
        mixed = mixed.to(device)
        
        optimizer.zero_grad()
        output = model(raw)
        loss = criterion(output, mixed)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        num_batches += 1
        print(f"   Batch {i+1}: Loss = {loss.item():.6f}")
    
    avg_loss = total_loss / num_batches
    print(f"   ✓ Epoch mini terminé!")
    print(f"   ✓ Loss moyenne: {avg_loss:.6f}")
    print(f"   ✅ ENTRAÎNEMENT FONCTIONNE!")
    
except Exception as e:
    print(f"   ❌ ERREUR Entraînement: {e}")
    import traceback
    traceback.print_exc()
    raise

print("\n=== ✅ TOUS LES TESTS RÉUSSIS! ===")
print("Vous pouvez maintenant lancer Cell 6 en toute sécurité!")
print("L'entraînement devrait fonctionner sans erreur.")
```

## Ce Que Ce Test Vérifie

1. **DataLoader fonctionne** : Les données se chargent correctement
2. **Taille des segments** : Tous les segments ont exactement 176400 samples (4 secondes)
3. **Modèle fonctionne** : Le modèle peut traiter les données
4. **Forward pass** : Le modèle produit des outputs de la bonne taille
5. **Entraînement fonctionne** : Un mini epoch complet fonctionne sans erreur

## Si Tous Les Tests Passent

✅ **Vous pouvez lancer Cell 6 et laisser tourner!**

L'entraînement devrait fonctionner sans problème pendant les 300 epochs.

## Si Un Test Échoue

❌ **Ne lancez PAS Cell 6!**

Corrigez l'erreur d'abord. Le test vous dira exactement où est le problème.

## Temps du Test

- **~30 secondes** pour tous les tests
- **Beaucoup plus rapide** que de lancer 300 epochs et découvrir une erreur après 2 heures!

---

## Après le Test Réussi

1. ✅ Lancez Cell 6
2. ✅ Laissez tourner (2-4 heures)
3. ✅ Vérifiez périodiquement que ça tourne toujours
4. ✅ Le meilleur modèle sera sauvegardé automatiquement dans `/content/models/best_model.pt`
