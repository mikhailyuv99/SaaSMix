"use client";

export function PageBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black" aria-hidden>
      {/* Rendu 4× (viewBox 2400×1600) pour qualité haute résolution, puis scale 0.5 = 2× net */}
      <div
        className="absolute inset-0 w-[200%] h-[200%] origin-top-left"
        style={{
          transform: "scale(0.5)",
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 2400 1600"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          style={{ imageRendering: "auto", shapeRendering: "geometricPrecision" }}
        >
          <defs>
            <linearGradient id="curve-dark-left" x1="0%" y1="0%" x2="100%" y2="0%" colorInterpolation="sRGB">
              <stop offset="0%" stopColor="rgba(18,18,22,0.95)" />
              <stop offset="12%" stopColor="rgba(25,25,30,0.82)" />
              <stop offset="25%" stopColor="rgba(34,35,40,0.65)" />
              <stop offset="35%" stopColor="rgba(45,46,52,0.5)" />
              <stop offset="50%" stopColor="rgba(85,88,95,0.28)" />
              <stop offset="70%" stopColor="rgba(170,172,178,0.12)" />
              <stop offset="85%" stopColor="rgba(220,221,224,0.08)" />
              <stop offset="100%" stopColor="rgba(255,252,255,0.07)" />
            </linearGradient>
            <linearGradient id="curve-dark-right" x1="100%" y1="0%" x2="0%" y2="0%" colorInterpolation="sRGB">
              <stop offset="0%" stopColor="rgba(14,14,18,0.92)" />
              <stop offset="20%" stopColor="rgba(22,23,28,0.75)" />
              <stop offset="50%" stopColor="rgba(38,40,46,0.45)" />
              <stop offset="70%" stopColor="rgba(100,102,108,0.22)" />
              <stop offset="85%" stopColor="rgba(190,191,195,0.1)" />
              <stop offset="100%" stopColor="rgba(255,252,255,0.08)" />
            </linearGradient>
            <linearGradient id="curve-soft" x1="0%" y1="100%" x2="0%" y2="0%" colorInterpolation="sRGB">
              <stop offset="0%" stopColor="rgba(10,10,14,0.9)" />
              <stop offset="25%" stopColor="rgba(35,36,42,0.5)" />
              <stop offset="50%" stopColor="rgba(80,82,88,0.2)" />
              <stop offset="75%" stopColor="rgba(180,182,188,0.07)" />
              <stop offset="100%" stopColor="rgba(255,252,255,0.05)" />
            </linearGradient>
            <linearGradient id="curve-edge" x1="0%" y1="0%" x2="100%" y2="100%" colorInterpolation="sRGB">
              <stop offset="0%" stopColor="rgba(255,252,255,0.06)" />
              <stop offset="25%" stopColor="rgba(80,82,88,0.35)" />
              <stop offset="50%" stopColor="rgba(28,30,35,0.5)" />
              <stop offset="75%" stopColor="rgba(18,19,24,0.75)" />
              <stop offset="100%" stopColor="rgba(12,12,16,0.92)" />
            </linearGradient>
            {/* Flou haute qualité en 2× resolution */}
            <filter
              id="blur-deep"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="52" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
              </feMerge>
            </filter>
            {/* Bruit subtil pour supprimer le banding (rendu premium) */}
            <filter id="deband-noise" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.04" result="noiseAlpha" />
              <feBlend in="SourceGraphic" in2="noiseAlpha" mode="normal" result="debanded" />
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="#000" />

          <g filter="url(#blur-deep)" transform="scale(2)" transformOrigin="0 0">
            <g filter="url(#deband-noise)" shapeRendering="geometricPrecision">
            <path
              d="M -80 120 C 200 80 400 200 550 180 C 750 150 950 220 1100 200 C 1250 180 1350 240 1400 220 L 1400 280 C 1280 320 1050 280 900 300 C 700 330 400 280 180 320 C 0 350 -80 280 -80 220 Z"
              fill="url(#curve-dark-left)"
              opacity="0.95"
            />
            <path
              d="M 1300 -40 C 1150 100 1000 180 850 280 C 700 380 750 480 650 520 C 500 580 400 520 350 600 L 320 560 C 380 460 450 400 600 360 C 750 320 900 380 1050 300 C 1180 230 1280 80 1300 -40 Z"
              fill="url(#curve-dark-right)"
              opacity="0.9"
            />
            <path
              d="M -100 250 C 50 200 150 320 250 380 C 380 460 300 580 200 650 C 80 720 0 620 -50 500 C -80 420 -80 320 -100 250 Z"
              fill="url(#curve-soft)"
              opacity="0.85"
            />
            <path
              d="M -120 450 C 80 400 180 520 320 600 C 480 690 400 750 280 780 C 120 820 -60 720 -100 580 C -130 480 -120 450 -120 450 Z"
              fill="url(#curve-edge)"
              opacity="0.8"
            />
            <path
              d="M 400 300 C 600 260 800 320 950 380 C 1050 420 1000 500 900 520 C 750 550 550 480 400 420 C 280 370 280 320 400 300 Z"
              fill="url(#curve-soft)"
              opacity="0.35"
            />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
