const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { LEVELS, TILE, LEVEL_W, LEVEL_H } = require("./js/level.js");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const rooms = new Map();
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

// --- round rules (the knobs) ---
const TRAPS_PER_ROUND = 1;     // traps each player places before a run
const ROUNDS_PER_LEVEL = 3;    // rounds on one course before rotating to the next
const NEXT_ROUND_DELAY = 10;   // seconds the scoreboard shows before the next build phase
const FINISH_POINTS = 4;       // points for reaching the flag
const FIRST_BONUS = 2;         // extra points for the first finisher when 3+ play and 2+ finish
const KILL_POINTS = 1;         // per kill by your trap, paid at round end only if YOU finished too
const FINAL_BONUSES = [5, 3, 1];   // Final Battle: 1st, 2nd, 3rd to the flag. Everyone else 0.
const FINAL_BATTLE_MAX_RUNS = 3;   // after this many Final Battles with no decision, the tie is shared
const MAX_PLAYERS = 24;        // room size, one color each
const PALETTE_SIZE = 24;       // colors in the picker (4 rows x 6 columns, defined in main.js)
const PLAYER_W = 22, PLAYER_H = 26;
const CHAT_MAX_LENGTH = 140;   // characters per chat message
const CHAT_MIN_GAP_MS = 500;   // fastest anyone can send (stops flooding)

// --- match settings the host picks when creating a room ---
// timeLimit is seconds per run, or null for Infinite.
// The host can also set how much each kind of point is worth (defaults from the constants above).
const SETTING_LIMITS = { timeLimit: [30, 600], pointsToWin: [15, 99], roundCap: [3, 60], winPoints: [1, 20], killPoints: [0, 10], firstPoints: [0, 10] };
const SETTING_DEFAULTS = { timeLimit: 60, pointsToWin: 45, roundCap: 30, winPoints: FINISH_POINTS, killPoints: KILL_POINTS, firstPoints: FIRST_BONUS };
const SETTING_LABELS = { timeLimit: "Time limit", pointsToWin: "Points to win", roundCap: "Round cap", winPoints: "Win points", killPoints: "Trap kill points", firstPoints: "Trailblazer points" };

function roomCode() {
  let code;
  do code = crypto.randomBytes(3).toString("hex").toUpperCase();
  while (rooms.has(code));
  return code;
}

// Check the settings a host sent. A missing value means "use the default".
// Anything outside the limits is refused with a message, never silently changed.
function validateSettings(raw) {
  const settings = {};
  for (const key of Object.keys(SETTING_LIMITS)) {
    const [min, max] = SETTING_LIMITS[key];
    const value = raw ? raw[key] : undefined;
    if (value === undefined) { settings[key] = SETTING_DEFAULTS[key]; continue; }
    if (key === "timeLimit" && value === null) { settings[key] = null; continue; }   // Infinite
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      return { ok: false, message: `${SETTING_LABELS[key]} must be between ${min} and ${max}.` };
    }
    settings[key] = n;
  }
  return { ok: true, settings };
}

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function broadcast(room, message) {
  for (const player of room.players.values()) send(player.socket, message);
}

function overlaps(a, b) {
  return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h);
}

function playerList(room) {
  return [...room.players.values()].map((player) => ({
    id: player.id, name: player.name, score: player.score, status: player.status, trapCount: player.trapCount, color: player.color,
  }));
}

function snapshot(room) {
  return {
    type: "room_state",
    code: room.code,
    phase: room.phase,
    round: room.round,
    levelIndex: room.levelIndex,
    roundsPerLevel: ROUNDS_PER_LEVEL,
    trapsPerRound: TRAPS_PER_ROUND,
    maxPlayers: MAX_PLAYERS,
    settings: room.settings,
    hostId: room.hostId,
    winnerIds: room.winnerIds,
    finalBattleIds: room.finalBattle ? room.finalBattle.ids : [],
    votes: room.votes,
    voteOpen: room.voteOpen,
    traps: room.traps,
    players: playerList(room),
  };
}

