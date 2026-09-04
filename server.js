const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { LEVELS, TILE, LEVEL_W, LEVEL_H } = require("./js/level.js");
const ChatFilter = require("./js/chatfilter.js");   // the same word list the chat filter uses, for names

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const rooms = new Map();
const users = new Map();       // permanent player ID -> socket, for everyone connected (in a room or on the menu)
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

// --- round rules (the knobs) ---
const TRAPS_PER_ROUND = 1;     // traps each player places before a run
const ROUNDS_PER_LEVEL = 3;    // rounds on one course before rotating to the next
const RESULTS_WAIT = 5;        // seconds the scoreboard stays AFTER all points have landed (10 when a course vote is up)
const FINISH_POINTS = 4;       // points for reaching the flag
const FIRST_BONUS = 2;         // extra points for the first finisher when 3+ play and 2+ finish
const KILL_POINTS = 1;         // per kill by your trap, paid at round end only if YOU finished too
const FINAL_BONUSES = [5, 3, 1];   // Final Battle: 1st, 2nd, 3rd to the flag. Everyone else 0.
const AUTONOMOUS_BONUS = 1;        // "Autonomous": the only one to reach the flag when 2+ ran
const FINAL_BATTLE_MAX_RUNS = 3;   // after this many Final Battles with no decision, the tie is shared
const MAX_PLAYERS = 24;        // room size, one color each
const PALETTE_SIZE = 24;       // colors in the picker (4 rows x 6 columns, defined in main.js)
const PLAYER_W = 22, PLAYER_H = 26;
const TRAP_KINDS = ["spike", "crumble", "glue", "bumper", "spring", "ice", "decoy"];   // what a player may place (see js/level.js for what each does)
const ERASERS_PER_COURSE = 1;  // erasers each player gets on every new course, to remove someone else's trap
const WEAPONS = ["boots", "dash", "shield", "freeze", "bomb", "feather"];   // Final Battle weapons (what they do: js/player.js)
const WEAPON_OFFER = 3;        // how many each fighter gets to choose from
const FREEZE_SECONDS = 1.5;
const VOTE_SECONDS = 10;       // course vote after the host presses Start
const CHAT_MAX_LENGTH = 140;   // characters per chat message
const CHAT_MIN_GAP_MS = 500;   // fastest anyone can send (stops flooding)

// --- match settings the host picks when creating a room ---
// timeLimit is seconds per run, or null for Infinite.
// The host can also set how much each kind of point is worth (defaults from the constants above).
const SETTING_LIMITS = { timeLimit: [30, 600], pointsToWin: [15, 600], roundCap: [3, 60], winPoints: [1, 20], killPoints: [0, 10], firstPoints: [0, 10], autonomousPoints: [0, 10] };
const SETTING_DEFAULTS = { timeLimit: 60, pointsToWin: 45, roundCap: 30, winPoints: FINISH_POINTS, killPoints: KILL_POINTS, firstPoints: FIRST_BONUS, autonomousPoints: AUTONOMOUS_BONUS, isPublic: true };
const USER_ID_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;   // permanent player IDs: 6 letters/digits without look-alikes
const INVITE_COOLDOWN_MS = 5000;                  // between invites from one player
const AVATARS = ["cube", "ball", "wedge", "ghost", "diamond", "dino", "unicorn", "cat", "bunny", "robot"];   // character models (drawn in js/player.js)
const SETTING_LABELS = { timeLimit: "Time limit", pointsToWin: "Points to win", roundCap: "Round cap", winPoints: "Win points", killPoints: "Trap kill points", firstPoints: "Trailblazer points", autonomousPoints: "Autonomous points" };

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
  // isPublic is a simple yes/no: listed in the room list, or private (join by code only).
  settings.isPublic = raw && raw.isPublic !== undefined ? Boolean(raw.isPublic) : SETTING_DEFAULTS.isPublic;
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
    id: player.id, name: player.name, score: player.score, status: player.status, trapCount: player.trapCount, color: player.color, erasers: player.erasers, pick: player.pick || null, pickSlot: player.pick ? player.pickSlot : null, pencil: player.pencil || 0, avatar: player.avatar || "cube",
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
    offer: room.offer || [],
    traps: room.traps,
    players: playerList(room),
  };
}

