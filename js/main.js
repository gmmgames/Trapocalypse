// ------------------------------------------------------------
// main.js
// The heartbeat of the game. About 60 times a second it does:
//   1. read input
//   2. update everything (move, fall, collide)
//   3. draw everything
// That three-step repeat is called the GAME LOOP. Every game
// you have ever played has one.
// ------------------------------------------------------------

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const buildHud = document.getElementById("build-hud");
const buildTitle = document.getElementById("build-title");
const buildInstructions = document.getElementById("build-instructions");
const startRunButton = document.getElementById("start-run");
const playerNameInput = document.getElementById("player-name");
const roomCodeInput = document.getElementById("room-code");
const createRoomButton = document.getElementById("create-room");
const joinRoomButton = document.getElementById("join-room");
const onlineStatus = document.getElementById("online-status");
const onlinePanel = document.getElementById("online-panel");
const colorPicker = document.getElementById("color-picker");
const swatchGrid = document.getElementById("swatches");
const lobby = document.getElementById("lobby");
const lobbyTitle = document.getElementById("lobby-title");
const lobbySettings = document.getElementById("lobby-settings");
const lobbyPlayers = document.getElementById("lobby-players");
const lobbyNote = document.getElementById("lobby-note");
const startMatchButton = document.getElementById("start-match");
const leaveRoomButton = document.getElementById("leave-room");
const mapVote = document.getElementById("map-vote");
const mapButtons = document.getElementById("map-buttons");
const gameWrap = document.getElementById("game-wrap");
const helpPanel = document.getElementById("help");
const helpPoints = document.getElementById("help-points");
const winnerHud = document.getElementById("winner-hud");
const backToLobbyButton = document.getElementById("back-to-lobby");
const winnerNote = document.getElementById("winner-note");

// The 24 colors players can pick from, laid out as 4 rows of 6.
// White is reserved for "you", so it is not in the palette.
const PALETTE = [
  "#ff3c78", "#ff5a3c", "#ff8c1a", "#ffb830", "#ffd23c", "#f5f03c",
  "#b4f03c", "#5cf05a", "#1fd68f", "#22e0c8", "#4df0ff", "#3cb4ff",
  "#4a7bff", "#6a5cff", "#9b5cff", "#c85cff", "#ff5cd6", "#ff7aa8",
  "#ffd6a8", "#c8ff9e", "#a8e8ff", "#d9b8ff", "#c0c0d8", "#8a6a4a",
];

// Canvas text uses the same fonts as the page (see index.html). Bangers is for big shouty titles.
const FONT = "'Fredoka', 'Segoe UI', system-ui, sans-serif";
const DISPLAY_FONT = "'Bangers', 'Fredoka', 'Segoe UI', system-ui, sans-serif";
const BANNER_SECONDS = 4;   // how long the Trailblazer burst stays on screen

// --- match settings (host only) ---
// Each dropdown has presets plus "Custom…", which reveals a number box.
// The server checks these again; this copy just gives instant feedback.
// The point values are plain number boxes ("input") with no presets.
const SETTING_FIELDS = {
  timeLimit:   { select: "set-time",   custom: "set-time-custom",   min: 30, max: 600, label: "Time limit" },
  pointsToWin: { select: "set-points", custom: "set-points-custom", min: 15, max: 99,  label: "Points to win" },
  roundCap:    { select: "set-rounds", custom: "set-rounds-custom", min: 3,  max: 60,  label: "Round cap" },
  winPoints:   { input: "set-win",   min: 1, max: 20, label: "Win points" },
  killPoints:  { input: "set-kill",  min: 0, max: 10, label: "Trap kill points" },
  firstPoints: { input: "set-first", min: 0, max: 10, label: "Trailblazer points" },
};
for (const field of Object.values(SETTING_FIELDS)) {
  if (!field.select) continue;
  const select = document.getElementById(field.select);
  const custom = document.getElementById(field.custom);
  select.addEventListener("change", () => custom.classList.toggle("hidden", select.value !== "custom"));
}

// Read the settings. Returns null (and says why) if a value is out of range.
function readSettings() {
  const settings = {};
  for (const [key, field] of Object.entries(SETTING_FIELDS)) {
    let text;
    if (field.input) text = document.getElementById(field.input).value;
    else {
      const select = document.getElementById(field.select);
      text = select.value === "custom" ? document.getElementById(field.custom).value : select.value;
    }
    if (text === "null") { settings[key] = null; continue; }   // Infinite time limit
    const n = Number(text);
    if (text.trim() === "" || !Number.isInteger(n) || n < field.min || n > field.max) {
      onlineStatus.textContent = `${field.label} must be between ${field.min} and ${field.max}.`;
      return null;
    }
    settings[key] = n;
  }
  return settings;
}

