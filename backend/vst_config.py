# Chemins VST trouvés sur ta machine (C:\Program Files\Common Files\VST3\...)
# Waves = WaveShell (un seul .vst3 contient tous les plugins Waves ; il faudra peut-etre choisir le plugin par nom/index)

VST3 = r"C:\Program Files\Common Files\VST3"

VST_PATHS = {
    # Plugin HISE (chaîne vocal principale) – GlobalMix remplace Project1
    "hise_vocal_chain": r"C:\Users\mikha\Desktop\HISE\Project1\Binaries\Compiled\VST3\Project1.vst3",
    "globalmix": r"C:\Users\mikha\Desktop\HISE\GlobalMix\Binaries\Compiled\VST3\GlobalMix.vst3",
    # EQ1–EQ9 (début de chaîne : Basses / Mids / Aigus)
    "eq1": r"C:\Users\mikha\Desktop\HISE\EQ1\Binaries\Compiled\VST3\EQ1.vst3",
    "eq2": r"C:\Users\mikha\Desktop\HISE\EQ2\Binaries\Compiled\VST3\EQ2.vst3",
    "eq3": r"C:\Users\mikha\Desktop\HISE\EQ3\Binaries\Compiled\VST3\EQ3.vst3",
    "eq4": r"C:\Users\mikha\Desktop\HISE\EQ4\Binaries\Compiled\VST3\EQ4.vst3",
    "eq5": r"C:\Users\mikha\Desktop\HISE\EQ5\Binaries\Compiled\VST3\EQ5.vst3",
    "eq6": r"C:\Users\mikha\Desktop\HISE\EQ6\Binaries\Compiled\VST3\EQ6.vst3",
    "eq7": r"C:\Users\mikha\Desktop\HISE\EQ7\Binaries\Compiled\VST3\EQ7.vst3",
    "eq8": r"C:\Users\mikha\Desktop\HISE\EQ8\Binaries\Compiled\VST3\EQ8.vst3",
    "eq9": r"C:\Users\mikha\Desktop\HISE\EQ9\Binaries\Compiled\VST3\EQ9.vst3",
    # Master HISE (limiter / glue, appliqué au mix final)
    "master": r"C:\Users\mikha\Desktop\HISE\master\Binaries\Compiled\VST3\master.vst3",
    # Reverb HISE (1=leger, 2=moyen défaut, 3=large) — chaque reverb a son projet HISE
    "reverb1": r"C:\Users\mikha\Desktop\HISE\reverb1\Binaries\Compiled\VST3\reverb1.vst3",
    "reverb2": r"C:\Users\mikha\Desktop\HISE\reverb2\Binaries\Compiled\VST3\reverb2.vst3",
    "reverb3": r"C:\Users\mikha\Desktop\HISE\reverb3new\Binaries\Compiled\VST3\reverb3new.vst3",
    "doubler": r"C:\Users\mikha\Desktop\HISE\doubler\Binaries\Compiled\VST3\doubler.vst3",
    "robot": r"C:\Users\mikha\Desktop\HISE\robot\Binaries\Compiled\VST3\robot.vst3",
    # LEAD 1
    "autotune_pro": VST3 + r"\Antares\Auto-Tune Pro.vst3",
    # LEAD 2 - Waves (via WaveShell ; Pedalboard charge le shell, les plugins Waves sont a l'interieur)
    "dereverb_pro_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "nls_channel_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "r_deesser_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "f6_rta_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "cla_76_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "rvox_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "r_compressor_mono": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    # FabFilter
    "saturn_2": VST3 + r"\FabFilter\FabFilter Saturn 2.vst3",
    "pro_ds": VST3 + r"\FabFilter\FabFilter Pro-DS.vst3",
    "pro_q4": VST3 + r"\FabFilter\FabFilter Pro-Q 4.vst3",
    # PCOMP (Fruity Chorus/Limiter/Flanger = pas de VST)
    "r_vox_mono_pcomp": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "doubler2_stereo": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    "sa_imager_stereo": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
    # DELAY
    "timeless_3": VST3 + r"\FabFilter\FabFilter Timeless 3.vst3",
    # VERB
    "valhalla_vintage_verb": VST3 + r"\ValhallaDSP\ValhallaVintageVerb.vst3",
    # NLS stereo
    "nls_channel_stereo": VST3 + r"\WaveShell1-VST3 16.2_x64.vst3",
}

# Noms exacts des plugins dans le WaveShell Waves (passer a load_plugin(..., plugin_name=...))
# Si une cle manque, tu auras une erreur qui liste les noms possibles.
WAVES_PLUGIN_NAMES = {
    "dereverb_pro_mono": "Clarity Vx - DeReverb Pro Mono",
    "nls_channel_mono": "NLS Channel Mono",
    "r_deesser_mono": "R Deesser Mono",
    "f6_rta_mono": "F6 RTA Mono",
    "cla_76_mono": "CLA-76 Mono",
    "rvox_mono": "R-Vox Mono",
    "r_compressor_mono": "R Compressor Mono",
    "r_vox_mono_pcomp": "R-Vox Mono",
    "doubler2_stereo": "Doubler2 Stereo",
    "sa_imager_stereo": "S1 Imager Stereo",
    "nls_channel_stereo": "NLS Channel Stereo",
}

SAMPLE_RATE = 48000
