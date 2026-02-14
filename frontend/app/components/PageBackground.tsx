"use client";

/**
 * Background = image pré-rendue avec dither (Floyd-Steinberg) pour zéro banding
 * pour tous les utilisateurs, quel que soit l’écran (8-bit).
 * Pour régénérer l’image : npm run export-background (depuis frontend/)
 */
export function PageBackground() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black"
      aria-hidden
      style={{
        backgroundImage: "url(/background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
