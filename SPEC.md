# Spec: Match settings, lobby, time limit, and winner screen

Date: 2026-09-02. Status: LOCKED (approved by owner 2026-09-02). v1 scored 4/10 and v2 scored 7/10 by independent reviewers; every finding from both rounds is addressed below.

## Context

Trapocalypse rounds currently repeat forever: there is no match end, no winner, no time limit, and no lobby. The run starts the instant every player has placed a trap, and a runner who stands still stalls the round for everyone. The owner (Sochima) wants a host to create a room with match settings, everyone to gather in a lobby first, rounds to have a time limit, and the match to end with a winner screen when someone reaches the points target or the round cap is hit, with a Final Battle among everyone who qualifies.

## Current State (verified by reading code and by a scripted two-player playthrough on 2026-09-02)

| Behavior | Where | Today |
|---|---|---|
| Round rule constants | server.js:18-26 | `FINISH_POINTS = 1`, `FIRST_BONUS = 1`, `KILL_POINTS = 1`, `NEXT_ROUND_DELAY = 4`, `ROUNDS_PER_LEVEL = 3`, `MAX_PLAYERS = 24`, `PALETTE_SIZE = 24`. Line 27 `PLAYER_W, PLAYER_H` is a body-size constant used by `trapBlocked` (server.js:73) and must be kept. |
| Room creation | server.js:154-169 | Room object `{ code, phase: "build", round: 1, levelIndex: 0, traps, players, timer, finishOrder }`. No settings. First player gets `host: true` in the `joined` message only; the server never stores who the host is. |
| Phases | server.js | `build` -> `run` -> `results` -> `build` ... forever. No `lobby`, no `winner`. |
| Player statuses | server.js:161, 81, 207, 218 | `building`, `running`, `dead`, `finished`, `out` (joined mid-run) |
| Run start | server.js:198, 236 | Automatic when `players.size >= 2` and every player has `trapCount >= TRAPS_PER_ROUND`. No host action. |
| Round end | server.js:90-118 | Only when no player has status `running`. No timer. Verified stall: one player standing still kept phase `run` indefinitely. |
| Scoring | server.js:97-105 | Finishers +1 unless everyone finished. First finisher +1 when `runners > 2 && finishers >= 2`. |
| Kill credit | server.js:206-216 | Awarded immediately at the moment of death (line 213), whether or not the owner finishes. Client shows "Your trap got X! +1" (main.js:235) and adds the points locally (main.js:238). |
| Round counter | server.js:120-133 | `room.round += 1`; when it exceeds `ROUNDS_PER_LEVEL` it is **reset to 1**, the level index advances, and traps are cleared. So `room.round` only ever holds 1, 2 or 3. There is no count of total rounds played. |
| Room with 1 player in build | server.js:198, 236 | Waits forever ("Waiting for another player"). |
| Client online start | main.js:89-101, 568-579 | Create/Join connects; `Game.phase = "lobby"` is only a "connecting" placeholder. |
| Room panel | main.js:219 | Hidden on the first `phase: run` and never shown again. |
| Scoreboard | main.js:398-471, gated at 525 on `phase === "results"` | Title "ROUND n RESULTS", countdown "Next round in n". |
| First banner | main.js:497 | Text "+1 Point" is hard-coded although the server sends `firstBonus`. |
| HUD (online) | main.js:527-529 | `ROUND r/3  <level>  •  <message>` |
| Color pick message | main.js:203 | Always "Now tap the level to place your trap." |
| Leave room | none | No button. Closing the tab is the only way out. |
| Panel markup | index.html:32-41 | Name input, code input, Create Room, Join Room, status line. |
| Build box on fresh load | index.html:18, style.css:105/116 | Visible in solo mode on every fresh page (pre-existing issue, out of scope). |

## Proposed Change

### 1. Match settings

**Server constants.** Edit the block at server.js:18-26. Keep line 27 (`PLAYER_W`, `PLAYER_H`) exactly as is.

```js
const TRAPS_PER_ROUND = 1;
const ROUNDS_PER_LEVEL = 3;       // rounds on one course before rotating (unchanged)
const NEXT_ROUND_DELAY = 4;
const FINISH_POINTS = 4;          // was 1
const FIRST_BONUS = 2;            // was 1
const KILL_POINTS = 1;            // paid at round end, only if the trap's owner finished that round
const FINAL_BONUSES = [5, 3, 1];  // Final Battle: 1st, 2nd, 3rd to the flag. Everyone else 0.
const FINAL_BATTLE_MAX_RERUNS = 3; // no-finisher Final Battles before the tie is declared shared
const MAX_PLAYERS = 24;
const PALETTE_SIZE = 24;
const SETTING_LIMITS = { timeLimit: [30, 600], pointsToWin: [15, 99], roundCap: [3, 60] };
const SETTING_DEFAULTS = { timeLimit: 60, pointsToWin: 45, roundCap: 30 };
const SETTING_LABELS = { timeLimit: "Time limit", pointsToWin: "Points to win", roundCap: "Round cap" };
```

