# HEP app design rules

One page. Every surface we touch follows these rules from the day they are written. Nothing is swept; screens convert when they are next worked on. To change a rule, edit this page and the matching token in the stylesheet, then convert on contact as before.

## Surfaces

1. Home is the only page. Everything else is a sheet over it.
2. Two kinds of sheet. A **flow sheet** carries an action (Propose, Review, Complete): flow sheets replace each other and never stack; the primary button is the way forward. A **reading sheet** carries no action: it opens over anything, has only a title and an X, and the X returns you to exactly where you were with nothing changed. A reading sheet never opens another sheet.
2a. **X always goes back one step, on every sheet.** On a reading sheet it returns you to exactly where you were. On a flow sheet it returns you to the previous step with everything you entered kept, so you can change something earlier. X never ends an exchange. There is no back chevron at the top; the X is the back control.
2b. **Ending is its own control.** Once two people are connected, every flow sheet carries a quiet "Cancel exchange" line at the very bottom (plain text, muted, not a button, not red). It ends the session for both people and returns to Home.
3. Every sheet has the same anatomy: title at the top, X at the top right, content, and at most one primary action at the bottom. The title follows the screen: centered on a moment screen, left on a reading screen. The X stays in the top right corner on every screen; it is a control, not text, and it means back one step (rule 2a). On a screen about one person, their name under their photo is the title. No drag bars, no Close buttons, no pop-ups.
4. A sheet is phone-shaped on every device: maximum width 420px, centered. A wide screen gets the same sheet in the middle of the window, never a stretched layout.

5a. Waiting on a person (to join, to confirm) is shown one way everywhere: the pulsing accent dot with a line of text beside it. No spinners in the flow. Swappable later, but only everywhere at once.

## Text

5. Five sizes, no others: caption 12, label 13, body 15, title 18, display 32 (`--fs-caption` to `--fs-display`). A number that is the moment (an agreed value, a standing) may use display.
6. Two weights: regular and semibold. Mono is for keys and hashes only.
7. Center for moments, left for reading. A question, a name, a number, a one-line sentence may be centered. Anything a person reads as prose, any list, and anything that wraps past two lines is left-aligned. Centered and left-aligned text never share a screen; reading lives in a reading sheet.
8. The unit beside a number is the HEP mark, small and muted, never a coin or a money glyph. The words currency and cosmic share appear only where the sign of standing is the point (the wallet, the wave).

## Disclosure

9. One signal: an underlined phrase in accent blue. Tapping it opens a reading sheet. Nothing else in the app is underlined.
10. There is no inline expander. If something is short enough to show inline, show it. A disclosure always opens a reading sheet.
11. A control that goes somewhere else in the flow is a button or a row with a right chevron, never an underlined phrase.

## Fields

12. One field style, used everywhere a person types: label above in caption size, a single quiet box (`--bg-input`, one border, `--radius-sm`), body text inside, accent border on focus. No field is styled per spot.
13. Editing a value in place (a name, an amount in the flow) uses the same field, shown large enough to read and sized to its content, with the unit mark beside it. It never looks different from a field elsewhere.

## Icons

14. One stroke style: 1.75 line weight on a 24 grid, round caps. A small named set defined once and reused by name (device, chain, similar, x, chevron, check, arrow, shield, hep-mark). No emoji, no filled glyphs beside stroke glyphs.
15. An icon never carries meaning alone except X and chevron. Every other icon has a word beside it.

## Color and shape

16. Four meanings, never a fifth hue: blue is you and action; amber is received and cosmic share; green is confirmed; red is danger only, and rare. All colors come from the tokens.
17. Two radii only: `--radius` for sheets and cards, `--radius-sm` for fields and buttons. Circles for avatars.
