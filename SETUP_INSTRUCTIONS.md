# Setup Instructions

## Quick Test Setup (Minimal)

To quickly test if everything works, we'll install just the basics first.

### Backend Setup (Python)

1. **Navigate to backend folder:**
   ```powershell
   cd "c:\Users\mikha\Desktop\SaaS Mix\backend"
   ```

2. **Activate virtual environment:**
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

3. **Install minimal packages (for testing):**
   ```powershell
   pip install -r requirements-minimal.txt
   ```

4. **Run the server:**
   ```powershell
   uvicorn main:app --reload
   ```

5. **Test it:**
   - Open browser: http://localhost:8000
   - API docs: http://localhost:8000/docs

### Frontend Setup (Node.js)

**First, install Node.js:**
1. Go to: https://nodejs.org/
2. Download the LTS version (recommended)
3. Install it (just click through the installer)
4. Restart your terminal/PowerShell

**Then setup frontend:**
1. **Navigate to frontend folder:**
   ```powershell
   cd "c:\Users\mikha\Desktop\SaaS Mix\frontend"
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Run the frontend:**
   ```powershell
   npm run dev
   ```

4. **Open browser:**
   - http://localhost:3000

## Full Setup (All Packages)

Once the minimal test works, install all packages:

```powershell
cd "c:\Users\mikha\Desktop\SaaS Mix\backend"
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

This will take 5-10 minutes as it downloads large packages like PyTorch.
