# Corgi Word Hunt

[Play in your browser](https://carteruh.github.io/corgi-word-hunt/)

Trace adjacent letters to find as many words as you can in one minute. Share a board link and compare your best scores with friends under a nickname. Players can join from a phone or a computer without an account.

In the meadow, tap to plant a flower and play the next flute note of Joe Hisaishi’s *Merry-Go-Round of Life*. Drag a trail to hear a whole phrase. On a keyboard, use Enter for a note and Shift + Enter for a phrase. Clover brings you tulips when the round ends.

## Development

With Node.js 24 installed, run `npm ci`, `npm test`, and `npm run build`. The browser game lives in `web`. The editable 3D garden sources live in `src`. Changes pushed to `main` rebuild the garden and publish `web` to GitHub Pages.

Board scores are shared with the original game through its hosted leaderboard API. The server implementation lives in `worker`, and the database schema and migrations live in `db` and `drizzle`.