`timeLimit` is whole seconds per run, or `null` for Infinite.

**`validateSettings(raw)`** (server.js, new function above the connection handler). `raw` may be undefined. Returns `{ ok: true, settings }` or `{ ok: false, message }`.
- For each key in `SETTING_LIMITS`: value = `raw && raw[key]`. If `undefined` -> default. If key is `timeLimit` and value is exactly `null` -> `null` (Infinite). Otherwise `n = Number(value)`; require `Number.isInteger(n)` and `min <= n <= max`; else return `{ ok: false, message: \`${SETTING_LABELS[key]} must be between ${min} and ${max}.\` }`. Check keys in the order timeLimit, pointsToWin, roundCap and report the first failure only.

**Protocol.** `create_room` gains `settings: { timeLimit, pointsToWin, roundCap }` (`timeLimit` may be JSON `null`). Invalid -> `send(socket, { type: "error", message })`, return without creating a room or attaching `socket.room`. `room.settings` = validated settings. `snapshot()` gains `settings`, `hostId`, `winnerIds` (array, empty unless phase is `winner`), `finalBattleIds` (array, empty unless a Final Battle is pending or running).

**Client panel.** index.html, inside `#online-panel`, inserted directly after the `#room-code` input:

```html
<fieldset id="match-settings">
  <legend>Match settings (host)</legend>
  <label>Time limit
    <select id="set-time">
      <option value="30">30 s</option><option value="45">45 s</option><option value="60" selected>60 s</option>
      <option value="90">90 s</option><option value="120">120 s</option><option value="null">Infinite</option>
      <option value="custom">Custom…</option>
    </select>
    <input id="set-time-custom" type="number" min="30" max="600" step="1" placeholder="30–600" class="hidden">
  </label>
  <label>Points to win
    <select id="set-points">
      <option value="20">20</option><option value="30">30</option><option value="45" selected>45</option>
      <option value="60">60</option><option value="99">99</option><option value="custom">Custom…</option>
    </select>
    <input id="set-points-custom" type="number" min="15" max="99" step="1" placeholder="15–99" class="hidden">
  </label>
  <label>Round cap
    <select id="set-rounds">
      <option value="5">5</option><option value="10">10</option><option value="15">15</option>
      <option value="20">20</option><option value="30" selected>30</option><option value="60">60</option>
      <option value="custom">Custom…</option>
    </select>
    <input id="set-rounds-custom" type="number" min="3" max="60" step="1" placeholder="3–60" class="hidden">
  </label>
</fieldset>
```

- A `change` listener on each select toggles the `hidden` class on its sibling input: shown iff the select value is `"custom"`.
- `readSettings()` (main.js): for each of the three, take the select value; if `"custom"`, take the input's `value` string. Map the string `"null"` to `null`. Otherwise `Number(text)`. Validate with the same rule as the server (integer, inclusive range; `null` allowed only for time). On the first failure: set `#online-status` to the same message string the server would produce, and return `null`. Create Room click: `const settings = readSettings(); if (!settings) return;` before `Game.startOnline()`, then `Network.connect(name, "", settings)`. No snapping, no clamping.
- **Wire.** `Network.connect(name, code = "", settings = null)` stores `settings` and the `open` handler sends `{ type: code ? "join_room" : "create_room", name, code, settings }`. Join Room passes no settings and the server ignores `settings` on `join_room`.
- `#match-settings` disappears with the whole panel when the client is in a room (§3).
- **Fatal errors.** The server marks every error that means "you are not in a room" with `fatal: true`: invalid settings, `Room not found.`, `That room is full (...)`. All other errors (`Only the host can start.`, `You need at least 2 players.`, etc.) have no `fatal` field. Client `error` handler: show the message in `#online-status` and via `say()` as today; if `message.fatal` also run `Game.leaveOnline(message.message)` (§3), which keeps that text in `#online-status` instead of the default. Non-fatal errors never call `leaveOnline`.

### 2. Scoring

- Finish = `FINISH_POINTS` (4). First bonus = `FIRST_BONUS` (2). Conditions unchanged (`runners > 2 && finishers >= 2`; nobody scores if everyone finished). **Normal scoring does not run during a Final Battle** (§5).
- **Kill credit moves to round end.** Players gain `pendingKills: 0` at creation. In the `died` handler, keep the trap lookup and the `killer` computation (server.js:211-212). Replace line 213 with `if (killer) killer.pendingKills += 1;`. The `status` broadcast keeps `killedBy` and `killPoints` so clients can show who got whom. In `checkRoundOver`, inside the `!everyoneFinished` block after finish points: for each player with status `finished`, `score += pendingKills * KILL_POINTS` and record `killBonus[player.id] = pendingKills * KILL_POINTS` when > 0. After scoring (every path), set `pendingKills = 0` for all players. Also zero it in `startNextRound`, `startFinalBattle`, `toLobby`.
- `round_over` gains `killBonus` (object, possibly empty).
- Client (main.js:235): the owner's message depends on the owner's own status in `this.players` at that moment: `running` -> `` `Your trap got ${victim}! Finish to bank +${message.killPoints}` ``; `finished` -> `` `Your trap got ${victim}! +${message.killPoints} banked` ``; anything else (`dead`, `out`) -> `` `Your trap got ${victim}! No points, you didn't finish.` ``. Delete the local `killer.score += message.killPoints;` line (main.js:238). Keep `this.showScores()`. The server pays the kill only to owners with status `finished` at round end, so a spectator's or dead owner's trap never scores.
- Client `round_over` message (main.js:251-254): compute `const extra = message.killBonus && message.killBonus[Network.id] ? \` +${message.killBonus[Network.id]} from your traps\` : "";` and append `extra` to whichever of the four strings is chosen (e.g. `"You scored! +1 from your traps"`).
- `round_over` already sends `firstBonus`; client stores it as `this._firstBonus` and `drawFirstBanner` renders `` `+${this._firstBonus} Points` `` in place of the literal at main.js:497.

