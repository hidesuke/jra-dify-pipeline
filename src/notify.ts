// 馬柱 URL 検証失敗時のメール通知（Resend HTTP API）。
//
// 必須シークレットが無い場合は送信せず console.warn のみ（投入フローは止めない）。
// 宛先は NOTIFY_EMAIL、未設定なら CF_ACCESS_ALLOWED_EMAIL を使う。

import type { RaceUrlCheck } from "./verifyRaceUrl";

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  /** 通知先。未設定時は CF_ACCESS_ALLOWED_EMAIL */
  NOTIFY_EMAIL?: string;
  CF_ACCESS_ALLOWED_EMAIL?: string;
  /** Resend の From。例: "JRA Pipeline <alerts@example.com>" */
  NOTIFY_FROM?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "jra-dify-pipeline <onboarding@resend.dev>";

export function resolveNotifyTo(env: NotifyEnv): string | null {
  const to = (env.NOTIFY_EMAIL ?? env.CF_ACCESS_ALLOWED_EMAIL)?.trim();
  return to || null;
}

export function notifyConfigured(env: NotifyEnv): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && resolveNotifyTo(env));
}

export function formatRaceUrlFailureEmail(params: {
  date: string;
  failures: RaceUrlCheck[];
}): { subject: string; text: string } {
  const { date, failures } = params;
  const venues = failures.map((f) => f.venueCode).join(",");
  const subject = `[jra-dify-pipeline] 馬柱URLエラー ${date} 場:${venues}`;
  const lines = [
    `対象日: ${date}`,
    `各場の 1R URL 検証でエラーを検出しました。`,
    ``,
    ...failures.flatMap((f) => [
      `--- 場 ${f.venueCode} ${f.raceNo}R (${f.kind}) ---`,
      `URL: ${f.url}`,
      `title: ${f.title ?? "(なし)"}`,
      `理由: ${f.reason ?? "(なし)"}`,
      ``,
    ]),
    `該当場のレースはキュー投入をスキップしています。`,
    `開催表（src/schedules）の回次・日次や PREFIX_CODE を確認してください。`,
  ];
  return { subject, text: lines.join("\n") };
}

/**
 * Resend でメール送信。未設定時は no-op（false）。
 * 送信失敗時は例外を投げず false を返す（呼び出し側でログ）。
 */
export async function sendNotifyEmail(
  env: NotifyEnv,
  mail: { subject: string; text: string },
  fetchImpl: FetchLike = fetch
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = resolveNotifyTo(env);
  if (!apiKey || !to) {
    console.warn(
      "Email notify skipped: set RESEND_API_KEY and NOTIFY_EMAIL (or CF_ACCESS_ALLOWED_EMAIL)"
    );
    return false;
  }

  const from = env.NOTIFY_FROM?.trim() || DEFAULT_FROM;
  try {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: mail.subject,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend API error (${res.status}): ${body}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send notify email:", error);
    return false;
  }
}

/** 検証失敗一覧をメールする。失敗 0 件なら何もしない。 */
export async function notifyRaceUrlFailures(
  env: NotifyEnv,
  date: string,
  failures: RaceUrlCheck[],
  fetchImpl: FetchLike = fetch
): Promise<boolean> {
  if (failures.length === 0) return false;
  const mail = formatRaceUrlFailureEmail({ date, failures });
  console.log(`Notifying race URL failures for ${date}: ${failures.length} venue(s)`);
  return sendNotifyEmail(env, mail, fetchImpl);
}