const Game = {
  // Day 1 only has one thing to do: run. Later days add
  // "setup", "build", "results", and "winner" states here.
  state: "run",
  message: "",
  _messageTimer: 0,
  _resetTimer: 0,
  _advanceLevel: false,
  levelIndex: 0,
  complete: false,
  mode: "solo",
  phase: "run",
  builder: 0,
  runner: 0,
  placements: [0, 0],
  deaths: [0, 0],
  remotePlayers: {},
  _networkTimer: 0,

  // --- online round state, filled in by the server ---
  round: 1,
  roundsPerLevel: 3,
  trapsPerRound: 1,
  players: [],          // everyone in the room: { id, name, score, status, color }
  maxPlayers: 24,
  settings: null,       // the host's match settings, from the server
  hostId: null,         // who the host is, from the server
  inRoom: false,        // true from the first room update until you leave
  votes: {},            // playerId -> course index, from the server
  voteOpen: false,      // true on a results screen where the next course is being voted on
  winnerIds: [],        // who won, once the match is over
  finalBattleIds: [],   // who is fighting in the current Final Battle (empty = normal round)
  _finalBattleNext: null, // the round_over said a Final Battle is coming
  _winnerPending: null,   // the round_over said a winner is about to be crowned
  _gains: {},             // playerId -> [{ label, points }] for this round, from the server
  _resultsElapsed: 0,     // seconds since the results screen appeared (drives the bar animation)
  myColor: null,        // index into PALETTE, chosen once when you join
  _nextRoundIn: 0,      // countdown shown on the scoreboard
  _chartX: {},          // where each player's bar currently sits (slides toward its sorted spot)
  _firstFinisher: null, // who earned the "First One There!" bonus this round
  _firstBonus: 2,       // how many points that bonus is worth (the server tells us)
  _bannerTimer: 0,      // seconds left to show that banner
  _runTimeLimit: null,  // seconds allowed for this run, or null for no limit
  _runStartedAt: 0,     // wall-clock time the run began, so the countdown can't drift
  _runTimeLeft: null,   // seconds left, shown in the HUD

  start() {
    Level.load(this.levelIndex);
    Player.spawn();
    this.say(`Level 1: ${Level.name}`, 2.5);
    requestAnimationFrame(this.loop.bind(this));
  },

  startParty() {
    this.mode = "party";
    this.phase = "build";
    this.levelIndex = 0;
    this.builder = 0;
    this.runner = 0;
    this.placements = [0, 0];
    this.deaths = [0, 0];
    this.complete = false;
    Level.load(this.levelIndex);
    Player.spawn();
    buildHud.classList.remove("hidden");
    this.say("Builder 1: place two traps", 3);
  },

  startOnline() {
    this.mode = "online";
    this.phase = "lobby";
    this.inRoom = false;
    this.complete = false;
    this.remotePlayers = {};
    this.players = [];
    this.myColor = null;
    this._chartX = {};
    Level.load(0);
    Player.spawn();
    buildHud.classList.add("hidden");
    lobby.classList.add("hidden");
    onlineStatus.textContent = "Connecting to room...";
  },

  // Back to the page as it is on load: solo mode, room panel showing.
  leaveOnline(statusText = "Create a room or join a friend.") {
    this.mode = "solo";
    this.phase = "run";
    this.inRoom = false;
    this.players = [];
    this.remotePlayers = {};
    this._chartX = {};
    this.myColor = null;
    this.hostId = null;
    this.levelIndex = 0;
    this.complete = false;
    this._resetTimer = 0;
    this._advanceLevel = false;
    this._runTimeLeft = null;
    this.winnerIds = [];
    this.finalBattleIds = [];
    Player.color = "#ff3c78";
    Level.load(0);
    Player.spawn();
    lobby.classList.add("hidden");
    colorPicker.classList.add("hidden");
    leaveRoomButton.classList.add("hidden");
    winnerHud.classList.add("hidden");
    mapVote.classList.add("hidden");
    onlinePanel.classList.remove("hidden");
    onlineStatus.textContent = statusText;
    roomCodeInput.value = "";
    this.say("Left the room.", 2);
  },

  // Fill in the lobby box and the Leave button from the latest room info.
  renderRoom() {
    onlinePanel.classList.add("hidden");
    leaveRoomButton.classList.toggle("hidden", !this.inRoom);
    lobby.classList.toggle("hidden", this.phase !== "lobby");
    const isHost = Network.id === this.hostId;
    // Winner screen: only the host gets the button, everyone else waits.
    winnerHud.classList.toggle("hidden", this.phase !== "winner");
    backToLobbyButton.classList.toggle("hidden", !isHost);
    winnerNote.textContent = isHost ? "" : "Waiting for the host…";
    this.renderVote();
    if (this.phase !== "lobby") return;
    const s = this.settings || {};
    lobbyTitle.textContent = `ROOM ${roomCodeInput.value}`;
    lobbySettings.textContent = `Time limit ${s.timeLimit === null ? "Infinite" : s.timeLimit + " s"}  •  First to ${s.pointsToWin}  •  Max ${s.roundCap} rounds\nWin ${s.winPoints}  •  Trap kill ${s.killPoints}  •  Trailblazer ${s.firstPoints}`;
    lobbyPlayers.replaceChildren(...this.players.map((player) => {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = player.color !== null ? PALETTE[player.color] : "#45455d";
      item.append(dot, `${player.name}${player.id === this.hostId ? " (host)" : ""}`);
      return item;
    }));
    startMatchButton.classList.toggle("hidden", !isHost);
    if (!isHost) lobbyNote.textContent = "Waiting for the host to start";
    else if (this.players.length < 2) lobbyNote.textContent = "Need at least 2 players";
    else if (this.players.some((player) => player.color === null)) lobbyNote.textContent = "Waiting for everyone to pick a color";
    else lobbyNote.textContent = "";
  },

  // --- color picker ---
  buildSwatches() {
    PALETTE.forEach((color, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.style.background = color;
      button.setAttribute("aria-label", `Color ${index + 1}`);
      button.addEventListener("click", () => Network.send({ type: "choose_color", color: index }));
      swatchGrid.appendChild(button);
    });
  },

  // --- How to Play ---
  // The point list uses the room's real settings when you are in one, otherwise the defaults.
  showHelp() {
    const s = this.settings || { winPoints: 4, killPoints: 1, firstPoints: 2, pointsToWin: 45, roundCap: 30, timeLimit: 60 };
    const time = s.timeLimit === null ? "no time limit" : `${s.timeLimit} seconds per run`;
    const lines = [
      `Reaching the flag: ${s.winPoints} point${s.winPoints === 1 ? "" : "s"}.`,
      `Trailblazer (first to the flag when 3 or more run and 2 or more finish): ${s.firstPoints} more.`,
      `Each time your trap kills someone: ${s.killPoints}, paid at the end of the round only if you reach the flag too.`,
      `Final Battle: first to the flag 5, second 3, third 1. Nothing else pays in a Final Battle.`,
      `${this.settings ? "This match" : "Default"}: first to ${s.pointsToWin} points wins, ${s.roundCap} rounds at most, ${time}.`,
    ];
    helpPoints.replaceChildren(...lines.map((text) => { const li = document.createElement("li"); li.textContent = text; return li; }));
    helpPanel.classList.remove("hidden");
  },

  hideHelp() {
    helpPanel.classList.add("hidden");
  },

  // --- course vote ---
  buildMapButtons() {
    LEVELS.forEach((level, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-btn";
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.background = level.theme.bg;
      chip.style.borderBottomColor = level.theme.solidTop;
      const count = document.createElement("span");
      count.className = "count";
      button.append(chip, level.name, count);
      button.addEventListener("click", () => Network.send({ type: "vote_map", level: index }));
      mapButtons.appendChild(button);
    });
  },

  // Show the vote where it belongs: inside the lobby, or floating over the results chart.
  renderVote() {
    const inLobby = this.phase === "lobby";
    const onResults = this.phase === "results" && this.voteOpen;
    mapVote.classList.toggle("hidden", !(inLobby || onResults));
    mapVote.classList.toggle("floating", onResults);
    if (inLobby && mapVote.parentElement !== lobby) lobby.insertBefore(mapVote, lobbyPlayers);
    if (onResults && mapVote.parentElement !== gameWrap) gameWrap.appendChild(mapVote);
    document.getElementById("map-vote-title").textContent = inLobby ? "Vote for the first course" : "Vote for the next course";
    const counts = new Array(LEVELS.length).fill(0);
    for (const level of Object.values(this.votes)) counts[level] += 1;
    [...mapButtons.children].forEach((button, index) => {
      button.querySelector(".count").textContent = counts[index] ? `×${counts[index]}` : "";
      button.classList.toggle("mine", this.votes[Network.id] === index);
    });
  },

  refreshSwatches() {
    const taken = new Set(this.players.filter((player) => player.id !== Network.id && player.color !== null).map((player) => player.color));
    [...swatchGrid.children].forEach((button, index) => { button.disabled = taken.has(index); });
  },

  showColorPicker() {
    this.refreshSwatches();
    colorPicker.classList.remove("hidden");
    buildHud.classList.add("hidden");
  },

  hideColorPicker() {
    colorPicker.classList.add("hidden");
    if (this.phase === "build") buildHud.classList.remove("hidden");
  },

  colorOf(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    return player && player.color !== null ? PALETTE[player.color] : "#4df0ff";
  },

  nameOf(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    return player ? player.name : "Someone";
  },

  // The server sends the whole room whenever something big changes:
  // someone joins or leaves, or a new round begins.
  applyRoomState(message) {
    this.phase = message.phase;
    this.round = message.round;
    this.roundsPerLevel = message.roundsPerLevel;
    this.trapsPerRound = message.trapsPerRound;
    this.maxPlayers = message.maxPlayers || this.maxPlayers;
    this.settings = message.settings || this.settings;
    this.hostId = message.hostId || null;
    this.winnerIds = message.winnerIds || [];
    this.finalBattleIds = message.finalBattleIds || [];
    this.votes = message.votes || {};
    this.voteOpen = Boolean(message.voteOpen);
    this.levelIndex = message.levelIndex;
    this.players = message.players;
    Level.load(message.levelIndex);
    for (const trap of message.traps) Level.hazards.push(trap);
    this.remotePlayers = {};
    for (const player of message.players) {
      if (player.id !== Network.id) {
        this.remotePlayers[player.id] = { name: player.name, x: Level.start.x, y: Level.start.y, alive: true, finished: false };
      }
    }
    const me = message.players.find((player) => player.id === Network.id);
    this.placements[0] = me ? me.trapCount : 0;
    this.myColor = me ? me.color : null;
    Player.color = this.myColor === null ? "#ff3c78" : PALETTE[this.myColor];
    roomCodeInput.value = message.code;
    this.inRoom = true;
    if (this.phase === "lobby") this._chartX = {};   // a fresh match gets a fresh chart
    this.showScores();
    this.renderRoom();
    startRunButton.classList.add("hidden");
    // The picker only shows until you have a color. After that it stays away for good.
    if (this.myColor === null) this.showColorPicker();
    else if (this.phase === "build") this.hideColorPicker();
    else { colorPicker.classList.add("hidden"); buildHud.classList.add("hidden"); }
  },

  showScores() {
    const scores = this.players.map((player) => `${player.name} ${player.score}`).join("  |  ");
    onlineStatus.textContent = `Room ${roomCodeInput.value}  •  ${this.players.length}/${this.maxPlayers} runners  •  ${scores}`;
  },

  onNetworkMessage(message) {
    if (message.type === "error") {
      onlineStatus.textContent = message.message;
      this.say(message.message, 3);
      // A fatal error means we are not in any room: go back to the start page, keeping the reason on screen.
      if (message.fatal && this.mode === "online") this.leaveOnline(message.message);
      return;
    }
    if (message.type === "joined") return;
    if (message.type === "room_state") {
      this.applyRoomState(message);
      // A room update arrives whenever anyone joins or leaves, even mid-run.
      // Only reset the runner if we are building, or if the server says we are
      // sitting this round out. Anyone already running, dead, or finished keeps
      // exactly where they were.
      const me = this.players.find((player) => player.id === Network.id);
      if (this.phase === "lobby") Player.spawn();
      else if (this.phase === "build") { Player.spawn(); this.say("Pick a color, then place your trap.", 3); }
      else if (me && me.status === "out") {
        Player.spawn(); Player.alive = false;
        this.say(this.phase === "winner" ? "Match over. Pick a color and wait for the lobby." : "Round in progress. Pick a color for next round.", 3);
      }
    }
    if (message.type === "round_start") {
      this.applyRoomState(message);
      Player.spawn();
      this._bannerTimer = 0;
      this.say(`Round ${this.round} on ${Level.name}. Place your trap.`, 3);
    }
    if (message.type === "color") {
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.color = message.color;
      if (message.playerId === Network.id) {
        this.myColor = message.color;
        Player.color = PALETTE[message.color];
        this.hideColorPicker();
        this.say(this.phase === "lobby" ? "Color picked. Waiting in the lobby." : "Now tap the level to place your trap.", 3);
      }
      this.refreshSwatches();
      this.renderRoom();
    }
    if (message.type === "color_rejected") { this.say(message.message, 1.5); this.refreshSwatches(); }
    if (message.type === "trap_placed") {
      if (!Level.hazards.some((hazard) => hazard.x === message.trap.x && hazard.y === message.trap.y)) Level.hazards.push(message.trap);
      if (message.playerId === Network.id) this.placements[0] += 1;
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.trapCount += 1;
    }
    if (message.type === "trap_rejected") this.say(message.message, 1.5);
    if (message.type === "phase" && message.phase === "run") {
      this.phase = "run";
      buildHud.classList.add("hidden");
      colorPicker.classList.add("hidden");
      onlinePanel.classList.add("hidden");   // the room UI goes away once the round starts
      this.voteOpen = false;
      this.renderVote();
      Player.spawn();
      for (const remote of Object.values(this.remotePlayers)) { remote.alive = true; remote.finished = false; }
      // Mirror what the server just did: everyone runs, or in a Final Battle only the tied players do.
      this.finalBattleIds = message.finalBattleIds || [];
      const fighting = (id) => this.finalBattleIds.length === 0 || this.finalBattleIds.includes(id);
      for (const player of this.players) player.status = fighting(player.id) ? "running" : "out";
      this._runTimeLimit = message.timeLimit === undefined ? null : message.timeLimit;
      this._runStartedAt = performance.now();
      this._runTimeLeft = this._runTimeLimit;
      if (this.finalBattleIds.length === 0) this.say("Run! One life. Reach the flag.", 2);
      else if (fighting(Network.id)) this.say("FINAL BATTLE! First to the flag gets +5.", 3);
      else { Player.alive = false; this.say("Final Battle! Watch the tied players fight it out.", 3); }
    }
    if (message.type === "votes") {
      this.votes = message.votes;
      this.renderVote();
    }
    if (message.type === "match_over") {
      this.phase = "winner";
      this.players = message.players;
      this.winnerIds = message.winnerIds;
      this._bannerTimer = 0;
      this._runTimeLeft = null;
      this.showScores();
      this.renderRoom();
    }
    if (message.type === "time_up") {
      // The clock ran out. Everyone the server lists is out of this round.
      for (const id of message.timedOut) {
        const who = this.players.find((player) => player.id === id);
        if (who) who.status = "dead";
        if (this.remotePlayers[id]) this.remotePlayers[id].alive = false;
      }
      if (message.timedOut.includes(Network.id)) {
        this.say(Player.finished ? "Too late! Time ran out." : "Time's up!", 2);
        Player.alive = false;
        Player.finished = false;
      }
      this._runTimeLeft = null;
    }
    if (message.type === "player_update" && message.playerId !== Network.id) {
      if (!this.remotePlayers[message.playerId]) this.remotePlayers[message.playerId] = { name: "Runner" };
      const remote = this.remotePlayers[message.playerId];
      // Other runners' dust is guessed from how they moved since their last update
      // (about every 50 ms): level movement = running, falling then level = landing.
      if (remote.alive && !remote.finished && message.alive && remote.x !== undefined) {
        const dx = message.x - remote.x, dy = message.y - remote.y;
        const feetX = message.x + Player.w / 2, feetY = message.y + Player.h;
        if (remote._falling && dy === 0) Dust.landing(feetX, feetY);
        else if (dy === 0 && dx !== 0) Dust.trail(message.playerId, feetX, feetY, 0.05);
        remote._falling = dy > 0;
      }
      Object.assign(remote, message);
    }
    if (message.type === "status") {
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.status = message.status;
      // A death by someone's trap: the server tells us who owns it and what it paid.
      const killer = message.killedBy ? this.players.find((player) => player.id === message.killedBy) : null;
      if (killer) {
        const victim = who ? who.name : "someone";
        if (killer.id === Network.id) {
          // Kills only pay if you reach the flag too, so the wording depends on how you're doing.
          const me = this.players.find((player) => player.id === Network.id);
          const mine = me ? me.status : "";
          if (mine === "running") this.say(`Your trap got ${victim}! Finish to bank +${message.killPoints}`, 2);
          else if (mine === "finished") this.say(`Your trap got ${victim}! +${message.killPoints} banked`, 2);
          else this.say(`Your trap got ${victim}! No points, you didn't finish.`, 2);
        }
        else if (message.playerId === Network.id) this.say(`${killer.name}'s trap got you! Watching the others...`, 4);
        else this.say(`${killer.name}'s trap got ${victim}!`, 1.5);
        this.showScores();
      } else if (message.playerId !== Network.id && who) {
        this.say(message.status === "dead" ? `${who.name} is out!` : `${who.name} made it!`, 1.5);
      }
    }
    if (message.type === "round_over") {
      this.phase = "results";
      this.players = message.players;
      this._runTimeLeft = null;
      this._nextRoundIn = message.nextIn;
      this._firstFinisher = message.firstFinisher || null;
      this._firstBonus = message.firstBonus || this._firstBonus;
      this._bannerTimer = this._firstFinisher ? BANNER_SECONDS : 0;
      this._finalBattleNext = message.finalBattle || null;
      this._winnerPending = message.winnerPending || null;
      this._gains = message.gains || {};
      this._resultsElapsed = 0;
      this.votes = {};
      this.voteOpen = Boolean(message.voteOpen);
      this.renderVote();
      const iFinished = message.finishers.includes(Network.id);
      // Points from your trap's kills, banked because you finished.
      const myKills = message.killBonus ? message.killBonus[Network.id] : 0;
      const extra = myKills ? ` +${myKills} from your traps` : "";
      if (message.finalBattle) {
        const names = message.finalBattle.ids.map((id) => this.nameOf(id));
        this.say(message.finalBattle.again ? "Final Battle again: nobody finished!" : `FINAL BATTLE next: ${names.join(" vs ")}`, message.nextIn);
      } else if (message.winnerPending) {
        const names = message.winnerPending.map((id) => this.nameOf(id));
        this.say(`${names.join(" & ")} win${names.length === 1 ? "s" : ""} the match!`, message.nextIn);
      }
      else if (message.finishers.length === 0) this.say("Everyone's out. No points.", message.nextIn);
      else if (message.everyoneFinished) this.say("Everyone made it. No points.", message.nextIn);
      else if (iFinished) this.say(`You scored!${extra}`, message.nextIn);
      else this.say("Round over.", message.nextIn);
      this.showScores();
    }
  },

  startPartyRun() {
    this.phase = "run";
    this.runner = 0;
    buildHud.classList.add("hidden");
    Player.spawn();
    this.say("Runner 1: survive the sabotage", 3);
  },

  placeTrap(clientX, clientY) {
    if (this.phase !== "build") return;
    if (this.mode === "online" && this.myColor === null) { this.say("Pick a color first.", 1.5); return; }
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - bounds.left) / bounds.width) * LEVEL_W / TILE) * TILE;
    const y = Math.floor(((clientY - bounds.top) / bounds.height) * LEVEL_H / TILE) * TILE;
    const trap = { x, y, w: TILE, h: TILE };

    // No traps on the flag, on any player, on another trap, or off the edges.
    const onSomeone = Physics.overlaps(trap, Player) ||
      Object.values(this.remotePlayers).some((remote) => Physics.overlaps(trap, { x: remote.x, y: remote.y, w: Player.w, h: Player.h }));
    const blocked = x < 2 * TILE || x + TILE > LEVEL_W - TILE ||
      Level.hazards.some((hazard) => Physics.overlaps(trap, hazard)) ||
      Physics.overlaps(trap, Level.flag) || onSomeone;
    if (blocked) { this.say("You can't place a trap there.", 1.5); return; }

    if (this.mode === "online") {
      if (this.placements[0] >= this.trapsPerRound) { this.say("You've placed your trap. Waiting for the others.", 1.5); return; }
      Network.send({ type: "place_trap", x, y });
      return;
    }
    Level.hazards.push(trap);
    this.placements[this.builder] += 1;
    if (this.placements[this.builder] >= 2 && this.builder === 0) {
      this.builder = 1;
      this.say("Builder 2: place two traps", 3);
    } else if (this.placements[1] >= 2) {
      this.say("Build complete. Let the betrayal begin.", 2);
      this._resetTimer = 2;
      this._advanceLevel = false;
    }
  },

  // Show a short message in the corner for a few seconds.
  say(text, seconds = 2) {
    this.message = text;
    this._messageTimer = seconds;
  },

  onPlayerDied(hazard) {
    if (this.mode === "online") {
      // One life per round: no respawn until the next round starts.
      // Tell the server which spike got us (by grid position) so its owner can score.
      Network.send({ type: "died", trapX: hazard ? hazard.x : null, trapY: hazard ? hazard.y : null });
      this.say("You're out! Watching the others...", 4);
      return;
    }
    if (this.mode === "party") this.deaths[this.runner] += 1;
    this.say(this.mode === "party" ? `Runner ${this.runner + 1} triggered a trap!` : "Splat. Try again!", 1.5);
    this._resetTimer = 1.0;
  },

  onPlayerFinished() {
    if (this.mode === "online") {
      Network.send({ type: "finished" });
      this.say("You made it! Waiting for the others...", 4);
      return;
    }
    if (this.mode === "party" && this.runner === 0) {
      this.say("Runner 1 survived. Pass the controls!", 2);
      this._resetTimer = 2;
      this.runner = 1;
      return;
    }
    if (this.mode === "party") {
      this.complete = true;
      this.say(`Party cleared! ${this.deaths[0]} / ${this.deaths[1]} deaths`, 5);
      return;
    }
    this._advanceLevel = true;
    this.say(this.levelIndex === LEVELS.length - 1 ? "All courses cleared!" : "Course cleared!", 1.5);
    this._resetTimer = 1.5;
  },

  update(dt) {
    Input.update();
    Dust.update(dt);
    if (this.phase === "run" && !this.complete) {
      Player.update(dt);
      if (this.mode === "online") {
        this._networkTimer -= dt;
        if (this._networkTimer <= 0) {
          this._networkTimer = 0.05;
          Network.send({ type: "player_update", x: Player.x, y: Player.y, alive: Player.alive, finished: Player.finished });
        }
      }
    }
    if (this.phase === "results" && this._nextRoundIn > 0) this._nextRoundIn -= dt;
    if (this.phase === "results") this._resultsElapsed += dt;
    // Countdown from the wall clock, so a tab that was hidden still shows the right time.
    if (this.phase === "run" && this._runTimeLimit !== null && this._runTimeLeft !== null) {
      this._runTimeLeft = Math.max(0, this._runTimeLimit - (performance.now() - this._runStartedAt) / 1000);
    }
    if (this._bannerTimer > 0) this._bannerTimer -= dt;

    // Count down timers
    if (this._messageTimer > 0) {
      this._messageTimer -= dt;
      if (this._messageTimer <= 0) this.message = "";
    }
    if (this._resetTimer > 0) {
      this._resetTimer -= dt;
      if (this._resetTimer <= 0) {
        if (this._advanceLevel && this.levelIndex < LEVELS.length - 1) {
          this.levelIndex += 1;
          Level.load(this.levelIndex);
          this._advanceLevel = false;
          Player.spawn();
          this.say(`Level ${this.levelIndex + 1}: ${Level.name}`, 2.5);
        } else if (this.mode === "party" && this.phase === "build") {
          this.startPartyRun();
        } else if (this.mode === "party" && this.runner === 1) {
          Player.spawn();
        } else if (!this._advanceLevel) {
          Player.spawn();
        } else {
          this.complete = true;
        }
      }
    }
  },

  // A name floating above a runner's head, with a dark backing so it reads over anything.
  drawNametag(x, y, name, color) {
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const width = ctx.measureText(name).width + 10;
    const centerX = x + Player.w / 2;
    ctx.fillStyle = "rgba(11, 11, 20, 0.75)";
    ctx.fillRect(centerX - width / 2, y - 22, width, 17);
    ctx.fillStyle = color;
    ctx.fillText(name, centerX, y - 7);
  },

  // The bar animation: each player's points arrive one stage at a time (win, then
  // trap kills, then Trailblazer). Returns the score to draw right now plus the
  // labels that should be floating above the bar.
  //   stage i grows from STAGE_START + i * STAGE_GAP over STAGE_GROW seconds.
  animatedScore(player) {
    const STAGE_START = 0.7, STAGE_GAP = 1.0, STAGE_GROW = 0.6, LABEL_LIFE = 1.4;
    const stages = this._gains[player.id] || [];
    const total = stages.reduce((sum, stage) => sum + stage.points, 0);
    let shown = player.score - total;   // where the bar was before this round
    const labels = [];
    stages.forEach((stage, i) => {
      const t = this._resultsElapsed - (STAGE_START + i * STAGE_GAP);
      if (t <= 0) return;
      const grow = Math.min(1, t / STAGE_GROW);
      shown += stage.points * (1 - (1 - grow) * (1 - grow));   // ease out: fast start, gentle finish
      if (t < LABEL_LIFE) labels.push({ text: `+${stage.points} ${stage.label}`, age: t / LABEL_LIFE });
    });
    return { shown, labels };
  },

  // End-of-round scoreboard: one bar per player, tallest score on the left,
  // the player's color at the foot of each bar, their name across the top.
  drawScoreboard() {
    ctx.fillStyle = "rgba(11, 11, 20, 0.82)";
    ctx.fillRect(0, 0, LEVEL_W, LEVEL_H);

    const sorted = [...this.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    // Bars shrink to fit: a 2-player chart is wide, a 24-player chart still fits on screen.
    const count = Math.max(1, sorted.length);
    const gap = Math.min(40, Math.floor(880 / count / 4));
    const barW = Math.min(110, Math.floor((880 - gap * (count - 1)) / count));
    const nameFont = Math.max(9, Math.min(18, Math.floor(barW / 4)));
    // When the course vote is floating at the bottom, lift the chart out of its way.
    const baseline = this.voteOpen ? 370 : 440, maxBarH = this.voteOpen ? 200 : 260, swatchH = 22;
    const animate = this.phase === "results";   // the winner screen shows final numbers straight away
    const totalW = sorted.length * barW + (sorted.length - 1) * gap;
    const leftX = (LEVEL_W - totalW) / 2;
    const topScore = Math.max(1, ...sorted.map((player) => player.score));

    ctx.font = `36px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffd23c";
    ctx.fillText(this.phase === "winner" ? "FINAL RESULTS" : `ROUND ${this.round} RESULTS`, LEVEL_W / 2, 70);
    if (this.phase === "winner") {
      // The winner's name (or names, for a shared win) in their color.
      const names = this.winnerIds.map((id) => this.nameOf(id));
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = this.winnerIds.length ? this.colorOf(this.winnerIds[0]) : "#ffd23c";
      ctx.fillText(`${names.join(" & ")} win${names.length === 1 ? "s" : ""}!`, LEVEL_W / 2, 100);
    } else {
      const label = this._finalBattleNext ? "Final Battle in" : this._winnerPending ? "Final results in" : "Next round in";
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = "#c0c0d8";
      ctx.fillText(`${label} ${Math.max(0, Math.ceil(this._nextRoundIn))}`, LEVEL_W / 2, 96);
    }

    sorted.forEach((player, rank) => {
      // Slide each bar toward its sorted slot so the order change is visible.
      const targetX = leftX + rank * (barW + gap);
      if (this._chartX[player.id] === undefined) this._chartX[player.id] = targetX;
      this._chartX[player.id] += (targetX - this._chartX[player.id]) * 0.12;
      const x = this._chartX[player.id];

      const isMe = player.id === Network.id;
      const color = player.color !== null ? PALETTE[player.color] : "#4df0ff";
      const { shown, labels } = animate ? this.animatedScore(player) : { shown: player.score, labels: [] };
      const barH = 8 + (shown / topScore) * maxBarH;

      // The bar
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, baseline - barH, barW, barH);
      ctx.globalAlpha = 1;

      // The player's color block at the foot of the column
      ctx.fillStyle = color;
      ctx.fillRect(x, baseline + 4, barW, swatchH);
      ctx.strokeStyle = isMe ? "#ffffff" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, baseline + 4, barW, swatchH);

      // Name across the top of the bar, white for you, their color for everyone else.
      // Long names get trimmed so they never spill into the next column.
      ctx.font = `bold ${nameFont}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = isMe ? "#ffffff" : color;
      let label = player.name;
      while (label.length > 1 && ctx.measureText(label).width > barW + gap - 4) label = label.slice(0, -1);
      ctx.fillText(label, x + barW / 2, baseline - barH - 10);

      // Score inside the bar when it is tall enough, otherwise above the name
      ctx.font = `bold ${Math.max(12, Math.min(22, barW / 3))}px ${FONT}`;
      if (barH >= 40) {
        ctx.fillStyle = "#0b0b14";
        ctx.fillText(String(Math.round(shown)), x + barW / 2, baseline - 12);
      } else {
        ctx.fillStyle = "#e8e8ff";
        ctx.fillText(String(Math.round(shown)), x + barW / 2, baseline - barH - 14 - nameFont);
      }

      // "+4 win" style labels float up from the top of the bar and fade.
      ctx.font = `bold ${Math.max(10, Math.min(15, barW / 6))}px ${FONT}`;
      labels.forEach((label) => {
        ctx.globalAlpha = 1 - label.age;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label.text, x + barW / 2, baseline - barH - 26 - nameFont - label.age * 40);
      });
      ctx.globalAlpha = 1;
    });

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(leftX - 20, baseline); ctx.lineTo(leftX + totalW + 20, baseline); ctx.stroke();

    if (this._bannerTimer > 0 && this._firstFinisher) this.drawTrailblazer();
  },

  // "Trailblazer!" for the first finisher: a jagged comic burst that slams down
  // into place, holds, then fades. Everyone sees it for BANNER_SECONDS.
  drawTrailblazer() {
    const winner = this.players.find((player) => player.id === this._firstFinisher);
    const color = winner && winner.color !== null ? PALETTE[winner.color] : "#ffd23c";
    const elapsed = BANNER_SECONDS - this._bannerTimer;   // seconds since it appeared
    const centerX = LEVEL_W / 2, centerY = 200;

    // Slam: starts huge and far, shrinks and drops into place over 0.25 s...
    const drop = Math.min(1, elapsed / 0.25);
    const eased = drop * drop;                            // speeds up as it falls, like gravity
    let scaleX = 2.2 - 1.2 * eased, scaleY = scaleX;
    let offsetY = -60 * (1 - eased);
    // ...then squashes on impact for 0.2 s and springs back.
    const impact = Math.max(0, Math.min(1, (elapsed - 0.25) / 0.2));
    const squash = Math.sin(impact * Math.PI);
    scaleX += 0.14 * squash;
    scaleY -= 0.2 * squash;
    const fade = Math.min(1, this._bannerTimer / 0.4);   // quick fade-out at the end

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(centerX, centerY + offsetY);
    ctx.scale(scaleX, scaleY);

    // The burst: points alternate between an outer and inner radius around an ellipse.
    const spikes = 18, outerW = 170, outerH = 62, innerW = 148, innerH = 48;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2;
      const rw = i % 2 === 0 ? outerW : innerW, rh = i % 2 === 0 ? outerH : innerH;
      const px = Math.cos(angle) * rw, py = Math.sin(angle) * rh;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(11, 11, 20, 0.95)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (winner) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText(winner.name, 0, -20);
    }
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.font = `34px ${DISPLAY_FONT}`;
    ctx.fillText("Trailblazer!", 0, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e8e8ff";
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(`+${this._firstBonus} Points`, 0, 30);
    ctx.restore();
  },

  draw() {
    // Wipe the whole canvas, then redraw the scene from scratch.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Level.draw(ctx);
    Dust.draw(ctx);   // under the runners, over the ground

    // Other runners first, so your own square is always drawn on top.
    for (const [id, remote] of Object.entries(this.remotePlayers)) {
      if (!remote.alive || remote.finished) continue;
      const color = this.colorOf(id);
      ctx.fillStyle = color;
      ctx.fillRect(remote.x, remote.y, Player.w, Player.h);
      if (this.mode === "online") this.drawNametag(remote.x, remote.y, remote.name, color);
    }
    Player.draw(ctx);
    if (this.mode === "online" && Player.alive) {
      const me = this.players.find((player) => player.id === Network.id);
      this.drawNametag(Player.x, Player.y, me ? me.name : "You", "#ffffff");
    }

    if (this.mode === "online" && (this.phase === "results" || this.phase === "winner")) this.drawScoreboard();

    if (this.mode === "online" && this.phase === "lobby") {
      hud.textContent = `ROOM ${roomCodeInput.value}  •  ${this.message}`;
    } else if (this.mode === "online" && this.phase === "winner") {
      hud.textContent = `MATCH OVER  •  ${this.message}`;
    } else if (this.mode === "online") {
      const cap = this.settings ? this.settings.roundCap : "?";
      const roundLabel = `ROUND ${this.round} of ${cap}  ${Level.name}`;
      const clock = this.phase === "run" && this._runTimeLeft !== null ? `  •  ⏱ ${Math.ceil(this._runTimeLeft)}s` : "";
      hud.textContent = `${roundLabel}${clock}  •  ${this.message}`;
    } else {
      const progress = `LEVEL ${this.levelIndex + 1}/${LEVELS.length}  ${Level.name}`;
      hud.textContent = this.complete ? `${progress}  •  COMPLETE` : `${progress}  •  ${this.message}`;
    }

    if (this.mode === "party" && this.phase === "build") {
      buildTitle.textContent = `BUILDER ${this.builder + 1}`;
      buildInstructions.textContent = `${this.placements[this.builder]}/2 traps placed`;
    }
    if (this.mode === "online" && this.phase === "build") {
      buildTitle.textContent = `ROUND ${this.round} BUILD`;
      const waiting = this.players.filter((player) => player.trapCount < this.trapsPerRound && player.status !== "out").length;
      if (this.players.length < 2) {
        buildInstructions.textContent = `Waiting for another player. Share room code ${roomCodeInput.value}.`;
      } else if (this.placements[0] >= this.trapsPerRound) {
        buildInstructions.textContent = `Trap placed. Waiting for ${waiting} more...`;
      } else {
        buildInstructions.textContent = `Tap the level to place your trap. Not on a runner or the flag.`;
      }
    }
  },

  // requestAnimationFrame hands us a timestamp in milliseconds.
  // We turn it into "dt": seconds since the last frame, so the game
  // runs at the same speed on a fast PC and a slow phone.
  _last: 0,
  loop(now) {
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.05) dt = 0.05;   // if the tab was hidden, do not let one huge step break things

    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  },
};

