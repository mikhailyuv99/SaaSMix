# Effets SNEX pour HISE – code à coller dans un snex_node

Dans HISE : **Script FX** → ouvre le graph ScriptNode → ajoute un noeud **snex** (cherche "snex" dans le popup) → double-clic sur le noeud → colle le code dans l’éditeur SNEX. Ajoute les **parameters** dans le noeud (Gain, Drive, etc.) puis connecte-les aux contrôles.

**Si l’éditeur SNEX ne s’ouvre pas :** (1) Double-clic sur le **corps** du noeud (pas seulement l’icône). (2) Ouvrir le **dropdown** sur le snex_node et créer/sélectionner un fichier script si proposé. (3) Charger un **snippet** SNEX (Snippet Browser → ex. « SNEX Bufferstop » ou « SNEX One pole filter »), ouvrir le code de ce noeud, puis remplacer par ton code. (4) Essayer un noeud **core.jit** à la place du snex_node (Add node → chercher « jit »).

La signature exacte (`ProcessData`, accès aux canaux) peut varier selon la version de HISE ; si ça ne compile pas, vérifie la doc : https://docs.hise.dev/scriptnode/manual/snex.html et https://docs.hise.audio/scriptnode/snex_api/node_types/snex_node.html

---

## 1. Gain (dB)

Un seul paramètre : **Gain** (en dB). Sortie = entrée × gain linéaire.

```snex
// Parameter 0 = Gain (dB)
double gainDb = 0.0;
float gainLinear = 1.0f;

template<int P> void setParameter(double v)
{
    if (P == 0)
    {
        gainDb = v;
        gainLinear = (float)Math.pow(10.0, v / 20.0);
    }
}

void reset()
{
}

template<int NV> void process(ProcessData<NV>& data)
{
    for (int ch = 0; ch < NV; ch++)
    {
        for (auto& s : data[ch])
            s *= gainLinear;
    }
}
```

**Dans HISE :** ajoute un paramètre au snex_node (index 0), nomme-le "Gain", range par ex. -100 à +24 dB.

---

## 2. Saturation (soft clip)

Deux paramètres : **Drive** (0…1 ou plus), **OutputGain** (dB). Sortie = gain de sortie × tanh(entrée × drive).

```snex
// Parameter 0 = Drive (0..2 typical), Parameter 1 = OutputGain (dB)
double drive = 1.0;
float outGainLinear = 1.0f;

template<int P> void setParameter(double v)
{
    if (P == 0) drive = v;
    if (P == 1) outGainLinear = (float)Math.pow(10.0, v / 20.0);
}

void reset()
{
}

template<int NV> void process(ProcessData<NV>& data)
{
    for (int ch = 0; ch < NV; ch++)
    {
        for (auto& s : data[ch])
            s = outGainLinear * (float)Math.tanh(s * drive);
    }
}
```

**Dans HISE :** paramètre 0 = Drive (0…2), paramètre 1 = OutputGain (-24…0 dB par ex.).

---

## 3. One-pole low-pass (simple filtre)

Un paramètre : **Freq** (Hz). Filtre low-pass du premier ordre (réponse douce).

```snex
// Parameter 0 = Freq (Hz)
double freq = 1000.0;
float coeff = 0.5f;  // will be set in prepare/setParameter
float state0 = 0.0f;
float state1 = 0.0f;

void prepare(PrepareSpecs ps)
{
    // coeff = exp(-2*pi*freq/sampleRate) for one-pole
    double sr = ps.sampleRate;
    coeff = (float)Math.exp(-2.0 * 3.14159265358979 * freq / sr);
}

template<int P> void setParameter(double v)
{
    if (P == 0)
    {
        freq = v;
        double sr = 44100.0;  // fallback; prepare() will set real SR
        coeff = (float)Math.exp(-2.0 * 3.14159265358979 * freq / sr);
    }
}

void reset()
{
    state0 = 0.0f;
    state1 = 0.0f;
}

template<int NV> void process(ProcessData<NV>& data)
{
    for (int ch = 0; ch < NV; ch++)
    {
        float state = (ch == 0) ? state0 : state1;
        for (auto& s : data[ch])
        {
            state = coeff * state + (1.0f - coeff) * s;
            s = state;
        }
        if (ch == 0) state0 = state; else state1 = state;
    }
}
```

**Dans HISE :** paramètre 0 = Freq (20…20000 Hz). Pour un HPF one-pole, on peut faire : `s = input - state` (high-pass = input - low-pass).

---

## 4. Comment utiliser dans HISE

1. **FX** → **Create new Processor** → **Script FX** → renomme (ex. "VocalChain").
2. Double-clic sur le Script FX → ouvre le **ScriptNode graph**.
3. Dans le graph, **Add node** → cherche **"snex"** → ajoute un **snex** (ou **snex_node**).
4. Double-clic sur le noeud snex → éditeur **SNEX** s’ouvre.
5. **Colle** l’un des codes ci-dessus (Gain, Saturation ou One-pole).
6. Dans le noeud snex, **ajoute les parameters** (clic + ou menu) : index 0 = Gain ou Drive, index 1 = OutputGain si besoin. Donne-leur un nom et un range.
7. **Câble** : entrée du graph → entrée du snex → sortie du snex → sortie du graph.
8. **Compile** (icône compile dans l’éditeur SNEX). Si erreur, vérifie la doc (accès à `data[ch]`, type `ProcessData`, etc.).
9. Expose les paramètres en **Main parameters** du Script FX et relie-les à l’interface ou au script HISE.

Si ta version de HISE utilise `processFrame(span<float,N>& frame)` au lieu de `process(ProcessData<NV>& data)`, il faudra adapter : une boucle sur le nombre de samples et lire/écrire `frame[0]`, `frame[1]` par frame. La doc et le SNEX Playground (Tools → SNEX Playground) permettent de valider la syntaxe et les callbacks.