// The public rooms a player can browse and join: listed, not full, and not mid-match-over.
function publicRoomList() {
  return [...rooms.values()]
    .filter((room) => room.settings.isPublic && room.players.size < MAX_PLAYERS && room.players.size > 0)
    .map((room) => {
      const host = room.players.get(room.hostId);
      return { code: room.code, host: host ? host.name : "?", players: room.players.size, max: MAX_PLAYERS, phase: room.phase, level: LEVELS[room.levelIndex].name };
    });
}

function makeUserId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;
  do id = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  while (users.has(id));
  return id;
}

// A trap may not sit on the flag or on any player. During build everyone
// stands at the start, so the start box covers every runner.
function trapBlocked(room, trap) {
  const level = LEVELS[room.levelIndex];
  const startBox = { x: level.start.x, y: level.start.y, w: PLAYER_W, h: PLAYER_H };
  // A crumbler is a fake platform, so it needs open air, not the inside of a wall.
  const inWall = trap.kind === "crumble" && level.solids.some((solid) => overlaps(solid, trap));
  // Ice sits on top of a block: never inside one, and there must be a block right under it.
  const below = { x: trap.x + 2, y: trap.y + TILE, w: TILE - 4, h: 2 };
  const badIce = trap.kind === "ice" && (level.solids.some((solid) => overlaps(solid, trap)) || !level.solids.some((solid) => overlaps(solid, below)));
  return inWall || badIce || overlaps(trap, level.flag) || overlaps(trap, startBox) ||
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
  broadcast(room, { type: "phase", phase: "run", timeLimit, finalBattleIds: room.finalBattle ? room.finalBattle.ids : [], weapons: room.finalBattle ? room.finalBattle.weapons || {} : {} });
}

