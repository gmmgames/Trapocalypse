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

Enter your name and create a room. Share the six-character room code, then other
players join from their own browsers, up to 24 in a room. When you join you pick a color
from the 24-color palette, and it's yours for the whole game. Nothing starts until at
least two players are in. Each round, every player places one trap. Once everyone has
placed, the room panel disappears and everyone runs at once with a single life. Your own
nametag is white; everyone else's shows in the color they picked.

The round ends when every runner has either reached the flag or died. Each finisher
scores one point. If everyone dies, or everyone makes it, nobody scores. With three or
more runners and at least two finishers, the first to the flag gets an extra point and
"First One There!" flashes on everyone's screen. A bar chart shows the standings, tallest
on the left, then the next round starts on its own a few seconds later with the old
traps still in place. After three rounds the room moves to the next level with a clean
course. Traps can't be placed on a runner or on the flag.

Tap jump early before you land and it still counts. Let go of jump early for a shorter hop.

## Build log

- **Day 1:** A runner. Canvas, game loop, gravity, collision, spikes, and a square that runs and jumps across platforms to the flag. Falling off the bottom or touching a spike resets you.
- **Day 2:** Three levels with automatic progression and distinct platform layouts.
- **Day 3:** Build-and-betray party mode with trap placement and death scoring.
- **Day 4:** Online rooms for multiple devices with synchronized traps and runners.
- **Day 5:** The round loop. One life per round, a point for finishing, automatic next round, one trap per player, traps accumulate, levels rotate every three rounds.
- **Day 6:** Identity. A 24-color picker, nametags over every runner, a sorted bar chart between rounds, and the room panel gets out of the way once the run starts.
- **Day 7:** Bigger rooms. Up to 24 players, colors kept for the whole game, no points when everyone finishes, and a "First One There!" bonus in races of three or more.

Coming up: trap variety, a closing timer after the first finish, polish.

## What each file does

| File | Job |
|---|---|
| `index.html` | The page: canvas, message box, touch buttons, loads the scripts in order |
| `style.css` | Dark background, keeps the 16:9 shape, shows touch buttons only on touch screens |
| `js/input.js` | Turns keys and touch buttons into `left`, `right`, `jump` |
| `js/physics.js` | Gravity and rectangle collision, moves a body and pushes it out of walls |
| `js/level.js` | Three tile grids, ground, platforms, traps, start points, and flags |
| `js/player.js` | The runner: speed, jump height, coyote time, dying, finishing |
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
- `FINISH_POINTS` for reaching the flag, `FIRST_BONUS` for the first finisher in a race of three or more
- `MAX_PLAYERS` room size (24, one per palette color)

The 24 swatch colors live in `PALETTE` at the top of `js/main.js`.
