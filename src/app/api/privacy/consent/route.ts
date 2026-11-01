import { NextRequest, NextResponse } from "next/server";
import { hasAnyUser } from "@/lib/auth/store";
import {
  PRIVACY_POLICY_VERSION,
  getInstanceConsent,
  hasCurrentInstanceConsent,
  privacyConsentRequired,
  recordInstanceConsent,
} from "@/lib/privacy/consent";

export const dynamic = "force-dynamic";

/** Public : l'écran de configuration et de connexion doivent le lire avant tout compte. */
export async function GET() {
  const instance = getInstanceConsent();
  return NextResponse.json({
    required: privacyConsentRequired(),
    version: PRIVACY_POLICY_VERSION,
    accepted: hasCurrentInstanceConsent(),
    acceptedAt: instance?.acceptedAt ?? null,
  });
}

/**
 * Enregistre l'acceptation faite à l'installation (avant le premier compte, par
 * exemple pour une connexion Plex). Refusé dès qu'un compte existe : un visiteur
 * anonyme ne peut pas réécrire la preuve d'une installation déjà configurée.
 */
export async function POST(req: NextRequest) {
  if (!privacyConsentRequired()) return NextResponse.json({ error: "not_required" }, { status: 400 });
  if (hasAnyUser()) return NextResponse.json({ error: "setup_completed" }, { status: 409 });
  const body = await req.json().catch(() => null);
  if (body?.accept !== true) return NextResponse.json({ error: "consent_required" }, { status: 400 });
  const record = recordInstanceConsent();
  return NextResponse.json({ ok: true, version: record.version, acceptedAt: record.acceptedAt });
}
