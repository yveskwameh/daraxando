/**
 * The sign-in code email, in the game's Owambe Night look.
 *
 * The design (Yves, 16 October 2026) mixes three of the five options he saw: Baba Ayo's chat
 * header from "Chat with Baba Ayo", the game board from "On the board", and the type, links
 * and giant cropped logo of "Editorial". Top to bottom:
 *   1. Baba Ayo's header bar with the logo, and his one-line greeting as a chat bubble.
 *   2. The code on the game board (tap a square and the game fills the code in).
 *   3. What to do with it, how long it works, and "Not you?" as plain editorial text.
 *   4. PLAY and CREATED BY links, then the giant Dara X&O cut off by the bottom of the email.
 *
 * Mail apps are not browsers, so this is written the old way on purpose:
 *  - Tables for layout and styles inline on every element. Gmail drops a <style> block for some
 *    accounts, so the <style> below only adds phone tweaks; the email reads fine without it.
 *  - No scripts (no mail app runs them), no SVG, no CSS animation, no positioning or transforms.
 *    Pictures are PNGs from the game's own address (public/email/), each with alt text.
 *  - Gmail doesn't load web fonts, so headings fall back to Arial there. Outlook on Windows
 *    ignores rounded corners, so every rounded shape still reads as a square.
 *  - The code is also printed in one piece as plain text, so mail apps can spot it (Gmail's
 *    "Copy code", iPhone autofill). No mail app copies text on a tap by itself, so the board
 *    squares link to the game with the code filled in.
 *
 * Instructions in plain standard English (CLAUDE.md, writing rules). No emojis.
 */

export type CodeEmailKind = 'save' | 'signin';

export interface CodeEmailInput {
  /** Six digits. */
  code: string;
  /** "save": a guest adds this email. "signin": someone signs in on another phone. */
  kind: CodeEmailKind;
  /** The player's name, if the email belongs to a player already. */
  name?: string;
  /** Where the game and its pictures live, such as https://daraxando.yveskwameh.com. No trailing slash. */
  origin: string;
  /** How long the code works. */
  minutes: number;
  /** Opens the game with the code filled in. Without it, the code is plain text. */
  codeUrl?: string;
}

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const C = {
  night: '#0b0a2a',
  deep: '#17164a',
  raise: '#24226a',
  line: '#34318a',
  label: '#9b8fff',
  glow: '#ff4fb8',
  danfo: '#ffc921',
  muted: '#b8b4e8',
  white: '#ffffff',
};

/** Every email links to the game and credits its creator (Yves, 15 and 16 October 2026). */
const CREATOR = 'Yves Kwameh';
const CREDIT_URL = 'https://yveskwameh.com';
const CREDIT_SITE = 'yveskwameh.com';

const HEAD = "'Gabarito', 'Arial Rounded MT Bold', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const T = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** "Tunde's" or "Charles'". */
function possessive(name: string) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function words(o: CodeEmailInput) {
  const save = o.kind === 'save';
  const how = o.codeUrl ? 'Tap the code, or type it in Dara X&O,' : 'Type this code in Dara X&O';
  const whose = o.name ? possessive(o.name) : 'your';
  const lead = save
    ? `${how} to save ${whose} seeds, streak and title. Then they follow you to any phone.`
    : `${how} to sign in${o.name ? ` as ${o.name}` : ''}. Your seeds, streak and title are waiting.`;
  const hello = save
    ? `Here's your code${o.name ? `, ${o.name}` : ''}.`
    : `Welcome back${o.name ? `, ${o.name}` : ''}.`;
  const expiry = `It works once, for ${o.minutes} minutes.`;
  const notYou = "If you didn't ask for this code, ignore this email and your game stays as it is. Nobody from Dara X&O will ever ask you for it.";
  const preheader = save
    ? `Type it in the game to save your progress. It works for ${o.minutes} minutes.`
    : `Type it in the game to sign in. It works for ${o.minutes} minutes.`;
  const tag = save ? 'Save your progress' : 'Sign in';
  return { lead, hello, expiry, notYou, preheader, tag };
}