### 3. Lobby, host, leaving

**Server.**
- Room fields added: `hostId`, `settings`, `runTimer: null`, `finalBattle: null` (see §5 for shape), `winnerIds: []`, `roundsPlayed: 0` (see §4).
- Rooms are created with `phase: "lobby"`; `hostId` = creator id.
- Join while `lobby` -> status `waiting`. Join while `build` -> `building`. Join while `run`, `results`, or `winner` -> `out` (unchanged). A joiner during `winner` sees the winner screen and the color picker over it; they pick a color and wait for Back to Lobby. Accepted.
- **`removePlayer(socket)`** (new function) replaces the body of the current `close` handler (server.js:224-237) and is called by both the `close` event and the new `leave_room` message. Steps, in this order: (a) if `!socket.room || !socket.player` return; capture `room` and `player`, then set `socket.room = null; socket.player = null` so a second call is a no-op; (b) `room.players.delete(player.id)`; (c) if the room is now empty: `clearTimeout(room.timer)`, `clearTimeout(room.runTimer)`, `rooms.delete(room.code)`, return; (d) if `player.id === room.hostId`: `room.hostId` = the first key of `room.players` (insertion order = join order); (e) `broadcast(room, snapshot(room))` (one snapshot, and it already carries the new host); (f) Final Battle participant rule (§5), which may itself broadcast; (g) `checkRoundOver(room)` (existing line 235); (h) the existing auto-start check (line 236), which only applies in `build`.
- **A room that drops to one player** in `build` keeps waiting exactly as today (the build box says "Waiting for another player"), with traps intact; the new Leave Room button is the way out. In `run`, the remaining runner's round ends by the existing rules (a lone finisher is "everyone finished", so no points). No automatic return to the lobby.
- **Already in a room.** `create_room` / `join_room` from a socket whose `socket.room` is set replies `{ type: "error", message: "You're already in a room." }` (not fatal) and does nothing else.
- **`toLobby(room, { resetScores })`**: `clearTimeout(room.timer); clearTimeout(room.runTimer);` then `phase = "lobby"`, `round = 1`, `roundsPlayed = 0`, `levelIndex = 0`, `traps = []`, `finishOrder = []`, `finalBattle = null`, `winnerIds = []`, `timer = null`, `runTimer = null`; every player `trapCount = 0`, `pendingKills = 0`, `status = "waiting"`, and `score = 0` only if `resetScores`. Colors and settings kept. Broadcast `snapshot`.
- **Timer callbacks are phase-guarded.** `startNextRound`, `startFinalBattle`, and `declareWinner` each begin with `room.timer = null; if (room.phase !== "results" || room.players.size === 0) return;`. `timeUp` begins with `room.runTimer = null; if (room.phase !== "run") return;`. A timer that fires after the room moved on therefore does nothing.
- **`start_match`**: accepted only when all of: sender is `hostId`, `phase === "lobby"`, `players.size >= 2`, every player `color !== null`. Otherwise reply `error` with, in this order of checks: `"Only the host can start."`, `"Use Back to Lobby first."` (when phase is `winner`) or `"The match has already started."` (any other non-lobby phase), `"You need at least 2 players."`, `"Everyone needs to pick a color first."`. On success: every player `score = 0`, `trapCount = 0`, `pendingKills = 0`, `status = "building"`; `round = 1`, `roundsPlayed = 0`, `levelIndex = 0`, `traps = []`, `finishOrder = []`, `phase = "build"`; broadcast `{ ...snapshot(room), type: "round_start" }`.
- `place_trap`, `died`, `finished` already require `build`/`run` and so are ignored in `lobby` and `winner`.

**Client.**
- New DOM (index.html, inside `#game-wrap` after `#color-picker`):

```html
<div id="lobby" class="hidden">
  <strong id="lobby-title">ROOM ------</strong>
  <span id="lobby-settings"></span>
  <ul id="lobby-players"></ul>
  <button id="start-match" type="button" class="hidden">Start Trap Apocalypse</button>
  <span id="lobby-note"></span>
</div>
<button id="leave-room" type="button" class="hidden">Leave Room</button>
```

