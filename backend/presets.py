"""
Preset Configurations
Modern Trap/Hip-Hop presets inspired by NAV, Lil Uzi Vert, Travis Scott, Post Malone
"""

PRESETS = {
    "nav_polished": {
        "name": "NAV Polished",
        "description": "Bright, polished, heavily compressed - NAV style",
        "genre": "Hip-Hop/Trap",
        "eq": {
            "low_shelf_freq": 200,
            "low_shelf_gain": -7.0,  # More aggressive low cut
            "mid_freq": 2800,  # Higher mid boost for presence
            "mid_gain": 6.5,  # Stronger mid boost
            "mid_q": 1.2,  # Wider Q for more presence
            "high_shelf_freq": 8500,
            "high_shelf_gain": 10.0  # Even brighter highs
        },
        "deesser": {
            "enabled": True,
            "threshold": -14.0  # Very aggressive de-essing
        },
        "compression": [
            {
                "threshold": -20.0,  # Lower threshold = more compression
                "ratio": 8.0,  # Higher ratio = more aggressive
                "attack": 0.0005,  # Faster attack = tighter
                "release": 0.05,  # Faster release = more aggressive
                "makeup_gain": 5.5  # More makeup gain
            },
            {
                "threshold": -14.0,
                "ratio": 5.0,
                "attack": 0.0005,
                "release": 0.08,
                "makeup_gain": 3.0
            },
            {
                "threshold": -8.0,  # Third stage for final polish
                "ratio": 3.0,
                "attack": 0.001,
                "release": 0.12,
                "makeup_gain": 1.5
            }
        ],
        "saturation": {
            "enabled": True,
            "drive": 4.5  # More saturation for that polished, modern character
        },
        "reverb": {
            "enabled": True,
            "room_size": 0.6,  # Smaller, more polished reverb
            "damping": 0.7,  # More damping for clean sound
            "intensity": 0.2  # Subtle reverb
        },
        "delay": {
            "enabled": True,
            "time": None,
            "note_division": 0.25,  # Quarter note
            "feedback": 0.25,
            "intensity": 0.15
        },
        "final_eq": {
            "high_shelf_freq": 10000,
            "high_shelf_gain": 3.5,  # More final bright boost
            "mid_freq": 3500,  # Add presence boost
            "mid_gain": 2.0,
            "mid_q": 1.5
        },
        "mixing": {
            "vocal_level": 1.5,
            "instrumental_level": -1.5
        }
    },
    
    "uzi_bright": {
        "name": "Lil Uzi Vert",
        "description": "Bright, present, modern trap - Uzi style",
        "genre": "Hip-Hop/Trap",
        "eq": {
            "low_shelf_freq": 200,
            "low_shelf_gain": -6.5,
            "mid_freq": 2600,
            "mid_gain": 6.0,
            "mid_q": 1.3,
            "high_shelf_freq": 8500,
            "high_shelf_gain": 9.5  # Very bright
        },
        "deesser": {
            "enabled": True,
            "threshold": -14.0
        },
        "compression": [
            {
                "threshold": -19.0,
                "ratio": 7.0,
                "attack": 0.0005,
                "release": 0.06,
                "makeup_gain": 5.0
            },
            {
                "threshold": -13.0,
                "ratio": 4.5,
                "attack": 0.0005,
                "release": 0.09,
                "makeup_gain": 2.8
            }
        ],
        "saturation": {
            "enabled": True,
            "drive": 4.0
        },
        "reverb": {
            "enabled": True,
            "room_size": 0.7,
            "damping": 0.65,
            "intensity": 0.22
        },
        "delay": {
            "enabled": True,
            "time": None,
            "note_division": 0.25,
            "feedback": 0.3,
            "intensity": 0.18
        },
        "final_eq": {
            "high_shelf_freq": 10000,
            "high_shelf_gain": 3.0,
            "mid_freq": 3500,
            "mid_gain": 1.8,
            "mid_q": 1.5
        },
        "mixing": {
            "vocal_level": 1.2,
            "instrumental_level": -1.2
        }
    },
    
    "travis_atmospheric": {
        "name": "Travis Scott",
        "description": "Dark, atmospheric, heavy reverb - Travis style",
        "genre": "Hip-Hop/Trap",
        "eq": {
            "low_shelf_freq": 200,
            "low_shelf_gain": -5.5,
            "mid_freq": 2400,
            "mid_gain": 5.5,
            "mid_q": 1.3,
            "high_shelf_freq": 8000,
            "high_shelf_gain": 8.5
        },
        "deesser": {
            "enabled": True,
            "threshold": -12.0
        },
        "compression": [
            {
                "threshold": -17.0,
                "ratio": 6.5,
                "attack": 0.0005,
                "release": 0.07,
                "makeup_gain": 4.5
            },
            {
                "threshold": -11.0,
                "ratio": 4.0,
                "attack": 0.001,
                "release": 0.1,
                "makeup_gain": 2.5
            }
        ],
        "saturation": {
            "enabled": True,
            "drive": 3.5
        },
        "reverb": {
            "enabled": True,
            "room_size": 0.95,  # Very large, atmospheric
            "damping": 0.5,
            "intensity": 0.35  # More reverb for atmosphere
        },
        "delay": {
            "enabled": True,
            "time": None,
            "note_division": 0.5,  # Half note for spacing
            "feedback": 0.4,
            "intensity": 0.3  # More prominent delay
        },
        "final_eq": {
            "high_shelf_freq": 10000,
            "high_shelf_gain": 2.5,
            "mid_freq": 3200,
            "mid_gain": 1.5,
            "mid_q": 1.5
        },
        "mixing": {
            "vocal_level": 0.8,
            "instrumental_level": -0.8
        }
    },
    
    "post_malone": {
        "name": "Post Malone",
        "description": "Warm, polished, modern - Post Malone style",
        "genre": "Hip-Hop/R&B",
        "eq": {
            "low_shelf_freq": 200,
            "low_shelf_gain": -5.5,
            "mid_freq": 2500,
            "mid_gain": 6.0,
            "mid_q": 1.2,
            "high_shelf_freq": 8500,
            "high_shelf_gain": 9.0
        },
        "deesser": {
            "enabled": True,
            "threshold": -12.0
        },
        "compression": [
            {
                "threshold": -16.0,
                "ratio": 6.0,
                "attack": 0.0005,
                "release": 0.08,
                "makeup_gain": 4.5
            },
            {
                "threshold": -10.0,
                "ratio": 4.0,
                "attack": 0.001,
                "release": 0.11,
                "makeup_gain": 2.8
            }
        ],
        "saturation": {
            "enabled": True,
            "drive": 3.8
        },
        "reverb": {
            "enabled": True,
            "room_size": 0.8,
            "damping": 0.6,
            "intensity": 0.28
        },
        "delay": {
            "enabled": True,
            "time": None,
            "note_division": 0.25,
            "feedback": 0.32,
            "intensity": 0.2
        },
        "final_eq": {
            "high_shelf_freq": 10000,
            "high_shelf_gain": 3.0,
            "mid_freq": 3400,
            "mid_gain": 1.8,
            "mid_q": 1.5
        },
        "mixing": {
            "vocal_level": 1.0,
            "instrumental_level": -1.0
        }
    }
}


