# Script FX in HISE – build your vocal chain in ScriptNode

In HISE, **Script FX** = a **ScriptNode graph** (visual DSP network). You don't write "onProcess(samples)" in JavaScript; you add **nodes** (gain, filter, compressor, etc.) in the graph and connect them. This guide tells you which nodes to add and in what order so you can recreate your PLUGINS.txt chain inside **one** Script FX.

---

## 1. Add a Script FX module

- In the **FX** section of your Sampler (or Master Chain), click **+** → **Create new Processor** → **Script FX**.
- Rename it (e.g. "VocalChain").
- Double‑click the Script FX (or click "Edit" / the graph icon) to open the **ScriptNode graph**.

---

## 2. Build the chain in the graph

In the graph you add nodes by **searching** in the "Add Node" popup and clicking to place them. Order = signal flow: **input → … → output**.

Suggested order (same as HISE_RECREATE_PLUGINS.txt):

| Step | Node to search | Role | Main params (from PLUGINS.txt) |
|------|----------------|------|-------------------------------|
| 1 | **gain** (core.gain) | Trim input | Gain 0 dB (or -26.9 for CLA input) |
| 2 | **filter** / **biquad** | HPF + bands (first EQ) | HPF 127 Hz Q 12, then bands 153/-2.9, 246/-3.4, 456/-2.6, 4034/-4, 10561/+7 |
| 3 | **comp** (dynamics) | CLA-76 style | Threshold/input -26.9, output -18, attack 2.1 ms, release 7 ms, ratio 4 |
| 4 | **comp** (dynamics) | RVOX style | Comp -7, Gain -3.3 |
| 5 | **comp** (dynamics) | R Comp style | Thresh -20.5, ratio 1.69, attack 4.65, release 57.6 |
| 6 | **saturator** / **waveshaper** / **shape** | Saturn 2 style | Drive ~18.5%, warm curve |
| 7 | **filter** / **biquad** | Second EQ | HPF 137 Q12, bands 141/-3.9, 392/-3, 5620/-2.7, 9390/+5.1 |
| 8 | **filter** / **biquad** (or dynamic band) | De-esser (Pro-DS) | 5.7–16 kHz, threshold -44, range +10 dB |

**How to add a node**

- Click in the graph → search bar appears.
- Type the name (e.g. `gain`, `filter`, `comp`, `dynamics`, `biquad`, `saturator`, `shape`).
- Click the node you want → it’s added. Drag it and **connect** output of previous node to input of next (cables).

**Input / output**

- The graph has a default **input** and **output**. Connect the first node’s input to the graph input, and the last node’s output to the graph output.

If a node type doesn’t exist (e.g. “saturator”), search for **shape**, **waveshaper**, **distortion**, or use a **math** node (e.g. tanh for soft clip). Docs: https://docs.hise.dev/scriptnode/list/

---

## 3. Expose parameters (Main parameters)

- In the ScriptNode editor, open the **parameter bar** (small knob icon at the top).
- Click **+** to add a **Main parameter** (e.g. Gain, Threshold1, Ratio1, Attack1, Release1, Drive, etc.).
- In **connect** mode (target icon), drag from the **control** (the main parameter) to the **parameter** of the node (e.g. Gain of core.gain, Threshold of comp).
- Use the **range editor** (icon next to the parameter) to set min/max (e.g. Gain -100 to +24 dB, Threshold -60 to 0 dB).

Then you can either link these to the plugin GUI (sliders) or control them from script (see below).

---

## 4. Link GUI to Script FX (HISE script)

In the **Script Editor** (e.g. for the Interface or the Synth), you reference the Script FX and set its parameters from UI. Example (one gain + one compressor threshold):

```javascript
// Replace "VocalChain" with your Script FX module name
const var VocalChain = Synth.getEffect("VocalChain");

// If your Main parameters are named Gain, Threshold1, Ratio1, etc.:
inline function onGainControl(component, value)
{
    VocalChain.setAttribute(VocalChain.Gain, value);
};
inline function onThresholdControl(component, value)
{
    VocalChain.setAttribute(VocalChain.Threshold1, value);
};

// Link to your UI components (replace "knobGain", "knobThreshold" with your slider/knob IDs)
Content.getComponent("knobGain").setControlCallback(onGainControl);
Content.getComponent("knobThreshold").setControlCallback(onThresholdControl);
```

**Finding parameter IDs**

- In the ScriptNode graph, Main parameters get an **ID** (e.g. `Gain`, `Threshold1`). Use that ID in `VocalChain.Gain`, `VocalChain.Threshold1`, etc. You can also list them via the API if available (e.g. inspect the effect’s attributes).

---

## 5. Summary

- **Script FX** = ScriptNode **graph** (no raw sample-loop script).
- You **add nodes** (gain, filter, comp, saturator, etc.) and **cable** them in order.
- You **expose** Main parameters and **link** them to the GUI or script.
- I can’t paste the graph itself; you build it in HISE following this order and the values from PLUGINS.txt / HISE_RECREATE_PLUGINS.txt.

If you tell me your exact Script FX name and the names of your Main parameters (e.g. Gain, Threshold1, Ratio1, Drive), I can give you a ready‑to‑paste script block that connects all your knobs to the Script FX.
