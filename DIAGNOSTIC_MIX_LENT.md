# Diagnostic : pourquoi le mix est lent maintenant (alors qu’il était rapide il y a 2 jours)

**Objectif :** identifier la cause exacte sans modifier le code.

---

## 1. Parcours complet du mix (où le temps peut être perdu)

| Phase | Ce qui se passe | Où ça peut ralentir |
|-------|-----------------|---------------------|
| **1. Upload** | Envoi du WAV vocal vers le serveur | Connexion upload de l’utilisateur |
| **2. Mix (traitement)** | `render_chain_b` + HISE VST3 sur le serveur | CPU, priorité du process, disque |
| **3. Poll status** | Le frontend interroge `/api/track/mix/status` toutes les 500 ms | Réseau (léger) |
| **4. Fetch piste mixée** | Le frontend récupère le WAV mixé pour la lecture | Réseau (download) |
| **5. Render mix** | Assemblage des pistes en un seul WAV | CPU, disque |
| **6. Master** | `hise_master_only` (VST3 master) | CPU, priorité |
| **7. Fetch mix + master** | Le frontend récupère les 2 WAV pour la lecture | Réseau (download) |
| **8. Download** | Clic sur « Télécharger » → récupération du WAV | Réseau (download) |

---

## 2. Causes possibles (par phase)

### Phase 2 & 6 — Traitement (CPU / priorité)

Le code indique explicitement :

- **mix_chain_b.py** : *« évite 2m40 quand le service tourne en basse priorité »*
- **main.py** : *« priorité Haute pour tout le process backend (mixes stables ~35s, pas 1m35 au hasard) »*

Si la priorité n’est pas appliquée ou est écrasée, le mix peut passer de ~30 s à **2m40**.

**Causes possibles :**

1. **Priorité du service NSSM** : le service tourne en priorité normale ou basse.
2. **Autre process** : un autre programme consomme le CPU pendant le mix.
3. **Redémarrage / mise à jour Windows** : changement de config ou de charge.
4. **Priorité non appliquée** : `SetPriorityClass` échoue (droits, timing).

---

### Phase 4, 7, 8 — Réseau (download)

**Causes possibles :**

1. **Connexion utilisateur** : débit limité (peu probable si ça marchait bien avant).
2. **Chemin réseau** : congestion ou mauvais routage entre le VPS et l’utilisateur.
3. **Bande passante du VPS** : autre service ou autre utilisateur qui sature l’upload.
4. **Caddy / reverse proxy** : buffering ou timeout.
5. **OVH** : incident ou throttling côté hébergeur.

---

### Phase 1 — Upload

**Causes possibles :**

1. Connexion upload lente.
2. Serveur surchargé (trop de requêtes simultanées).

---

## 3. Diagnostic côté serveur (VPS)

### 3.1 Priorité du service

Vérifier la priorité actuelle du service :

```powershell
# Lister les processus Python/uvicorn du backend
Get-Process | Where-Object { $_.ProcessName -like "*python*" -or $_.ProcessName -like "*uvicorn*" } | Select-Object Id, ProcessName, CPU, @{N='Priority';E={
    try {
        $h = (Add-Type -MemberDefinition @"
[DllImport("kernel32.dll")]
public static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);
[DllImport("kernel32.dll")]
public static extern bool GetPriorityClass(IntPtr hProcess, out uint lpPriorityClass);
"@ -Name Win32 -PassThru)::OpenProcess(0x1000, $false, $_.Id)
        if ($h -ne [IntPtr]::Zero) {
            $p = 0
            [void](Add-Type -MemberDefinition @"
[DllImport("kernel32.dll")]
public static extern bool GetPriorityClass(IntPtr hProcess, out uint lpPriorityClass);
"@ -Name Win32P -PassThru)::GetPriorityClass($h, [ref]$p)
            switch ($p) { 0x80 { "High" } 0x40 { "AboveNormal" } 0x20 { "Normal" } 0x4000 { "BelowNormal" } default { "?" } }
        }
    } catch { "?" }
}}
```

Ou via **Gestionnaire des tâches** : Onglet Détails → clic droit sur `python.exe` → Définir la priorité. Si c’est « Normal » ou « Inférieure à la normale », c’est suspect.

**Forcer la priorité haute via NSSM :**

