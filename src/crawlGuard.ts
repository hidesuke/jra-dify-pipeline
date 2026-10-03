/**
 * 検索エンジン／AI クローラ向けの最低限の対策。
 * robots.txt と X-Robots-Tag。意図的な API 利用（例: Dify の HTTP ツール → /baba/latest）は塞がない。
 */

/** よく知られた AI／学習系クローラ（robots.txt 用）。一覧は代表例のみ。 */
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "GoogleOther",
  "anthropic-ai",
  "ClaudeBot",
  "Claude-Web",
  "Bytespider",
  "CCBot",
  "Diffbot",
  "FacebookBot",
  "meta-externalagent",
  "Applebot-Extended",
  "PerplexityBot",
  "Omgilibot",
  "Omgili",
  "YouBot",
  "cohere-ai",
] as const;

export const X_ROBOTS_TAG = "noindex, nofollow, noarchive";

export function robotsTxtBody(): string {
  const lines = [
    "# jra-dify-pipeline — crawl politely; this Worker is not for indexing.",
    "User-agent: *",
    "Disallow: /",
    "",
  ];
  for (const ua of AI_CRAWLER_USER_AGENTS) {
    lines.push(`User-agent: ${ua}`, "Disallow: /", "");
  }
  return `${lines.join("\n")}\n`;
}

export function robotsTxtResponse(): Response {
  return new Response(robotsTxtBody(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Robots-Tag": X_ROBOTS_TAG,
    },
  });
}

/** 応答に X-Robots-Tag を付与（既にあれば尊重） */
export function withNoindex(res: Response): Response {
  const headers = new Headers(res.headers);
  if (!headers.has("X-Robots-Tag")) {
    headers.set("X-Robots-Tag", X_ROBOTS_TAG);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