// A trap may not sit on the flag or on any player. During build everyone
// stands at the start, so the start box covers every runner.
function trapBlocked(room, trap) {
  const level = LEVELS[room.levelIndex];
  const startBox = { x: level.start.x, y: level.start.y, w: PLAYER_W, h: PLAYER_H };
  return overlaps(trap, level.flag) || overlaps(trap, startBox) ||
    room.traps.some((item) => overlaps(item, trap));
}

function startRun(room) {
  room.phase = "run";
  room.finishOrder = [];
  // In a Final Battle the statuses were already set: tied players run, the rest watch.
  if (!room.finalBattle) for (const player of room.players.values()) player.status = "running";
  // The host's time limit: when it runs out, anyone still running is out.
  clearTimeout(room.runTimer);
  room.runTimer = null;
  const timeLimit = room.settings.timeLimit;
  if (timeLimit !== null) room.runTimer = setTimeout(() => timeUp(room), timeLimit * 1000);
  broadcast(room, { type: "phase", phase: "run", timeLimit, finalBattleIds: room.finalBattle ? room.finalBattle.ids : [] });
}

// Ids of the players with the top score (ignoring anyone sitting out, unless that is everyone).
function maxScoreIds(room) {
  const everyone = [...room.players.values()];
  const active = everyone.filter((player) => player.status !== "out");
  const pool = active.length ? active : everyone;
  const top = Math.max(...pool.map((player) => player.score));
  return pool.filter((player) => player.score === top).map((player) => player.id);
}

// After a round: keep going, hold a Final Battle, or crown a winner?
//   next   - nobody has reached the target and the round cap is not hit
//   final  - two or more players qualify (or are still tied after a Final Battle)
//   winner - exactly one player stands on top
function decideMatchState(room) {
  const settings = room.settings;
  if (room.finalBattle) {
    const participants = room.finalBattle.ids.map((id) => room.players.get(id)).filter(Boolean);
    if (participants.length === 0) return { kind: "winner", ids: maxScoreIds(room) };
    const capped = room.finalBattle.runs >= FINAL_BATTLE_MAX_RUNS;
    const finished = participants.filter((player) => player.status === "finished");
    if (finished.length === 0) return { kind: capped ? "winner" : "final", ids: participants.map((player) => player.id) };
    const top = Math.max(...participants.map((player) => player.score));
    const leaders = participants.filter((player) => player.score === top).map((player) => player.id);
    return { kind: leaders.length === 1 || capped ? "winner" : "final", ids: leaders };
  }
  const active = [...room.players.values()].filter((player) => player.status !== "out");
  // Everyone who reaches the target in the same round goes to the Final Battle, even with different scores.
  let qualified = active.filter((player) => player.score >= settings.pointsToWin).map((player) => player.id);
  if (qualified.length === 0 && room.roundsPlayed >= settings.roundCap) qualified = maxScoreIds(room);
  if (qualified.length === 0) return { kind: "next" };
  return { kind: qualified.length === 1 ? "winner" : "final", ids: qualified };
}

// The tied players run the current course again, no build phase. Everyone else watches.
function startFinalBattle(room) {
  room.timer = null;
  if (room.phase !== "results" || room.players.size === 0 || !room.finalBattle) return;
  room.finalBattle.ids = room.finalBattle.ids.filter((id) => room.players.has(id));
  if (room.finalBattle.ids.length < 2) { declareWinner(room, room.finalBattle.ids); return; }
  room.finalBattle.runs += 1;
  for (const player of room.players.values()) {
    player.pendingKills = 0;
    player.status = room.finalBattle.ids.includes(player.id) ? "running" : "out";
  }
  startRun(room);
}

function declareWinner(room, ids) {
  room.timer = null;
  if (room.phase !== "results" || room.players.size === 0) return;
  let winners = ids.filter((id) => room.players.has(id));
  if (winners.length === 0) winners = maxScoreIds(room);
  room.phase = "winner";
  room.winnerIds = winners;
  room.finalBattle = null;
  broadcast(room, { type: "match_over", winnerIds: winners, players: playerList(room) });
}

