export interface PredictAuthEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_ALLOWED_EMAIL?: string;
  PREDICT_SECRET?: string;
}

type AccessExecutionContext = ExecutionContext & {
  access?: {
    getIdentity?: () => Promise<{ email?: string } | undefined>;
  };
};

function b64urlToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function emailAllowed(email: string | undefined, env: PredictAuthEnv): boolean {
  if (!email) return false;
  const allow = env.CF_ACCESS_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allow) return true;
  return email.toLowerCase() === allow;
}

function getAccessJwt(req: Request): string | null {
  const header = req.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header;
  const cookie = req.headers.get("Cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** `/run` と `/seed`・`/kick` など Access アプリが複数あるときはカンマ区切り */
export function configuredAccessAuds(env: PredictAuthEnv): string[] {
  return (env.CF_ACCESS_AUD ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function audMatches(payloadAud: string | string[] | undefined, allowed: string[]): boolean {
  if (!payloadAud || allowed.length === 0) return false;
  const presented = Array.isArray(payloadAud) ? payloadAud : [payloadAud];
  return allowed.some((a) => presented.includes(a));
}

async function verifyAccessJwt(
  token: string,
  env: PredictAuthEnv
): Promise<{ email?: string } | null> {
  const team = env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  const allowedAuds = configuredAccessAuds(env);
  if (!team || allowedAuds.length === 0) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header: { alg?: string; kid?: string };
  let payload: { aud?: string | string[]; email?: string; exp?: number; iss?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }

  if (header.alg !== "RS256") return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;

  if (!audMatches(payload.aud, allowedAuds)) return null;

  if (payload.iss && payload.iss.replace(/\/$/, "") !== team) return null;

  const certsRes = await fetch(`${team}/cdn-cgi/access/certs`);
  if (!certsRes.ok) return null;
  const certs = (await certsRes.json()) as { keys?: JsonWebKey[] };
  const jwk = certs.keys?.find((k) => (k as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]) as BufferSource,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) return null;
  return { email: payload.email };
}

function bearerToken(req: Request): string | null {
  const raw = req.headers.get("Authorization");
  if (!raw?.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

export function predictAuthConfigured(env: PredictAuthEnv): boolean {
  const accessReady = Boolean(env.CF_ACCESS_TEAM_DOMAIN?.trim() && configuredAccessAuds(env).length > 0);
  const secretReady = Boolean(env.PREDICT_SECRET?.trim());
  return accessReady || secretReady;
}

/**
 * `/run`・`/kick`・`/verify`・`/seed` を通してよければ null。拒否なら Response。
 * Access 未設定のまま公開しない。
 */
export async function authorizePredict(
  req: Request,
  env: PredictAuthEnv,
  ctx: AccessExecutionContext
): Promise<Response | null> {
  try {
    const identity = await ctx.access?.getIdentity?.();
    if (identity?.email && emailAllowed(identity.email, env)) {
      return null;
    }
  } catch {
    // Access 未接続なら identity API は失敗しうる
  }

  const jwt = getAccessJwt(req);
  if (jwt && env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
    const identity = await verifyAccessJwt(jwt, env);
    if (identity && emailAllowed(identity.email, env)) {
      return null;
    }
  }

  const secret = env.PREDICT_SECRET?.trim();
  const presented = bearerToken(req);
  if (secret && presented && presented === secret) {
    return null;
  }

  if (!predictAuthConfigured(env)) {
    return new Response(
      "予想の実行は未設定です。Cloudflare Access（CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD）か PREDICT_SECRET を入れてください。\n",
      { status: 503 }
    );
  }

  return new Response("Unauthorized\n", {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" }
  });
}