Network.onMessage = (message) => Game.onNetworkMessage(message);
createRoomButton.addEventListener("click", () => {
  const settings = readSettings();
  if (!settings) return;   // a setting is out of range; the message is already on screen
  const name = playerNameInput.value.trim() || "Runner";
  Game.startOnline();
  Network.connect(name, "", settings);
});
joinRoomButton.addEventListener("click", () => {
  const name = playerNameInput.value.trim() || "Runner";
  const code = roomCodeInput.value.trim();
  if (!code) { onlineStatus.textContent = "Enter a room code first."; return; }
  Game.startOnline();
  Network.connect(name, code);
});
startRunButton.addEventListener("click", () => {
  if (Game.phase === "build") Game.startPartyRun();
});
startMatchButton.addEventListener("click", () => Network.send({ type: "start_match" }));
leaveRoomButton.addEventListener("click", () => { Network.leave(); Game.leaveOnline(); });
backToLobbyButton.addEventListener("click", () => Network.send({ type: "back_to_lobby" }));
document.getElementById("help-button").addEventListener("click", () => Game.showHelp());
document.getElementById("help-close").addEventListener("click", () => Game.hideHelp());
helpPanel.addEventListener("click", (event) => { if (event.target === helpPanel) Game.hideHelp(); });   // click outside the box
window.addEventListener("keydown", (event) => { if (event.key === "Escape") Game.hideHelp(); });
canvas.addEventListener("pointerdown", (event) => Game.placeTrap(event.clientX, event.clientY));

// The canvas only picks up a web font once the browser has loaded it, so ask for both now.
if (document.fonts) { document.fonts.load("16px Fredoka"); document.fonts.load("16px Bangers"); }
Game.buildSwatches();
Game.buildMapButtons();
Game.start();