function timeUp(room) {
  room.runTimer = null;
  if (room.phase !== "run") return;   // the round already ended on its own
  const timedOut = [];
  for (const player of room.players.values()) {
    if (player.status === "running") { player.status = "dead"; timedOut.push(player.id); }
  }
  broadcast(room, { type: "time_up", timedOut });
  checkRoundOver(room);
}

// The round is over when nobody is still running. Scoring:
//   - each finisher gets a point
//   - if EVERY runner finished, nobody gets anything
//   - if everyone died, nobody gets anything
//   - with 3+ runners and 2+ finishers, the first to the flag gets a bonus
function checkRoundOver(room) {
  if (room.phase !== "run") return;
  const players = [...room.players.values()];
  if (players.some((player) => player.status === "running")) return;
  clearTimeout(room.runTimer);   // everyone is done, the clock is no longer needed
  room.runTimer = null;

  const runners = players.filter((player) => player.status !== "out");
  const finishers = runners.filter((player) => player.status === "finished");
  const everyoneFinished = !room.finalBattle && finishers.length > 0 && finishers.length === runners.length;
  let firstFinisher = null;
  const killBonus = {};   // playerId -> points earned from their trap's kills this round
  const gains = {};       // playerId -> [{ label, points }] so the scoreboard can show where points came from
  const award = (player, label, points) => {
    if (points <= 0) return;
    player.score += points;
    (gains[player.id] = gains[player.id] || []).push({ label, points });
  };
  if (room.finalBattle) {
    // Final Battle: only the podium bonuses, in finishing order. Nothing else pays.
    const placeNames = ["1st place", "2nd place", "3rd place"];
    room.finishOrder.forEach((id, place) => {
      const player = room.players.get(id);
      if (player && room.finalBattle.ids.includes(id) && place < FINAL_BONUSES.length) award(player, placeNames[place], FINAL_BONUSES[place]);
    });
  } else if (!everyoneFinished) {
    const { winPoints, killPoints, firstPoints } = room.settings;   // the host's values
    for (const player of finishers) {
      award(player, "win", winPoints);
      // Trap kills only pay if you made it to the flag yourself.
      if (player.pendingKills > 0 && killPoints > 0) {
        killBonus[player.id] = player.pendingKills * killPoints;
        award(player, player.pendingKills === 1 ? "trap kill" : `${player.pendingKills} trap kills`, killBonus[player.id]);
      }
    }
    if (runners.length > 2 && finishers.length >= 2) {
      firstFinisher = room.players.get(room.finishOrder[0]) || null;
      if (firstFinisher) award(firstFinisher, "Trailblazer", firstPoints);
    }
  }
  for (const player of players) player.pendingKills = 0;
  if (!room.finalBattle) room.roundsPlayed += 1;   // what the round cap is checked against
  room.phase = "results";

  // Decide what comes next BEFORE telling everyone, so the scoreboard can say so.
  const decision = decideMatchState(room);
  const wasFinalBattle = room.finalBattle !== null;
  if (decision.kind === "final") room.finalBattle = { ids: decision.ids, runs: wasFinalBattle ? room.finalBattle.runs : 0 };
  else room.finalBattle = null;
  // If the next round starts a new course, everyone votes on which one during the results.
  room.votes = {};
  room.voteOpen = decision.kind === "next" && room.round % ROUNDS_PER_LEVEL === 0;

  broadcast(room, {
    type: "round_over",
    round: room.round,
    finishers: finishers.map((player) => player.id),
    everyoneFinished,
    firstFinisher: firstFinisher ? firstFinisher.id : null,
    firstBonus: room.settings.firstPoints,
    killBonus,
    gains,
    nextIn: NEXT_ROUND_DELAY,
    players: playerList(room),
    finalBattle: decision.kind === "final" ? { ids: decision.ids, again: wasFinalBattle && finishers.length === 0 } : null,
    winnerPending: decision.kind === "winner" ? decision.ids : null,
    voteOpen: room.voteOpen,
  });
  const delay = NEXT_ROUND_DELAY * 1000;
  if (decision.kind === "next") room.timer = setTimeout(() => startNextRound(room), delay);
  else if (decision.kind === "final") room.timer = setTimeout(() => startFinalBattle(room), delay);
  else room.timer = setTimeout(() => declareWinner(room, decision.ids), delay);
}