```powershell
$nssm = "C:\nssm\nssm-2.24\win64\nssm.exe"  # Adapter si chemin différent

# Forcer priorité Haute pour prod et staging
& $nssm set SaasMixBackend AppPriority HIGH_PRIORITY_CLASS
& $nssm set SaasMixBackendStaging AppPriority HIGH_PRIORITY_CLASS

# Redémarrer pour appliquer
Restart-Service SaasMixBackend
Restart-Service SaasMixBackendStaging
```

---

### 3.2 Charge CPU pendant un mix

Pendant qu’un mix tourne :

```powershell
# Top 10 processus par CPU
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Id, ProcessName, CPU, WorkingSet64
```

Vérifier si `hise_vst3_host.exe` ou `python.exe` sont bien en tête et si un autre process ne monopolise pas le CPU.

---

### 3.3 Bande passante / réseau

```powershell
# Statistiques réseau (résumé)
Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes
```

Faire un mix, puis relancer la commande pour voir l’évolution de `SentBytes` (upload).

---

### 3.4 Dossier temporaire (disque)

Les WAV sont écrits dans `tempfile.gettempdir()`. Pour un service Windows, c’est souvent `C:\Windows\Temp` ou `C:\Users\Default\AppData\Local\Temp`.

```powershell
# Vérifier l’espace disque
Get-PSDrive C | Select-Object Used, Free

# Dossiers utilisés par le backend
dir "$env:TEMP\saas_mix_mixed" 2>$null
dir "$env:TEMP\saas_mix_render" 2>$null
```

Si le disque est plein ou très lent, ça peut ralentir les écritures.

---

### 3.5 Jobs en attente

Si plusieurs mixes sont lancés en parallèle, ils sont limités à 4 (MAX_CONCURRENT_MIX_JOBS). Les suivants attendent en file.

Vérifier dans les logs backend s’il y a beaucoup de jobs en attente (pas de log dédié dans le code actuel, mais tu peux ajouter un endpoint debug temporaire si besoin).

---

## 4. Diagnostic côté client (ta machine)

### 4.1 Où ça bloque exactement ?

En faisant un mix, note à quel moment ça semble lent :

- **Barre de progression du mix** qui avance très lentement → Phase 2 (traitement).
- **Barre à 100 %** mais la lecture ne démarre pas longtemps → Phase 4 (fetch piste mixée).
- **Master** qui met du temps à s’afficher → Phase 5–6 (render/master) ou Phase 7 (fetch).
- **Téléchargement** qui dure longtemps → Phase 8 (download).

---

### 4.2 Test réseau direct

Depuis ton PC, tester le débit de download :

```powershell
# Télécharger un fichier de test depuis l’API (remplace ID par un vrai mixed_id ou render id)
$url = "https://api-staging.siberiamix.com/api/download/mixed-track?id=REMPLACER_PAR_UN_UUID_VALIDE"
Measure-Command { Invoke-WebRequest -Uri $url -OutFile "test.wav" -UseBasicParsing }
```

Ou avec curl :

```powershell
curl -o test.wav -w "Temps: %{time_total}s, Taille: %{size_download} bytes\n" "https://api-staging.siberiamix.com/api/download/mixed-track?id=UUID"
```

Si le temps est très long (ex. > 60 s pour ~20 Mo), le problème est bien le download.

---

### 4.3 Test depuis un autre réseau

Tester depuis le partage de connexion 4G ou un autre WiFi. Si c’est rapide ailleurs, le blocage est lié à ta connexion ou au chemin réseau vers le VPS.

---

## 5. Checklist rapide

| # | Vérification | Commande / action |
|---|--------------|-------------------|
| 1 | Priorité du service | `nssm set SaasMixBackend AppPriority HIGH_PRIORITY_CLASS` puis redémarrer |
| 2 | Charge CPU pendant un mix | `Get-Process \| Sort-Object CPU -Desc` pendant un mix |
| 3 | Espace disque | `Get-PSDrive C` |
| 4 | Temp du backend | `dir $env:TEMP\saas_mix_*` |
| 5 | Test download direct | `Measure-Command { Invoke-WebRequest ... }` |
| 6 | Test autre réseau | 4G ou autre WiFi |

---

## 6. Hypothèse la plus probable

Vu le code et les commentaires :

- **Si la lenteur est pendant la barre de progression du mix** → priorité du process (NSSM ou autre process qui prend le CPU).
- **Si la lenteur est après 100 % (lecture ou téléchargement)** → réseau (download).

Action prioritaire : forcer `nssm set SaasMixBackend AppPriority HIGH_PRIORITY_CLASS` (et staging si tu testes dessus), redémarrer, puis refaire un mix.
