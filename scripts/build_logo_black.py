"""
One-off script: take frontend/public/siberia-logo.png, put it on a black background,
output logo-black.png and favicon.ico to frontend/public/.
Requires: pip install Pillow
"""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Run: pip install Pillow")
    raise

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "frontend" / "public"
SRC = PUBLIC / "siberia-logo.png"
OUT_PNG = PUBLIC / "logo-black.png"
OUT_ICO = PUBLIC / "favicon.ico"

def main():
    if not SRC.exists():
        print(f"Logo not found: {SRC}")
        return
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    # Black background, same size
    black = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    black.paste(img, (0, 0), img if img.mode == "RGBA" else None)
    # Save PNG (for OG, icons)
    black.convert("RGB").save(OUT_PNG, "PNG")
    print(f"Saved {OUT_PNG}")
    # Favicon: 32x32 logo on black, save as ICO
    fav = black.resize((32, 32), Image.Resampling.LANCZOS)
    fav.save(OUT_ICO, format="ICO", sizes=[(32, 32)])
    print(f"Saved {OUT_ICO}")

if __name__ == "__main__":
    main()