def get_preset(preset_id: str) -> dict:
    """
    Get preset configuration by ID
    
    Args:
        preset_id: Preset identifier
        
    Returns:
        Preset configuration dictionary
    """
    return PRESETS.get(preset_id, PRESETS["nav_polished"])


def list_presets() -> list:
    """
    Get list of all available presets
    
    Returns:
        List of preset dictionaries with id, name, description, genre
    """
    return [
        {
            "id": preset_id,
            "name": preset["name"],
            "description": preset["description"],
            "genre": preset["genre"]
        }
        for preset_id, preset in PRESETS.items()
    ]


def apply_user_parameters(preset: dict, reverb_intensity: float = None,
                         delay_time: float = None, delay_intensity: float = None,
                         bpm: float = None) -> dict:
    """
    Apply user-controlled parameters to preset
    
    Args:
        preset: Base preset configuration
        reverb_intensity: Reverb intensity (0.0 to 1.0)
        delay_time: Delay time in seconds (or None to calculate from BPM)
        delay_intensity: Delay intensity (0.0 to 1.0)
        bpm: BPM for tempo-synced delay
        
    Returns:
        Modified preset configuration
    """
    modified_preset = preset.copy()
    
    # Apply reverb intensity
    if reverb_intensity is not None:
        if "reverb" in modified_preset:
            modified_preset["reverb"]["intensity"] = max(0.0, min(1.0, reverb_intensity))
    
    # Calculate delay time from BPM if provided
    if bpm is not None and delay_time is None:
        # Get note division from preset (1/4 or 1/2 note)
        note_division = modified_preset.get("delay", {}).get("note_division", 0.25)
        delay_time = 60.0 / bpm * note_division
    
    # Apply delay parameters
    if delay_time is not None:
        if "delay" in modified_preset:
            modified_preset["delay"]["time"] = delay_time
    
    if delay_intensity is not None:
        if "delay" in modified_preset:
            modified_preset["delay"]["intensity"] = max(0.0, min(1.0, delay_intensity))
    
    return modified_preset
