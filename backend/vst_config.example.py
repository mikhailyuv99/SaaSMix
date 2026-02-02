# Copie ce fichier en vst_config.py et remplis les chemins vers tes .vst3 (ou .vst)
# Windows : C:\\Program Files\\Common Files\\VST3\\NomPlugin.vst3
#          ou C:\\Program Files\\Waves\\Plug-Ins V14\\...
# Mac : /Library/Audio/Plug-Ins/VST3/NomPlugin.vst3
#
# Pour lister les paramètres d'un plugin : python -c "from vst_preset_chain import *; from vst_config import VST_PATHS; from pedalboard import load_plugin; p=load_plugin(VST_PATHS['pro_q4']); print(list(p.parameters.keys()))"

VST_PATHS = {
    # LEAD 1
    "autotune_pro": "",  # Antares Auto-Tune Pro (si VST)
    
    # LEAD 2 - Waves
    "dereverb_pro_mono": "",   # Waves DeReverb
    "nls_channel_mono": "",   # Waves NLS Channel
    "r_deesser_mono": "",     # Waves R Deesser
    "f6_rta_mono": "",       # Waves F6 RTA
    "cla_76_mono": "",       # Waves CLA-76
    "rvox_mono": "",         # Waves R-Vox
    "r_compressor_mono": "", # Waves R Compressor
    "saturn_2": "",          # FabFilter Saturn 2
    "pro_ds": "",            # FabFilter Pro-DS
    "pro_q4": "",            # FabFilter Pro-Q 4
    
    # PCOMP - (Fruity Chorus, Limiter, Flanger = natifs FL, pas de VST)
    "r_compressor_mono_pcomp": "",  # même que R Compressor ou autre instance
    "r_vox_mono_pcomp": "",
    "doubler2_stereo": "",   # Waves Doubler
    "sa_imager_stereo": "",  # Waves / Soundtoys SA Imager
    
    # DELAY
    "timeless_3": "",        # FabFilter Timeless 3
    
    # VERB
    "valhalla_vintage_verb": "",  # Valhalla Vintage Verb
    
    # NLS stereo (plusieurs chains)
    "nls_channel_stereo": "",
}

# Sample rate pour tout le traitement (doit matcher tes fichiers)
SAMPLE_RATE = 48000
