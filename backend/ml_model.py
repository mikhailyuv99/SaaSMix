"""
Neural Audio Model for Vocal Mixing
U-Net style architecture for raw → mixed vocal transformation
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class AudioUNet(nn.Module):
    """
    U-Net architecture for audio-to-audio transformation
    Learns to transform raw vocals → professionally mixed vocals
    """
    
    def __init__(self, n_channels=1, n_filters=32):
        super(AudioUNet, self).__init__()
        
        # Encoder (downsampling path)
        self.enc1 = self._conv_block(n_channels, n_filters)
        self.enc2 = self._conv_block(n_filters, n_filters * 2)
        self.enc3 = self._conv_block(n_filters * 2, n_filters * 4)
        self.enc4 = self._conv_block(n_filters * 4, n_filters * 8)
        
        # Bottleneck
        self.bottleneck = self._conv_block(n_filters * 8, n_filters * 16)
        
        # Decoder (upsampling path) - input channels doubled due to skip connections
        # First upsampling from bottleneck
        self.dec4_up = nn.Upsample(scale_factor=2, mode='nearest')
        self.dec4_conv = self._conv_block(n_filters * 16 + n_filters * 8, n_filters * 8)  # concat with enc4
        
        self.dec3_up = nn.Upsample(scale_factor=2, mode='nearest')
        self.dec3_conv = self._conv_block(n_filters * 8 + n_filters * 4, n_filters * 4)  # concat with enc3
        
        self.dec2_up = nn.Upsample(scale_factor=2, mode='nearest')
        self.dec2_conv = self._conv_block(n_filters * 4 + n_filters * 2, n_filters * 2)  # concat with enc2
        
        self.dec1_up = nn.Upsample(scale_factor=2, mode='nearest')
        self.dec1_conv = self._conv_block(n_filters * 2 + n_filters, n_filters)  # concat with enc1
        
        # Final output layer
        self.final = nn.Conv1d(n_filters, n_channels, kernel_size=1)
        
        # Pooling and upsampling
        self.pool = nn.MaxPool1d(2)
        self.upsample = nn.Upsample(scale_factor=2, mode='nearest')
        
    def _conv_block(self, in_channels, out_channels):
        """Convolutional block with batch norm and ReLU"""
        return nn.Sequential(
            nn.Conv1d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm1d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv1d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm1d(out_channels),
            nn.ReLU(inplace=True)
        )
    
    def _upconv_block(self, in_channels, out_channels):
        """Upsampling + convolution block"""
        return nn.Sequential(
            nn.Upsample(scale_factor=2, mode='nearest'),
            nn.Conv1d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm1d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv1d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm1d(out_channels),
            nn.ReLU(inplace=True)
        )
    
    def forward(self, x):
        # Encoder path
        enc1 = self.enc1(x)
        x1 = self.pool(enc1)
        
        enc2 = self.enc2(x1)
        x2 = self.pool(enc2)
        
        enc3 = self.enc3(x2)
        x3 = self.pool(enc3)
        
        enc4 = self.enc4(x3)
        x4 = self.pool(enc4)
        
        # Bottleneck
        bottleneck = self.bottleneck(x4)
        
        # Decoder path with skip connections
        # Upsample bottleneck and concat with enc4
        dec4 = self.dec4_up(bottleneck)
        dec4 = self._crop_and_concat(dec4, enc4)
        dec4 = self.dec4_conv(dec4)
        
        # Upsample dec4 and concat with enc3
        dec3 = self.dec3_up(dec4)
        dec3 = self._crop_and_concat(dec3, enc3)
        dec3 = self.dec3_conv(dec3)
        
        # Upsample dec3 and concat with enc2
        dec2 = self.dec2_up(dec3)
        dec2 = self._crop_and_concat(dec2, enc2)
        dec2 = self.dec2_conv(dec2)
        
        # Upsample dec2 and concat with enc1
        dec1 = self.dec1_up(dec2)
        dec1 = self._crop_and_concat(dec1, enc1)
        dec1 = self.dec1_conv(dec1)
        
        # Final output
        output = self.final(dec1)
        
        # Residual connection (add input to output for stability)
        output = output + x
        
        return output
    
    def _crop_and_concat(self, upsampled, skip):
        """Crop skip connection to match upsampled size and concatenate"""
        # Handle size mismatch
        diff = upsampled.size(2) - skip.size(2)
        if diff > 0:
            upsampled = upsampled[:, :, :-diff]
        elif diff < 0:
            skip = skip[:, :, :upsampled.size(2)]
        
        return torch.cat([upsampled, skip], dim=1)


class SpectralUNet(nn.Module):
    """
    Frequency-domain U-Net for better audio quality
    Works in STFT domain for more efficient processing
    """
    
    def __init__(self, n_fft=2048, hop_length=512, n_channels=2):
        super(SpectralUNet, self).__init__()
        self.n_fft = n_fft
        self.hop_length = hop_length
        n_freq_bins = n_fft // 2 + 1
        
        # Process magnitude and phase separately
        self.magnitude_net = AudioUNet(n_channels=n_channels, n_filters=64)
        self.phase_net = AudioUNet(n_channels=n_channels, n_filters=32)
        
    def forward(self, x):
        """
        x: (batch, channels, samples) - time domain audio
        Returns: (batch, channels, samples) - processed audio
        """
        batch_size, channels, samples = x.shape
        
        # Convert to STFT
        stft = torch.stft(
            x.view(batch_size * channels, samples),
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            return_complex=True
        )
        
        # Separate magnitude and phase
        magnitude = torch.abs(stft)
        phase = torch.angle(stft)
        
        # Stack real and imaginary parts for processing
        magnitude_input = torch.stack([magnitude.real, magnitude.imag], dim=1)
        phase_input = torch.stack([phase.real, phase.imag], dim=1)
        
        # Process magnitude and phase
        magnitude_processed = self.magnitude_net(magnitude_input)
        phase_processed = self.phase_net(phase_input)
        
        # Reconstruct complex STFT
        magnitude_out = magnitude_processed[:, 0] + 1j * magnitude_processed[:, 1]
        phase_out = phase_processed[:, 0] + 1j * phase_processed[:, 1]
        
        # Combine (magnitude from net, phase from net)
        stft_out = magnitude_out * torch.exp(1j * torch.angle(phase_out))
        
        # Convert back to time domain
        output = torch.istft(
            stft_out,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            length=samples
        )
        
        return output.view(batch_size, channels, -1)[:, :, :samples]


def create_model(model_type='time_domain', device='cuda'):
    """
    Create and initialize model
    
    Args:
        model_type: 'time_domain' or 'spectral'
        device: 'cuda' or 'cpu'
    
    Returns:
        Initialized model
    """
    if model_type == 'spectral':
        model = SpectralUNet()
    else:
        model = AudioUNet()
    
    model = model.to(device)
    return model


def load_model(model_path, model_type='time_domain', device='cuda'):
    """
    Load trained model from file
    
    Args:
        model_path: Path to saved model or checkpoint
        model_type: 'time_domain' or 'spectral'
        device: 'cuda' or 'cpu'
    
    Returns:
        Loaded model
    """
    model = create_model(model_type, device)
    checkpoint = torch.load(model_path, map_location=device)
    
    # Handle both checkpoint format and direct state_dict format
    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        # It's a checkpoint file (from training)
        state_dict = checkpoint['model_state_dict']
        epoch = checkpoint.get('epoch', '?')
        print(f"Loading model from checkpoint (epoch {epoch})...")
    else:
        # It's a direct state_dict
        state_dict = checkpoint
        print("Loading model from state_dict...")
    
    # Load with strict=False to handle architecture changes
    try:
        model.load_state_dict(state_dict, strict=True)
        print("✓ Model loaded successfully")
    except RuntimeError as e:
        print("⚠️  Architecture mismatch detected, loading compatible weights only...")
        model_dict = model.state_dict()
        
        # Filter compatible weights
        compatible_state = {}
        for k, v in state_dict.items():
            if k in model_dict and model_dict[k].shape == v.shape:
                compatible_state[k] = v
            else:
                print(f"  Skipping incompatible key: {k}")
        
        # Load compatible weights
        model_dict.update(compatible_state)
        model.load_state_dict(model_dict, strict=False)
        print(f"✓ Loaded {len(compatible_state)}/{len(state_dict)} compatible weights")
    
    model.eval()
    return model