- `#leave-room` is one button, `position: fixed; top: 18px; right: 18px; z-index: 4`, styled like the panel buttons. Visible iff `Game.inRoom` is true. `inRoom` is set to `true` by `applyRoomState` (the first `room_state`) and to `false` by `leaveOnline()` and by `startOnline()`. While connecting (before any `room_state`) the button is hidden.
- `#lobby` styled like `#color-picker` (centered box, 1px `rgba(255,210,60,0.7)` border, `rgba(11,11,20,0.94)` background, `z-index: 2`). `#lobby-players` is an unstyled list; each `li` has a 12px square `span` (background = palette color, or `#45455d` when `color === null`), the name, and ` (host)` when `id === hostId`.
- **`renderRoom()`** runs after every `room_state`, `round_start`, `color`, and `match_over`: `onlinePanel.classList.add("hidden")`; `#lobby` visible iff `phase === "lobby"`; `#lobby-title` = `ROOM <code>`; `#lobby-settings` = `` `Time limit ${timeLimit === null ? "Infinite" : timeLimit + " s"}  •  First to ${pointsToWin}  •  Max ${roundCap} rounds` ``; player list as above; `#start-match` visible iff `Network.id === hostId`; `#lobby-note` = for non-host `"Waiting for the host to start"`, for host with < 2 players `"Need at least 2 players"`, for host when any player lacks a color `"Waiting for everyone to pick a color"`, else `""`; `#winner-hud` per §5.
- `applyRoomState` stores `hostId`, `settings`, `winnerIds`, `finalBattleIds` on `Game`.
- Color pick message (main.js:203): `this.say(this.phase === "lobby" ? "Color picked. Waiting in the lobby." : "Now tap the level to place your trap.", 3)`.
- Mid-match joiner message (main.js:188): when `this.phase === "winner"` say `"Match over. Pick a color and wait for the lobby."`; otherwise the existing `"Round in progress. Pick a color for next round."`.
- **Leave Room click** -> `Network.leave()` then `Game.leaveOnline()`. `Network.leave()`: `this.send({ type: "leave_room" }); const old = this.socket; this.socket = null; old.close();`. Every listener registered in `connect()` is bound to its own socket and starts with `if (this.socket !== sock) return;` (where `sock` is the socket the listener was attached to), so events from an abandoned socket, including its late `close`, are ignored. This replaces the `leaving` flag idea entirely. `connected` is set to `false` in `leave()`.
- **`Game.leaveOnline(statusText = "Create a room or join a friend.")`**: `mode = "solo"`, `phase = "run"`, `inRoom = false`, `players = []`, `remotePlayers = {}`, `_chartX = {}`, `myColor = null`, `hostId = null`, `winnerIds = []`, `finalBattleIds = []`, `levelIndex = 0`, `complete = false`, `_resetTimer = 0`, `_advanceLevel = false`, `_runTimeLeft = null`, `Player.color = "#ff3c78"`, `Level.load(0)`, `Player.spawn()`, hide `#lobby`, `#color-picker`, `#winner-hud`, `#leave-room`; leave `#build-hud` untouched; show `#online-panel`; `onlineStatus.textContent = statusText`; `roomCodeInput.value = ""`; `this.say("Left the room.", 2)`. (The build box may or may not be visible afterwards depending on history; the fresh-load build-box issue is out of scope.)
- `_chartX = {}` is also reset whenever a `room_state` with `phase === "lobby"` arrives, so a new match's chart starts clean.
- HUD in lobby: `ROOM <code>  •  <message>`.

### 4. Round counter and time limit

**Round counter.** `room.round` becomes the cumulative match round (1, 2, 3, 4, …). Rewrite `startNextRound` (server.js:120-133):

```js
function startNextRound(room) {
  room.timer = null;
  if (room.players.size === 0) return;
  room.round += 1;
  if ((room.round - 1) % ROUNDS_PER_LEVEL === 0) {      // rounds 4, 7, 10, … start a fresh course
    room.levelIndex = (room.levelIndex + 1) % LEVELS.length;
    room.traps = [];
  }
  room.phase = "build";
  for (const player of room.players.values()) { player.trapCount = 0; player.pendingKills = 0; player.status = "building"; }
  broadcast(room, { ...snapshot(room), type: "round_start" });
}
```

Traps still persist for exactly 3 rounds and the level still rotates every 3 rounds; only the displayed number keeps counting. `roundsPlayed` is incremented in `checkRoundOver` when a normal (non-Final-Battle) round ends, and is what the round cap compares against (so a Final Battle re-run never counts toward the cap). Labels: the HUD line at main.js:528 changes from `ROUND r/3` to `ROUND <round> of <roundCap>`; the scoreboard title (main.js:417) and the build box title (main.js:540) keep their current wording and simply show the cumulative number (`ROUND 7 RESULTS`, `ROUND 7 BUILD`).

