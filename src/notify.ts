// 馬柱 URL 検証失敗時のメール通知（Cloudflare Email Service）。
//
// 自分の検証済み Destination address 宛てに送る想定。
// EMAIL バインディング未設定、または宛先／From が無い場合はログのみ（投入は止めない）。
// 宛先は NOTIFY_EMAIL、未設定なら CF_ACCESS_ALLOWED_EMAIL を使う。

import type { RaceUrlCheck } from "./verifyRaceUrl";

/** Workers の send_email バインディング（Email Service） */
export interface SendEmailBinding {
  send(message: {
    to: string | string[];
    from: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string } | void>;
}

export interface NotifyEnv {
  /** wrangler.jsonc の send_email バインディング */
  EMAIL?: SendEmailBinding;
  /** 通知先。未設定時は CF_ACCESS_ALLOWED_EMAIL（いずれも Email Routing で Verify 済みであること） */
  NOTIFY_EMAIL?: string;
  CF_ACCESS_ALLOWED_EMAIL?: string;
  /** From。koumeinowana.info 上のアドレス。例: noreply@koumeinowana.info */
  NOTIFY_FROM?: string;
}

const DEFAULT_FROM = "noreply@koumeinowana.info";

export function resolveNotifyTo(env: NotifyEnv): string | null {
  const to = (env.NOTIFY_EMAIL ?? env.CF_ACCESS_ALLOWED_EMAIL)?.trim();
  return to || null;
}

export function resolveNotifyFrom(env: NotifyEnv): string {
  return env.NOTIFY_FROM?.trim() || DEFAULT_FROM;
}

export function notifyConfigured(env: NotifyEnv): boolean {
  return Boolean(env.EMAIL && resolveNotifyTo(env));
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
 * Cloudflare Email で送信。未設定時は no-op（false）。
 * 送信失敗時は例外を投げず false を返す。
 */
export async function sendNotifyEmail(
  env: NotifyEnv,
  mail: { subject: string; text: string }
): Promise<boolean> {
  const to = resolveNotifyTo(env);
  const from = resolveNotifyFrom(env);
  if (!env.EMAIL || !to) {
    console.warn(
      "Email notify skipped: bind send_email as EMAIL and set NOTIFY_EMAIL (or CF_ACCESS_ALLOWED_EMAIL)"
    );
    return false;
  }

  try {
    await env.EMAIL.send({
      to,
      from,
      subject: mail.subject,
      text: mail.text,
    });
    console.log(`Email notify sent to ${to} from ${from}`);
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
  failures: RaceUrlCheck[]
): Promise<boolean> {
  if (failures.length === 0) return false;
  const mail = formatRaceUrlFailureEmail({ date, failures });
  console.log(`Notifying race URL failures for ${date}: ${failures.length} venue(s)`);
  return sendNotifyEmail(env, mail);
}