// How long the results screen stays. The bars grow one point source at a time (the client
// starts the first at 0.7 s and adds 1 s per stage), so the countdown only begins after
// the last point has landed, then waits RESULTS_WAIT seconds (or the vote time if a
// course vote is up).
function resultsDelay(room, gains) {
  const maxStages = Math.max(0, ...Object.values(gains).map((list) => list.length));
  const reveal = maxStages ? 0.7 + maxStages * 1.0 : 0.5;
  const wait = room.voteOpen ? VOTE_SECONDS : RESULTS_WAIT;
  return { reveal, total: reveal + wait };
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

// Deal each fighter a few random weapons to choose from before a Final Battle.
function dealWeapons(room, ids) {
  const offers = {};
  for (const id of ids) {
    const player = room.players.get(id);
    if (!player) continue;
    const deck = [...WEAPONS].sort(() => Math.random() - 0.5);
    player.weaponOffer = deck.slice(0, WEAPON_OFFER);
    player.weapon = null;
    player.weaponUsed = false;
    offers[id] = player.weaponOffer;
  }
  return offers;
}

function clearWeapons(room) {
  for (const player of room.players.values()) { player.weapon = null; player.weaponOffer = null; player.weaponUsed = false; }
}

// The tied players run the current course again, no build phase. Everyone else watches.
function startFinalBattle(room) {
  room.timer = null;
  if (room.phase !== "results" || room.players.size === 0 || !room.finalBattle) return;
  room.finalBattle.ids = room.finalBattle.ids.filter((id) => room.players.has(id));
  if (room.finalBattle.ids.length < 2) { declareWinner(room, room.finalBattle.ids); return; }
  room.finalBattle.runs += 1;
  const weapons = {};
  for (const player of room.players.values()) {
    player.pendingKills = 0;
    player.status = room.finalBattle.ids.includes(player.id) ? "running" : "out";
    if (player.status === "running") {
      // No pick in time? Take a random one from the offer.
      if (!player.weapon) player.weapon = (player.weaponOffer || WEAPONS)[Math.floor(Math.random() * (player.weaponOffer || WEAPONS).length)];
      player.weaponUsed = false;
      weapons[player.id] = player.weapon;
    }
  }
  room.finalBattle.weapons = weapons;
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
    const placeNames = ["1st Place", "2nd Place", "3rd Place"];
    room.finishOrder.forEach((id, place) => {
      const player = room.players.get(id);
      if (player && room.finalBattle.ids.includes(id) && place < FINAL_BONUSES.length) award(player, placeNames[place], FINAL_BONUSES[place]);
    });
  } else if (!everyoneFinished) {
    const { winPoints, killPoints, firstPoints, autonomousPoints } = room.settings;   // the host's values
    for (const player of finishers) {
      award(player, "Win", winPoints);
      // "Curiosity": trap kills only pay if you made it to the flag yourself.
      if (player.pendingKills > 0 && killPoints > 0) {
        killBonus[player.id] = player.pendingKills * killPoints;
        award(player, player.pendingKills === 1 ? "Curiosity" : `Curiosity ×${player.pendingKills}`, killBonus[player.id]);
      }
    }
    // "Trailblazer": first to the flag in a race of three or more with at least two finishers.
    if (runners.length > 2 && finishers.length >= 2) {
      firstFinisher = room.players.get(room.finishOrder[0]) || null;
      if (firstFinisher) award(firstFinisher, "Trailblazer", firstPoints);
    }
    // "Autonomous": the only one to make it when at least two ran.
    if (runners.length >= 2 && finishers.length === 1) award(finishers[0], "Autonomous", autonomousPoints);
  }
  for (const player of players) player.pendingKills = 0;
  if (!room.finalBattle) room.roundsPlayed += 1;   // what the round cap is checked against
  room.phase = "results";

  // Decide what comes next BEFORE telling everyone, so the scoreboard can say so.
  const decision = decideMatchState(room);
  const wasFinalBattle = room.finalBattle !== null;
  if (decision.kind === "final") room.finalBattle = { ids: decision.ids, runs: wasFinalBattle ? room.finalBattle.runs : 0 };
  else room.finalBattle = null;
  clearWeapons(room);
  const weaponOffers = decision.kind === "final" ? dealWeapons(room, decision.ids) : {};
  // If the next round starts a new course, everyone votes on which one during the results.
  room.votes = {};
  room.voteOpen = decision.kind === "next" && room.round % ROUNDS_PER_LEVEL === 0;
  const timing = resultsDelay(room, gains);

  broadcast(room, {
    type: "round_over",
    round: room.round,
    finishers: finishers.map((player) => player.id),
    everyoneFinished,
    firstFinisher: firstFinisher ? firstFinisher.id : null,
    firstBonus: room.settings.firstPoints,
    killBonus,
    gains,
    nextIn: timing.total,
    revealIn: timing.reveal,
    players: playerList(room),
    finalBattle: decision.kind === "final" ? { ids: decision.ids, again: wasFinalBattle && finishers.length === 0 } : null,
    winnerPending: decision.kind === "winner" ? decision.ids : null,
    voteOpen: room.voteOpen,
    weaponOffers,
  });
  const delay = timing.total * 1000;
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
  clearWeapons(room);
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
      const timing = resultsDelay(room, {});
      broadcast(room, { type: "round_over", round: room.round, finishers: [], everyoneFinished: false, firstFinisher: null, firstBonus: room.settings.firstPoints, killBonus: {}, nextIn: timing.total, revealIn: timing.reveal, players: playerList(room), finalBattle: null, winnerPending: ids, voteOpen: false });
      room.timer = setTimeout(() => declareWinner(room, ids), timing.total * 1000);
    }
  }
  // If the last runner left mid-run, do not leave the others waiting.
  checkRoundOver(room);
  maybeStartRun(room);
}

