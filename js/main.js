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
const hudText = document.getElementById("hud-text");
const hudClock = document.getElementById("hud-clock");
const hudTail = document.getElementById("hud-tail");

// A random name for players who leave the box empty (or roll the dice). Two words, always clean.
const NAME_ADJECTIVES = ["Sneaky", "Bouncy", "Zesty", "Turbo", "Wobbly", "Spicy", "Crispy", "Jolly", "Mighty", "Fuzzy", "Rapid", "Sleepy", "Cosmic", "Loopy", "Frosty", "Peppy", "Dizzy", "Chunky", "Slippy", "Golden", "Rowdy", "Sunny", "Grumpy", "Nimble"];
const NAME_NOUNS = ["Mango", "Pickle", "Waffle", "Noodle", "Badger", "Comet", "Pebble", "Gecko", "Muffin", "Rocket", "Walrus", "Taco", "Panda", "Cactus", "Yeti", "Donut", "Falcon", "Marble", "Otter", "Pretzel", "Robot", "Turnip", "Llama", "Biscuit"];
// The title screen only ever shows one of the three plain shapes, picked at random each visit.
// Your saved shape is for rooms.
const TITLE_AVATARS = ["cube", "wedge", "ball"];
function titleAvatar() { return TITLE_AVATARS[Math.floor(Math.random() * TITLE_AVATARS.length)]; }

// The shape you picked last time (kept in this browser), the cube until you pick one.
function savedAvatar() {
  try { const saved = localStorage.getItem("trapocalypse.avatar"); return AVATARS.includes(saved) ? saved : "cube"; } catch (error) { return "cube"; }
}

function randomName() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  // Never hand out a name the filter would then refuse.
  for (let tries = 0; tries < 20; tries++) {
    const name = `${pick(NAME_ADJECTIVES)} ${pick(NAME_NOUNS)}`;
    if (ChatFilter.isClean(name)) return name;
  }
  return "Bouncy Pebble";
}
// The name to play under: what you typed, or a fresh random one written into the box for you.
function chosenName() {
  const input = document.getElementById("player-name");
  if (!input.value.trim()) input.value = randomName();
  return input.value.trim();
}
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
const chatBox = document.getElementById("chat");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const settingsPanel = document.getElementById("settings");
const chatFilterToggle = document.getElementById("chat-filter");
const soundsToggle = document.getElementById("sounds-toggle");
const settingsBackToLobby = document.getElementById("settings-back-to-lobby");
const settingsNote = document.getElementById("settings-note");
const weaponPick = document.getElementById("weapon-pick");
const weaponCards = document.getElementById("weapon-cards");
const touchUseButton = document.querySelector(".touch-btn.use");
const helpPanel = document.getElementById("help");

// What each Final Battle weapon is called and does (the rules live in js/player.js).
const WEAPON_INFO = {
  boots:   { icon: "🚀", name: "Rocket Boots", desc: "One extra jump in mid-air" },
  dash:    { icon: "💨", name: "Dash",         desc: "X / Shift: burst forward" },
  shield:  { icon: "🛡️", name: "Shield",       desc: "Survive one spike hit" },
  freeze:  { icon: "❄️", name: "Freeze Ray",   desc: "X / Shift: freeze the others, once" },
  bomb:    { icon: "💣", name: "Trap Bomb",    desc: "X / Shift: spikes under your feet, once" },
  feather: { icon: "🪶", name: "Feather",      desc: "Floaty low gravity all run" },
};
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
const DISPLAY_FONT = "'Baloo 2', 'Fredoka', 'Segoe UI', system-ui, sans-serif";
const BANNER_SECONDS = 4;   // (old) how long the Trailblazer burst stayed on screen
const BURST_SECONDS = 1.6;  // how long each special-point burst stays; bursts never overlap
// Which points get a burst, how big, and what the burst says.
const BURST_STYLE = {
  Trailblazer: { scale: 1, text: "Trailblazer!" },
  Autonomous:  { scale: 0.78, text: "Autonomous!" },
  Curiosity:   { scale: 0.62, text: "Curiosity!" },
  Condolence:  { scale: 0.85, text: "Condolence." },
};
const TRAP_NAMES = { spike: "Spikes", crumble: "Crumbler", glue: "Glue", bumper: "Bumper", spring: "Spring", ice: "Ice", decoy: "Decoy", eraser: "Eraser", pencil: "Pencil", portal: "Teleport Ball" };
const PENCIL_MAX_BLOCKS = 8;   // squares per pencil stroke (the server enforces the same cap)

// Every kind of point has a name and a little line that shows on the results screen as it lands.
const GAIN_TEXT = {
  "Win": "They never believed in me... look at where I stand now",
  "Trailblazer": "Turns out first isn't the worst",
  "Autonomous": "It's kinda lonely being at the top... oh well",
  "Curiosity": "Grabbed a tiger by its toe. I guess curiosity really does kill the cat.",
  "Condolence": "With all of my losses, I could simply finish once. They would all cease to exist. That is called... mercy.",
  "1st Place": "Last one standing. Well, running.",
  "2nd Place": "So close you could taste it",
  "3rd Place": "Hey, a podium is a podium",
};
const gainText = (label) => GAIN_TEXT[label] || GAIN_TEXT[label.replace(/ ×\d+$/, "")] || "";

// --- match settings (host only) ---
// Each dropdown has presets plus "Custom…", which reveals a number box.
// The server checks these again; this copy just gives instant feedback.
// The point values are plain number boxes ("input") with no presets.
const SETTING_FIELDS = {
  timeLimit:   { select: "set-time",   custom: "set-time-custom",   min: 30, max: 600, label: "Time limit" },
  pointsToWin: { select: "set-points", custom: "set-points-custom", min: 15, max: 600, label: "Points to win" },
  roundCap:    { select: "set-rounds", custom: "set-rounds-custom", min: 3,  max: 60,  label: "Round cap" },
  winPoints:   { input: "set-win",   min: 1, max: 20, label: "Win points" },
  killPoints:  { input: "set-kill",  min: 0, max: 10, label: "Trap kill points" },
  firstPoints: { input: "set-first", min: 0, max: 10, label: "Trailblazer points" },
  autonomousPoints: { input: "set-autonomous", min: 0, max: 10, label: "Autonomous points" },
  isPublic:    { checkbox: "set-public", label: "Listed in the room list" },
};
for (const field of Object.values(SETTING_FIELDS)) {
  if (!field.select) continue;
  const select = document.getElementById(field.select);
  const custom = document.getElementById(field.custom);
  select.addEventListener("change", () => custom.classList.toggle("hidden", select.value !== "custom"));
}

// Put the room's current settings into the form (used when you are, or become, the host).
function fillSettingsForm(settings) {
  if (!settings) return;
  for (const [key, field] of Object.entries(SETTING_FIELDS)) {
    if (field.checkbox) { document.getElementById(field.checkbox).checked = Boolean(settings[key]); continue; }
    const value = settings[key] === null ? "null" : String(settings[key]);
    if (field.input) { document.getElementById(field.input).value = value; continue; }
    const select = document.getElementById(field.select);
    const custom = document.getElementById(field.custom);
    const preset = [...select.options].some((option) => option.value === value);
    select.value = preset ? value : "custom";
    custom.classList.toggle("hidden", preset);
    if (!preset) custom.value = value;
  }
}

// Read the settings. Returns null (and says why) if a value is out of range.
function readSettings() {
  const settings = {};
  for (const [key, field] of Object.entries(SETTING_FIELDS)) {
    if (field.checkbox) { settings[key] = document.getElementById(field.checkbox).checked; continue; }
    let text;
    if (field.input) text = document.getElementById(field.input).value;
    else {
      const select = document.getElementById(field.select);
      text = select.value === "custom" ? document.getElementById(field.custom).value : select.value;
    }
    if (text === "null") { settings[key] = null; continue; }   // Infinite time limit
    const n = Number(text);
    if (text.trim() === "" || !Number.isInteger(n) || n < field.min || n > field.max) {
      document.getElementById("settings-status").textContent = `${field.label} must be between ${field.min} and ${field.max}.`;
      return null;
    }
    settings[key] = n;
  }
  document.getElementById("settings-status").textContent = "";
  return settings;
}