**HUD by phase (online).** `lobby`: `ROOM <code>  •  <message>`. `build` and `results`: `ROUND <round> of <roundCap>  <level>  •  <message>`. `run`: the same plus the clock (below). `winner`: `MATCH OVER  •  <message>`. Non-Final-Battle scoreboard countdown line (main.js:420): `Next round in n` as today, except `Final Battle in n` when `round_over.finalBattle` is set and `Final results in n` when `round_over.winnerPending` is set (§5).

**Time limit.**
- `startRun(room)`: `clearTimeout(room.runTimer)`; if `room.settings.timeLimit !== null`, `room.runTimer = setTimeout(() => timeUp(room), room.settings.timeLimit * 1000)`. Broadcast `{ type: "phase", phase: "run", timeLimit, finalBattleIds: room.finalBattle ? room.finalBattle.ids : [] }`.
- `timeUp(room)`: `room.runTimer = null`; if `phase !== "run"` return; `timedOut` = ids of players with status `running`; set each to `dead`; broadcast `{ type: "time_up", timedOut }`; `checkRoundOver(room)`.
- `checkRoundOver` does `clearTimeout(room.runTimer); room.runTimer = null;` when it decides the round is over. `removePlayer` clears both timers when the room is deleted.
- A `finished` message that arrives after `timeUp` finds status `dead`, not `running`, and is ignored (existing guard at server.js:217). The server is authoritative.
- Client: on `phase run`, `_runTimeLeft = message.timeLimit` (number or `null`) and `_runStartedAt = performance.now()`. In `update`, if `phase === "run"` and `_runTimeLeft !== null`, recompute `_runTimeLeft = Math.max(0, message.timeLimit - (performance.now() - _runStartedAt) / 1000)` (wall clock, so a hidden tab does not make the clock drift). On `time_up` and `round_over`, `_runTimeLeft = null`. HUD during `run`: `` `ROUND ${round} of ${roundCap}  ${Level.name}${_runTimeLeft === null ? "" : \`  •  ⏱ ${Math.ceil(_runTimeLeft)}s\`}  •  ${message}` ``. On `time_up`: for each id in `timedOut`, set that player's `status = "dead"` in `this.players` and, if in `remotePlayers`, `alive = false`; if it includes `Network.id`: `Player.alive = false; Player.finished = false; say("Time's up!", 2)`. If the local client believed it had finished but is in `timedOut`, the same assignment applies and the message is `"Too late! Time ran out."`.

### 5. Match end, Final Battle, winner screen

**Server.** `room.finalBattle` is `null` or `{ ids: [playerId…], runs: 0 }`, where `runs` counts every Final Battle run started in this match (re-runs and re-ties alike).

**`checkRoundOver` is restructured** into four steps, replacing lines 106-117: (1) scoring, (2) `const decision = decideMatchState(room)`, (3) one `round_over` broadcast that includes the decision fields, (4) arm one timer from the decision. The existing `round_over` fields (`round`, `finishers`, `everyoneFinished`, `firstFinisher`, `firstBonus`, `nextIn`, `players`) stay; new fields are `killBonus` (§2), `finalBattle` (`null` or `{ ids, again }`), and `winnerPending` (`null` or `[ids]`).

Step 1, scoring, when `room.finalBattle` is set: **skip** the normal finish/first/kill block. Participants = `finalBattle.ids` filtered to players still in the room; finishers among them ordered by `finishOrder`; the i-th finisher (`i` = 0, 1, 2) gains `FINAL_BONUSES[i]`; nobody else gains anything. `everyoneFinished` is reported `false`, `firstFinisher` `null`, `killBonus` `{}`. `pendingKills` zeroed for everyone in every case.

Step 2, `decideMatchState(room)` returns one of `{ kind: "next" }`, `{ kind: "final", ids }`, `{ kind: "winner", ids }`:
- If `room.finalBattle` is set (a Final Battle just ended): participants as above. If `participants.length === 0` -> `{ kind: "winner", ids: maxScoreIds(room) }`. Else if no participant finished -> if `finalBattle.runs >= FINAL_BATTLE_MAX_RERUNS` `{ kind: "winner", ids: participants }` else `{ kind: "final", ids: participants }`. Else `leaders` = participants with the maximum score among participants; one leader -> `{ kind: "winner", ids: [leader] }`; several -> if `finalBattle.runs >= FINAL_BATTLE_MAX_RERUNS` `{ kind: "winner", ids: leaders }` else `{ kind: "final", ids: leaders }`.
- Else (normal round): `roundsPlayed += 1`. `qualified` = players with status not `out` and `score >= pointsToWin`. If none and `roundsPlayed >= roundCap`: `qualified` = `maxScoreIds(room)` (players with status not `out` having the maximum score; can be everyone, including all-zero). None -> `{ kind: "next" }`. One -> `{ kind: "winner", ids }`. Several -> `{ kind: "final", ids }`. Per the owner's rule, **everyone who reaches the target in the same round goes to the Final Battle, even if their scores differ.**
- `maxScoreIds(room)` = ids of players with status not `out` whose score equals the maximum; if that set is empty (everyone is `out`), all player ids.

