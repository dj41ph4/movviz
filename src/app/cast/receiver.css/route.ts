import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Feuille de style du récepteur Google Cast aux couleurs de Movviz (« Styled
 * Media Receiver »). URL à donner dans la console Google Cast :
 * https://<votre domaine>/cast/receiver.css — puis MOVVIZ_CAST_APP_ID et
 * MOVVIZ_CAST_APP_PUBLISHED=1 une fois l'application publiée.
 *
 * Servie par une route (et non un fichier statique) pour écrire des URL
 * d'images ABSOLUES vers le domaine public : la doc Google ne garantit pas la
 * résolution des chemins relatifs. Publique : l'extension « .css » passe le
 * proxy d'authentification comme un fichier statique, et rien de privé n'y figure.
 * Classes reconnues : .background, .logo, .progressBar, .splash, .watermark.
 */
function origin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  const host = (req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || req.nextUrl.host).replace(/[^\w.:-]/g, "");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export function GET(req: NextRequest) {
  const o = origin(req);
  const css = `.background {
  background: #050816 radial-gradient(ellipse at 50% 35%, #142056 0%, #050816 70%);
}
.logo {
  background-image: url("${o}/brand/movviz-lockup.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  width: 40%;
}
.progressBar {
  background-color: #6d8cff;
}
.watermark {
  background-image: url("${o}/brand/movviz-mark.png");
  background-size: 48px 48px;
  background-repeat: no-repeat;
  background-position: right 32px bottom 32px;
  opacity: 0.35;
}
`;
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "private, max-age=3600", "access-control-allow-origin": "*" } });
}
