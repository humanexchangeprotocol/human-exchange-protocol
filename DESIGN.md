# HEP app design rules

One page. Read it before designing or mocking up any surface. Every mockup starts from the dev stylesheet (the tokens and the `exs-` classes in `dev/index.html`), never from a fresh drawing. Every surface we touch follows these rules from the day they are written. Nothing is swept; screens convert when they are next worked on. To change a rule, edit this page and the matching token in the stylesheet, then convert on contact as before.

## Surfaces

1. Home is the only page. Everything else is a sheet over it.
2. Two kinds of sheet. A **flow sheet** carries an action (Propose, Review, Complete): flow sheets replace each other and never stack; the primary button is the way forward. A **reading sheet** carries no action: it opens over anything, has only a title and an X, and the X returns you to exactly where you were with nothing changed. A reading sheet may open another reading sheet over it (an underlined phrase, rule 9); X closes the top one and returns you to the sheet beneath, exactly as it was (ruled Oct 2: sheets over sheets are the one consistent behaviour, never inline subtext).
2a. **X always goes back one step, on every sheet.** On a reading sheet it returns you to exactly where you were. On a flow sheet it returns you to the previous step with everything you entered kept, so you can change something earlier. X never ends an exchange. There is no back chevron at the top; the X is the back control.
2b. **Ending is its own control.** Once two people are connected (from the chain read on), every flow sheet ends with "Cancel exchange" at the bottom left: caption size, faintest grey, plain text, not a button, not red, always the last thing on the screen, and every flow sheet keeps that space for it. It ends the session for both people and returns to Home. Like the X, it belongs to the frame of the sheet, not its content, so rule 7 does not apply to it on a centered screen. Verify keeps its own "Not the right person" in place of it.
2c. **Once a proposal is sent, the sender waits.** The Wait screen has no X and no Cancel exchange: the proposal is out and only the other person's answer (confirm, not right, or cancel) moves it. The sender is told the answer whichever it is.
3. Every sheet has the same anatomy: title at the top, X at the top right, content, and at most one primary action at the bottom. The title follows the screen: centered on a moment screen, left on a reading screen. The X stays in the top right corner on every screen; it is a control, not text, and it means back one step (rule 2a). On a screen about one person, their name under their photo is the title. No drag bars, no Close buttons, no pop-ups.
3a. **Edit sheets** (ruled Oct 3): a sheet that changes saved values ("About you": photo, name, about, skills) opens over the screen it came from, holds every change as a draft, and has one primary action, Save, at the bottom. Save commits and closes. X throws the draft away and returns you exactly where you were, nothing changed. The primary action of any sheet where a person enters or edits data (Save on an edit sheet) is pinned to the bottom of the sheet, always visible; the content scrolls behind it (ruled Oct 3, after Michael twice closed a long edit without seeing Save). The declarations edit sheet is titled "About you".
4. A sheet is phone-shaped on every device: maximum width 480px (the width the exchange sheet is built at), centered, so it fills any phone edge to edge with no gutter. A wide screen gets the same sheet in the middle of the window, never a stretched layout.
4a. Nothing slides. Every sheet appears and disappears in place, with no slide up or down, on every surface (ruled Oct 2: sliding is disorienting).

5a. Waiting on a person (to join, to confirm) is shown one way everywhere: the pulsing accent dot with a line of text beside it. No spinners in the flow. Swappable later, but only everywhere at once.

## Text

5. Five sizes, no others: caption 12, label 13, body 15, title 18, display 32 (`--fs-caption` to `--fs-display`). A number that is the moment (an agreed value, a standing) may use display.
6. Two weights: regular and semibold. Mono is for keys and hashes only.
7. Center for moments, left for reading. A question, a name, a number, a one-line sentence may be centered. Anything a person reads as prose, any list, and anything that wraps past two lines is left-aligned. Centered and left-aligned text never share a screen; reading lives in a reading sheet.
7a. One exception (ruled Oct 3): on a screen about one person, the person block (photo, name, caption, and an Edit control under it) may sit centred above a left-aligned reading list. Nothing else on that screen is centred.
7b. A reading screen groups its rows under captions ("Your texture", "Your record", "This phone"), the same caption that groups a sheet's numbers.
8. The unit beside a number is the HEP mark, two overlapping circles (ruled Oct 2), small and muted, never a coin or a money glyph. Words for the totals (ruled Oct 2): currency is the running total of what you have produced, cosmic share the running total of what you have received, standing the difference. A standing is shown unsigned with "above" or "below" ("2,000 below"), never a minus sign, never red.

