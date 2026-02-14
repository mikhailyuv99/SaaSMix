"use client";

export function PageBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black" aria-hidden>
      {/* Rendu 2× pour limiter la pixelisation (flou calculé en haute résolution puis redimensionné) */}
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
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          style={{ imageRendering: "auto" }}
        >
          <defs>
            <linearGradient id="curve-dark-left" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(18,18,22,0.95)" />
              <stop offset="35%" stopColor="rgba(45,46,52,0.5)" />
              <stop offset="100%" stopColor="rgba(255,252,255,0.07)" />
            </linearGradient>
            <linearGradient id="curve-dark-right" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(14,14,18,0.92)" />
              <stop offset="50%" stopColor="rgba(38,40,46,0.45)" />
              <stop offset="100%" stopColor="rgba(255,252,255,0.08)" />
            </linearGradient>
            <linearGradient id="curve-soft" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(10,10,14,0.9)" />
              <stop offset="100%" stopColor="rgba(255,252,255,0.05)" />
            </linearGradient>
            <linearGradient id="curve-edge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,252,255,0.06)" />
              <stop offset="50%" stopColor="rgba(28,30,35,0.5)" />
              <stop offset="100%" stopColor="rgba(12,12,16,0.92)" />
            </linearGradient>
            {/* Flou haute qualité : zone large + interpolation sRGB */}
            <filter
              id="blur-deep"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="26" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
              </feMerge>
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="#000" />

          <g filter="url(#blur-deep)" shapeRendering="geometricPrecision">
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
        </svg>
      </div>
    </div>
  );
}
