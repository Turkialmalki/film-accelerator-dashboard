import { NextResponse } from 'next/server';

/**
 * The tiny, branded confirmation page an admin lands on after clicking
 * Approve/Reject from their inbox. Not part of the SPA — this is a plain
 * server-rendered HTML response, on purpose: it has to work as the target
 * of a link from an email client with no session and no client JS, and
 * "approved" is the entire interaction, nothing else to hydrate.
 */
export function decisionPage({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  const color = ok ? '#2F7D62' : '#B03A31';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Film Business Accelerator</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#FAF8F5; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; padding:24px; }
  .card { max-width:440px; width:100%; background:#fff; border:1px solid #E8E3DB; border-radius:16px; padding:32px; box-shadow:0 8px 24px -12px rgba(15,40,55,0.12); }
  .badge { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:999px; background:${color}1a; color:${color}; font-size:20px; margin-bottom:16px; }
  h1 { font-size:18px; color:#0F2837; margin:0 0 8px; }
  p { font-size:14px; line-height:1.6; color:#4B5E69; margin:0; }
</style></head>
<body>
  <div class="card">
    <div class="badge">${ok ? '✓' : '!'}</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
