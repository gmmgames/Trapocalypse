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

// The 24 colors players can pick from, laid out as 4 rows of 6.
// White is reserved for "you", so it is not in the palette.
const PALETTE = [
  "#ff3c78", "#ff5a3c", "#ff8c1a", "#ffb830", "#ffd23c", "#f5f03c",
  "#b4f03c", "#5cf05a", "#1fd68f", "#22e0c8", "#4df0ff", "#3cb4ff",
  "#4a7bff", "#6a5cff", "#9b5cff", "#c85cff", "#ff5cd6", "#ff7aa8",
  "#ffd6a8", "#c8ff9e", "#a8e8ff", "#d9b8ff", "#c0c0d8", "#8a6a4a",
];

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
  myColor: null,        // index into PALETTE, chosen once when you join
  _nextRoundIn: 0,      // countdown shown on the scoreboard
  _chartX: {},          // where each player's bar currently sits (slides toward its sorted spot)
  _firstFinisher: null, // who earned the "First One There!" bonus this round
  _bannerTimer: 0,      // seconds left to show that banner

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
    this.complete = false;
    this.remotePlayers = {};
    this.players = [];
    this.myColor = null;
    this._chartX = {};
    Level.load(0);
    Player.spawn();
    buildHud.classList.add("hidden");
    onlineStatus.textContent = "Connecting to room...";
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

  // The server sends the whole room whenever something big changes:
  // someone joins or leaves, or a new round begins.
  applyRoomState(message) {
    this.phase = message.phase;
    this.round = message.round;
    this.roundsPerLevel = message.roundsPerLevel;
    this.trapsPerRound = message.trapsPerRound;
    this.maxPlayers = message.maxPlayers || this.maxPlayers;
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
    this.showScores();
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
      if (this.phase === "build") { Player.spawn(); this.say("Pick a color, then place your trap.", 3); }
      else if (me && me.status === "out") { Player.spawn(); Player.alive = false; this.say("Round in progress. Pick a color for next round.", 3); }
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
        this.say("Now tap the level to place your trap.", 3);
      }
      this.refreshSwatches();
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
      Player.spawn();
      for (const remote of Object.values(this.remotePlayers)) { remote.alive = true; remote.finished = false; }
      this.say("Run! One life. Reach the flag.", 2);
    }
    if (message.type === "player_update" && message.playerId !== Network.id) {
      if (!this.remotePlayers[message.playerId]) this.remotePlayers[message.playerId] = { name: "Runner" };
      Object.assign(this.remotePlayers[message.playerId], message);
    }
    if (message.type === "status") {
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.status = message.status;
      // A death by someone's trap: the server tells us who owns it and what it paid.
      const killer = message.killedBy ? this.players.find((player) => player.id === message.killedBy) : null;
      if (killer) {
        const victim = who ? who.name : "someone";
        if (killer.id === Network.id) this.say(`Your trap got ${victim}! +${message.killPoints}`, 2);
        else if (message.playerId === Network.id) this.say(`${killer.name}'s trap got you! Watching the others...`, 4);
        else this.say(`${killer.name}'s trap got ${victim}!`, 1.5);
        killer.score += message.killPoints;   // keep the room panel's scores current until the next full update
        this.showScores();
      } else if (message.playerId !== Network.id && who) {
        this.say(message.status === "dead" ? `${who.name} is out!` : `${who.name} made it!`, 1.5);
      }
    }
    if (message.type === "round_over") {
      this.phase = "results";
      this.players = message.players;
      this._nextRoundIn = message.nextIn;
      this._firstFinisher = message.firstFinisher || null;
      this._bannerTimer = this._firstFinisher ? 3 : 0;
      const iFinished = message.finishers.includes(Network.id);
      if (message.finishers.length === 0) this.say("Everyone's out. No points.", message.nextIn);
      else if (message.everyoneFinished) this.say("Everyone made it. No points.", message.nextIn);
      else if (iFinished) this.say("You scored!", message.nextIn);
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
    ctx.font = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const width = ctx.measureText(name).width + 10;
    const centerX = x + Player.w / 2;
    ctx.fillStyle = "rgba(11, 11, 20, 0.75)";
    ctx.fillRect(centerX - width / 2, y - 22, width, 17);
    ctx.fillStyle = color;
    ctx.fillText(name, centerX, y - 7);
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
    const baseline = 440, maxBarH = 260, swatchH = 22;
    const totalW = sorted.length * barW + (sorted.length - 1) * gap;
    const leftX = (LEVEL_W - totalW) / 2;
    const topScore = Math.max(1, ...sorted.map((player) => player.score));

    ctx.font = "bold 28px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffd23c";
    ctx.fillText(`ROUND ${this.round} RESULTS`, LEVEL_W / 2, 70);
    ctx.font = "16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#c0c0d8";
    ctx.fillText(`Next round in ${Math.max(0, Math.ceil(this._nextRoundIn))}`, LEVEL_W / 2, 96);

    sorted.forEach((player, rank) => {
      // Slide each bar toward its sorted slot so the order change is visible.
      const targetX = leftX + rank * (barW + gap);
      if (this._chartX[player.id] === undefined) this._chartX[player.id] = targetX;
      this._chartX[player.id] += (targetX - this._chartX[player.id]) * 0.12;
      const x = this._chartX[player.id];

      const isMe = player.id === Network.id;
      const color = player.color !== null ? PALETTE[player.color] : "#4df0ff";
      const barH = 8 + (player.score / topScore) * maxBarH;

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
      ctx.font = `bold ${nameFont}px 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = isMe ? "#ffffff" : color;
      let label = player.name;
      while (label.length > 1 && ctx.measureText(label).width > barW + gap - 4) label = label.slice(0, -1);
      ctx.fillText(label, x + barW / 2, baseline - barH - 10);

      // Score inside the bar when it is tall enough, otherwise above the name
      ctx.font = `bold ${Math.max(12, Math.min(22, barW / 3))}px 'Segoe UI', system-ui, sans-serif`;
      if (barH >= 40) {
        ctx.fillStyle = "#0b0b14";
        ctx.fillText(String(player.score), x + barW / 2, baseline - 12);
      } else {
        ctx.fillStyle = "#e8e8ff";
        ctx.fillText(String(player.score), x + barW / 2, baseline - barH - 14 - nameFont);
      }
    });

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(leftX - 20, baseline); ctx.lineTo(leftX + totalW + 20, baseline); ctx.stroke();

    if (this._bannerTimer > 0 && this._firstFinisher) this.drawFirstBanner();
  },

  // "First One There!" for the first finisher, shown to everyone for a few seconds.
  drawFirstBanner() {
    const winner = this.players.find((player) => player.id === this._firstFinisher);
    const color = winner && winner.color !== null ? PALETTE[winner.color] : "#ffd23c";
    const fade = Math.min(1, this._bannerTimer / 0.4);   // quick fade-out at the end
    const centerX = LEVEL_W / 2, centerY = 250;

    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(11, 11, 20, 0.9)";
    ctx.fillRect(centerX - 300, centerY - 70, 600, 140);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(centerX - 300, centerY - 70, 600, 140);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.font = "900 54px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("First One There!", centerX, centerY + 5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("+1 Point", centerX, centerY + 45);
    if (winner) {
      ctx.fillStyle = "#c0c0d8";
      ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(winner.name, centerX, centerY - 48);
    }
    ctx.globalAlpha = 1;
  },

  draw() {
    // Wipe the whole canvas, then redraw the scene from scratch.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Level.draw(ctx);

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

    if (this.mode === "online" && this.phase === "results") this.drawScoreboard();

    if (this.mode === "online") {
      const roundLabel = `ROUND ${this.round}/${this.roundsPerLevel}  ${Level.name}`;
      hud.textContent = `${roundLabel}  •  ${this.message}`;
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
  const name = playerNameInput.value.trim() || "Runner";
  Game.startOnline();
  Network.connect(name);
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
canvas.addEventListener("pointerdown", (event) => Game.placeTrap(event.clientX, event.clientY));

Game.buildSwatches();
Game.start();
