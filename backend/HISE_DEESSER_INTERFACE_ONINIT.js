/**
 * DEESSER – BRANCHEMENT VIA MACRO CONTROLS (pas de script)
 *
 * ÉTAPE 1 – Assigner chaque knob à un macro (propriété du knob)
 *   Dans l’Interface Designer, pour chaque knob :
 *   - Threshold  → propriété "Macro Control" (ou équivalent) = 0
 *   - Reduction  → = 1
 *   - FreqLow    → = 2
 *   - FreqHigh   → = 3
 *
 * ÉTAPE 2 – Connecter les macros aux paramètres du Script FX
 *   Dans HISE : clic sur l’icône Macro Controls (barre du haut).
 *   Pour chaque macro (0, 1, 2, 3) :
 *   - Clic sur l’icône "edit" du macro (crayon).
 *   - Dans le panneau de droite "Macro Edit Table" : Add / + .
 *   - Processor = "Script FX1" (ou le nom exact de ton Script FX).
 *   - Parameter = 0 pour macro 0, 1 pour macro 1, 2 pour macro 2, 3 pour macro 3.
 *   - Min/Max : Threshold/Reduction 0–1 ; FreqLow 1000–8000 ; FreqHigh 4000–15000.
 *
 * Aucun code dans onInit nécessaire.
 */