## Disclosure

9. One signal: an underlined phrase in accent blue. Tapping it opens a reading sheet. Nothing else in the app is underlined.
10. There is no inline expander. If something is short enough to show inline, show it. A disclosure always opens a reading sheet.
11. A control that goes somewhere else in the flow is a button or a row with a right chevron, never an underlined phrase. A list of places to go (My chain) is plain rows: word, caption, chevron, no icons, the same row the exchange uses.

11a. **Reordering** (ruled Oct 3): a list a person typed and can arrange (skills, education) shows the grip, six solid dots (#icon-grip), at the left of each row, in the faint tone at 20px, only when the list has two or more items. Press and drag the grip: on a phone you hold and move, on a computer the pointer shows a grabbing hand. The row being moved lifts (raised background, large shadow) and the others swap around it in place, nothing slides (rule 4a). The order is part of the draft on an edit sheet (rule 3a): Save keeps it, X discards it.

## Fields

12. One field style, used everywhere a person types: label above in caption size, a single quiet box (`--bg-input`, one border, `--radius-sm`), body text inside, accent border on focus. No field is styled per spot.
13. Editing a value in place (a name, an amount in the flow) uses the same field, shown large enough to read and sized to its content, with the unit mark beside it. It never looks different from a field elsewhere.

## Icons

14. One icon style, the bottom bar's (ruled Oct 2: every icon matches the system already built). Icons sit on a 24 grid and are solid: shapes filled with the current colour. Shapes that overlap are filled at 0.55 so the overlap reads darker (the HEP mark, Share, network). A line, where a shape needs one, is 2.5 wide with round ends and joins (3 for check). No thin outline icons, no emoji. Corners are square except where the shape itself is round (Home's house has crisp corners; circles stay circles). Outline icons (like History) leave their inside white so anything inside reads crisply. Icons rest in the faint tone at 22px, the bottom bar's tone and size, and turn blue when active; none sits darker than the bar. A small named set defined once in the sprite and reused by name. The HEP mark (#icon-hep-mark, two crossing rings, ruled Oct 2) and the wallet (#icon-wallet, a square-cornered wallet holding the mark) live only in the sprite; everything else references them, so a redraw happens in one place.
15. An icon never carries meaning alone except X, chevron and the grip (rule 11a). Every other icon has a word beside it.
15a. Removing an item a person typed into a list (a skill) uses the word "Remove" at the right of its row, caption size, faintest grey; never a small x, which means back (ruled Oct 3).

## Color and shape

16. Four meanings, never a fifth hue: blue is you and action; amber is received and cosmic share; green is confirmed; red is danger only, and rare. All colors come from the tokens. Numbers take the colour of their side (ruled Oct 2): currency and anything provided in blue, cosmic share and anything received in amber, a standing in blue when above and amber when below, neutral when even. Counts of exchanges or people stay neutral.
17. Two radii only: `--radius` for sheets and cards, `--radius-sm` for fields and buttons. Circles for avatars.

## Open questions

A design question these rules do not answer is written here when it comes up, ruled by Michael, then moved into the rules above. Nothing is designed around an open question silently.

- Segmented controls (Actual / Typical, Each / Week / Month / Year on the textures): no rule yet. The mockup uses a quiet pill row on `--bg-input`.
- Charts (line weights, fills, axis labels, bar strips): no rule yet beyond rule 16's colours.
- Where Reach is turned on. Ruled off by default, own phone only; the mockup shows it as already on. The switch has no home yet.
- The My chain icon on Home: still open, rule 15 asks for a word beside it.
- The Share tab draws the mark as two filled circles (#icon-cooperation), separate from #icon-hep-mark. Whether Share keeps its own drawing or references the mark is open.
- The word for standing in the wallet: "Standing" is in use; whether it is final is open.
- Counterparty About (Oct 3, mockup only, not built): the profile opens from a third icon, "about", beside device and chain on the chain read, as a reading sheet whose title is the person block (photo, name, "In their own words") over Skills and qualifications and Education rows, ending with a caption that HEP does not check what anyone says about themselves. Open: the person icon itself (a new solid #icon-person); whether the about icon appears at all when the other person has sharing off or nothing written (mockup assumes it is hidden); Long lists are settled by structure (Michael, Oct 3): the About sheet holds the person block and their own description, then two rows, Skills and qualifications and Education (word, count caption, chevron), each opening its own reading sheet over About (rule 2), so the lists never make About long.