// The course with the most votes. Ties are settled at random; no votes means `fallback`.
function pickVotedLevel(room, fallback) {
  const counts = new Array(LEVELS.length).fill(0);
  for (const level of Object.values(room.votes)) counts[level] += 1;
  const top = Math.max(...counts);
  if (top === 0) return fallback;
  const tied = counts.map((count, index) => (count === top ? index : -1)).filter((index) => index >= 0);
  return tied[Math.floor(Math.random() * tied.length)];
}

// Everyone back to the lobby. Colors and settings are kept; scores only if asked.
function toLobby(room, { resetScores }) {
  clearTimeout(room.timer); clearTimeout(room.runTimer);
  room.timer = null; room.runTimer = null;
  room.phase = "lobby"; room.round = 1; room.roundsPlayed = 0; room.levelIndex = 0;
  room.traps = []; room.finishOrder = []; room.finalBattle = null; room.winnerIds = [];
  room.votes = {}; room.voteOpen = false;
  for (const player of room.players.values()) {
    player.trapCount = 0; player.pendingKills = 0; player.status = "waiting";
    if (resetScores) player.score = 0;
  }
  broadcast(room, snapshot(room));
}

// Take a player out of their room (they left, or their connection dropped).
// Safe to call twice: the second call finds nothing to do.
function removePlayer(socket) {
  const room = socket.room, player = socket.player;
  if (!room || !player) return;
  socket.room = null; socket.player = null;
  room.players.delete(player.id);
  delete room.votes[player.id];
  if (room.players.size === 0) {
    clearTimeout(room.timer); clearTimeout(room.runTimer);
    rooms.delete(room.code);
    return;
  }
  // If the host left, the player who has been here longest takes over.
  if (player.id === room.hostId) room.hostId = room.players.keys().next().value;
  broadcast(room, snapshot(room));
  // A Final Battle needs at least two fighters. If one walks out mid-run, the other wins.
  if (room.finalBattle && room.finalBattle.ids.includes(player.id)) {
    room.finalBattle.ids = room.finalBattle.ids.filter((id) => id !== player.id);
    if (room.phase === "run" && room.finalBattle.ids.length < 2) {
      clearTimeout(room.runTimer); room.runTimer = null;
      for (const item of room.players.values()) if (item.status === "running") item.status = "out";
      room.phase = "results";
      const ids = room.finalBattle.ids.length ? room.finalBattle.ids : maxScoreIds(room);
      room.finalBattle = null;
      broadcast(room, { type: "round_over", round: room.round, finishers: [], everyoneFinished: false, firstFinisher: null, firstBonus: room.settings.firstPoints, killBonus: {}, nextIn: NEXT_ROUND_DELAY, players: playerList(room), finalBattle: null, winnerPending: ids, voteOpen: false });
      room.timer = setTimeout(() => declareWinner(room, ids), NEXT_ROUND_DELAY * 1000);
    }
  }
  // If the last runner left mid-run, do not leave the others waiting.
  checkRoundOver(room);
  if (room.phase === "build" && room.players.size >= 2 && [...room.players.values()].every((item) => item.trapCount >= TRAPS_PER_ROUND)) startRun(room);
}

function startNextRound(room) {
  room.timer = null;
  if (room.phase !== "results" || room.players.size === 0) return;   // the room moved on; stale timer
  // room.round counts up for the whole match (1, 2, 3, 4, ...). Every
  // ROUNDS_PER_LEVEL rounds the course rotates and its traps are cleared,
  // so rounds 4, 7, 10, ... start fresh on the next level.
  room.round += 1;
  if ((room.round - 1) % ROUNDS_PER_LEVEL === 0) {
    // The voted course, or simply the next one in the list if nobody voted.
    room.levelIndex = pickVotedLevel(room, (room.levelIndex + 1) % LEVELS.length);
    room.traps = [];
  }
  room.votes = {}; room.voteOpen = false;
  room.phase = "build";
  // Colors are picked once when you join and kept for the whole game.
  for (const player of room.players.values()) { player.trapCount = 0; player.pendingKills = 0; player.status = "building"; }
  broadcast(room, { ...snapshot(room), type: "round_start" });
}