// Every round the room is offered a random handful of items (traps plus maybe the eraser),
// one more than there are players, at most all five. Everyone sees the same offer and
// picks one; while any offered item is still free, two players cannot pick the same one.
// Each card is a separate random draw, so the same trap can show up twice. Rarer
// items have a lower weight: the eraser turns up in maybe one round in four.
const ITEM_WEIGHTS = { spike: 1, crumble: 1, glue: 1, bumper: 1, spring: 1, ice: 1, decoy: 1, eraser: 0.5, pencil: 0.2 };
const PENCIL_CHARGES = 3;        // strokes per pencil pick
const PENCIL_SECONDS = 2.5;      // how long a sketched block lasts
const PENCIL_MAX_BLOCKS = 8;     // blocks per stroke
function drawItem() {
  let roll = Math.random() * Object.values(ITEM_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  for (const [item, weight] of Object.entries(ITEM_WEIGHTS)) { roll -= weight; if (roll < 0) return item; }
  return "spike";
}
function dealItems(room) {
  const count = Math.min(8, Math.max(2, room.players.size + 1));
  room.offer = Array.from({ length: count }, drawItem);
  if (process.env.FORCE_ITEM) room.offer[0] = process.env.FORCE_ITEM;   // test hook: FORCE_ITEM=pencil node server.js
  for (const player of room.players.values()) { player.pick = null; player.pickSlot = null; player.pencil = 0; }
}

// Who holds which card (by card number, since two cards can show the same item).
function itemPicks(room) {
  const picks = {};
  for (const player of room.players.values()) if (player.pick) picks[player.id] = player.pickSlot;
  return picks;
}

// May this player take this card right now?
function canPick(room, player, slot) {
  const item = room.offer ? room.offer[slot] : undefined;
  if (!Number.isInteger(slot) || !item) return "That item isn't on offer this round.";
  if (item === "eraser" && player.erasers <= 0) return "No erasers left on this course.";
  const takenByOthers = new Set([...room.players.values()].filter((other) => other !== player && other.pick).map((other) => other.pickSlot));
  const anyFree = room.offer.some((offered, index) => !takenByOthers.has(index));
  if (takenByOthers.has(slot) && anyFree) return "Someone already took that one.";
  return null;
}

// After a trap is placed or an eraser used: once everyone has used their item, the run starts.
function maybeStartRun(room) {
  if (room.phase === "build" && room.players.size >= 2 && [...room.players.values()].every((item) => item.trapCount >= TRAPS_PER_ROUND)) startRun(room);
}

// The course vote is over: reset everyone and start round 1 on the winning course.
function beginMatch(room) {
  room.timer = null;
  if (room.phase !== "vote" || room.players.size === 0) return;
  room.round = 1; room.roundsPlayed = 0; room.traps = []; room.finishOrder = [];
  room.levelIndex = pickVotedLevel(room, 0);
  room.votes = {}; room.voteOpen = false;
  room.finalBattle = null; room.winnerIds = [];
  for (const item of room.players.values()) { item.score = 0; item.trapCount = 0; item.pendingKills = 0; item.status = "building"; item.erasers = ERASERS_PER_COURSE; }
  dealItems(room);
  room.phase = "build";
  broadcast(room, { ...snapshot(room), type: "round_start" });
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
    for (const player of room.players.values()) player.erasers = ERASERS_PER_COURSE;   // fresh course, fresh eraser
  }
  room.votes = {}; room.voteOpen = false;
  room.phase = "build";
  // Colors are picked once when you join and kept for the whole game.
  for (const player of room.players.values()) { player.trapCount = 0; player.pendingKills = 0; player.status = "building"; }
  dealItems(room);
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

    // First message after connecting: claim your permanent player ID (or get a fresh one
    // if it is malformed or someone else is already using it right now).
    if (message.type === "hello") {
      let userId = String(message.userId || "").toUpperCase();
      if (!USER_ID_PATTERN.test(userId) || (users.has(userId) && users.get(userId) !== socket)) userId = makeUserId();
      if (socket.userId && users.get(socket.userId) === socket) users.delete(socket.userId);
      socket.userId = userId;
      users.set(userId, socket);
      send(socket, { type: "hello_ok", userId });
      return;
    }
    // The room list for the Join screen.
    if (message.type === "list_rooms") { send(socket, { type: "rooms", rooms: publicRoomList() }); return; }
    // Invite another player by their permanent ID. They get a toast with a Join button.
    if (message.type === "invite") {
      const target = users.get(String(message.toUserId || "").toUpperCase());
      if (!socket.room || !socket.player) { send(socket, { type: "error", message: "Create or join a room first, then invite." }); return; }
      if (!target) { send(socket, { type: "error", message: "No player with that ID is online." }); return; }
      if (target === socket) { send(socket, { type: "error", message: "That's your own ID." }); return; }
      if (target.room === socket.room) { send(socket, { type: "error", message: "Player is already in the server." }); return; }
      // One invite every INVITE_COOLDOWN_MS per player, so nobody gets spammed.
      const now = Date.now();
      if (now - (socket.lastInviteAt || 0) < INVITE_COOLDOWN_MS) {
        send(socket, { type: "error", message: `Slow down: one invite every ${INVITE_COOLDOWN_MS / 1000} seconds.` });
        return;
      }
      socket.lastInviteAt = now;
      send(target, { type: "invited", from: socket.player.name, fromUserId: socket.userId, code: socket.room.code });
      send(socket, { type: "notice", message: `Invite sent to ${message.toUserId.toUpperCase()}.` });
      return;
    }

    if (message.type === "create_room" || message.type === "join_room") {
      if (socket.room) { send(socket, { type: "error", message: "You're already in a room." }); return; }
      const wantedName = String(message.name || "Runner").slice(0, 26).trim() || "Runner";
      if (!ChatFilter.isClean(wantedName)) { send(socket, { type: "error", message: "That name isn't allowed here. Pick another.", fatal: true }); return; }
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
      // In the lobby (or the course vote) you wait for the host. Joining mid-run means sitting this round out.
      const status = room.phase === "lobby" || room.phase === "vote" ? "waiting" : room.phase === "build" ? "building" : "out";
      const player = { id: crypto.randomUUID(), name: wantedName, socket, score: 0, trapCount: 0, pendingKills: 0, status, color: null, erasers: ERASERS_PER_COURSE };
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

    // Pick your character model (in the lobby, any number of times).
    if (message.type === "choose_avatar") {
      if (room.phase !== "lobby") { send(socket, { type: "error", message: "You can change your character in the lobby." }); return; }
      if (!AVATARS.includes(message.avatar)) return;
      player.avatar = message.avatar;
      broadcast(room, { type: "avatar", playerId: player.id, avatar: player.avatar });
      return;
    }
    // The host can change the match settings while everyone is in the lobby.
    if (message.type === "update_settings") {
      if (player.id !== room.hostId) { send(socket, { type: "error", message: "Only the host can change the settings." }); return; }
      if (room.phase !== "lobby") { send(socket, { type: "error", message: "Settings are locked once the match starts." }); return; }
      const check = validateSettings(message.settings);
      if (!check.ok) { send(socket, { type: "error", message: check.message }); return; }
      room.settings = check.settings;
      broadcast(room, snapshot(room));
      return;
    }

    // Only the host starts the match, from the lobby, with 2+ players who all have colors.
    if (message.type === "start_match") {
      let problem = null;
      if (player.id !== room.hostId) problem = "Only the host can start.";
      else if (room.phase === "winner") problem = "Use Back to Lobby first.";
      else if (room.phase !== "lobby") problem = "The match has already started.";
      else if (room.players.size < 2) problem = "You need at least 2 players.";
      if (problem) { send(socket, { type: "error", message: problem }); return; }
      // Anyone who never picked a color gets a random one nobody else has.
      for (const item of room.players.values()) {
        if (item.color !== null) continue;
        const used = new Set([...room.players.values()].map((other) => other.color));
        const free = [...Array(PALETTE_SIZE).keys()].filter((color) => !used.has(color));
        item.color = free[Math.floor(Math.random() * free.length)] ?? 0;
        broadcast(room, { type: "color", playerId: item.id, color: item.color });
      }
      // First, everyone votes on the course for VOTE_SECONDS. Then the match begins.
      room.phase = "vote"; room.votes = {}; room.voteOpen = true;
      for (const item of room.players.values()) item.status = "waiting";
      broadcast(room, { ...snapshot(room), type: "vote_start", seconds: VOTE_SECONDS });
      clearTimeout(room.timer);
      room.timer = setTimeout(() => beginMatch(room), VOTE_SECONDS * 1000);
      return;
    }
    // Final Battle: choose a weapon from your offer during the countdown.
    if (message.type === "pick_weapon") {
      const fighting = room.phase === "results" && room.finalBattle && room.finalBattle.ids.includes(player.id) && !room.finalBattle.weapons;
      if (fighting && player.weaponOffer && player.weaponOffer.includes(message.weapon)) {
        player.weapon = message.weapon;
        broadcast(room, { type: "weapon_picked", playerId: player.id, weapon: player.weapon });
      }
      return;
    }
    // Final Battle: fire a weapon that needs the server (freeze everyone else, or drop a trap bomb).
    if (message.type === "weapon_use") {
      const fighting = room.phase === "run" && room.finalBattle && player.status === "running" && !player.weaponUsed;
      if (!fighting) return;
      if (player.weapon === "freeze") {
        player.weaponUsed = true;
        const ids = room.finalBattle.ids.filter((id) => id !== player.id);
        broadcast(room, { type: "freeze", by: player.id, ids, seconds: FREEZE_SECONDS });
      } else if (player.weapon === "bomb") {
        const x = Math.round((Number(message.x) || 0) / TILE) * TILE;
        const y = Math.round((Number(message.y) || 0) / TILE) * TILE;
        const trap = { x, y, w: TILE, h: TILE, owner: player.id, kind: "spike" };
        const level = LEVELS[room.levelIndex];
        const inBounds = x >= 0 && x + TILE <= LEVEL_W && y >= 0 && y + TILE <= LEVEL_H;
        if (!inBounds || overlaps(trap, level.flag) || room.traps.some((item) => overlaps(item, trap))) return;
        player.weaponUsed = true;
        room.traps.push(trap);
        broadcast(room, { type: "trap_placed", trap, playerId: player.id, traps: room.traps, bomb: true });
      }
      return;
    }
    // Erase someone else's trap during the build phase. Costs one eraser AND your item for the round.
    if (message.type === "erase_trap" && room.phase === "build") {
      const x = Number(message.x), y = Number(message.y);
      const index = room.traps.findIndex((item) => item.x === x && item.y === y);
      let problem = null;
      if (player.trapCount >= TRAPS_PER_ROUND) problem = "You've already used your item this round.";
      else if (player.pick !== "eraser") problem = "Pick the eraser first.";
      else if (player.erasers <= 0) problem = "No erasers left on this course.";
      else if (index < 0) problem = "Only placed traps can be erased.";
      else if (room.traps[index].owner === player.id) problem = "You can't erase your own trap.";
      if (problem) { send(socket, { type: "trap_rejected", message: problem }); return; }
      const [trap] = room.traps.splice(index, 1);
      player.erasers -= 1;
      player.trapCount += 1;   // the eraser was your item this round
      broadcast(room, { type: "trap_erased", trap, by: player.id, traps: room.traps, players: playerList(room) });
      maybeStartRun(room);
      return;
    }
    // Vote for a course: in the lobby, or on the results screen when the course is about to change.
    if (message.type === "vote_map") {
      const level = Number(message.level);
      const open = room.phase === "vote" || (room.phase === "results" && room.voteOpen);
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

    // Pick a color. In the lobby you can change your mind; once the match starts it is fixed.
    // Two players can't share one.
    if (message.type === "choose_color" && (player.color === null || room.phase === "lobby")) {
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
    // Pick one of this round's offered items (you can change your mind until you place).
    if (message.type === "pick_item" && room.phase === "build") {
      if (player.trapCount >= TRAPS_PER_ROUND) { send(socket, { type: "trap_rejected", message: "You've already used your item this round." }); return; }
      const slot = Number(message.slot);
      const problem = canPick(room, player, slot);
      if (problem) { send(socket, { type: "trap_rejected", message: problem }); return; }
      player.pick = room.offer[slot];
      player.pickSlot = slot;
      if (player.pick === "pencil") {
        // The pencil is used during the run, not placed now, so picking it is your build turn.
        player.trapCount = TRAPS_PER_ROUND;
        player.pencil = PENCIL_CHARGES;
        broadcast(room, { type: "picks", picks: itemPicks(room) });
        broadcast(room, { type: "pencil_taken", playerId: player.id, charges: PENCIL_CHARGES });
        maybeStartRun(room);
        return;
      }
      broadcast(room, { type: "picks", picks: itemPicks(room) });
      return;
    }
    // Nobody places anything until every player in the round has picked an item.
    const everyonePicked = () => [...room.players.values()].filter((item) => item.status !== "out").every((item) => item.pick);
    if ((message.type === "place_trap" || message.type === "erase_trap") && room.phase === "build" && !everyonePicked()) {
      send(socket, { type: "trap_rejected", message: "Waiting for everyone to pick an item." });
      return;
    }
    if (message.type === "place_trap" && room.phase === "build" && player.color !== null && player.trapCount < TRAPS_PER_ROUND && (!player.pick || player.pick === "eraser")) {
      send(socket, { type: "trap_rejected", message: player.pick === "eraser" ? "You picked the eraser: click a trap to erase it." : "Pick an item first." });
    }
    if (message.type === "place_trap" && room.phase === "build" && player.color !== null && player.trapCount < TRAPS_PER_ROUND && player.pick && player.pick !== "eraser") {
      const x = Math.round((Number(message.x) || 0) / TILE) * TILE;
      const y = Math.round((Number(message.y) || 0) / TILE) * TILE;
      const kind = player.pick;   // the item you picked this round; the browser's claim is ignored
      const trap = { x, y, w: TILE, h: TILE, owner: player.id, kind };
      const inBounds = x >= 2 * TILE && x + TILE <= LEVEL_W - TILE && y >= 0 && y + TILE <= LEVEL_H;
      if (inBounds && !trapBlocked(room, trap)) {
        room.traps.push(trap); player.trapCount += 1;
        broadcast(room, { type: "trap_placed", trap, playerId: player.id, traps: room.traps });
        maybeStartRun(room);
      } else {
        send(socket, { type: "trap_rejected", message: "You can't place a trap there." });
      }
    }
    // Pencil: sketch a few short-lived blocks to stand on, mid-run. The browser sends the
    // squares it drew; the server trims, bounds-checks, spends a charge and tells everyone.
    if (message.type === "draw_block" && room.phase === "run" && player.status === "running" && player.pencil > 0) {
      const blocks = (Array.isArray(message.blocks) ? message.blocks : []).slice(0, PENCIL_MAX_BLOCKS)
        .map((block) => ({ x: Math.round(Number(block.x) || 0), y: Math.round(Number(block.y) || 0), w: 15, h: 15 }))
        .filter((block) => block.x >= 0 && block.x + block.w <= LEVEL_W && block.y >= 0 && block.y + block.h <= LEVEL_H);
      if (!blocks.length) return;
      player.pencil -= 1;
      broadcast(room, { type: "drawn", by: player.id, blocks, seconds: PENCIL_SECONDS, left: player.pencil });
      return;
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
  socket.on("close", () => {
    removePlayer(socket);
    if (socket.userId && users.get(socket.userId) === socket) users.delete(socket.userId);
  });
});

server.listen(PORT, () => console.log(`Trapocalypse online at http://localhost:${PORT}`));