Step 3: `finalBattle` field = `decision.kind === "final" ? { ids, again: <true iff room.finalBattle was already set and no participant finished> } : null`; `winnerPending` = `decision.kind === "winner" ? ids : null`. If `decision.kind === "final"`, set `room.finalBattle = { ids, runs: room.finalBattle ? room.finalBattle.runs : 0 }` before broadcasting; if `"next"` or `"winner"`, set `room.finalBattle = null`.

Step 4: `"next"` -> `room.timer = setTimeout(() => startNextRound(room), NEXT_ROUND_DELAY * 1000)`. `"final"` -> `setTimeout(() => startFinalBattle(room), …)`. `"winner"` -> `setTimeout(() => declareWinner(room, ids), …)` so the chart shows for the usual delay first.

`declareWinner(room, ids)`: phase guard (§3); `ids` filtered to players still present; if empty, `ids = maxScoreIds(room)`; `phase = "winner"`, `winnerIds = ids`, `finalBattle = null`; broadcast `{ type: "match_over", winnerIds, players: playerList(room) }`.

`startFinalBattle(room)`: phase guard (§3); drop ids no longer in the room; if fewer than 2 remain, call `declareWinner(room, ids)` and return. Otherwise `finalBattle.runs += 1`, `finishOrder = []`, all `pendingKills = 0`; participants -> `running`, everyone else -> `out`; traps unchanged; `round` unchanged; then `startRun(room)`. `startRun` sets every status to `running` only when `room.finalBattle` is `null`; otherwise it leaves statuses alone.

Participant leaves (`removePlayer` step f): if `room.finalBattle` is set, remove the id from `finalBattle.ids`. If `phase === "run"` and fewer than 2 ids remain: `clearTimeout(room.runTimer); room.runTimer = null;` set every remaining `running` player to `out`, `phase = "results"`, broadcast a `round_over` with `finishers: []`, `everyoneFinished: false`, `firstFinisher: null`, `killBonus: {}`, `finalBattle: null`, `winnerPending: ids` (the survivor, or `maxScoreIds(room)` if none), `nextIn: NEXT_ROUND_DELAY`, `players`, and arm `declareWinner` after the delay. Step (g) `checkRoundOver` then returns immediately because the phase is no longer `run`. If `phase === "results"` (countdown running), nothing else happens; the pending `startFinalBattle` applies its "fewer than 2" rule when it fires.

`back_to_lobby`: accepted only from `hostId` while `phase === "winner"`; otherwise `error` `"Only the host can do that."` / `"The match isn't over."`. Runs `toLobby(room, { resetScores: true })`.

**Client.**
- `round_over` message priority: if `finalBattle` is set -> `` `FINAL BATTLE next: ${names.join(" vs ")}` `` when `again` is false, `"Final Battle again: nobody finished!"` when true; else if `winnerPending` is set -> `` `${names.join(" & ")} win${names.length === 1 ? "s" : ""} the match!` ``; else the existing four strings with the `+N from your traps` suffix. Names come from `this.players`, falling back to `"Someone"`. The suffix never applies to Final Battle rounds.
- `phase run` with non-empty `finalBattleIds`: if `Network.id` is not included -> after `Player.spawn()`, `Player.alive = false`, `say("Final Battle! Watch the tied players fight it out.", 3)`; else `say("FINAL BATTLE! First to the flag gets +5.", 3)`.
- `match_over`: `phase = "winner"`, `players = message.players`, `winnerIds = message.winnerIds`, `_bannerTimer = 0`, `renderRoom()`.
- `drawScoreboard` gate (main.js:525) becomes `phase === "results" || phase === "winner"`. In `winner` phase: title `FINAL RESULTS`; the countdown line is replaced by `` `${names.join(" & ")} win${names.length === 1 ? "s" : ""}!` `` in bold 22px, colored with the first winner's palette color (`#ffd23c` if none). Names of winners no longer in the room are looked up from `this.players` and fall back to `"Someone"`.
- New DOM (index.html, inside `#game-wrap`): `<div id="winner-hud" class="hidden"><button id="back-to-lobby" type="button" class="hidden">Back to Lobby</button><span id="winner-note"></span></div>`, positioned `left: 50%; bottom: 40px; transform: translateX(-50%)`, styled like `#build-hud` with `pointer-events: auto` on the button. `renderRoom()` sets `#winner-hud` visible iff `phase === "winner"`, `#back-to-lobby` visible iff `Network.id === hostId`, `#winner-note` = `"Waiting for the host…"` for non-hosts, `""` for the host. Because `renderRoom()` also runs on `room_state`, a host handoff during `winner` moves the button to the new host.
- `#back-to-lobby` click -> `Network.send({ type: "back_to_lobby" })`. The resulting `room_state` (phase `lobby`) hides the winner HUD and shows the lobby.

### 6. Reference after this change

