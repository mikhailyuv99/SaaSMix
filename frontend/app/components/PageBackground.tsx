"use client";

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
        filter: "blur(6px)",
        transform: "scale(1.08)",
        transformOrigin: "center center",
      }}
    />
  );
}
