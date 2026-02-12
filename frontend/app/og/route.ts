import { NextRequest } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://siberiamix.com";
// Lighter image for crawlers (keep under ~200KB so Instagram mobile loads it)
const OG_IMAGE_URL = `${SITE_URL.replace(/\/$/, "")}/logo-og.png`;

/**
 * Serves minimal HTML with only Open Graph / Twitter meta tags.
 * Used when Facebook/Instagram crawler requests the homepage so they get
 * a guaranteed 200 response and correct preview image (avoids 206 issues).
 */
export function GET(request: NextRequest) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE_URL}/" />
  <meta property="og:title" content="SIBERIA MIX | MIX VOCAL EN LIGNE" />
  <meta property="og:description" content="Logiciel de mix vocal en ligne. Stems + instrumental, mix + master en quelques secondes pour les artistes indépendants. 0 ingé son, 0 plugin, tout se fait en ligne!" />
  <meta property="og:image" content="${OG_IMAGE_URL}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:image:alt" content="Siberia Mix" />
  <meta property="og:site_name" content="Siberia Mix" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="SIBERIA MIX | MIX VOCAL EN LIGNE" />
  <meta name="twitter:description" content="Logiciel de mix vocal en ligne. Stems + instrumental, mix + master en quelques secondes pour les artistes indépendants. 0 ingé son, 0 plugin, tout se fait en ligne!" />
  <meta name="twitter:image" content="${OG_IMAGE_URL}" />
  <title>SIBERIA MIX | MIX VOCAL EN LIGNE</title>
  <meta http-equiv="refresh" content="0;url=${SITE_URL}/" />
</head>
<body><p>Redirecting to <a href="${SITE_URL}/">Siberia Mix</a>...</p></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