const server = http.createServer((request, response) => {
  const requested = request.url === "/" ? "/index.html" : request.url;
  const filePath = path.normalize(path.join(ROOT, requested.split("?")[0]));
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403); response.end("Forbidden"); return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
});

const webSocketServer = new WebSocketServer({ server });
webSocketServer.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch { return; }

    if (message.type === "create_room" || message.type === "join_room") {
      if (socket.room) { send(socket, { type: "error", message: "You're already in a room." }); return; }
      const code = message.type === "create_room" ? roomCode() : String(message.code || "").toUpperCase();
      let room = rooms.get(code);
      // "fatal" tells the browser it is not in any room and should go back to the start page.
      if (message.type === "join_room" && !room) { send(socket, { type: "error", message: "Room not found.", fatal: true }); return; }
      if (!room) {
        const check = validateSettings(message.settings);
        if (!check.ok) { send(socket, { type: "error", message: check.message, fatal: true }); return; }
        room = { code, phase: "lobby", round: 1, roundsPlayed: 0, levelIndex: 0, traps: [], players: new Map(), timer: null, runTimer: null, finishOrder: [], settings: check.settings, hostId: null, finalBattle: null, winnerIds: [], votes: {}, voteOpen: false };
      }
      if (room.players.size >= MAX_PLAYERS) { send(socket, { type: "error", message: `That room is full (${MAX_PLAYERS} players).`, fatal: true }); return; }
      // In the lobby you wait for the host. Joining mid-run means sitting this round out.
      const status = room.phase === "lobby" ? "waiting" : room.phase === "build" ? "building" : "out";
      const player = { id: crypto.randomUUID(), name: String(message.name || "Runner").slice(0, 18), socket, score: 0, trapCount: 0, pendingKills: 0, status, color: null };
      room.players.set(player.id, player);
      if (room.hostId === null) room.hostId = player.id;   // the room's creator is the host
      rooms.set(code, room);
      socket.player = player; socket.room = room;
      send(socket, { type: "joined", id: player.id, host: room.players.size === 1 });
      broadcast(room, snapshot(room));
      return;
    }

    const room = socket.room;
    const player = socket.player;
    if (!room || !player) return;

    if (message.type === "leave_room") { removePlayer(socket); return; }

    // Only the host starts the match, from the lobby, with 2+ players who all have colors.
    if (message.type === "start_match") {
      const everyoneColored = [...room.players.values()].every((item) => item.color !== null);
      let problem = null;
      if (player.id !== room.hostId) problem = "Only the host can start.";
      else if (room.phase === "winner") problem = "Use Back to Lobby first.";
      else if (room.phase !== "lobby") problem = "The match has already started.";
      else if (room.players.size < 2) problem = "You need at least 2 players.";
      else if (!everyoneColored) problem = "Everyone needs to pick a color first.";
      if (problem) { send(socket, { type: "error", message: problem }); return; }
      room.round = 1; room.roundsPlayed = 0; room.traps = []; room.finishOrder = [];
      room.levelIndex = pickVotedLevel(room, 0);   // the lobby vote picks the first course
      room.votes = {}; room.voteOpen = false;
      room.finalBattle = null; room.winnerIds = [];
      for (const item of room.players.values()) { item.score = 0; item.trapCount = 0; item.pendingKills = 0; item.status = "building"; }
      room.phase = "build";
      broadcast(room, { ...snapshot(room), type: "round_start" });
      return;
    }
    // Vote for a course: in the lobby, or on the results screen when the course is about to change.
    if (message.type === "vote_map") {
      const level = Number(message.level);
      const open = room.phase === "lobby" || (room.phase === "results" && room.voteOpen);
      if (open && Number.isInteger(level) && level >= 0 && level < LEVELS.length) {
        room.votes[player.id] = level;
        broadcast(room, { type: "votes", votes: room.votes });
      }
      return;
    }
    // The host can send everyone back to the lobby from the winner screen, or end a match early.
    if (message.type === "back_to_lobby") {
      if (player.id !== room.hostId) send(socket, { type: "error", message: "Only the host can do that." });
      else if (room.phase === "lobby") send(socket, { type: "error", message: "You're already in the lobby." });
      else toLobby(room, { resetScores: true });
      return;
    }
    // Chat: short text, at most one message every half second per player. Everyone sees it.
    if (message.type === "chat") {
      const text = String(message.text || "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH);
      const now = Date.now();
      if (!text || now - (player.lastChatAt || 0) < CHAT_MIN_GAP_MS) return;
      player.lastChatAt = now;
      broadcast(room, { type: "chat", playerId: player.id, name: player.name, color: player.color, text });
      return;
    }

    // Pick a color once, when you first join. Two players can't share one.
    if (message.type === "choose_color" && player.color === null) {
      const color = Number(message.color);
      const valid = Number.isInteger(color) && color >= 0 && color < PALETTE_SIZE;
      const taken = [...room.players.values()].some((item) => item !== player && item.color === color);
      if (valid && !taken) {
        player.color = color;
        broadcast(room, { type: "color", playerId: player.id, color });
      } else {
        send(socket, { type: "color_rejected", message: "That color is taken." });
      }
    }
    if (message.type === "place_trap" && room.phase === "build" && player.color === null) {
      send(socket, { type: "trap_rejected", message: "Pick a color first." });
    }
    if (message.type === "place_trap" && room.phase === "build" && player.color !== null && player.trapCount < TRAPS_PER_ROUND) {
      const x = Math.round((Number(message.x) || 0) / TILE) * TILE;
      const y = Math.round((Number(message.y) || 0) / TILE) * TILE;
      const trap = { x, y, w: TILE, h: TILE, owner: player.id };
      const inBounds = x >= 2 * TILE && x + TILE <= LEVEL_W - TILE && y >= 0 && y + TILE <= LEVEL_H;
      if (inBounds && !trapBlocked(room, trap)) {
        room.traps.push(trap); player.trapCount += 1;
        broadcast(room, { type: "trap_placed", trap, playerId: player.id, traps: room.traps });
        if (room.players.size >= 2 && [...room.players.values()].every((item) => item.trapCount >= TRAPS_PER_ROUND)) startRun(room);
      } else {
        send(socket, { type: "trap_rejected", message: "You can't place a trap there." });
      }
    }
    if (message.type === "player_update" && room.phase === "run") {
      broadcast(room, { type: "player_update", playerId: player.id, x: Number(message.x) || 0, y: Number(message.y) || 0, alive: Boolean(message.alive), finished: Boolean(message.finished) });
    }
    if (message.type === "died" && room.phase === "run" && player.status === "running") {
      player.status = "dead";
      // Credit the trap's owner. The trap is looked up by position in the server's own
      // list, not trusted from the browser, so nobody can award points to themselves.
      // Level spikes and falls have no owner. Your own trap never pays you.
      // The kill is only counted for now; it turns into points at round end if the owner finishes.
      const trap = room.traps.find((item) => item.x === Number(message.trapX) && item.y === Number(message.trapY));
      const killer = trap && trap.owner !== player.id ? room.players.get(trap.owner) : null;
      if (killer) killer.pendingKills += 1;
      broadcast(room, { type: "status", playerId: player.id, status: "dead", killedBy: killer ? killer.id : null, killPoints: room.settings.killPoints });
      checkRoundOver(room);
    }
    if (message.type === "finished" && room.phase === "run" && player.status === "running") {
      player.status = "finished";
      room.finishOrder.push(player.id);
      broadcast(room, { type: "status", playerId: player.id, status: "finished" });
      checkRoundOver(room);
    }
  });
  socket.on("close", () => removePlayer(socket));
});

server.listen(PORT, () => console.log(`Trapocalypse online at http://localhost:${PORT}`));
