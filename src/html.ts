/** Access 配下のブラウザ向け HTML（スマホ前提）。 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlPage(
  title: string,
  body: string,
  status = 200,
  extraCss = ""
): Response {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --fg: #111;
      --muted: #5c5c5c;
      --line: #d4d4d4;
      --bg: #fff;
      --card: #f6f6f6;
      --btn: #0b6b2c;
      --btn-fg: #fff;
      --danger: #b00020;
      --ok: #0b6b2c;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --fg: #f3f3f3;
        --muted: #a3a3a3;
        --line: #3a3a3a;
        --bg: #111;
        --card: #1c1c1c;
        --btn: #3dba6e;
        --btn-fg: #111;
        --danger: #ff8a80;
        --ok: #7dcc9a;
      }
    }
    html { -webkit-text-size-adjust: 100%; }
    body {
      font-family: system-ui, sans-serif;
      max-width: 28rem;
      margin: 0 auto;
      padding: 1rem 1rem max(2rem, env(safe-area-inset-bottom));
      line-height: 1.5;
      color: var(--fg);
      background: var(--bg);
    }
    h1 { font-size: 1.25rem; margin: 0 0 0.4rem; }
    h2 { font-size: 1.05rem; margin: 1.2rem 0 0.4rem; }
    p { margin: 0.4rem 0; }
    label { display: block; font-weight: 600; margin-top: 1.1rem; }
    select, input, button { font: inherit; font-size: 1rem; }
    select, input[type=url], input[type=text] {
      width: 100%;
      box-sizing: border-box;
      min-height: 2.75rem;
      padding: 0.6rem 0.7rem;
      margin-top: 0.35rem;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
      background: var(--bg);
      color: var(--fg);
    }
    button[type=submit], .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin-top: 1.4rem;
      min-height: 3rem;
      padding: 0.7rem 1rem;
      border: 0;
      border-radius: 0.6rem;
      background: var(--btn);
      color: var(--btn-fg);
      font-weight: 700;
      text-align: center;
      text-decoration: none;
    }
    button[type=submit]:disabled { opacity: 0.6; }
    .muted { color: var(--muted); }
    .error { color: var(--danger); }
    .ok { color: var(--ok); }
    .summary {
      margin-top: 1rem;
      padding: 0.75rem 0.85rem;
      background: var(--card);
      border-radius: 0.5rem;
      font-weight: 600;
    }
    code, pre { word-break: break-all; }
    pre {
      white-space: pre-wrap;
      background: var(--card);
      padding: 0.75rem;
      border-radius: 0.5rem;
      overflow: auto;
    }
    ul { padding-left: 1.2rem; }
    nav.links { margin-top: 1.8rem; display: grid; gap: 0.6rem; }
    nav.links a {
      display: block;
      padding: 0.85rem 1rem;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
      text-decoration: none;
      color: inherit;
    }
    ${extraCss}
  </style>
</head>
<body>
${body}
</body>
</html>
`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