Phases: `lobby` -> `build` -> `run` -> `results` -> (`build` | Final Battle `run` | `winner`); `winner` -> `lobby`.
Statuses: `waiting` (lobby), `building`, `running`, `dead`, `finished`, `out`.
Server -> client messages added: `time_up { timedOut }`, `match_over { winnerIds, players }`. Extended: `error` (`fatal`), `room_state`/`round_start` (`settings`, `hostId`, `winnerIds`, `finalBattleIds`), `phase` (`timeLimit`, `finalBattleIds`), `round_over` (`killBonus`, `finalBattle`, `winnerPending`).
Client -> server added: `start_match`, `leave_room`, `back_to_lobby`. Extended: `create_room { settings }`.

## Acceptance Criteria (each pass/fail)

1. Creating a room with untouched dropdowns yields `settings = { timeLimit: 60, pointsToWin: 45, roundCap: 30 }` in the first `room_state`.
2. Custom time limit 25: Create Room sends no WebSocket message and `#online-status` reads `Time limit must be between 30 and 600.` Same pattern for points 14 and 100 (`Points to win must be between 15 and 99.`) and rounds 2 and 61 (`Round cap must be between 3 and 60.`). Custom 600/99/60 and 30/15/3 are all accepted. Dropdown Infinite yields `timeLimit: null`.
3. A raw `create_room` with `settings: { pointsToWin: 200 }` gets `{ type: "error", message: "Points to win must be between 15 and 99." }` and no `room_state`.
4. After Create or Join: `#online-panel` hidden, `#leave-room` visible, `#lobby` visible listing every player with a color square and name, `(host)` after the creator, settings line matches the chosen settings.
5. `#start-match` is hidden for non-hosts. Host with 1 player: error `You need at least 2 players.` Host with 2 players, one without a color: `Everyone needs to pick a color first.`
6. Host Start with 2 colored players: every client receives `round_start` with `phase: "build"`, `round: 1`; lobby hidden, build box visible.
7. Host leaves the lobby: the remaining oldest player becomes host and sees `#start-match`.
8. Leave Room during `lobby`, `build`, `run`, and `winner` (4 separate checks): the client is in solo mode (`Game.mode === "solo"`, `#online-panel` visible, `#lobby`, `#leave-room`, `#winner-hud` hidden), the HUD says `Left the room.`, no `Connection lost.` appears within 2s, and the next `room_state` other clients receive omits that player.
9. Time limit 30: with one runner standing still after the other died, `round_over` arrives 30s ± 1s after `phase run`; the stalled runner's status is `dead`; the stalled client saw `Time's up!` and its HUD contained `⏱ 1s` at some point.
10. Time limit Infinite: the same stall has not ended after 35s.
11. Three runners where A finishes first, B second, C dies (no traps involved): A = 6, B = 4, C = 0.
12. A's trap kills B and A does not finish: A gets 0 for it. A's trap kills B and A finishes: A = 4 + 1 = 5, and A's `round_over` message ends with ` +1 from your traps`. At the kill moment A's HUD read `Your trap got B! Finish to bank +1`.
13. First banner text is `+2 Points`.
14. `pointsToWin` 15: after A's 4th solo finish (16 points) `round_over` arrives, then `match_over` with `winnerIds: [A]` about 4s later, phase `winner`; no `round_start` follows within 10s.
15. `roundCap` 3, 2 players tied after round 3: `round_over.finalBattle.ids` has both ids and `again: false`; ~4s later a `phase run` with `finalBattleIds` of both arrives. A third player with a lower score has `Player.alive === false` during it and saw `Final Battle! Watch the tied players fight it out.`
16. Round 4 of a `roundCap` 10 match starts on level index 1 with `traps: []`; rounds 1-3 kept traps. `round_over.round` for the 4th round equals 4.
17. Final Battle, A finishes first, B does not: A gains exactly 5, B exactly 0 (no finish points, no first bonus, no kill points), then `match_over` with `winnerIds: [A]` after ~4s.
18. Final Battle where nobody finishes: `round_over.finalBattle.again === true`, another Final Battle `phase run` ~4s later. After 3 Final Battle runs in one match with no decision, `match_over` lists every still-tied participant in `winnerIds`.
19. Winner screen shows `FINAL RESULTS`, `<name> wins!` (or `<a> & <b> win!`), host sees Back to Lobby, others see `Waiting for the host…`. If the host leaves during `winner`, the new host's Back to Lobby appears within 1s. The results screen before it read `Final results in n`.
20. Back to Lobby: every client gets `room_state` with `phase: "lobby"`, all scores 0, `traps: []`, colors unchanged, settings unchanged.
21. Two players in `build`; one leaves: the other stays in `build`, the build box reads `Waiting for another player. Share room code …`, `Level.hazards` still contains the placed traps, and Leave Room works from there.
21b. A second `create_room` sent on a socket already in a room gets `error` `You're already in a room.` and the room list is unchanged.
21c. Join with a wrong code: `error` `Room not found.` with `fatal: true`; the client ends in solo mode with `#online-status` still reading `Room not found.` and `#online-panel` visible.
22. Fresh page load solo: Neon Ascent, run/jump/die/respawn work, canvas click adds no hazard.
23. Verification pass: the scratchpad `play.js` extended for criteria 1-22 completes with zero `PAGE ERROR` lines and every criterion printed as PASS.
24. No regression: trap placement refusals (flag, start, existing trap, out of bounds, second trap), color refusal for taken colors, mid-run join as `out`, traps persisting for rounds 1-3 and clearing on round 4, level rotation on rounds 4 and 7 all still hold.

