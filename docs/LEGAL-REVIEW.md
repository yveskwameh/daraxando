# Dara X&O: privacy notice and terms for legal review

16 October 2026. Prepared for the lawyer who approved Dara Seeds (`docs/COWRIES-REVIEW.md`) and the safety rules (`docs/SAFETY-REVIEW.md`). Nothing here is live: the game is not published yet. The two drafts are in the game's code, so what you approve is exactly what players will read:

- **Privacy notice:** `src/legal/privacy.md`, shown in the game at `/privacy`
- **Terms of play:** `src/legal/terms.md`, shown in the game at `/terms`

On the test copy: https://daraxando-staging.yves-workers.workers.dev/privacy and /terms.

## Facts the drafts rely on

- **Who runs it:** Yves Kwameh. Dara X&O is his project, not a company. At his request, the drafts and the game don't give his location anywhere. The drafts call it "we" and name Yves as the person responsible (question 14). Contact: hello@yveskwameh.com.
- **The game is free.** Nothing is sold, there are no ads and no tracking services. Dara Seeds can't be bought, sold, sent or cashed out (as you approved).
- **Who plays:** Nigerian players, 13 or older by a one-tap confirmation on the first screen. No date of birth is asked for or stored.
- **What's kept:** every item is listed in the notice under "What we keep, and why". In short: a player name, an animal and a state the player picks; game progress and match history; an email address or a Google account id only if the player saves their progress; a scrambled phone id against seed farming; notification addresses only if turned on; ban records; the days each player played (400 days); error reports (3 days).
- **What's never kept:** real names, phone numbers, exact locations, contacts, photos, IP addresses in the database, payment details.
- **Where it goes:** Cloudflare (hosting and database, database in Western Europe), Google (sign-in, only if chosen), Resend (sign-in code emails, stored in the United States for 30 days), and the phone's push service (Google, Apple, Mozilla or Microsoft, encrypted, only if turned on).
- **Deleting:** players can delete their account in Settings at any time. It removes the player and everything tied to it, except matches against other people (kept in the opponents' history under an id that no longer leads anywhere) and our admin log (kept so a banned person can't start again).

## Changes made in the game while drafting

So that the notice is true, a few things changed in the code on 16 October 2026:

- **Server logs no longer record request addresses.** Some addresses carried login tokens or sign-in links. Only the game's own error lines are logged, for 3 days.
- **Error reports from phones leave out sign-in links**, as they already left out room codes.
- **Old sign-in codes and Google sign-in steps are deleted every day**, not only when someone asks for a new code.

## Questions

### Children

1. **Under-18s.** The Nigeria Data Protection Act 2023 defines a child by the Child's Rights Act (under 18) and, in section 31, requires a parent's or guardian's consent to process a child's data, with an appropriate check of age and consent. Section 31(5) lets the Commission make rules for children 13 and over using online services at their own request. We couldn't find that those rules have been made yet. The game today asks only for a tap confirming the player is 13 or older. The drafts add "If you're under 18, you need your parent or guardian's permission". Which do you recommend?
   - (a) Keep 13+ with that sentence in the terms and notice, as drafted.
   - (b) Add a step on the first screen for 13 to 17 year olds, for example "I'm 18 or older" or "I'm 13 to 17 and my parent or guardian says yes".
   - (c) Raise the minimum age to 18.
   - (d) Something else.
2. **Accepting the terms.** Yves wants players to accept the terms when they make their player, and to keep his one-tap first screen. The line right under the Play now button now reads: "By tapping Play now, you agree to the Terms of play, confirm you're 13 or older, and have read the Privacy notice", with both as links that open the full text. The server keeps which version each player accepted and when (`players.terms_version`, `terms_at`). Is a tap with that line next to the button enough to bind players, or do you recommend a tick box? Is "have read" right for the Privacy notice, given that most uses rely on the contract and legitimate interests rather than consent?

### Registration and duties

3. **Data controller of major importance.** Secondary sources on the GAID 2025 (we couldn't read its Schedule 7 directly) say an organisation processing the data of more than 200 people in six months is "ordinary high level" and must register with the Commission. Does this apply to an individual running a free game, and from when? What would it cost, and does it bring yearly compliance audit returns?
4. **Data Protection Officer.** If registration applies, must Yves appoint a DPO, and can he be his own?

### Lawful bases

5. The notice gives these bases. Are they right?
   - **Running the game you asked to play** (contract): the player, progress, matches, seeds history, sign-in details.
   - **Legitimate interest** in a fair and safe game: the scrambled phone id, bans, the admin log, error reports.
   - **Legitimate interest** in improving the game: the days each player played (400 days), daily counts with no names.
   - **Consent:** notifications, which the phone also asks for.
6. **The admin log** is kept after an account is deleted, so a banned person can't simply start again. It holds the player id, what was done (rename, ban, seed correction, review answer) and why. Is that acceptable, and for how long?

### Outside Nigeria

7. Our providers process data in the European Union and the United States. Which basis under sections 41 to 43 of the Act should the notice name: the providers' own data protection terms (Cloudflare's and Resend's data processing agreements, which use the EU's standard contractual clauses), necessity for the service the player asked for (section 43(1)(b)), or consent? The GAID (Article 18(1)(e)) mentions consent for transfers to countries without an adequacy decision.

### Keeping data

8. **Idle guest players.** A player who never saves their progress and clears their phone can't come back, but their player stays in our database until deleted. Should we delete players with no activity for a set time (for example 2 years)? It isn't built yet.
9. **Replying to requests.** The notice promises a reply within 30 days. Is that the right period?

### Terms

10. **Taking back seeds.** The terms say we may take back seeds won by breaking the rules (for example by farming). You approved seed corrections only for fixing mistakes. Is taking back seeds won by cheating acceptable as a correction?
11. **Law and courts.** The terms choose the laws of Nigeria and name no court. Should they name one (for example a particular state's High Court)?
12. **Responsibility.** The limit of responsibility keeps players' rights under the Federal Competition and Consumer Protection Act 2018. Is the wording enough?
13. **Contact details.** Section 27(1)(a) asks for the controller's identity and contact details. Yves doesn't want his location in the game or the documents, so the notice gives only his name and an email address. Is that enough, or does the law need a postal address (and could it be a postal box or another address that isn't his home)?

### The business

14. **The project and Yves.** Dara X&O is a project, not a company. Yves would like the documents to put the project's name forward ("we" means the Dara X&O project) while naming him as the person responsible, as the drafts do. Is that wording right? Our understanding is that the project's legal duties sit with him personally. Is there anything, short of forming a company, that limits his personal exposure (for example the terms' limits of responsibility), and would you recommend a company at some point?
15. **Protecting Yves.** Yves asked for the strongest protection the law allows. The terms now have: the game "as it is" with no promises; a list of things we aren't responsible for; a cap of ₦5,000 on what we could owe in total; those limits covering the project, Yves and anyone who helps; players covering our reasonable costs if their breach causes a claim against us; write to us first, then 30 days, then mediation, then the Nigerian courts; passing the game on to a company later; and asking players to accept important changes. Please check each against Nigerian law, especially the Federal Competition and Consumer Protection Act 2018:
    - Is the cap enforceable for a free game, and is ₦5,000 a figure a court would accept?
    - Can a 13 to 17 year old be bound by the indemnity, or should it apply only through their parent or guardian?
    - Should the terms add anything else to protect Yves personally, such as a time limit for bringing claims?

## After your answers

Claude updates the two drafts, removes the "Draft for legal review" line, and they go live with the game. Google's sign-in review needs these two pages before Google sign-in can leave its testing mode.