export function codeEmail(o: CodeEmailInput): Email {
  const w = words(o);
  const img = (f: string) => `${o.origin}/email/${f}`;
  const subject = `Your Dara X&O code is ${o.code}`;
  const site = o.origin.replace(/^https?:\/\//, '');

  // Hidden text some apps show after the subject in the inbox. The padding stops them from
  // pulling in the first words of the email after it.
  const pad = '&#8199;&#847;'.repeat(60);

  const link = (href: string, label: string, extra = '') =>
    `<a href="${esc(href)}" style="color:${C.glow};text-decoration:underline;${extra}">${esc(label)}</a>`;
  const tap = (inner: string, color: string) =>
    o.codeUrl ? `<a href="${esc(o.codeUrl)}" style="color:${color};text-decoration:none;">${inner}</a>` : inner;
  const caps = (color: string = C.label) =>
    `color:${color};font:700 11px/18px ${BODY};letter-spacing:0.14em;text-transform:uppercase;`;
  const p = (text: string, style: string) => `<p style="margin:0;${style}">${text}</p>`;
  const rule = `<tr><td colspan="2" style="padding:0;border-top:2px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>`;

  // 1. Baba Ayo's header bar: his picture and name on the left, the logo on the right.
  const header = `
<tr><td colspan="2" style="padding:0 0 12px;">
<table ${T} width="100%" bgcolor="${C.deep}" style="background-color:${C.deep};border:2px solid ${C.line};border-radius:20px;border-collapse:separate;"><tr>
<td width="44" valign="middle" style="width:44px;padding:10px 10px 10px 12px;"><img src="${img('baba.png')}" width="40" height="40" alt="Baba Ayo" style="display:block;width:40px;height:40px;border:0;"></td>
<td valign="middle" style="padding:10px 0;">
<div style="color:${C.white};font:800 17px/1.2 ${HEAD};">Baba Ayo</div>
<div style="color:${C.label};font:400 13px/1.3 ${BODY};">Dara X&amp;O</div>
</td>
<td valign="middle" align="right" style="padding:10px 14px 10px 0;"><img src="${img('wordmark.png')}" width="88" height="27" alt="Dara X&amp;O" style="display:block;width:88px;height:27px;border:0;color:${C.white};font:800 16px ${HEAD};"></td>
</tr></table>
</td></tr>
<tr><td colspan="2" style="padding:0 0 34px;">
<table ${T} style="border-collapse:separate;"><tr>
<td bgcolor="${C.raise}" style="background-color:${C.raise};border-radius:4px 18px 18px 18px;padding:12px 16px;color:${C.white};font:400 16px/1.45 ${BODY};">${esc(w.hello)}</td>
</tr></table>
</td></tr>`;

  // 2. The code on the game board, left-aligned like the rest of the type.
  const cell = (d: string) =>
    `<td style="padding:4px;"><table ${T} style="border-collapse:separate;"><tr><td class="cell" width="62" height="66" align="center" valign="middle" bgcolor="${C.raise}" style="width:62px;height:66px;background-color:${C.raise};border:2px solid ${C.line};border-radius:14px;color:${C.danfo};font:800 38px/1 ${HEAD};">${tap(esc(d), C.danfo)}</td></tr></table></td>`;
  const digits = o.code.split('');
  const board = `
<tr>
<td style="padding:0 0 10px;${caps()}">Your code</td>
<td align="right" style="padding:0 0 10px;${caps(C.muted)}">${esc(w.tag)}</td>
</tr>
${rule}
<tr><td colspan="2" style="padding:22px 0 12px;">
<table ${T} bgcolor="${C.night}" style="background-color:${C.night};border:2px solid ${C.line};border-radius:24px;border-collapse:separate;padding:8px;">
<tr>${digits.slice(0, 3).map(cell).join('')}</tr>
<tr>${digits.slice(3).map(cell).join('')}</tr>
</table>
</td></tr>
<tr><td colspan="2" style="padding:0 0 26px;">${p(`<span style="${caps()}">In one piece</span>&nbsp;&nbsp;<span style="color:${C.white};font:700 15px/1 ${BODY};letter-spacing:3px;white-space:nowrap;">${tap(esc(o.code), C.white)}</span>`, 'line-height:18px;')}</td></tr>`;

  // 3. The words, set like the editorial option.
  const copy = `
<tr><td colspan="2" style="padding:0 0 10px;">${p(esc(w.lead), `max-width:460px;color:${C.white};font:400 17px/1.5 ${BODY};`)}</td></tr>
<tr><td colspan="2" style="padding:0 0 32px;">${p(esc(w.expiry), `color:${C.muted};font:400 15px/1.5 ${BODY};`)}</td></tr>
${rule}
<tr><td colspan="2" style="padding:18px 0 18px;">
<div style="${caps()}padding:0 0 4px;">Not you?</div>
${p(esc(w.notYou), `max-width:460px;color:${C.muted};font:400 14px/1.55 ${BODY};`)}
</td></tr>
${rule}`;

  // 4. The links, then the giant logo cut off by the bottom of the email.
  const credits = `
<tr><td colspan="2" style="padding:18px 0 0;">
<table ${T} width="100%">
<tr>
<td class="cl" valign="top" style="padding:0 16px 10px 0;width:1%;white-space:nowrap;${caps()}">Play</td>
<td class="cv" valign="top" style="padding:0 0 10px;font:600 15px/18px ${BODY};">${link(o.origin, site)}</td>
</tr>
<tr>
<td class="cl" valign="top" style="padding:0 16px 0 0;width:1%;white-space:nowrap;${caps()}">Created by</td>
<td class="cv" valign="top" style="padding:0;color:${C.white};font:600 15px/18px ${BODY};">${CREATOR}, ${link(CREDIT_URL, CREDIT_SITE, 'font-weight:400;')}</td>
</tr>
</table>
</td></tr>
<tr><td colspan="2" style="padding:22px 0 0;">${p('You got this email because this address was typed into&nbsp;Dara&nbsp;X&amp;O.', `color:${C.muted};font:400 12px/1.5 ${BODY};`)}</td></tr>`;

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
@media (max-width: 379px) {
  .cell { width: 52px !important; height: 58px !important; font-size: 32px !important; }
  .cl, .cv { display: block !important; width: auto !important; padding: 0 0 2px !important; }
  .cv { padding: 0 0 12px !important; }
}
@media (max-width: 339px) {
  .outer { padding-left: 10px !important; padding-right: 10px !important; }
  .cell { width: 46px !important; height: 52px !important; font-size: 28px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(w.preheader)}${pad}</div>
<table ${T} width="100%" bgcolor="${C.night}" style="background-color:${C.night};background-image:url('${img('stage.png')}');background-size:115px 115px;">
<tr><td class="outer" align="center" style="padding:24px 16px 0;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table ${T} width="100%" style="max-width:560px;">
<tr><td style="padding:0;">
<table ${T} width="100%">
${header}
${board}
${copy}
${credits}
</table>
</td></tr>
<tr><td style="padding:40px 0 0;font-size:0;line-height:0;">
<a href="${esc(o.origin)}" style="text-decoration:none;"><img src="${img('wordmark-giant.png')}" width="560" alt="Dara X&amp;O" style="display:block;width:100%;max-width:560px;height:auto;border:0;"></a>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = [
    w.hello,
    '',
    o.code,
    ...(o.codeUrl ? ['', `Tap to fill it in: ${o.codeUrl}`] : []),
    '',
    w.lead,
    w.expiry,
    '',
    `Not you? ${w.notYou}`,
    '',
    `Play Dara X&O: ${o.origin}`,
    `Created by ${CREATOR}: ${CREDIT_URL}`,
    '',
    'You got this email because this address was typed into Dara X&O.',
  ].join('\n');

  return { subject, html, text };
}