## Testing Plan

- Extend `play.js` (scratchpad, Playwright + Edge, Node) with up to three browser contexts plus a raw `ws` client for criterion 3. Use `timeLimit: 30` rooms for the timer check and `Infinite` elsewhere so tests are not slow. Use `pointsToWin: 15` and `roundCap: 3` rooms to reach match end quickly. Each criterion prints `PASS`/`FAIL` with the observed value. Screenshots of lobby, run HUD with clock, Final Battle message, and winner screen are inspected by eye.
- Restart the server before every test run (Node does not reload files).

## Rollback Plan

Each of the six build steps is its own git commit with the working game verified before committing. `git revert <hash>` undoes one step. `git checkout dfd90ab -- .` restores the Day 7 game. No data is stored anywhere, so nothing needs migrating.

## Build order (six commits, each playable)

1. Settings fieldset, `readSettings`, `create_room.settings`, `validateSettings`, `settings`/`hostId` in snapshot. Rounds otherwise unchanged.
2. Scoring: 4/2, `pendingKills`, kill credit at round end, `killBonus`, banner text, kill message.
3. Cumulative round counter and `roundsPlayed`; `ROUND r of cap` labels.
4. Time limit: `runTimer`, `timeUp`, `time_up`, HUD clock.
5. Lobby: `lobby` phase, `waiting`, `removePlayer`, host handoff, `start_match`, `leave_room`, "already in a room" guard, `toLobby`, `fatal` errors, Leave Room button, `leaveOnline`.
6. Match end: `decideMatchState`, `startFinalBattle`, `declareWinner`, `match_over`, winner screen, `back_to_lobby`.

## Files Reference

| Path | Change |
|---|---|
| server.js | constants (keep line 27); `validateSettings`; room fields `hostId`, `settings`, `runTimer`, `finalBattle`, `winnerIds`, `roundsPlayed`; player `pendingKills`; `removePlayer`, `toLobby`, `maxScoreIds`; `start_match`, `leave_room`, `back_to_lobby`, "already in a room" guard, `fatal` on errors; `timeUp`; cumulative `startNextRound`; kill credit at round end; restructured `checkRoundOver`; `decideMatchState`, `startFinalBattle`, `declareWinner`; phase guards on timer callbacks |
| index.html | `#match-settings` fieldset; `#lobby`; `#leave-room`; `#winner-hud` |
| style.css | `#match-settings` (labels stacked, selects full width), `#lobby`, `#lobby-players li` + color square, `#leave-room`, `#winner-hud` |
| js/main.js | `readSettings`; `inRoom`; `renderRoom`; `leaveOnline(statusText)`; wall-clock `_runTimeLeft` + HUD by phase; handlers for `time_up`, `match_over`, `finalBattle`, `winnerPending`, `fatal` errors; scoreboard title/countdown/winner line and gate; banner text; kill and results messages; color-pick and mid-match-join messages; round labels; `_chartX` resets |
| js/network.js | `connect(name, code, settings)` sends `settings`; `leave()`; listeners ignore events from a socket that is no longer `this.socket` |
| README.md | rules text, settings, and knobs table updated |

## Out of Scope

Weapons and weapon selection in the Final Battle (separate feature, next). Map voting. Sounds and milestones. New trap types. Trap eraser. Pre-existing issues found on 2026-09-02 (build box visible on fresh load in solo, traps allowed one tile from the start, traps inside solids, favicon 404, possible tunneling at low frame rates). Persisting settings between page loads. Changing settings after the room exists. Spectator UI beyond `Player.alive = false`. Reconnecting a dropped player to their old seat. A build-phase timer or host "skip" for a player who never places a trap (the run timer covers runs only; Leave Room is the exit for a stuck lobby or build).

## What's Working Well (Do Not Touch)

Trap ownership lookup by position (server.js:208-212). Trap placement validation (server.js:69-76, 190-202). Jump feel constants in player.js. Spike hitbox inset (player.js:13-14, 71-82). Physics one-axis-at-a-time collision. The scoreboard bar layout and slide animation (main.js:402-468) apart from the title and countdown lines. Color picker refusal flow. Level rotation every 3 rounds and trap persistence within a level (behavior preserved by §4 even though the code moves).

## Related

Owner's wishlist items 1 (lobby, merged here), 2 (this spec), 4 (map voting, next, depends on the lobby), 5 (scoring, merged here). Final Battle weapons: to be specced separately.
