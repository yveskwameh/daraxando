/**
 * The sign-in code email, in the game's Owambe Night look.
 *
 * Mail apps are not browsers, so this is written the old way on purpose: tables for layout,
 * styles inline on each element, pictures for the logo and Baba Ayo (public/email/), and a
 * plain-text copy for apps that show no HTML. The card is dark in every mail app; the
 * `color-scheme` tags tell Apple Mail it is already dark so it doesn't repaint it.
 *
 * Instructions in plain standard English (CLAUDE.md, writing rules). No emojis.
 * Design approved by Yves before sending is built (docs/BACKEND.md, milestone 3).
 */

export type CodeEmailKind = 'save' | 'signin';

export interface CodeEmailInput {
  /** Six digits. */
  code: string;
  /** "save": a guest adds this email. "signin": someone signs in on another phone. */
  kind: CodeEmailKind;
  /** The player's name, if the email belongs to a player already. */
  name?: string;
  /** Where the pictures live, such as https://daraxando.yveskwameh.com. No trailing slash. */
  origin: string;
  /** How long the code works. */
  minutes: number;
}

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const C = {
  night: '#0b0a2a',
  deep: '#17164a',
  line: '#34318a',
  fuchsia: '#dc0fa1',
  glow: '#ff4fb8',
  cream: '#fff4e0',
  muted: '#b8b4e8',
  white: '#ffffff',
};

/** The credit at the bottom of every email (Yves, 15 October 2026). */
const CREDIT_URL = 'https://yveskwameh.com';
const CREDIT_SITE = 'yveskwameh.com';

const HEAD = "'Gabarito', 'Arial Rounded MT Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** "Tunde's" or "Charles'". */
function possessive(name: string) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function words(o: CodeEmailInput) {
  const save = o.kind === 'save';
  const title = save ? 'Save your progress' : 'Welcome back';
  const lead = save
    ? o.name
      ? `Type this code in Dara X&O to save ${possessive(o.name)} seeds, streak and title. Then they follow you to any phone.`
      : 'Type this code in Dara X&O to save your seeds, streak and title. Then they follow you to any phone.'
    : o.name
      ? `Type this code in Dara X&O to sign in as ${o.name}. Your seeds, streak and title are waiting.`
      : 'Type this code in Dara X&O to sign in. Your seeds, streak and title are waiting.';
  const expiry = `It works once, for ${o.minutes} minutes.`;
  const safety = "Didn't ask for this code? Ignore this email and your game stays as it is. Nobody from Dara X&O will ever ask you for it.";
  const preheader = save
    ? `Type it in the game to save your progress. It works for ${o.minutes} minutes.`
    : `Type it in the game to sign in. It works for ${o.minutes} minutes.`;
  return { title, lead, expiry, safety, preheader };
}

export function codeEmail(o: CodeEmailInput): Email {
  const w = words(o);
  const img = (f: string) => `${o.origin}/email/${f}`;
  const subject = `Your Dara X&O code is ${o.code}`;

  // Hidden text some apps show after the subject in the inbox. The padding stops them from
  // pulling in the first words of the email after it.
  const pad = '&#8199;&#847;'.repeat(60);

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
@font-face { font-family: 'Gabarito'; font-weight: 400 900; font-display: swap; src: url('${img('gabarito.woff2')}') format('woff2'); }
body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: ${C.night}; }
a { color: ${C.glow}; }
@media (max-width: 480px) {
  .card { padding: 26px 20px 22px !important; border-radius: 22px !important; }
  .title { font-size: 26px !important; }
}
@media (max-width: 359px) {
  .outer { padding: 16px 8px 24px !important; }
  .card { padding: 22px 14px 20px !important; }
  .code { font-size: 32px !important; letter-spacing: 6px !important; padding: 12px 20px 12px 26px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(w.preheader)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.night}" style="background-color:${C.night};background-image:url('${img('stage.png')}');background-size:115px 115px;">
<tr><td class="outer" align="center" style="padding:28px 12px 32px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td class="card" bgcolor="${C.deep}" style="background-color:${C.deep};border:2px solid ${C.line};border-radius:28px;padding:32px 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

<tr><td align="center" style="padding:0 0 22px;">
<img src="${img('wordmark.png')}" width="156" height="48" alt="Dara X&amp;O" style="display:block;width:156px;height:48px;border:0;color:${C.white};font:800 24px ${HEAD};">
</td></tr>

<tr><td align="center" style="padding:0 0 10px;">
<h1 class="title" style="margin:0;color:${C.white};font:800 28px/1.15 ${HEAD};letter-spacing:-0.01em;">${esc(w.title)}</h1>
</td></tr>

<tr><td align="center" style="padding:0 0 24px;">
<p style="margin:0;max-width:400px;color:${C.muted};font:400 16px/1.5 ${BODY};text-wrap:balance;">${esc(w.lead)}</p>
</td></tr>

<tr><td align="center" style="padding:0 0 14px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
<tr><td class="code" bgcolor="${C.fuchsia}" style="background-color:${C.fuchsia};background-image:url('${img('sticker.png')}');background-size:44px 44px;border:3px solid ${C.cream};border-radius:999px;padding:12px 26px 12px 34px;color:${C.white};font:800 40px/1.1 ${HEAD};letter-spacing:8px;font-variant-numeric:tabular-nums;white-space:nowrap;mso-line-height-rule:exactly;">${esc(o.code)}</td></tr>
</table>
</td></tr>

<tr><td align="center" style="padding:0 0 26px;">
<p style="margin:0;color:${C.white};font:600 15px/1.4 ${BODY};">${esc(w.expiry)}</p>
</td></tr>

<tr><td style="padding:0;border-top:2px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>

<tr><td style="padding:20px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="52" valign="top" style="width:52px;padding:2px 14px 0 0;">
<img src="${img('baba.png')}" width="52" height="53" alt="Baba Ayo" style="display:block;width:52px;height:53px;border:0;">
</td>
<td valign="top" style="padding:0;">
<p style="margin:0;color:${C.muted};font:400 14px/1.5 ${BODY};">${esc(w.safety)}</p>
</td>
</tr>
</table>
</td></tr>

</table>
</td></tr>

<tr><td align="center" style="padding:22px 16px 0;">
<p style="margin:0 0 6px;color:${C.muted};font:400 13px/1.5 ${BODY};">Dara X&amp;O, created by Yves Kwameh. <a href="${CREDIT_URL}" style="color:${C.glow};text-decoration:underline;">${CREDIT_SITE}</a></p>
<p style="margin:0;color:${C.muted};font:400 13px/1.5 ${BODY};">You got this email because this address was typed into Dara X&amp;O.</p>
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = [
    w.title,
    '',
    w.lead,
    '',
    o.code,
    '',
    w.expiry,
    '',
    w.safety,
    '',
    'Dara X&O, created by Yves Kwameh.',
    CREDIT_URL,
    'You got this email because this address was typed into Dara X&O.',
  ].join('\n');

  return { subject, html, text };
}