// The host changed something in the lobby form: check it and send it to the server.
function sendSettings() {
  const settings = readSettings();
  if (settings) Network.send({ type: "update_settings", settings });
}
document.getElementById("match-settings").addEventListener("change", sendSettings);

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
  offer: [],            // this round's items on offer (the same for everyone), from the server
  picks: {},            // playerId -> the item they picked
  pick: null,           // the item you picked (null = not yet)
  pending: null,        // { x, y } where your item will go once you confirm
  weaponOffer: [],      // Final Battle: the weapons you may pick from
  myWeapon: null,       // the one you picked (null = not yet)
  weapons: {},          // playerId -> weapon for the current Final Battle run
  _nextRoundIn: 0,      // countdown shown on the scoreboard
  _chartX: {},          // where each player's bar currently sits (slides toward its sorted spot)
  _firstFinisher: null, // who earned the "First One There!" bonus this round
  _firstBonus: 2,       // how many points that bonus is worth (the server tells us)
  _bannerTimer: 0,      // seconds left to show that banner
  _bursts: [],          // the round's special-point bursts (Trailblazer, Autonomous, Curiosity), shown one at a time
  _runTimeLimit: null,  // seconds allowed for this run, or null for no limit
  _runStartedAt: 0,     // wall-clock time the run began, so the countdown can't drift
  _runTimeLeft: null,   // seconds left, shown in the HUD
  _voteEndsAt: 0,       // wall-clock time the course vote closes
  pencil: 0,            // pencil strokes you have left this run
  portal: false,        // holding a picked-up Teleport Ball
  _balls: [],           // teleport balls in flight: { x, y, vx, vy, by, color, trail }
  _stroke: null,        // the stroke you are drawing right now: { blocks: [{x, y}] }

  start() {
    Level.loadTitle();
    Player.avatar = titleAvatar();
    Player.spawn();
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
    this.message = "";   // drop any leftover solo message (like the course name) before the room HUD shows
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
    Player.avatar = titleAvatar();
    Level.loadTitle();   // a fresh random title world each time you come back
    Player.spawn();
    lobby.classList.add("hidden");
    colorPicker.classList.add("hidden");
    leaveRoomButton.classList.add("hidden");
    winnerHud.classList.add("hidden");
    mapVote.classList.add("hidden");
    chatBox.classList.add("hidden");
    chatLog.replaceChildren();
    weaponPick.classList.add("hidden");
    touchUseButton.classList.add("hidden");
    this.weaponOffer = []; this.myWeapon = null; this.weapons = {};
    Player.setWeapon(null);
    onlinePanel.classList.remove("hidden");
    document.getElementById("match-settings").classList.add("hidden");
    onlineStatus.textContent = statusText;
    roomCodeInput.value = "";
    this.say("Left the room.", 2);
  },

  // Fill in the lobby box and the Leave button from the latest room info.
  renderRoom() {
    onlinePanel.classList.add("hidden");
    leaveRoomButton.classList.toggle("hidden", !this.inRoom);
    chatBox.classList.toggle("hidden", !this.inRoom);
    lobby.classList.toggle("hidden", this.phase !== "lobby");
    const isHost = Network.id === this.hostId;
    // The settings form lives in the lobby and only the host sees it.
    const settingsForm = document.getElementById("match-settings");
    const showForm = this.phase === "lobby" && isHost;
    settingsForm.classList.toggle("hidden", !showForm);
    if (showForm) {
      if (settingsForm.parentElement !== lobby) lobby.insertBefore(settingsForm, document.getElementById("lobby-color"));
      if (document.activeElement === null || !settingsForm.contains(document.activeElement)) fillSettingsForm(this.settings);
    }
    // Winner screen: only the host gets the button, everyone else waits.
    winnerHud.classList.toggle("hidden", this.phase !== "winner");
    backToLobbyButton.classList.toggle("hidden", !isHost);
    winnerNote.textContent = isHost ? "" : "Waiting for the host…";
    this.renderVote();
    if (this.phase !== "lobby") return;
    const s = this.settings || {};
    lobbyTitle.textContent = `ROOM ${roomCodeInput.value}`;
    lobbySettings.textContent = `Time limit ${s.timeLimit === null ? "Infinite" : s.timeLimit + " s"}  •  First to ${s.pointsToWin}  •  Max ${s.roundCap} rounds\nWin ${s.winPoints}  •  Trap kill ${s.killPoints}  •  Trailblazer ${s.firstPoints}  •  Autonomous ${s.autonomousPoints ?? 1}  •  ${s.isPublic === false ? "Private room" : "Listed room"}`;
    lobbyPlayers.replaceChildren(...this.players.map((player) => {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = player.color !== null ? PALETTE[player.color] : "#45455d";
      item.append(dot, `${player.name}${player.id === this.hostId ? " (host)" : ""}`);
      return item;
    }));
    // Host tools: everyone but the host in a dropdown, with Kick and Ban beside it.
    const hostTools = document.getElementById("host-tools"), kickTarget = document.getElementById("kick-target");
    const others = this.players.filter((player) => player.id !== Network.id);
    hostTools.classList.toggle("hidden", !isHost || others.length === 0);
    if (this.phase === "lobby" && hostTools.parentElement !== lobby) lobbyPlayers.after(hostTools);   // back from the settings dialog
    const chosen = kickTarget.value;
    kickTarget.replaceChildren(...others.map((player) => { const option = document.createElement("option"); option.value = player.id; option.textContent = player.name; return option; }));
    if (others.some((player) => player.id === chosen)) kickTarget.value = chosen;
    startMatchButton.classList.toggle("hidden", !isHost || this.players.length < 2);
    document.getElementById("test-match").classList.toggle("hidden", !isHost || this.players.length !== 1);
    if (!isHost) lobbyNote.textContent = "Waiting for the host to start";
    else if (this.players.length < 2) lobbyNote.textContent = "Need at least 2 players, or try a Test Match by yourself";
    else if (this.players.some((player) => player.color === null)) lobbyNote.textContent = "Waiting for everyone to pick a color";
    else lobbyNote.textContent = "";
    this.refreshSwatches();
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
      `Win, ${s.winPoints} point${s.winPoints === 1 ? "" : "s"}: reaching the flag. "${GAIN_TEXT.Win}"`,
      `Trailblazer, ${s.firstPoints} more: first to the flag when 3 or more run and 2 or more finish. "${GAIN_TEXT.Trailblazer}"`,
      `Autonomous, ${s.autonomousPoints ?? 1} more: the only one to make it when 2 or more ran. "${GAIN_TEXT.Autonomous}"`,
      `Curiosity, ${s.killPoints} each: your trap kills someone, paid at the end of the round only if you reach the flag too. "${GAIN_TEXT.Curiosity}"`,
      `Condolence, 4 more: you were at least 10 points behind everyone, and then you finally won a round. "${GAIN_TEXT.Condolence}"`,
      `Final Battle: 1st Place 5, 2nd Place 3, 3rd Place 1. Nothing else pays in a Final Battle.`,
      `${this.settings ? "This match" : "Default"}: first to ${s.pointsToWin} points wins, ${s.roundCap} rounds at most, ${time}.`,
    ];
    helpPoints.replaceChildren(...lines.map((text) => { const li = document.createElement("li"); li.textContent = text; return li; }));
    helpPanel.classList.remove("hidden");
  },

  hideHelp() {
    helpPanel.classList.add("hidden");
  },

  // --- this round's items ---
  // One card per offered item: a picture, the name, and who has taken it. Your own pick
  // is outlined; an item someone else took is greyed out while other items are still free.
  renderItems() {
    const cards = document.getElementById("item-cards");
    const me = this.players.find((player) => player.id === Network.id);
    // Cards are tracked by number, not name: two cards can show the same trap.
    const mineSlot = this.picks[Network.id];
    const takenByOthers = new Set(Object.entries(this.picks).filter(([id]) => id !== Network.id).map(([, slot]) => slot));
    const anyFree = this.offer.some((item, slot) => !takenByOthers.has(slot));
    // Once everyone holds a card the menu gets out of the way so you can place.
    cards.classList.toggle("hidden", this.phase !== "build" || this.offer.length === 0 || this.everyonePicked());
    cards.replaceChildren(...this.offer.map((item, slot) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "item-card" + (mineSlot === slot ? " mine" : "");
      card.dataset.item = item;
      card.dataset.slot = slot;
      const icon = document.createElement("canvas");
      icon.width = TILE; icon.height = TILE;
      Level.drawItemIcon(icon.getContext("2d"), item);
      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = item === "eraser" && me ? `Eraser (${me.erasers} left)` : item === "pencil" ? "Pencil (3 strokes)" : TRAP_NAMES[item];
      const taker = document.createElement("span");
      taker.className = "item-taker";
      const takerId = Object.keys(this.picks).find((id) => this.picks[id] === slot && id !== Network.id);
      if (takerId) taker.textContent = "taken";
      else if (mineSlot === slot) taker.textContent = "yours";
      card.append(icon, name, taker);
      const used = me && me.trapCount >= this.trapsPerRound;
      card.disabled = used || (takenByOthers.has(slot) && anyFree) || (item === "eraser" && me && me.erasers <= 0);
      card.addEventListener("click", () => Network.send({ type: "pick_item", slot }));
      return card;
    }));
  },

  // --- Teleport Ball: grab the orb by touching it, throw it, appear where it lands ---
  throwPortal() {
    if (!this.portal || this.phase !== "run" || !Player.alive || Player.finished) return;
    this.portal = false;   // the server confirms with a portal_ball for everyone
    Network.send({ type: "portal_throw", x: Player.x + Player.w / 2, y: Player.y + 6, vx: Player.facing * 520, vy: -420 });
  },
  updateBalls(dt) {
    const solids = Level.solids.concat(Level.drawnSolids());
    for (const ball of this._balls) {
      const before = { x: ball.x, y: ball.y };
      ball.vy += Physics.GRAVITY * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      ball.trail.push(before); if (ball.trail.length > 8) ball.trail.shift();
      let landing = null;
      const hit = solids.find((solid) => ball.x >= solid.x && ball.x <= solid.x + solid.w && ball.y >= solid.y && ball.y <= solid.y + solid.h);
      if (hit) {
        // Came down onto its top: stand there. Anything else: appear where the ball last was.
        landing = ball.vy > 0 && before.y <= hit.y ? { x: ball.x - Player.w / 2, y: hit.y - Player.h } : { x: before.x - Player.w / 2, y: before.y - Player.h / 2 };
      } else if (ball.x < 0 || ball.x > LEVEL_W || ball.y < 0) {
        landing = { x: before.x - Player.w / 2, y: before.y - Player.h / 2 };
      } else if (ball.y > LEVEL_H) {
        ball.done = true;   // fell out of the world: no teleport
        if (ball.by === Network.id) this.say("The ball fell out of the world!", 2);
      }
      if (landing) {
        ball.done = true;
        if (ball.by === Network.id && Player.alive && !Player.finished) {
          Player.x = Math.max(0, Math.min(LEVEL_W - Player.w, landing.x));
          Player.y = Math.max(0, Math.min(LEVEL_H - Player.h, landing.y));
          Player.vx = 0; Player.vy = 0;
          Dust.spawn(Player.x + Player.w / 2, Player.y + Player.h, 12, 20);
          Sfx.boots();
        }
      }
    }
    this._balls = this._balls.filter((ball) => !ball.done);
  },
  drawBalls() {
    for (const ball of this._balls) {
      ctx.save();
      ctx.strokeStyle = ball.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
      ctx.beginPath(); for (const [i, p] of ball.trail.entries()) i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); ctx.lineTo(ball.x, ball.y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = "#c98bff"; ctx.shadowBlur = 16;
      ctx.fillStyle = "#7b3fe4";
      ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e6d5ff";
      ctx.beginPath(); ctx.arc(ball.x - 2, ball.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  },

  // --- pencil: hold the pointer during the run to sketch a short line of blocks ---
  levelPoint(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    return { x: ((clientX - bounds.left) / bounds.width) * LEVEL_W, y: ((clientY - bounds.top) / bounds.height) * LEVEL_H };
  },
  // Returns true when the press started a stroke (so it is not a trap placement).
  beginStroke(clientX, clientY) {
    if (this.mode !== "online" || this.phase !== "run" || this.pencil <= 0 || !Player.alive || Player.finished) return false;
    this._stroke = { blocks: [] };
    this.extendStroke(clientX, clientY);
    return true;
  },
  extendStroke(clientX, clientY) {
    if (!this._stroke) return;
    const point = this.levelPoint(clientX, clientY);
    const block = { x: Math.floor(point.x / 15) * 15, y: Math.floor(point.y / 15) * 15 };   // half-tile squares
    if (this._stroke.blocks.some((other) => other.x === block.x && other.y === block.y)) return;
    if (Physics.overlaps({ ...block, w: 15, h: 15 }, Player)) return;   // never through yourself
    this._stroke.blocks.push(block);
    if (this._stroke.blocks.length >= PENCIL_MAX_BLOCKS) this.endStroke();   // the pencil runs dry mid-line
  },
  endStroke() {
    if (!this._stroke) return;
    const blocks = this._stroke.blocks;
    this._stroke = null;
    if (blocks.length) Network.send({ type: "draw_block", blocks });
  },
  drawStroke() {
    if (!this._stroke) return;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#f4f1e0";
    for (const block of this._stroke.blocks) ctx.fillRect(block.x, block.y, 15, 15);
    ctx.globalAlpha = 1;
  },

  // --- placing: put the item down, move it if you like, then confirm ---
  // Where would the item go if you tapped here? (Snapped to the tile grid.)
  tileAt(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((clientX - bounds.left) / bounds.width) * LEVEL_W / TILE) * TILE,
      y: Math.floor(((clientY - bounds.top) / bounds.height) * LEVEL_H / TILE) * TILE,
    };
  },

  // Why can't a trap go here? null means it can.
  placementProblem(x, y) {
    const trap = { x, y, w: TILE, h: TILE, kind: this.pick };
    if (this.pick === "eraser") return Level.hazards.some((hazard) => hazard.x === x && hazard.y === y) ? null : "Put the eraser on a trap.";
    const onSomeone = Physics.overlaps(trap, Player) ||
      Object.values(this.remotePlayers).some((remote) => Physics.overlaps(trap, { x: remote.x, y: remote.y, w: Player.w, h: Player.h }));
    if (x < 2 * TILE || x + TILE > LEVEL_W - TILE || y < 0 || y + TILE > LEVEL_H) return "That's off the course.";
    if (Level.hazards.some((hazard) => Physics.overlaps(trap, hazard))) return "There's already a trap there.";
    if (Physics.overlaps(trap, Level.flag) || onSomeone) return "Not on a runner or the flag.";
    if (this.pick === "crumble" && Level.solids.some((solid) => Physics.overlaps(trap, solid))) return "A crumbler needs open air, not a wall.";
    if (this.pick === "portal" && Level.solids.some((solid) => Physics.overlaps(trap, solid))) return "The ball has to hang in open air.";
    if (this.pick === "ice") {
      // Ice is a coating: it sits on top of a block, never inside one, beside one or under one.
      if (Level.solids.some((solid) => Physics.overlaps(trap, solid))) return "Ice goes on top of a block, not inside it.";
      const below = { x: x + 2, y: y + TILE, w: TILE - 4, h: 2 };
      if (!Level.solids.some((solid) => Physics.overlaps(below, solid))) return "Ice needs a block right under it.";
    }
    return null;
  },

  setPending(clientX, clientY) {
    if (this.phase !== "build" || this.mode !== "online") return;
    if (this.myColor === null) { this.say("Pick a color first.", 1.5); return; }
    if (this.pick === "pencil") { this.say("You have the pencil: you sketch blocks during the run instead of placing now.", 2); return; }
    if (this.placements[0] >= this.trapsPerRound) { this.say("You've used your item this round. Waiting for the others.", 1.5); return; }
    if (!this.pick) { this.say("Pick an item from the cards first.", 1.5); return; }
    if (!this.everyonePicked()) { this.say("Waiting for everyone to pick an item.", 1.5); return; }
    this.pending = this.tileAt(clientX, clientY);
  },

  // Placing only opens once every player in the round has chosen an item.
  everyonePicked() {
    return this.players.filter((player) => player.status !== "out").every((player) => this.picks[player.id] !== undefined);
  },

  confirmPlacement() {
    if (!this.pending || this.phase !== "build" || !this.pick) return;
    const { x, y } = this.pending;
    const problem = this.placementProblem(x, y);
    if (problem) { this.say(problem, 1.5); return; }
    if (this.pick === "eraser") Network.send({ type: "erase_trap", x, y });
    else Network.send({ type: "place_trap", x, y, kind: this.pick });
  },

  cancelPlacement() { this.pending = null; },

  // The see-through preview of your item on the course, green outline if it can go
  // there, red if not. The ✓ / ✕ buttons are moved to sit just above it.
  drawPending() {
    const confirm = document.getElementById("place-confirm");
    const show = this.pending && this.phase === "build" && this.mode === "online" && this.pick && this.placements[0] < this.trapsPerRound;
    confirm.classList.toggle("hidden", !show);
    if (!show) return;
    const { x, y } = this.pending;
    const problem = this.placementProblem(x, y);
    ctx.save();
    ctx.globalAlpha = 0.65;
    if (this.pick === "eraser") {
      ctx.fillStyle = "rgba(255, 60, 120, 0.5)";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + 23, y + 23); ctx.moveTo(x + 23, y + 7); ctx.lineTo(x + 7, y + 23); ctx.stroke();
    } else {
      ctx.translate(x, y);
      Level.drawItemIcon(ctx, this.pick);
      ctx.translate(-x, -y);
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = problem ? "#ff5a3c" : "#5cf05a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, TILE + 4, TILE + 4);
    ctx.restore();
    // Just to the right of the ghost (or to the left if it is near the right edge).
    const nearRightEdge = x > LEVEL_W - 6 * TILE;
    confirm.style.left = nearRightEdge ? "" : `${((x + TILE + 6) / LEVEL_W) * 100}%`;
    confirm.style.right = nearRightEdge ? `${((LEVEL_W - x + 6) / LEVEL_W) * 100}%` : "";
    confirm.style.top = `${((y + TILE / 2) / LEVEL_H) * 100}%`;
  },

  // --- Final Battle weapons ---
  renderWeaponPick() {
    const show = this.phase === "results" && this.weaponOffer.length > 0;
    weaponPick.classList.toggle("hidden", !show);
    if (!show) return;
    weaponCards.replaceChildren(...this.weaponOffer.map((weapon) => {
      const info = WEAPON_INFO[weapon];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "weapon-card" + (this.myWeapon === weapon ? " mine" : "");
      card.dataset.weapon = weapon;
      const icon = document.createElement("span"); icon.className = "icon"; icon.textContent = info.icon;
      const name = document.createElement("span"); name.className = "name"; name.textContent = info.name;
      const desc = document.createElement("span"); desc.className = "desc"; desc.textContent = info.desc;
      card.append(icon, name, desc);
      card.addEventListener("click", () => Network.send({ type: "pick_weapon", weapon }));
      return card;
    }));
  },

  // The runner pressed the weapon button for a weapon the server has to handle.
  useWeapon() {
    if (Player.weapon === "bomb") {
      // The tile you are standing in (not the ground under you), so the next runner hits it.
      const x = Math.round((Player.x + Player.w / 2 - TILE / 2) / TILE) * TILE;
      const y = Math.round((Player.y + Player.h) / TILE) * TILE - TILE;
      Network.send({ type: "weapon_use", x, y });
    } else {
      Network.send({ type: "weapon_use" });
    }
    Player.weaponUsed = true;
  },


  // --- player ID, invites, room list ---
  showInvite() {
    document.getElementById("invite-status").textContent = this.inRoom ? "" : "Create or join a room first, then invite.";
    document.getElementById("invite-id").value = "";
    document.getElementById("invite-panel").classList.remove("hidden");
    document.getElementById("invite-id").focus();
  },
  hideInvite() { document.getElementById("invite-panel").classList.add("hidden"); },
  sendInvite() {
    const id = document.getElementById("invite-id").value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(id)) { document.getElementById("invite-status").textContent = "An ID is 6 letters or digits."; return; }
    Network.send({ type: "invite", toUserId: id });
  },
  showInviteToast(message) {
    this._invite = message;
    document.getElementById("invite-text").textContent = `${message.from} invited you to room ${message.code}`;
    document.getElementById("invite-toast").classList.remove("hidden");
    Sfx.pickup();
    clearTimeout(this._inviteTimer);
    this._inviteTimer = setTimeout(() => this.hideInviteToast(), 25000);
  },
  hideInviteToast() { document.getElementById("invite-toast").classList.add("hidden"); },
  acceptInvite() {
    if (!this._invite) return;
    const code = this._invite.code;
    this.hideInviteToast();
    if (this.inRoom) { Network.leave(); this.leaveOnline(); }
    const name = chosenName();
    this.startOnline();
    Network.connect(name, code);
  },

  // Room list: opened by Join Room, refreshed every few seconds while open.
  showRoomList() {
    document.getElementById("join-code").value = roomCodeInput.value.trim().toUpperCase();
    document.getElementById("room-list").classList.remove("hidden");
    this.refreshRooms();
    clearInterval(this._roomsTimer);
    this._roomsTimer = setInterval(() => this.refreshRooms(), 3000);
  },
  hideRoomList() {
    document.getElementById("room-list").classList.add("hidden");
    clearInterval(this._roomsTimer);
  },
  refreshRooms() { Network.ensure().then(() => Network.send({ type: "list_rooms" })).catch(() => {}); },
  renderRooms(rooms) {
    const list = document.getElementById("rooms");
    const phaseLabel = { lobby: "In the lobby", vote: "Voting on a course", build: "Building", run: "Running", results: "Between rounds", winner: "Match over" };
    list.replaceChildren(...rooms.map((room) => {
      const row = document.createElement("div");
      row.className = "room-row";
      const info = document.createElement("div");
      const name = document.createElement("div"); name.className = "room-name"; name.textContent = `${room.host}'s room  •  ${room.code}`;
      const meta = document.createElement("div"); meta.className = "room-meta"; meta.textContent = `${room.players}/${room.max} players  •  ${phaseLabel[room.phase] || room.phase}  •  ${room.level}`;
      info.append(name, meta);
      const join = document.createElement("button"); join.type = "button"; join.textContent = "Join";
      join.addEventListener("click", () => this.joinCode(room.code));
      row.append(info, join);
      return row;
    }));
    document.getElementById("room-list-note").textContent = rooms.length ? "" : "No open rooms right now. Create one, or type a friend's code above.";
  },
  joinCode(code) {
    code = String(code || "").trim().toUpperCase();
    if (!code) { document.getElementById("room-list-note").textContent = "Type a room code first."; return; }
    this.hideRoomList();
    const name = chosenName();
    this.startOnline();
    Network.connect(name, code);
  },

  // --- settings and chat ---
  // The chat filter is a per-player choice, remembered in this browser.
  chatFilterOn: true,
  loadPreferences() {
    try {
      this.chatFilterOn = localStorage.getItem("trapocalypse.chatFilter") !== "off";
      Sfx.muted = localStorage.getItem("trapocalypse.sounds") === "off";
    } catch (error) { /* private mode etc. */ }
    chatFilterToggle.checked = this.chatFilterOn;
    soundsToggle.checked = !Sfx.muted;
  },
  setChatFilter(on) {
    this.chatFilterOn = on;
    try { localStorage.setItem("trapocalypse.chatFilter", on ? "on" : "off"); } catch (error) { /* ignore */ }
  },
  setSounds(on) {
    Sfx.muted = !on;
    try { localStorage.setItem("trapocalypse.sounds", on ? "on" : "off"); } catch (error) { /* ignore */ }
    if (on) Sfx.pickup();   // a little confirmation blip
  },
  showSettings() {
    const hostInMatch = this.inRoom && Network.id === this.hostId && this.phase !== "lobby";
    settingsBackToLobby.classList.toggle("hidden", !hostInMatch);
    // The Kick/Ban row lives in the lobby panel; during a match it moves in here so the host
    // can still deal with a troll. renderRoom() puts it back when the lobby returns.
    if (hostInMatch) settingsBackToLobby.before(document.getElementById("host-tools"));
    // Test Match: a course dropdown, so the host can try any course without waiting.
    const courseRow = document.getElementById("test-course-row"), courseSelect = document.getElementById("test-course");
    courseRow.classList.toggle("hidden", !(hostInMatch && this.testMatch));
    if (hostInMatch && this.testMatch) {
      courseSelect.replaceChildren(...LEVELS.map((level, index) => { const option = document.createElement("option"); option.value = index; option.textContent = level.name; return option; }));
      courseSelect.value = String(this.levelIndex);
    }
    settingsNote.textContent = hostInMatch ? "Ends the match for everyone and clears the scores." : this.inRoom ? "Only the host can end a match early." : "";
    settingsPanel.classList.remove("hidden");
  },
  hideSettings() {
    settingsPanel.classList.add("hidden");
  },

  addChatLine(message) {
    const line = document.createElement("div");
    line.className = "chat-line";
    const name = document.createElement("span");
    name.className = "chat-name";
    name.style.color = message.color !== null && message.color !== undefined ? PALETTE[message.color] : "#e8e8ff";
    name.textContent = `${message.name}: `;
    const text = document.createTextNode(this.chatFilterOn ? ChatFilter.censor(message.text) : message.text);
    line.append(name, text);
    chatLog.appendChild(line);
    while (chatLog.children.length > 60) chatLog.removeChild(chatLog.firstChild);
    chatLog.scrollTop = chatLog.scrollHeight;
    this.updateChatScroll();
  },

  // The log is click-through so you can place traps behind it, which means its own
  // scrollbar cannot be grabbed. This strip beside it can: drag the thumb, or wheel
  // over the log, to scroll old messages.
  updateChatScroll() {
    const strip = document.getElementById("chat-scroll"), thumb = document.getElementById("chat-thumb");
    const overflow = chatLog.scrollHeight - chatLog.clientHeight;
    strip.classList.toggle("hidden", overflow <= 2);
    if (overflow <= 2) return;
    const track = strip.clientHeight;
    const size = Math.max(14, (chatLog.clientHeight / chatLog.scrollHeight) * track);
    const top = (chatLog.scrollTop / overflow) * (track - size);
    thumb.style.height = `${size}px`;
    thumb.style.top = `${top}px`;
  },

  // Sounds for the results screen, timed to the growing bars: a chime when your
  // points land, a fanfare if you were Trailblazer, and an arpeggio plus a message
  // each time you pass another 10 points. Others' points get a soft blip.
  MILESTONE_STEP: 10,
  playRoundSounds(message) {
    const gains = message.gains || {};
    const mine = gains[Network.id] || [];
    const before = this.players.find((player) => player.id === Network.id);
    const after = message.players.find((player) => player.id === Network.id);
    const othersScored = Object.keys(gains).some((id) => id !== Network.id);
    if (mine.length) setTimeout(() => Sfx.score(), 700);            // first bar stage starts at 0.7 s
    else if (othersScored) setTimeout(() => Sfx.otherScore(), 700);
    // The Trailblazer fanfare now plays when its burst appears (see update()).
    if (before && after) {
      const step = this.MILESTONE_STEP;
      const crossed = Math.floor(after.score / step) - Math.floor(before.score / step);
      if (crossed > 0) {
        const milestone = Math.floor(after.score / step) * step;
        setTimeout(() => { Sfx.milestone(); this.say(`Milestone! ${milestone} points!`, 3); }, 700 + mine.length * 1000);
      }
    }
  },

  sendChat() {
    const text = chatInput.value.trim();
    if (text) Network.send({ type: "chat", text });
    chatInput.value = "";
    chatInput.blur();   // hand the keyboard back to the runner
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

  // The vote floats over the course: for 10 seconds after the host presses Start,
  // and on the results screen whenever a new course is coming.
  renderVote() {
    const voting = this.phase === "vote";
    const onResults = this.phase === "results" && this.voteOpen;
    mapVote.classList.toggle("hidden", !(voting || onResults));
    mapVote.classList.add("floating");
    if (mapVote.parentElement !== gameWrap) gameWrap.appendChild(mapVote);
    document.getElementById("map-vote-title").textContent = voting ? "Vote for the first course" : "Vote for the next course";
    const counts = new Array(LEVELS.length).fill(0);
    for (const level of Object.values(this.votes)) counts[level] += 1;
    [...mapButtons.children].forEach((button, index) => {
      button.querySelector(".count").textContent = counts[index] ? `×${counts[index]}` : "";
      button.classList.toggle("mine", this.votes[Network.id] === index);
    });
  },

  // --- character models ---
  // A row of little previews in the lobby, drawn in your color. Click one to become it.
  renderAvatars() {
    const row = document.getElementById("avatar-picker");
    if (!row) return;
    const color = this.myColor === null ? "#c0c0d8" : PALETTE[this.myColor];
    const me = this.players.find((player) => player.id === Network.id);
    const unlocked = AVATARS.filter((avatar) => !SECRET_AVATARS[avatar] || SECRET_AVATARS[avatar](me && me.name));
    row.replaceChildren(...unlocked.map((avatar) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "avatar-btn" + (Player.avatar === avatar ? " mine" : "");
      button.dataset.avatar = avatar;
      button.title = avatar;
      const preview = document.createElement("canvas");
      preview.width = 34; preview.height = 34;
      drawAvatar(preview.getContext("2d"), 6, 4, Player.w, Player.h, color, 1, avatar);
      button.appendChild(preview);
      button.addEventListener("click", () => Network.send({ type: "choose_avatar", avatar }));
      return button;
    }));
  },

  refreshSwatches() {
    const taken = new Set(this.players.filter((player) => player.id !== Network.id && player.color !== null).map((player) => player.color));
    [...swatchGrid.children].forEach((button, index) => {
      button.disabled = taken.has(index);
      button.classList.toggle("mine", this.myColor === index);
    });
  },

  // In the lobby the picker sits inside the lobby box and stays open, so you can change
  // your mind. Anywhere else (joining mid-match) it is the overlay, shown until you pick.
  showColorPicker() {
    this.refreshSwatches();
    colorPicker.classList.remove("hidden");
    if (this.phase !== "lobby") buildHud.classList.add("hidden");
  },

  hideColorPicker() {
    if (this.phase === "lobby") return;   // stays open in the lobby
    colorPicker.classList.add("hidden");
    if (this.phase === "build") buildHud.classList.remove("hidden");
  },

  placeColorPicker() {
    const lobbyColor = document.getElementById("lobby-color");
    if (this.phase === "lobby") { if (colorPicker.parentElement !== lobbyColor) lobbyColor.appendChild(colorPicker); }
    else if (colorPicker.parentElement !== gameWrap) gameWrap.appendChild(colorPicker);
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
    this.testMatch = Boolean(message.testMatch);
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
    Player.avatar = me && me.avatar ? me.avatar : "cube";
    // First time in this room: ask for the shape you used last time.
    const wanted = savedAvatar();
    const allowed = !SECRET_AVATARS[wanted] || SECRET_AVATARS[wanted](me && me.name);
    if (!this.inRoom && me && this.phase === "lobby" && wanted !== me.avatar && allowed) Network.send({ type: "choose_avatar", avatar: wanted });
    this.renderAvatars();
    roomCodeInput.value = message.code;
    this.inRoom = true;
    if (this.phase === "lobby") this._chartX = {};   // a fresh match gets a fresh chart
    this.showScores();
    this.renderRoom();
    this.offer = message.offer || [];
    this.picks = {};
    for (const player of message.players) if (player.pick) this.picks[player.id] = player.pickSlot;
    this.pick = me ? me.pick || null : null;
    this.pencil = me ? me.pencil || 0 : 0;
    this.pending = null;
    this.renderItems();
    startRunButton.classList.add("hidden");
    // In the lobby the picker is always open. Elsewhere it only shows until you have a color.
    this.placeColorPicker();
    if (this.phase === "lobby" || this.myColor === null) this.showColorPicker();
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
      if (!document.getElementById("invite-panel").classList.contains("hidden")) document.getElementById("invite-status").textContent = message.message;
      // A fatal error means we are not in any room: go back to the start page, keeping the reason on screen.
      if (message.fatal && this.mode === "online") this.leaveOnline(message.message);
      return;
    }
    if (message.type === "joined") return;
    if (message.type === "hello_ok") { document.getElementById("user-id").textContent = message.userId; return; }
    if (message.type === "offline") { if (this.mode === "solo") onlineStatus.textContent = "Not connected to the server. Retrying…"; return; }
    if (message.type === "rooms") { this.renderRooms(message.rooms); return; }
    if (message.type === "invited") { this.showInviteToast(message); return; }
    if (message.type === "notice") { this.say(message.message, 3); document.getElementById("invite-status").textContent = message.message; return; }
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
      this._bannerTimer = 0; this._bursts = [];
      this.say(`Round ${this.round} on ${Level.name}. Place your trap.`, 3);
    }
    if (message.type === "vote_start") {
      this.applyRoomState(message);
      Player.spawn();
      this._voteEndsAt = performance.now() + message.seconds * 1000;
      this.say("Vote for the course!", 3);
    }
    if (message.type === "color") {
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.color = message.color;
      if (message.playerId === Network.id) {
        this.myColor = message.color;
        Player.color = PALETTE[message.color];
        this.renderAvatars();   // the shape previews (and the mouse's eyes) take the new color
        this.hideColorPicker();
        this.say(this.phase === "lobby" ? "Color picked. You can still change it before the start." : "Now tap the level to place your trap.", 3);
      }
      this.refreshSwatches();
      this.renderRoom();
    }
    if (message.type === "color_rejected") { this.say(message.message, 1.5); this.refreshSwatches(); }
    if (message.type === "avatar") {
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.avatar = message.avatar;
      if (message.playerId === Network.id) {
        Player.avatar = message.avatar;
        this.say(`You're a ${message.avatar} now.`, 2);
        try { localStorage.setItem("trapocalypse.avatar", message.avatar); } catch (error) { /* ignore */ }
      }
      this.renderAvatars();
    }
    if (message.type === "picked_up") {
      const orb = Level.hazards.find((hazard) => hazard.kind === "portal" && hazard.x === message.x && hazard.y === message.y);
      if (orb) orb.taken = true;
      if (message.by === Network.id) { this.portal = true; this.say("Teleport Ball! Press X / Shift (or USE) to throw it and appear where it lands.", 4); }
      else this.say(`${this.nameOf(message.by)} grabbed the Teleport Ball!`, 2);
      Sfx.pickup();
    }
    if (message.type === "portal_ball") {
      this._balls.push({ x: message.x, y: message.y, vx: message.vx, vy: message.vy, by: message.by, color: this.colorOf(message.by), trail: [] });
      if (message.by === Network.id) this.portal = false;
      Sfx.dash();
    }
    if (message.type === "pencil_taken") {
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.trapCount = this.trapsPerRound;
      if (message.playerId === Network.id) {
        this.placements[0] = this.trapsPerRound; this.pencil = message.charges; this.pending = null;
        Sfx.pickup();
        this.say(`Pencil! During the run, hold the mouse (or a finger) to sketch blocks. ${message.charges} strokes.`, 4);
      }
      this.renderItems();
    }
    if (message.type === "drawn") {
      for (const block of message.blocks) Level.drawn.push({ ...block, until: Infinity, color: this.colorOf(message.by) });   // gone when the round ends
      if (message.by === Network.id) { this.pencil = message.left; this._stroke = null; }
      Sfx.pickup();
    }
    if (message.type === "trap_placed") {
      if (!Level.hazards.some((hazard) => hazard.x === message.trap.x && hazard.y === message.trap.y)) Level.hazards.push(message.trap);
      if (message.bomb) {
        // A Trap Bomb during a Final Battle. The dropper gets a moment to step off it.
        Sfx.crumble();
        if (message.playerId === Network.id) { Player._immune = 0.8; this.say("Trap Bomb dropped! Move!", 2); }
        else this.say(`${this.nameOf(message.playerId)} dropped a Trap Bomb!`, 2);
      }
      else if (message.playerId === Network.id) { this.placements[0] += 1; this.pending = null; Sfx.pickup(); this.renderItems(); }
      const who = this.players.find((player) => player.id === message.playerId);
      if (who) who.trapCount += 1;
    }
    if (message.type === "trap_rejected") this.say(message.message, 1.5);
    if (message.type === "trap_erased") {
      // The trap crumbles: a big puff of dust in its color, then it is gone.
      const index = Level.hazards.findIndex((hazard) => hazard.x === message.trap.x && hazard.y === message.trap.y);
      if (index >= 0) Level.hazards.splice(index, 1);
      Dust.spawn(message.trap.x + TILE / 2, message.trap.y + TILE, 22, TILE);
      Sfx.crumble();
      this.players = message.players;
      const owner = this.nameOf(message.trap.owner);
      if (message.by === Network.id) { this.placements[0] += 1; this.pending = null; this.say(`You erased ${owner}'s trap! That was your item this round.`, 2.5); }
      else if (message.trap.owner === Network.id) this.say(`${this.nameOf(message.by)} erased your trap!`, 2);
      else this.say(`${this.nameOf(message.by)} erased ${owner}'s trap.`, 1.5);
      this.renderItems();
    }
    if (message.type === "phase" && message.phase === "run") {
      this.phase = "run";
      buildHud.classList.add("hidden");
      colorPicker.classList.add("hidden");
      onlinePanel.classList.add("hidden");   // the room UI goes away once the round starts
      this.voteOpen = false;
      this.renderVote();
      Player.spawn();
      Level.drawn = []; this._stroke = null;   // last run's pencil sketches are gone
      this.portal = false; this._balls = [];
      for (const remote of Object.values(this.remotePlayers)) { remote.alive = true; remote.finished = false; }
      // Mirror what the server just did: everyone runs, or in a Final Battle only the tied players do.
      this.finalBattleIds = message.finalBattleIds || [];
      const fighting = (id) => this.finalBattleIds.length === 0 || this.finalBattleIds.includes(id);
      for (const player of this.players) player.status = fighting(player.id) ? "running" : "out";
      this._runTimeLimit = message.timeLimit === undefined ? null : message.timeLimit;
      this._runStartedAt = performance.now();
      this._runTimeLeft = this._runTimeLimit;
      // Weapons, only in a Final Battle.
      this.weapons = message.weapons || {};
      this.weaponOffer = [];
      this.renderWeaponPick();
      Player.setWeapon(this.weapons[Network.id] || null);
      touchUseButton.classList.toggle("hidden", !["dash", "freeze", "bomb"].includes(Player.weapon));
      if (this.finalBattleIds.length === 0) this.say("Run! One life. Reach the flag.", 2);
      else if (fighting(Network.id)) {
        const info = WEAPON_INFO[Player.weapon];
        this.say(info ? `FINAL BATTLE! ${info.name}: ${info.desc}.` : "FINAL BATTLE! First to the flag gets +5.", 4);
      }
      else { Player.alive = false; this.say("Final Battle! Watch the tied players fight it out.", 3); }
    }
    if (message.type === "weapon_picked") {
      this.weapons[message.playerId] = message.weapon;
      if (message.playerId === Network.id) { this.myWeapon = message.weapon; this.renderWeaponPick(); this.say(`${WEAPON_INFO[message.weapon].name} it is!`, 2); }
    }
    if (message.type === "freeze") {
      Sfx.freeze();
      const by = this.nameOf(message.by);
      for (const id of message.ids) if (this.remotePlayers[id]) this.remotePlayers[id].frozenUntil = performance.now() + message.seconds * 1000;
      if (message.ids.includes(Network.id)) { Player.frozen = message.seconds; this.say(`Frozen by ${by}'s Freeze Ray!`, 2); }
      else if (message.by === Network.id) this.say("Freeze Ray fired!", 2);
    }
    if (message.type === "votes") {
      this.votes = message.votes;
      this.renderVote();
    }
    if (message.type === "picks") {
      this.picks = message.picks;
      const mine = message.picks[Network.id] === undefined ? null : this.offer[message.picks[Network.id]] || null;
      if (mine !== this.pick) { this.pick = mine; this.pending = null; if (mine) Sfx.pickup(); }
      this.renderItems();
    }
    if (message.type === "chat") this.addChatLine(message);
    if (message.type === "match_over") {
      Sfx.victory();
      this.phase = "winner";
      this.players = message.players;
      this.winnerIds = message.winnerIds;
      this._bannerTimer = 0; this._bursts = [];
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
      Sfx.timeUp();
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
        // Shot upward while touching a spring: that spring just launched them. (A spring
        // throws you about 50 px per update; an ordinary jump manages about 35.)
        if (dy < -42) {
          const box = { x: remote.x, y: remote.y + 6, w: Player.w, h: Player.h };
          const spring = Level.hazards.find((hazard) => hazard.kind === "spring" && Physics.overlaps(box, hazard));
          if (spring) spring.bouncedAt = performance.now();
        }
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
          if (mine === "running") this.say(`Your trap got ${victim}! Finish to bank +${message.killPoints} Curiosity`, 2);
          else if (mine === "finished") this.say(`Your trap got ${victim}! +${message.killPoints} Curiosity banked`, 2);
          else this.say(`Your trap got ${victim}! No points, you didn't finish.`, 2);
        }
        else if (message.playerId === Network.id) this.say(`${killer.name}'s trap got you! Watching the others...`, 4);
        else this.say(`${killer.name}'s trap got ${victim}!`, 1.5);
        this.showScores();
      } else if (message.playerId !== Network.id && who) {
        this.say(message.status === "dead" ? `${who.name} is out!` : `${who.name} made it!`, 1.5);
      }
      // Someone else reached the flag: confetti where we last saw them.
      if (message.status === "finished" && message.playerId !== Network.id) {
        const remote = this.remotePlayers[message.playerId];
        if (remote && remote.x !== undefined) Confetti.burst(remote.x + Player.w / 2, remote.y + Player.h / 2, this.colorOf(message.playerId));
        if (remote) remote.finished = true;
      }
    }
    if (message.type === "round_over") {
      Level.drawn = []; this._stroke = null;   // pencil sketches last exactly one round
      this.playRoundSounds(message);
      this.phase = "results";
      this.players = message.players;
      this._runTimeLeft = null;
      this._nextRoundIn = message.nextIn;
      this._firstFinisher = message.firstFinisher || null;
      this._firstBonus = message.firstBonus || this._firstBonus;
      this._bursts = this.buildBursts(message.gains || {});
      this._finalBattleNext = message.finalBattle || null;
      this._winnerPending = message.winnerPending || null;
      this._gains = message.gains || {};
      this._revealIn = message.revealIn || 0;   // the countdown only shows once the points have all landed
      this._resultsElapsed = 0;
      // Weapons are for the Final Battle only; hand back whatever you held and show any new offer.
      Player.setWeapon(null);
      touchUseButton.classList.add("hidden");
      this.weaponOffer = (message.weaponOffers || {})[Network.id] || [];
      this.myWeapon = null;
      this.weapons = {};
      this.votes = {};
      this.voteOpen = Boolean(message.voteOpen);
      this.renderVote();
      this.renderWeaponPick();
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

  // Local party mode only (unreachable from the menu for now): place straight away.
  placeTrap(clientX, clientY) {
    if (this.phase !== "build" || this.mode !== "party") return;
    const { x, y } = this.tileAt(clientX, clientY);
    const trap = { x, y, w: TILE, h: TILE, kind: "spike" };
    if (x < 2 * TILE || x + TILE > LEVEL_W - TILE || Level.hazards.some((hazard) => Physics.overlaps(trap, hazard)) || Physics.overlaps(trap, Level.flag) || Physics.overlaps(trap, Player)) { this.say("You can't place a trap there.", 1.5); return; }
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
    Sfx.splat();
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
    Sfx.finish();
    Confetti.burst(Player.x + Player.w / 2, Player.y + Player.h / 2, Player.color);
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
        this.updateBalls(dt);
        // Touch a Teleport Ball orb to claim it (the server decides who was first).
        for (const orb of Level.hazards) {
          if (orb.kind === "portal" && !orb.taken && !orb._claimed && Player.alive && !Player.finished && Physics.overlaps(Player, orb)) {
            orb._claimed = true;
            Network.send({ type: "pickup", x: orb.x, y: orb.y });
          }
        }
      }
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
    Confetti.update(dt);
    // A burst plays its sound the moment it appears: the fanfare for Trailblazer, a chime otherwise.
    const burst = this.activeBurst();
    if (burst && !burst.sounded) { burst.sounded = true; if (burst.label === "Trailblazer") Sfx.fanfare(); else Sfx.otherScore(); }
    // Last 15 seconds of a run: a tick every second.
    if (this.phase === "run" && this._runTimeLeft !== null && this._runTimeLeft <= 15) {
      const whole = Math.ceil(this._runTimeLeft);
      if (whole !== this._lastTick && whole > 0) { this._lastTick = whole; Sfx.tick(); }
    } else this._lastTick = null;
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

  // Special points burst onto the screen as they land on the chart: Trailblazer big,
  // Autonomous a bit smaller, Curiosity smaller still. Two bursts never show at once:
  // if they would collide in time, the later one waits its turn.
  buildBursts(gains) {
    const STAGE_START = 0.7, STAGE_GAP = 1.0;
    const bursts = [];
    for (const [playerId, stages] of Object.entries(gains)) {
      stages.forEach((stage, i) => {
        const key = stage.label.replace(/ ×\d+$/, "");
        if (BURST_STYLE[key]) bursts.push({ label: key, playerId, points: stage.points, at: STAGE_START + i * STAGE_GAP, scale: BURST_STYLE[key].scale });
      });
    }
    bursts.sort((a, b) => a.at - b.at || b.scale - a.scale);
    for (let i = 1; i < bursts.length; i++) bursts[i].at = Math.max(bursts[i].at, bursts[i - 1].at + BURST_SECONDS);
    return bursts;
  },

  activeBurst() {
    if (this.phase !== "results") return null;
    return this._bursts.find((burst) => this._resultsElapsed >= burst.at && this._resultsElapsed < burst.at + BURST_SECONDS) || null;
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

  // The end of a whole match: 1st, 2nd and 3rd on podium blocks under a disco ball,
  // everyone dancing in their own shape. Players tied on points share a step.
  drawPodium(sorted) {
    const now = performance.now() / 1000;
    const floorY = 470, centerX = LEVEL_W / 2;
    const steps = [                                 // 1st in the middle, 2nd left, 3rd right
      { x: centerX, h: 130, face: "#ffd23c", edge: "#fff3b0", label: "1" },
      { x: centerX - 150, h: 90, face: "#c9d1e0", edge: "#f0f4ff", label: "2" },
      { x: centerX + 150, h: 60, face: "#d38a4a", edge: "#f2c39a", label: "3" },
    ];
    // Group by score so ties stand together.
    const groups = [];
    for (const player of sorted) {
      const last = groups[groups.length - 1];
      if (last && last[0].score === player.score) last.push(player); else groups.push([player]);
    }

    // Disco ball on a string, with slow-turning colored beams.
    const ballX = centerX, ballY = 150, ballR = 26;
    ctx.save();
    ctx.strokeStyle = "#c0c0d8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ballX, 0); ctx.lineTo(ballX, ballY - ballR); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const angle = now * 0.6 + i * (Math.PI / 3);
      ctx.fillStyle = `hsla(${(i * 60 + now * 40) % 360}, 100%, 60%, 0.13)`;
      ctx.beginPath();
      ctx.moveTo(ballX, ballY);
      ctx.lineTo(ballX + Math.cos(angle) * 900, ballY + Math.sin(angle) * 900);
      ctx.lineTo(ballX + Math.cos(angle + 0.25) * 900, ballY + Math.sin(angle + 0.25) * 900);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#e8e8ff";
    ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 25;
    ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Mirror tiles: a grid clipped to the ball, sparkling as it turns.
    ctx.save();
    ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2); ctx.clip();
    for (let gy = -ballR; gy < ballR; gy += 7) {
      for (let gx = -ballR; gx < ballR; gx += 7) {
        const sparkle = Math.sin(gx * 0.5 + now * 5) * Math.cos(gy * 0.4 + now * 3);
        ctx.fillStyle = sparkle > 0.6 ? "#ffffff" : `hsl(${(gx * 4 + now * 120) % 360}, 60%, ${55 + sparkle * 15}%)`;
        ctx.fillRect(ballX + gx, ballY + gy, 6, 6);
      }
    }
    ctx.restore();

    // The floor, then the three blocks with their numbers.
    ctx.fillStyle = "#1c1c2e";
    ctx.fillRect(centerX - 300, floorY, 600, 6);
    steps.forEach((step, rank) => {
      if (!groups[rank]) return;   // fewer than three score groups: leave the step out
      ctx.fillStyle = step.face;
      ctx.fillRect(step.x - 55, floorY - step.h, 110, step.h);
      ctx.fillStyle = step.edge;
      ctx.fillRect(step.x - 55, floorY - step.h, 110, 5);
      ctx.fillStyle = "#0b0b14";
      ctx.font = `bold 34px ${DISPLAY_FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(step.label, step.x, floorY - step.h / 2 + 4);
      // Everyone on this step, dancing: bobbing, swaying, turning to face each beat.
      const dancers = groups[rank];
      const spacing = Math.min(36, 100 / dancers.length);
      dancers.forEach((player, i) => {
        const beat = now * 6 + rank + i * 1.3;
        const bob = Math.abs(Math.sin(beat)) * 12;
        const sway = Math.sin(beat / 2) * 5;
        const squash = 1 - Math.max(0, Math.sin(beat + Math.PI)) * 0.12;   // a little squat on the landing
        const x = step.x - ((dancers.length - 1) * spacing) / 2 + i * spacing - Player.w / 2 + sway;
        const y = floorY - step.h - Player.h - bob;
        const facing = Math.sin(beat / 3) > 0 ? 1 : -1;
        ctx.save();
        ctx.translate(0, floorY - step.h);
        ctx.scale(1, squash);
        ctx.translate(0, -(floorY - step.h));
        drawAvatar(ctx, x, y, Player.w, Player.h, this.colorOf(player.id), facing, player.avatar || "cube");
        ctx.restore();
        ctx.font = `bold 13px ${FONT}`;
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = this.colorOf(player.id);
        ctx.fillText(player.name, x + Player.w / 2, y - 8 - (i % 2) * 14);
      });
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillStyle = "#e8e8ff";
      ctx.fillText(`${groups[rank][0].score} pts`, step.x, floorY + 24);
    });
    // Everyone else, listed under the podium.
    const rest = groups.slice(3).flat();
    if (rest.length) {
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = "#c0c0d8";
      ctx.textAlign = "center";
      ctx.fillText(rest.map((player) => `${player.name} ${player.score}`).join("  •  "), centerX, floorY + 50);
    }
    ctx.restore();

    // A four-to-the-floor beat under the disco ball, two beats a second.
    const beat = Math.floor(now * 2);
    if (this._lastBeat !== beat) { this._lastBeat = beat; Sfx.discoBeat(beat % 8); }
    // A pop of confetti from the ceiling every so often.
    if (!this._lastPodiumConfetti || now - this._lastPodiumConfetti > 1.3) {
      this._lastPodiumConfetti = now;
      Confetti.burst(200 + Math.random() * 560, 40, `hsl(${Math.random() * 360}, 100%, 65%)`);
    }
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
      this.drawPodium(sorted);
      return;
    } else {
      const label = this._finalBattleNext ? "Final Battle in" : this._winnerPending ? "Final results in" : "Next round in";
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = "#c0c0d8";
      const stillCounting = this._resultsElapsed < (this._revealIn || 0);
      ctx.fillText(stillCounting ? "Adding up the points…" : `${label} ${Math.max(0, Math.ceil(this._nextRoundIn))}`, LEVEL_W / 2, 96);
      // As each of YOUR points lands, its name and a little line about it.
      const me = this.players.find((player) => player.id === Network.id);
      const mine = me ? this.animatedScore(me).labels : [];
      const current = mine[mine.length - 1];
      if (current) {
        const name = current.text.replace(/^\+\d+ /, "");
        ctx.globalAlpha = Math.min(1, (1 - current.age) * 2);
        ctx.font = `bold 15px ${FONT}`;
        ctx.fillStyle = "#ffd23c";
        ctx.fillText(`${name}: ${current.text.match(/^\+\d+/)[0]}`, LEVEL_W / 2, 120);
        ctx.font = `italic 13px ${FONT}`;
        ctx.fillStyle = "#e8e8ff";
        ctx.fillText(gainText(name), LEVEL_W / 2, 140);
        ctx.globalAlpha = 1;
      }
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

    const burst = this.activeBurst();
    if (burst) this.drawBurst(burst);
  },

  // A special-point burst (Trailblazer, Autonomous, Curiosity): a jagged comic burst that
  // slams down into place, holds, then fades. burst = { label, playerId, points, at, scale }.
  drawBurst(burst) {
    const winner = this.players.find((player) => player.id === burst.playerId);
    const color = winner && winner.color !== null ? PALETTE[winner.color] : "#ffd23c";
    const elapsed = this._resultsElapsed - burst.at;     // seconds since it appeared
    const remaining = BURST_SECONDS - elapsed;
    const centerX = LEVEL_W / 2, centerY = 200;

    // Slam: starts huge and far, shrinks and drops into place over 0.25 s...
    const drop = Math.min(1, elapsed / 0.25);
    const eased = drop * drop;                            // speeds up as it falls, like gravity
    let scaleX = (2.2 - 1.2 * eased) * burst.scale, scaleY = scaleX;
    let offsetY = -60 * (1 - eased);
    // ...then squashes on impact for 0.2 s and springs back.
    const impact = Math.max(0, Math.min(1, (elapsed - 0.25) / 0.2));
    const squash = Math.sin(impact * Math.PI);
    scaleX += 0.14 * squash;
    scaleY -= 0.2 * squash;
    const fade = Math.max(0, Math.min(1, remaining / 0.4));   // quick fade-out at the end

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
    ctx.fillText(BURST_STYLE[burst.label].text, 0, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e8e8ff";
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(`+${burst.points} Point${burst.points === 1 ? "" : "s"}`, 0, 30);
    ctx.restore();
  },

  draw() {
    // Wipe the whole canvas, then redraw the scene from scratch.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Level.draw(ctx);
    Dust.draw(ctx);   // under the runners, over the ground

    // Other runners first, so your own square is always drawn on top.
    for (const [id, remote] of Object.entries(this.remotePlayers)) {
      if (!remote.alive || remote.x === undefined) continue;
      const color = this.colorOf(id);
      const who = this.players.find((player) => player.id === id);
      if (remote.finished) {
        // Made it: they stay visible at the flag, faded, with a tick on their tag.
        ctx.globalAlpha = 0.6;
        drawAvatar(ctx, remote.x, remote.y, Player.w, Player.h, color, 1, who ? who.avatar : "cube");
        ctx.globalAlpha = 1;
        if (this.mode === "online") this.drawNametag(remote.x, remote.y, `✓ ${remote.name}`, color);
        continue;
      }
      drawAvatar(ctx, remote.x, remote.y, Player.w, Player.h, color, remote.x >= (remote._lastX ?? remote.x) ? 1 : -1, who ? who.avatar : "cube");
      remote._lastX = remote.x;
      if (remote.frozenUntil && remote.frozenUntil > performance.now()) {   // hit by a Freeze Ray
        ctx.fillStyle = "rgba(160, 230, 255, 0.55)";
        ctx.fillRect(remote.x - 3, remote.y - 3, Player.w + 6, Player.h + 6);
      }
      if (this.mode === "online") this.drawNametag(remote.x, remote.y, remote.name, color);
    }
    Player.draw(ctx);
    Confetti.draw(ctx);
    this.drawPending();
    this.drawStroke();
    this.drawBalls();
    if (this.mode === "online" && Player.alive) {
      const me = this.players.find((player) => player.id === Network.id);
      this.drawNametag(Player.x, Player.y, me ? me.name : "You", "#ffffff");
    }

    if (this.mode === "online" && (this.phase === "results" || this.phase === "winner")) this.drawScoreboard();

    // The round and course line only shows once a match is under way. On the menu (solo
    // mode) the HUD stays hidden; in the lobby and the vote it shows no course name.
    hud.classList.toggle("hidden", this.mode === "solo");
    // Touch buttons only while there is something to run: the title world, or an online run.
    const running = this.mode === "solo" || this.phase === "run";
    document.body.classList.toggle("in-run", running);
    document.getElementById("touch-controls").classList.toggle("hidden", !running);
    hudClock.textContent = ""; hudClock.classList.remove("urgent"); hudTail.textContent = "";   // only the run branch fills these
    if (this.mode === "online" && this.phase === "lobby") {
      hudText.textContent = `ROOM ${roomCodeInput.value}  •  ${this.message}`;
    } else if (this.mode === "online" && this.phase === "vote") {
      const left = Math.max(0, Math.ceil((this._voteEndsAt - performance.now()) / 1000));
      hudText.textContent = `COURSE VOTE  •  ⏱ ${left}s  •  ${this.message}`;
    } else if (this.mode === "online" && this.phase === "winner") {
      hudText.textContent = `MATCH OVER  •  ${this.message}`;
    } else if (this.mode === "online") {
      const cap = this.settings ? this.settings.roundCap : "?";
      const roundLabel = `${this.testMatch ? "TEST MATCH  •  " : ""}ROUND ${this.round} of ${cap}  ${Level.name}`;
      const showClock = this.phase === "run" && this._runTimeLeft !== null;
      const info = this.phase === "run" && Player.weapon ? WEAPON_INFO[Player.weapon] : null;
      const weapon = info ? `  •  ${info.icon} ${info.name}${Player.weaponUsed ? " (used)" : ""}` : "";
      const pencil = this.pencil > 0 ? `  •  ✏️ ${this.pencil} stroke${this.pencil === 1 ? "" : "s"} left` : "";
      const portal = this.portal ? "  •  🔮 Teleport Ball: X / Shift to throw" : "";
      // The clock is its own span so the last 15 seconds can go red without the rest.
      hudText.textContent = `${roundLabel}${showClock ? "  •  " : ""}`;
      hudClock.textContent = showClock ? `⏱ ${Math.ceil(this._runTimeLeft)}s` : "";
      hudClock.classList.toggle("urgent", showClock && this._runTimeLeft <= 15);
      hudTail.textContent = `${weapon}${pencil}${portal}  •  ${this.message}`;
    } else {
      const progress = `LEVEL ${this.levelIndex + 1}/${LEVELS.length}  ${Level.name}`;
      hudText.textContent = this.complete ? `${progress}  •  COMPLETE` : `${progress}  •  ${this.message}`;
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
        buildInstructions.textContent = `Item used. Waiting for ${waiting} more...`;
      } else if (!this.pick) {
        buildInstructions.textContent = `Pick one of this round's items.`;
      } else if (!this.everyonePicked()) {
        const left = this.players.filter((player) => player.status !== "out" && this.picks[player.id] === undefined).length;
        buildInstructions.textContent = `Waiting for ${left} more to pick an item…`;
      } else if (this.pick === "eraser") {
        buildInstructions.textContent = `Tap someone else's trap, then confirm to erase it.`;
      } else {
        buildInstructions.textContent = `Tap the course to set your ${TRAP_NAMES[this.pick]} down, move it if you like, then confirm.`;
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
  const name = chosenName();
  Game.startOnline();
  Network.connect(name);   // the room starts with default settings; the host adjusts them in the lobby
});
document.getElementById("menu-help").addEventListener("click", () => Game.showHelp());
document.getElementById("roll-name").addEventListener("click", () => { playerNameInput.value = randomName(); });
// Join Room opens the room list; a code typed on the menu is carried into it.
joinRoomButton.addEventListener("click", () => Game.showRoomList());
document.getElementById("join-code-button").addEventListener("click", () => Game.joinCode(document.getElementById("join-code").value));
document.getElementById("join-code").addEventListener("keydown", (event) => { if (event.key === "Enter") Game.joinCode(document.getElementById("join-code").value); event.stopPropagation(); });
document.getElementById("room-list-close").addEventListener("click", () => Game.hideRoomList());
document.getElementById("invite-button").addEventListener("click", () => Game.showInvite());
document.getElementById("invite-send").addEventListener("click", () => Game.sendInvite());
document.getElementById("invite-id").addEventListener("keydown", (event) => { if (event.key === "Enter") Game.sendInvite(); event.stopPropagation(); });
document.getElementById("invite-cancel").addEventListener("click", () => Game.hideInvite());
document.getElementById("invite-join").addEventListener("click", () => Game.acceptInvite());
document.getElementById("invite-dismiss").addEventListener("click", () => Game.hideInviteToast());
document.getElementById("user-id").textContent = Network.loadUserId();
Network.ensure().catch(() => {});   // connect right away so invites can find you on the menu
startRunButton.addEventListener("click", () => {
  if (Game.phase === "build") Game.startPartyRun();
});
startMatchButton.addEventListener("click", () => Network.send({ type: "start_match" }));
document.getElementById("test-match").addEventListener("click", () => Network.send({ type: "start_match", test: true }));
leaveRoomButton.addEventListener("click", () => { Network.leave(); Game.leaveOnline(); });
document.getElementById("test-course").addEventListener("change", (event) => { Network.send({ type: "test_course", level: Number(event.target.value) }); Game.hideSettings(); });
document.getElementById("kick-button").addEventListener("click", () => Network.send({ type: "kick", playerId: document.getElementById("kick-target").value }));
document.getElementById("ban-button").addEventListener("click", () => Network.send({ type: "ban", playerId: document.getElementById("kick-target").value, minutes: document.getElementById("ban-length").value }));
backToLobbyButton.addEventListener("click", () => Network.send({ type: "back_to_lobby" }));
document.getElementById("settings-help").addEventListener("click", () => { Game.hideSettings(); Game.showHelp(); });
document.getElementById("help-close").addEventListener("click", () => Game.hideHelp());
// Chat scroll strip: drag the thumb, or wheel anywhere over the log.
(() => {
  const strip = document.getElementById("chat-scroll");
  let dragging = null;
  const scrollTo = (clientY) => {
    const rect = strip.getBoundingClientRect();
    const thumbH = document.getElementById("chat-thumb").offsetHeight;
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top - dragging.grab) / Math.max(1, rect.height - thumbH)));
    chatLog.scrollTop = ratio * (chatLog.scrollHeight - chatLog.clientHeight);
    Game.updateChatScroll();
  };
  strip.addEventListener("pointerdown", (event) => {
    const thumb = document.getElementById("chat-thumb").getBoundingClientRect();
    const onThumb = event.clientY >= thumb.top && event.clientY <= thumb.bottom;
    dragging = { grab: onThumb ? event.clientY - thumb.top : thumb.height / 2 };
    scrollTo(event.clientY);
    event.preventDefault();
  });
  window.addEventListener("pointermove", (event) => { if (dragging) scrollTo(event.clientY); });
  window.addEventListener("pointerup", () => { dragging = null; });
  window.addEventListener("wheel", (event) => {
    const rect = chatLog.getBoundingClientRect();
    if (chatBox.classList.contains("hidden") || rect.height === 0) return;
    if (event.clientX >= rect.left && event.clientX <= rect.right + 14 && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      chatLog.scrollTop += event.deltaY;
      Game.updateChatScroll();
    }
  }, { passive: true });
  chatLog.addEventListener("scroll", () => Game.updateChatScroll());
})();
document.getElementById("chat-toggle").addEventListener("click", () => {
  const minimized = chatBox.classList.toggle("minimized");
  document.getElementById("chat-toggle").textContent = minimized ? "Chat +" : "Chat −";
  try { localStorage.setItem("trapocalypse.chatMin", minimized ? "1" : "0"); } catch (error) { /* ignore */ }
});
try { if (localStorage.getItem("trapocalypse.chatMin") === "1") { chatBox.classList.add("minimized"); document.getElementById("chat-toggle").textContent = "Chat +"; } } catch (error) { /* ignore */ }
helpPanel.addEventListener("click", (event) => { if (event.target === helpPanel) Game.hideHelp(); });   // click outside the box
document.getElementById("settings-button").addEventListener("click", () => Game.showSettings());
document.getElementById("settings-close").addEventListener("click", () => Game.hideSettings());
settingsPanel.addEventListener("click", (event) => { if (event.target === settingsPanel) Game.hideSettings(); });
chatFilterToggle.addEventListener("change", () => Game.setChatFilter(chatFilterToggle.checked));
soundsToggle.addEventListener("change", () => Game.setSounds(soundsToggle.checked));
settingsBackToLobby.addEventListener("click", () => { Network.send({ type: "back_to_lobby" }); Game.hideSettings(); });
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") Game.sendChat();
  if (event.key === "Escape") chatInput.blur();
  event.stopPropagation();   // typing never reaches the game's key handlers
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { Game.hideHelp(); Game.hideSettings(); Game.hideInvite(); Game.hideRoomList(); Game.cancelPlacement(); }
  if ((event.key === "e" || event.key === "E") && Game.pending && !event.target.matches("input, textarea, select")) Game.confirmPlacement();
  // "/" or "T" opens the chat when you are in a room and not already typing somewhere.
  if ((event.key === "/" || event.key === "t" || event.key === "T") && Game.inRoom && !event.target.matches("input, textarea, select")) { chatInput.focus(); event.preventDefault(); }
});
Game.loadPreferences();
// Tap the course to set your item down; drag to move it; ✓ or E to confirm; ✕ or Escape to cancel.
let pointerHeld = false;
let lastTap = { x: -1, y: -1, at: 0 };   // for double-tap placing
canvas.addEventListener("pointerdown", (event) => {
  pointerHeld = true;
  if (Game.beginStroke(event.clientX, event.clientY)) return;   // pencil in hand during a run
  // Tap a tile once to put the ghost there; tap the same tile again within 0.4 s to confirm.
  const tile = Game.tileAt(event.clientX, event.clientY);
  const twice = tile.x === lastTap.x && tile.y === lastTap.y && event.timeStamp - lastTap.at < 400;
  lastTap = { x: tile.x, y: tile.y, at: event.timeStamp };
  if (twice && Game.pending && Game.pending.x === tile.x && Game.pending.y === tile.y) { Game.confirmPlacement(); return; }
  Game.setPending(event.clientX, event.clientY); Game.placeTrap(event.clientX, event.clientY);
});
canvas.addEventListener("pointermove", (event) => {
  if (pointerHeld && Game._stroke) Game.extendStroke(event.clientX, event.clientY);
  else if (pointerHeld && Game.pending) Game.setPending(event.clientX, event.clientY);
});
window.addEventListener("pointerup", () => { pointerHeld = false; Game.endStroke(); });
document.getElementById("place-ok").addEventListener("click", () => Game.confirmPlacement());
document.getElementById("place-cancel").addEventListener("click", () => Game.cancelPlacement());

// The canvas only picks up a web font once the browser has loaded it, so ask for both now.
if (document.fonts) { document.fonts.load("16px Fredoka"); document.fonts.load("16px 'Baloo 2'"); }
Game.buildSwatches();
Game.buildMapButtons();
Game.start();
