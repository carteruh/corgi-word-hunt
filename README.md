# Corgi Word Hunt

[GitHub Pages](https://carteruh.github.io/corgi-word-hunt/) · [Play on the original site](https://moonpetal-moonlit-word-hunt.smoky-dune-6060.chatgpt.site/)

Trace adjacent letters to find as many words as you can in one minute. Share a board link and compare your best scores with friends under a nickname. Players can join from a phone or a computer without an account.

The home page is an interactive moonlit meadow. Sweep a finger or mouse through Clover’s petal portrait, hold to release more petals, or choose Tulips to reshape the portrait. With a keyboard, use the arrows and Space. Choose **Play for 60 seconds** when you’re ready. [Open the game](https://carteruh.github.io/corgi-word-hunt/?board=1dh1)

When the minute ends, your garden opens with a flower for each word you found. Compare scores, replay the board, or stay and plant. Tap to plant a flower and play the next flute note of Joe Hisaishi’s *Merry-Go-Round of Life*. Drag a trail to hear a whole phrase. On a keyboard, use Enter for a note and Shift + Enter for a phrase.

The spring motion takes inspiration from Soulwire’s interactive particle study. [30,000 Particles on CodePen](https://codepen.io/soulwire/pen/DdGRYG)

## Development

With Node.js 24 installed, run `npm ci`, `npm test`, and `npm run build`. The browser game lives in `docs`. The editable 3D garden sources live in `src`. After editing the 3D garden, include the rebuilt `docs/garden-view.mjs` in your commit. GitHub Pages serves `docs` from `main`.

Board scores are shared with the original game through its hosted leaderboard API. The server implementation lives in `worker`, and the database schema and migrations live in `db` and `drizzle`.
