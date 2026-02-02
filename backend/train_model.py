"""
Training Script for Neural Audio Model
Trains model to transform raw vocals → mixed vocals
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.tensorboard import SummaryWriter
import os
import argparse
from tqdm import tqdm
from typing import Optional
import numpy as np

from ml_model import create_model
from data_loader import create_dataloader


def train_epoch(model, dataloader, criterion, optimizer, device, epoch):
    """Train for one epoch"""
    model.train()
    total_loss = 0.0
    num_batches = 0
    
    pbar = tqdm(dataloader, desc=f"Epoch {epoch}")
    for raw, mixed in pbar:
        raw = raw.to(device)
        mixed = mixed.to(device)
        
        # Forward pass
        optimizer.zero_grad()
        output = model(raw)
        
        # Calculate loss
        loss = criterion(output, mixed)
        
        # Backward pass
        loss.backward()
        
        # Gradient clipping for stability
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        
        optimizer.step()
        
        total_loss += loss.item()
        num_batches += 1
        
        # Update progress bar
        pbar.set_postfix({'loss': f'{loss.item():.6f}'})
    
    avg_loss = total_loss / num_batches
    return avg_loss


def validate(model, dataloader, criterion, device):
    """Validate model"""
    model.eval()
    total_loss = 0.0
    num_batches = 0
    
    with torch.no_grad():
        for raw, mixed in tqdm(dataloader, desc="Validating"):
            raw = raw.to(device)
            mixed = mixed.to(device)
            
            output = model(raw)
            loss = criterion(output, mixed)
            
            total_loss += loss.item()
            num_batches += 1
    
    avg_loss = total_loss / num_batches
    return avg_loss


def save_checkpoint(model, optimizer, epoch, loss, checkpoint_dir, is_best=False):
    """Save model checkpoint"""
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    checkpoint = {
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'loss': loss,
    }
    
    checkpoint_path = os.path.join(checkpoint_dir, f'checkpoint_epoch_{epoch}.pt')
    torch.save(checkpoint, checkpoint_path)
    
    if is_best:
        best_path = os.path.join(checkpoint_dir, 'best_model.pt')
        torch.save(checkpoint, best_path)
        print(f"Saved best model to {best_path}")


def train(
    raw_dir: str,
    mixed_dir: str,
    output_dir: str,
    batch_size: int = 8,
    num_epochs: int = 100,
    learning_rate: float = 1e-4,
    sample_rate: int = 44100,
    segment_length: int = 44100 * 4,
    model_type: str = 'time_domain',
    resume_from: Optional[str] = None
):
    """
    Main training function
    
    Args:
        raw_dir: Directory with raw vocal files
        mixed_dir: Directory with mixed vocal files
        output_dir: Directory to save checkpoints and logs
        batch_size: Batch size
        num_epochs: Number of training epochs
        learning_rate: Learning rate
        sample_rate: Audio sample rate
        segment_length: Segment length in samples
        model_type: 'time_domain' or 'spectral'
        resume_from: Path to checkpoint to resume from
    """
    # Setup device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Create model
    model = create_model(model_type=model_type, device=device)
    print(f"Model created: {model_type}")
    print(f"Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Loss function - combination of L1 and spectral loss
    l1_loss = nn.L1Loss()
    mse_loss = nn.MSELoss()
    
    def combined_loss(output, target):
        # L1 loss for time domain
        l1 = l1_loss(output, target)
        
        # Spectral loss (frequency domain)
        output_fft = torch.fft.rfft(output, dim=2)
        target_fft = torch.fft.rfft(target, dim=2)
        spectral = mse_loss(torch.abs(output_fft), torch.abs(target_fft))
        
        return l1 + 0.1 * spectral
    
    criterion = combined_loss
    
    # Optimizer
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, betas=(0.9, 0.999))
    
    # Learning rate scheduler
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=10
    )
    
    # Resume from checkpoint if provided
    start_epoch = 0
    best_val_loss = float('inf')
    
    if resume_from and os.path.exists(resume_from):
        print(f"Resuming from {resume_from}")
        checkpoint = torch.load(resume_from, map_location=device)
        
        # Try to load with strict=False to handle architecture changes
        try:
            model.load_state_dict(checkpoint['model_state_dict'], strict=True)
            print("✓ Model loaded successfully")
        except RuntimeError as e:
            print("⚠️  Architecture mismatch detected, loading compatible weights only...")
            model_state = checkpoint['model_state_dict']
            model_dict = model.state_dict()
            
            # Filter out incompatible keys
            compatible_state = {}
            for k, v in model_state.items():
                if k in model_dict and model_dict[k].shape == v.shape:
                    compatible_state[k] = v
                else:
                    print(f"  Skipping incompatible key: {k}")
            
            # Load compatible weights
            model_dict.update(compatible_state)
            model.load_state_dict(model_dict, strict=False)
            print(f"✓ Loaded {len(compatible_state)}/{len(model_state)} compatible weights")
            print("  Note: Some decoder weights will be reinitialized")
        
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        start_epoch = checkpoint['epoch'] + 1
        best_val_loss = checkpoint.get('loss', float('inf'))
    
    # Create data loaders
    print("Creating data loaders...")
    
    # For small datasets, use more aggressive augmentation
    # Check dataset size to adjust settings
    from data_loader import VocalPairDataset
    temp_dataset = VocalPairDataset(raw_dir, mixed_dir, sample_rate, segment_length, augment=False)
    dataset_size = len(temp_dataset)
    
    print(f"Dataset size: {dataset_size} pairs")
    if dataset_size < 200:
        print("⚠️  Small dataset detected! Using optimized settings:")
        print("   - More aggressive augmentation")
        print("   - Longer training recommended (200+ epochs)")
        print("   - Consider smaller batch size")
    
    # Use num_workers=0 to avoid worker process issues
    num_workers = 0
    
    train_loader = create_dataloader(
        raw_dir=raw_dir,
        mixed_dir=mixed_dir,
        batch_size=batch_size,
        sample_rate=sample_rate,
        segment_length=segment_length,
        augment=True,  # Always use augmentation for small datasets
        shuffle=True,
        num_workers=num_workers
    )
    
    # Split data for validation (use 20% for validation if dataset is small)
    val_split = 0.2 if dataset_size < 200 else 0.1
    val_loader = create_dataloader(
        raw_dir=raw_dir,
        mixed_dir=mixed_dir,
        batch_size=batch_size,
        sample_rate=sample_rate,
        segment_length=segment_length,
        augment=False,
        shuffle=False,
        num_workers=num_workers
    )
    
    # TensorBoard writer
    writer = SummaryWriter(os.path.join(output_dir, 'logs'))
    
    # Training loop
    print(f"Starting training for {num_epochs} epochs...")
    
    for epoch in range(start_epoch, num_epochs):
        # Train
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device, epoch)
        
        # Validate
        val_loss = validate(model, val_loader, criterion, device)
        
        # Update learning rate
        scheduler.step(val_loss)
        
        # Log to TensorBoard
        writer.add_scalar('Loss/Train', train_loss, epoch)
        writer.add_scalar('Loss/Validation', val_loss, epoch)
        writer.add_scalar('Learning_Rate', optimizer.param_groups[0]['lr'], epoch)
        
        print(f"Epoch {epoch+1}/{num_epochs}")
        print(f"  Train Loss: {train_loss:.6f}")
        print(f"  Val Loss: {val_loss:.6f}")
        print(f"  LR: {optimizer.param_groups[0]['lr']:.2e}")
        
        # Save checkpoint
        is_best = val_loss < best_val_loss
        if is_best:
            best_val_loss = val_loss
        
        save_checkpoint(model, optimizer, epoch, val_loss, output_dir, is_best)
        
        # Save every 10 epochs
        if (epoch + 1) % 10 == 0:
            checkpoint_path = os.path.join(output_dir, f'checkpoint_epoch_{epoch+1}.pt')
            print(f"Saved checkpoint to {checkpoint_path}")
    
    writer.close()
    print("Training complete!")
    print(f"Best validation loss: {best_val_loss:.6f}")
    print(f"Best model saved to: {os.path.join(output_dir, 'best_model.pt')}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train Neural Audio Model')
    parser.add_argument('--raw_dir', type=str, required=True,
                       help='Directory with raw vocal files')
    parser.add_argument('--mixed_dir', type=str, required=True,
                       help='Directory with mixed vocal files')
    parser.add_argument('--output_dir', type=str, default='./models',
                       help='Output directory for checkpoints')
    parser.add_argument('--batch_size', type=int, default=8,
                       help='Batch size')
    parser.add_argument('--num_epochs', type=int, default=100,
                       help='Number of training epochs')
    parser.add_argument('--learning_rate', type=float, default=1e-4,
                       help='Learning rate')
    parser.add_argument('--sample_rate', type=int, default=44100,
                       help='Sample rate')
    parser.add_argument('--segment_length', type=int, default=44100 * 4,
                       help='Segment length in samples')
    parser.add_argument('--model_type', type=str, default='time_domain',
                       choices=['time_domain', 'spectral'],
                       help='Model type')
    parser.add_argument('--resume_from', type=str, default=None,
                       help='Resume from checkpoint')
    
    args = parser.parse_args()
    
    train(
        raw_dir=args.raw_dir,
        mixed_dir=args.mixed_dir,
        output_dir=args.output_dir,
        batch_size=args.batch_size,
        num_epochs=args.num_epochs,
        learning_rate=args.learning_rate,
        sample_rate=args.sample_rate,
        segment_length=args.segment_length,
        model_type=args.model_type,
        resume_from=args.resume_from
    )
