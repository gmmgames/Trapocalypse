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
const NEXT_ROUND_DELAY = 4;    // seconds the scoreboard shows before the next build phase
const FINISH_POINTS = 1;       // points for reaching the flag
const FIRST_BONUS = 1;         // extra point for the first finisher when 3+ play and 2+ finish
const KILL_POINTS = 1;         // points to a trap's owner each time it kills someone else
const MAX_PLAYERS = 24;        // room size, one color each
const PALETTE_SIZE = 24;       // colors in the picker (4 rows x 6 columns, defined in main.js)
const PLAYER_W = 22, PLAYER_H = 26;

function roomCode() {
  let code;
  do code = crypto.randomBytes(3).toString("hex").toUpperCase();
  while (rooms.has(code));
  return code;
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
  for (const player of room.players.values()) player.status = "running";
  broadcast(room, { type: "phase", phase: "run" });
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

  const runners = players.filter((player) => player.status !== "out");
  const finishers = runners.filter((player) => player.status === "finished");
  const everyoneFinished = finishers.length > 0 && finishers.length === runners.length;
  let firstFinisher = null;
  if (!everyoneFinished) {
    for (const player of finishers) player.score += FINISH_POINTS;
    if (runners.length > 2 && finishers.length >= 2) {
      firstFinisher = room.players.get(room.finishOrder[0]) || null;
      if (firstFinisher) firstFinisher.score += FIRST_BONUS;
    }
  }
  room.phase = "results";
  broadcast(room, {
    type: "round_over",
    round: room.round,
    finishers: finishers.map((player) => player.id),
    everyoneFinished,
    firstFinisher: firstFinisher ? firstFinisher.id : null,
    firstBonus: FIRST_BONUS,
    nextIn: NEXT_ROUND_DELAY,
    players: playerList(room),
  });
  room.timer = setTimeout(() => startNextRound(room), NEXT_ROUND_DELAY * 1000);
}

function startNextRound(room) {
  room.timer = null;
  if (room.players.size === 0) return;
  room.round += 1;
  if (room.round > ROUNDS_PER_LEVEL) {
    room.round = 1;
    room.levelIndex = (room.levelIndex + 1) % LEVELS.length;
    room.traps = [];
  }
  room.phase = "build";
  // Colors are picked once when you join and kept for the whole game.
  for (const player of room.players.values()) { player.trapCount = 0; player.status = "building"; }
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
      const code = message.type === "create_room" ? roomCode() : String(message.code || "").toUpperCase();
      let room = rooms.get(code);
      if (message.type === "join_room" && !room) { send(socket, { type: "error", message: "Room not found." }); return; }
      if (!room) room = { code, phase: "build", round: 1, levelIndex: 0, traps: [], players: new Map(), timer: null, finishOrder: [] };
      if (room.players.size >= MAX_PLAYERS) { send(socket, { type: "error", message: `That room is full (${MAX_PLAYERS} players).` }); return; }
      // Joining mid-run means sitting this round out.
      const status = room.phase === "build" ? "building" : "out";
      const player = { id: crypto.randomUUID(), name: String(message.name || "Runner").slice(0, 18), socket, score: 0, trapCount: 0, status, color: null };
      room.players.set(player.id, player);
      rooms.set(code, room);
      socket.player = player; socket.room = room;
      send(socket, { type: "joined", id: player.id, host: room.players.size === 1 });
      broadcast(room, snapshot(room));
      return;
    }

    const room = socket.room;
    const player = socket.player;
    if (!room || !player) return;

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
      const trap = room.traps.find((item) => item.x === Number(message.trapX) && item.y === Number(message.trapY));
      const killer = trap && trap.owner !== player.id ? room.players.get(trap.owner) : null;
      if (killer) killer.score += KILL_POINTS;
      broadcast(room, { type: "status", playerId: player.id, status: "dead", killedBy: killer ? killer.id : null, killPoints: KILL_POINTS });
      checkRoundOver(room);
    }
    if (message.type === "finished" && room.phase === "run" && player.status === "running") {
      player.status = "finished";
      room.finishOrder.push(player.id);
      broadcast(room, { type: "status", playerId: player.id, status: "finished" });
      checkRoundOver(room);
    }
  });
  socket.on("close", () => {
    const room = socket.room;
    if (!room || !socket.player) return;
    room.players.delete(socket.player.id);
    if (room.players.size === 0) {
      if (room.timer) clearTimeout(room.timer);
      rooms.delete(room.code);
      return;
    }
    broadcast(room, snapshot(room));
    // If the last runner left mid-run, do not leave the others waiting.
    checkRoundOver(room);
    if (room.phase === "build" && room.players.size >= 2 && [...room.players.values()].every((item) => item.trapCount >= TRAPS_PER_ROUND)) startRun(room);
  });
});

server.listen(PORT, () => console.log(`Trapocalypse online at http://localhost:${PORT}`));
