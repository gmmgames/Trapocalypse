# TRAPOCALYPSE

An online party platformer inspired by Ultimate Chicken Horse. Build traps, run the course, betray your friends. Built by Sochima.

## How to play

Install Node.js, then run `npm install` and `npm start` from the project folder. Open
`http://localhost:8080` in your browser. To play across devices, host the server on a
machine reachable by the other devices and have everyone open that machine's URL.

**Controls**

| Action | Keyboard | Phone |
|---|---|---|
| Move | Arrow keys or A / D | Left and right buttons |
| Jump | Up, W, or Space | JUMP button |

Enter your name and create a room, or press Join Room to pick from the list of open rooms
(or type a private room's six-character code at the top). You also have a permanent
six-character player ID at the bottom of the screen: give it to a friend and they can
invite you straight into their room. Up to 24 can be in a room. Everyone lands in a lobby that lists who is here. The host sets the
match rules there (time limit per run, points to win, round cap, and what a win, a trap
kill, and Trailblazer are worth; dropdowns have a Custom box for your own number) and can
change them until the start. Pick a color from the 24-color palette; you can change it
until the start, then it's yours for the whole match. Only the host can press Start Trap
Apocalypse, and only once at least two players are in and everyone has a color. Start
opens a ten-second vote on the first course. Leave Room, top right, takes you back to
the menu at any time. If the host leaves, the longest-present player becomes host. The
gear, top left, has the chat filter, sounds, How to Play, and (for the host) an early
Back to Lobby. Chat opens with / or T.

Each round the room is offered a random handful of items (Spikes, Crumbler, Glue, Bumper,
and sometimes the one-per-course Eraser), shown as pictures. Everyone picks one; while
any item is still free, two players can't take the same one. Tap the course to set your
item down as a see-through ghost, move it if you like, then press E or the check button
to confirm. Once everyone has used their item, everyone runs at once with a single life. Your own nametag
is white; everyone else's shows in the color they picked. A clock counts down in the
corner; when it hits zero, anyone still running is out.

The round ends when every runner has reached the flag, died, or run out of time. Each
finisher scores a win (4 by default). If everyone dies, or everyone makes it, nobody
scores. With three or more runners and at least two finishers, the first to the flag is
the Trailblazer (2 more by default) and a burst slams onto everyone's screen. Your trap's
kills are worth 1 each by default, but only paid if you reach the flag yourself that
round. A bar chart shows the standings for ten seconds, tallest on the left, each bar
growing one point source at a time so you can see where every point came from. Then the
next round starts on its own with the old traps still in place. After three rounds the
room moves to a new course, chosen by a vote on the results screen (ties are random, no
votes means the next one in the list), with a clean slate. Traps can't be placed on a
runner or on the flag. There are seven courses, each with its own look.

The match ends when someone reaches the points target, or when the round cap is hit and
the top score wins. If two or more players qualify in the same round, or tie on top at
the cap, they fight a Final Battle: one more run on the current course, no build phase,
everyone else watching. First to the flag gets 5, second 3, third 1, nobody else scores.
If nobody finishes it runs again; after three Final Battles with no decision the tie is
shared. Before a Final Battle each fighter is dealt three weapons and picks one: Rocket
Boots, Dash, Shield, Freeze Ray, Trap Bomb, or Feather (X, Shift, or the USE button
fires it). The winner screen shows the final chart and the winner's name. The host's Back
to Lobby button resets the scores and keeps everyone's colors and settings.

Tap jump early before you land and it still counts. Let go of jump early for a shorter hop.

## Build log

- **Day 1:** A runner. Canvas, game loop, gravity, collision, spikes, and a square that runs and jumps across platforms to the flag. Falling off the bottom or touching a spike resets you.
- **Day 2:** Three levels with automatic progression and distinct platform layouts.
- **Day 3:** Build-and-betray party mode with trap placement and death scoring.
- **Day 4:** Online rooms for multiple devices with synchronized traps and runners.
- **Day 5:** The round loop. One life per round, a point for finishing, automatic next round, one trap per player, traps accumulate, levels rotate every three rounds.
- **Day 6:** Identity. A 24-color picker, nametags over every runner, a sorted bar chart between rounds, and the room panel gets out of the way once the run starts.
- **Day 7:** Bigger rooms. Up to 24 players, colors kept for the whole game, no points when everyone finishes, and a "First One There!" bonus in races of three or more.
- **Day 8:** A real match. Host settings (time limit, points to win, round cap), a lobby with a host-only start and a Leave Room button, a run clock, 4/2/1 scoring with trap kills paid only to owners who finish, a winner screen, and a Final Battle to settle ties.

- **Day 9:** Seven courses with their own looks (only one of them neon), dust under runners' feet, map voting in the lobby and before each course change, host-set point values, the Trailblazer burst, and a ten-second results screen where the bars grow one point source at a time.

- **Day 10:** Fun fonts, How to Play, chat with a filter and a settings gear, sounds, three new trap kinds, the eraser, Final Battle weapons, then a reshuffle: a bare menu, host settings and the color picker inside the lobby, a ten-second course vote after Start, random trap per round, eraser as your item, angled bumpers, click-through chat, and a bubbly cursor.

- **Day 11:** Your logo on a centered menu, permanent 6-character player IDs with invites and a public room list, a stricter name filter, and the item draft: each round the room is dealt a handful of item cards, everyone picks one, then places it as a ghost and confirms.

- **Day 12:** Shapes. Ten character models (cube, ball, wedge, ghost, diamond, dino, unicorn, cat, bunny, robot) picked in the lobby and remembered, plus a secret black-and-white 1928-style mouse for anyone with "mouse" in their name. The title screen is a random little world you can hop around in. Two rare items: the Pencil (sketch blocks to stand on, mid-run) and the Teleport Ball (throw it, appear where it lands). Autonomous and Curiosity bursts on the results screen, a podium finale with a disco ball and dancing shapes, springs that squash and stretch, a grabbable chat scroll strip, finished runners still visible at the flag, cards dealt as independent draws with a rarer eraser, Autonomous points in the host settings, ice only on top of blocks, random colors for anyone who forgot to pick, host Kick and Ban tools, a solo Test Match, the game filling the whole window, and five new courses (three built around wall jumps): Chimney Climb, Tower Hop, The Well, Skyline, Hedge Maze.

Coming up: polish and the parked bug list.

## What each file does

| File | Job |
|---|---|
| `index.html` | The page: canvas, message box, touch buttons, loads the scripts in order |
| `style.css` | Dark theme, fills the whole window, shows touch buttons only on touch screens |
| `js/input.js` | Turns keys and touch buttons into `left`, `right`, `jump` |
| `js/physics.js` | Gravity and rectangle collision, moves a body and pushes it out of walls |
| `js/level.js` | Twelve tile-grid courses with their color themes, the random title world, trap and item drawing |
| `js/dust.js` | The puffs under runners' feet, visual only |
| `js/audio.js` | Sound effects synthesized in the browser, no sound files |
| `js/chatfilter.js` | The word list and the bleeping for the chat filter |
| `js/player.js` | The runner: speed, jump height, wall slide and wall jump, dying, finishing, and `drawAvatar` for every shape |
| `js/main.js` | The game loop, online room UI, synchronization, and rendering |
| `js/network.js` | WebSocket client for rooms and real-time game events |
| `server.js` | Static file server and WebSocket room server |

## Knobs worth turning

Open `js/player.js` and change these, then refresh the browser:

- `RUN_SPEED` how fast you move sideways
- `JUMP_SPEED` how high you jump
- `COYOTE_TIME` how forgiving edges are

Open `js/physics.js` and change `GRAVITY` to make the whole world feel heavier or floatier.

Open `server.js` for the round rules, then restart the server:

- `TRAPS_PER_ROUND` how many traps each player places before a run
- `ROUNDS_PER_LEVEL` how many rounds before the room moves to the next level
- `NEXT_ROUND_DELAY` seconds the scoreboard shows before the next round
- `FINISH_POINTS` (4), `FIRST_BONUS` (2, the Trailblazer), and `KILL_POINTS` (1) are the defaults for the host's point-value boxes. Kills pay at round end only if the trap's owner finished; level spikes, falls, and your own trap pay nothing.
- `NEXT_ROUND_DELAY` (10) is also how long the bars have to grow; `BANNER_SECONDS` at the top of `js/main.js` is how long the Trailblazer burst stays.
- Courses and their themes live in `LEVELS` and `THEMES` at the top of `js/level.js`. Add a course there and it shows up in the vote automatically.
- `FINAL_BONUSES` (5, 3, 1) for the podium in a Final Battle, `FINAL_BATTLE_MAX_RUNS` (3) before a tie is shared
- `SETTING_LIMITS` and `SETTING_DEFAULTS` for what the host may pick: time limit 30-600 s or Infinite (default 60), points to win 15-600 (default 45), round cap 3-60 (default 30), and the point values Win 1-20, Kill 0-10, Trailblazer 0-10, Autonomous 0-10. The dropdown presets live in `index.html`.
- `ITEM_WEIGHTS` is how often each item card turns up: traps 1 each, eraser 0.5, pencil 0.2, teleport ball 0.08. `PENCIL_CHARGES` (3) strokes per pencil, `PENCIL_MAX_BLOCKS` (8) squares per stroke.
- `BAN_LENGTHS` are the host's ban options (5 min, 30 min, 2 h, 24 h, forever). Bans are per room and vanish when the room empties.
- `AVATARS` lists the shapes; `SECRET_AVATARS` says what unlocks a hidden one. The drawings live in `drawAvatar` in `js/player.js`.
- `MAX_PLAYERS` room size (24, one per palette color)

The 24 swatch colors live in `PALETTE` at the top of `js/main.js`.

## Putting it online

The game needs its Node server running somewhere public; GitHub only stores the files. On [Render](https://render.com): New → Web Service → pick the `gmmgames/Trapocalypse` repo, runtime Node, build command `npm install`, start command `npm start`, free plan. Render sets the `PORT` environment variable and the server already reads it; the browser connects back to whatever address the page came from, over `wss` on https. The free plan sleeps after 15 minutes without visitors, so the first join can take about half a minute.
