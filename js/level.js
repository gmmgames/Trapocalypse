// ------------------------------------------------------------
// level.js
// Where everything sits. The level is a grid of tiles, each
// TILE pixels wide. Thinking in tiles instead of pixels makes it
// much easier to place platforms (and later, traps).
// ------------------------------------------------------------

const TILE = 30;                 // 960 / 30 = 32 tiles across, 540 / 30 = 18 tiles down
const LEVEL_W = 960;
const LEVEL_H = 540;

// Helper: build a rectangle from tile coordinates.
// tileRect(col, row, colsWide, rowsTall)
function tileRect(col, row, cols = 1, rows = 1) {
  return { x: col * TILE, y: row * TILE, w: cols * TILE, h: rows * TILE };
}

// Each course has its own look. A "theme" is just the set of colors the
// drawing code uses, so two courses with the same shapes can feel different.
//   bg        the sky / background
//   grid      the faint tile lines
//   solid     platform body, solidTop its bright top edge
//   spike     spike color, spikeBase the strip along the bottom of the spikes
//   pole      the flagpole
//   dust      the puffs kicked up when a runner moves or lands
// Random background decoration for the title screen, picked to suit the theme.
function makeScenery(themeName) {
  const daylight = themeName === "meadow";
  const items = [];
  if (!daylight) for (let i = 0; i < 45; i++) items.push({ kind: "star", x: Math.random() * LEVEL_W, y: Math.random() * LEVEL_H * 0.65, r: 0.6 + Math.random() * 1.4, phase: Math.random() * Math.PI * 2 });
  items.push({ kind: daylight ? "sun" : "moon", x: 80 + Math.random() * (LEVEL_W - 160), y: 50 + Math.random() * 80, r: 18 + Math.random() * 10 });
  if (daylight || themeName === "frost") for (let i = 0; i < 4; i++) items.push({ kind: "cloud", x: Math.random() * LEVEL_W, y: 40 + Math.random() * 150, w: 60 + Math.random() * 60, speed: 6 + Math.random() * 10 });
  items.push({ kind: "hills", layer: 0, seed: Math.random() * 100 }, { kind: "hills", layer: 1, seed: Math.random() * 100 });
  const prop = { meadow: "tree", rust: "cactus", frost: "crystal", grotto: "crystal", neon: "tower", dusk: "tower", ash: "stump" }[themeName] || "stump";
  for (let i = 0; i < 6; i++) items.push({ kind: prop, x: 20 + Math.random() * (LEVEL_W - 40), h: 30 + Math.random() * 60 });
  return items;
}

const THEMES = {
  neon:   { bg: "#0b0b14", grid: "rgba(255,255,255,0.04)", solid: "#1c1c2e", solidTop: "#4df0ff", spike: "#ff3c78", spikeBase: "#ffb3c9", pole: "#ffffff", dust: "rgba(200,200,230,0.7)" },
  rust:   { bg: "#171008", grid: "rgba(255,180,80,0.05)",  solid: "#3a2414", solidTop: "#ff8c1a", spike: "#d8dde3", spikeBase: "#8a949e", pole: "#e8e8ff", dust: "rgba(255,190,120,0.6)" },
  dusk:   { bg: "#160f24", grid: "rgba(255,255,255,0.04)", solid: "#2d2044", solidTop: "#c98bff", spike: "#ffb830", spikeBase: "#ffe0a0", pole: "#ffffff", dust: "rgba(220,200,255,0.6)" },
  grotto: { bg: "#06202a", grid: "rgba(120,220,220,0.05)", solid: "#1e3d45", solidTop: "#6fd3c8", spike: "#ff8a5c", spikeBase: "#ffc9b3", pole: "#dffbf7", dust: "rgba(160,220,220,0.5)" },
  ash:    { bg: "#1c1a1a", grid: "rgba(255,120,60,0.05)",  solid: "#3a3232", solidTop: "#ff5a1f", spike: "#ffb347", spikeBase: "#ffe0b3", pole: "#e8e8ff", dust: "rgba(140,140,140,0.7)" },
  meadow: { bg: "#9ad7f5", grid: "rgba(0,0,0,0.04)",       solid: "#6b4a2b", solidTop: "#7ed957", spike: "#3b2a1a", spikeBase: "#5a3d24", pole: "#3b2a1a", dust: "rgba(120,90,50,0.6)" },
  frost:  { bg: "#0e1a2e", grid: "rgba(200,230,255,0.05)", solid: "#24405f", solidTop: "#dff6ff", spike: "#bfe9ff", spikeBase: "#ffffff", pole: "#ffffff", dust: "rgba(230,245,255,0.7)" },
};

// A placed Mover block slides this far to the right and back, taking this long per round trip.
const MOVER_DX = 60;
const MOVER_PERIOD = 3;

const LEVELS = [
  {
    name: "Neon Ascent",
    theme: THEMES.neon,
    solids: [
      tileRect(0, 16, 32, 2), tileRect(6, 13, 3, 1),
      tileRect(11, 11, 3, 1), tileRect(16, 9, 4, 1),
      tileRect(22, 12, 3, 1), tileRect(27, 10, 3, 1),
    ],
    hazards: [
      tileRect(4, 15, 2, 1), tileRect(9, 15, 2, 1),
      tileRect(14, 10, 2, 1), tileRect(20, 15, 2, 1),
      tileRect(25, 15, 2, 1),
    ],
    start: { x: 2 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(28, 8, 1, 2),
  },
  {
    name: "The Gauntlet",
    theme: THEMES.rust,
    solids: [
      tileRect(0, 16, 5, 2), tileRect(7, 16, 4, 2),
      tileRect(13, 14, 3, 1), tileRect(18, 11, 4, 1),
      tileRect(24, 14, 3, 1), tileRect(29, 10, 3, 1),
    ],
    hazards: [
      tileRect(5, 17, 2, 1), tileRect(11, 15, 2, 1),
      tileRect(16, 15, 2, 1), tileRect(22, 15, 2, 1),
      tileRect(27, 15, 2, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 8, 1, 2),
  },
  {
    name: "Last Light",
    theme: THEMES.dusk,
    solids: [
      tileRect(0, 16, 4, 2), tileRect(5, 13, 3, 1),
      tileRect(10, 15, 3, 1), tileRect(15, 12, 3, 1),
      tileRect(20, 9, 3, 1), tileRect(25, 12, 3, 1),
      tileRect(29, 8, 3, 1),
    ],
    hazards: [
      tileRect(3, 15, 2, 1), tileRect(8, 15, 2, 1),
      tileRect(13, 15, 2, 1), tileRect(18, 15, 2, 1),
      tileRect(23, 15, 2, 1), tileRect(28, 15, 1, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 6, 1, 2),
  },
  {
    // Ground with spiked pits, and a ledge route up to a high flag.
    name: "Sunken Grotto",
    theme: THEMES.grotto,
    solids: [
      tileRect(0, 16, 7, 2), tileRect(9, 16, 4, 2),
      tileRect(15, 16, 5, 2), tileRect(22, 16, 10, 2),
      tileRect(5, 12, 3, 1), tileRect(12, 11, 3, 1),
      tileRect(19, 12, 3, 1), tileRect(26, 11, 4, 1),
    ],
    hazards: [
      tileRect(7, 17, 2, 1), tileRect(13, 17, 2, 1),
      tileRect(20, 17, 2, 1), tileRect(24, 15, 2, 1),
      tileRect(13, 10, 1, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(28, 9, 1, 2),
  },
  {
    // Islands over lava. Miss a jump and you are gone. A drifting island bridges the middle.
    name: "Ashfall",
    theme: THEMES.ash,
    movers: [{ ...tileRect(8, 11, 2, 1), dx: 150, dy: 0, period: 4 }],
    solids: [
      tileRect(0, 16, 4, 2), tileRect(6, 15, 3, 1),
      tileRect(11, 13, 3, 1), tileRect(16, 16, 4, 2),
      tileRect(22, 13, 3, 1), tileRect(27, 15, 5, 3),
    ],
    hazards: [
      tileRect(4, 17, 2, 1), tileRect(9, 17, 2, 1),
      tileRect(14, 17, 2, 1), tileRect(20, 17, 2, 1),
      tileRect(25, 17, 2, 1), tileRect(18, 15, 1, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 13, 1, 2),
  },
  {
    // Daylight. Thorn patches on the grass, and a staircase of ledges to the flag.
    name: "Sunny Meadow",
    theme: THEMES.meadow,
    solids: [
      tileRect(0, 16, 32, 2), tileRect(4, 13, 3, 1),
      tileRect(9, 11, 3, 1), tileRect(14, 13, 2, 1),
      tileRect(18, 10, 3, 1), tileRect(23, 12, 3, 1),
      tileRect(28, 9, 4, 1),
    ],
    hazards: [
      tileRect(7, 15, 2, 1), tileRect(12, 15, 3, 1),
      tileRect(17, 15, 2, 1), tileRect(22, 15, 2, 1),
      tileRect(27, 15, 3, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 7, 1, 2),
  },
  {
    // Icy steps over deep crevasses. A ledge rises and sinks over the middle gap.
    name: "Frostbite Ridge",
    theme: THEMES.frost,
    movers: [{ ...tileRect(10, 11, 2, 1), dx: 0, dy: 75, period: 3 }],
    solids: [
      tileRect(0, 16, 5, 2), tileRect(7, 14, 3, 1),
      tileRect(12, 16, 4, 2), tileRect(18, 14, 2, 1),
      tileRect(22, 12, 3, 1), tileRect(27, 14, 5, 4),
    ],
    hazards: [
      tileRect(5, 17, 2, 1), tileRect(10, 17, 2, 1),
      tileRect(16, 17, 2, 1), tileRect(20, 17, 2, 1),
      tileRect(25, 17, 2, 1), tileRect(13, 15, 1, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 12, 1, 2),
  },
  {
    // Wall-jump course. Duck under the floating pillar into a three-tile shaft, bounce wall to
    // wall up to the roof, then hop the high ledges to a flag near the top of the screen.
    name: "Chimney Climb",
    theme: THEMES.dusk,
    solids: [
      tileRect(0, 16, 32, 2),
      tileRect(9, 3, 2, 10), tileRect(14, 3, 2, 13),          // the chimney: floating left pillar, full right pillar
      tileRect(18, 6, 2, 1), tileRect(22, 5, 3, 1), tileRect(26, 4, 2, 1), tileRect(29, 4, 3, 1),
    ],
    hazards: [
      tileRect(5, 15, 2, 1), tileRect(18, 15, 2, 1), tileRect(24, 15, 2, 1),
      tileRect(23, 4, 1, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 2, 1, 2),
  },
  {
    // Wall-jump course. Thin frozen towers over a bed of icicles: hop top to top, or slide
    // down a face and kick off it to save yourself. A sliding slab helps between two towers.
    name: "Tower Hop",
    theme: THEMES.frost,
    movers: [{ ...tileRect(11, 14, 2, 1), dx: 30, dy: 0, period: 2.5 }],
    solids: [
      tileRect(0, 16, 4, 2), tileRect(28, 16, 4, 2),
      tileRect(6, 10, 1, 6), tileRect(10, 8, 1, 8), tileRect(14, 11, 1, 5),
      tileRect(18, 8, 1, 8), tileRect(22, 10, 1, 6), tileRect(26, 9, 1, 7),
    ],
    hazards: [tileRect(4, 17, 24, 1)],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 14, 1, 2),
  },
  {
    // Wall-jump course. Start high, drop down a well (slide the right-hand wall: the left
    // side lands on a spike), cross the cave floor, then climb the second well to the flag.
    name: "The Well",
    theme: THEMES.grotto,
    solids: [
      tileRect(0, 16, 32, 2),
      tileRect(0, 4, 5, 1), tileRect(4, 5, 1, 10), tileRect(8, 2, 2, 13),    // start ledge and the first well
      tileRect(20, 2, 2, 11), tileRect(25, 2, 2, 14),                        // the second well (walk in under the left wall)
      tileRect(28, 3, 4, 1),
    ],
    hazards: [
      tileRect(5, 15, 1, 1), tileRect(11, 15, 2, 1), tileRect(16, 15, 2, 1),
    ],
    start: { x: 1 * TILE, y: 4 * TILE - 26 },
    flag: tileRect(30, 1, 1, 2),
  },
  {
    // Rooftops at night. Wide buildings with deadly alleys between them, and a window-cleaning
    // cradle sliding across one alley.
    name: "Skyline",
    theme: THEMES.neon,
    movers: [{ ...tileRect(9, 13, 2, 1), dx: 90, dy: 0, period: 3.5 }],
    solids: [
      tileRect(0, 14, 4, 4), tileRect(6, 12, 3, 6), tileRect(11, 15, 3, 3),
      tileRect(16, 12, 3, 6), tileRect(21, 13, 3, 5), tileRect(26, 10, 6, 8),
    ],
    hazards: [
      tileRect(4, 17, 2, 1), tileRect(9, 17, 2, 1), tileRect(14, 17, 2, 1),
      tileRect(19, 17, 2, 1), tileRect(24, 17, 2, 1),
      tileRect(12, 14, 1, 1), tileRect(27, 9, 1, 1),
    ],
    start: { x: 1 * TILE, y: 14 * TILE - 26 },
    flag: tileRect(30, 8, 1, 2),
  },
  {
    // Daylight. Tall hedges to vault (a wall jump makes it easy), thorns on the grass behind them.
    name: "Hedge Maze",
    theme: THEMES.meadow,
    solids: [
      tileRect(0, 16, 32, 2),
      tileRect(6, 12, 1, 4), tileRect(12, 12, 1, 4), tileRect(18, 12, 1, 4), tileRect(24, 12, 1, 4),
      tileRect(8, 10, 2, 1), tileRect(14, 9, 2, 1), tileRect(20, 10, 2, 1), tileRect(27, 8, 3, 1),
    ],
    hazards: [
      tileRect(9, 15, 2, 1), tileRect(15, 15, 2, 1), tileRect(21, 15, 2, 1),
      tileRect(28, 7, 1, 1),
    ],
    start: { x: 1 * TILE, y: 16 * TILE - 26 },
    flag: tileRect(30, 14, 1, 2),
  },
];

const Level = {
  index: 0,
  name: "",
  solids: [],
  hazards: [],
  start: { x: 0, y: 0 },
  flag: { x: 0, y: 0, w: 0, h: 0 },
  theme: THEMES.neon,

  scenery: [],          // title-screen decoration (stars, hills, trees...); empty on real courses
  sceneryId: 0,
  drawn: [],            // pencil blocks: { x, y, w, h, until (performance.now() ms), color }
  movers: [],           // the course's moving platforms (current x,y plus baseX/baseY, dx, dy, period, prevX/prevY)
  moverEpoch: 0,        // performance.now() the movers' clock started; everyone resets it when a run starts

  load(index) {
    this.index = index;
    const level = LEVELS[index];
    this.name = level.name;
    this.theme = level.theme;
    this.solids = level.solids.map((solid) => ({ ...solid }));
    this.hazards = level.hazards.map((hazard) => ({ ...hazard }));
    this.start = { ...level.start };
    this.flag = { ...level.flag };
    this.scenery = [];
    this.drawn = [];
    this.movers = (level.movers || []).map((mover) => ({ ...mover, baseX: mover.x, baseY: mover.y, prevX: mover.x, prevY: mover.y }));
    this.moverEpoch = typeof performance !== "undefined" ? performance.now() : Date.now();
  },

  // Move every platform to where it is right now. Called once per frame before the runner
  // moves. Position is a smooth back-and-forth: 0 -> 1 -> 0 over one period.
  updateMovers() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const t = (now - this.moverEpoch) / 1000;
    const slide = (mover) => {
      const k = 0.5 - 0.5 * Math.cos((Math.PI * 2 * t) / mover.period);
      mover.prevX = mover.x; mover.prevY = mover.y;
      mover.x = mover.baseX + mover.dx * k;
      mover.y = mover.baseY + mover.dy * k;
    };
    for (const mover of this.movers) slide(mover);
    for (const hazard of this.hazards) {
      if (hazard.kind !== "mover") continue;
      if (!hazard._box) hazard._box = { x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h, baseX: hazard.x, baseY: hazard.y, dx: MOVER_DX, dy: 0, period: MOVER_PERIOD, prevX: hazard.x, prevY: hazard.y };
      slide(hazard._box);
    }
  },
  // Every moving platform, course-built or player-placed, as a box the physics can use.
  movingSolids() {
    return this.movers.concat(this.hazards.filter((hazard) => hazard.kind === "mover" && hazard._box).map((hazard) => hazard._box));
  },

  // Pencil blocks that still exist right now. Expired ones are dropped here, so the
  // physics and the drawing always agree on what is solid.
  drawnSolids() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.drawn.length) this.drawn = this.drawn.filter((block) => block.until > now);
    return this.drawn;
  },

  // The title screen: a random little world to hop around in behind the menu.
  // A random theme, a full floor, a few floating ledges, no traps and no flag.
  loadTitle() {
    this.index = -1;
    this.name = "Title";
    const themeNames = Object.keys(THEMES);
    const themeName = themeNames[Math.floor(Math.random() * themeNames.length)];
    this.theme = THEMES[themeName];
    this.hazards = [];
    this.flag = { x: -1000, y: 0, w: TILE, h: TILE * 2 };   // parked off-screen: nothing to finish
    this.solids = [tileRect(0, 17, 32, 1)];
    let col = 1 + Math.floor(Math.random() * 3);
    while (col < 28) {
      const width = 2 + Math.floor(Math.random() * 3), row = 9 + Math.floor(Math.random() * 6);
      this.solids.push(tileRect(col, row, width, 1));
      col += width + 2 + Math.floor(Math.random() * 3);
    }
    for (let i = 0; i < 2; i++) {   // a couple of steps on the floor, away from where you spawn
      const c = 9 + Math.floor(Math.random() * 21);
      this.solids.push(tileRect(c, 16, 1 + Math.floor(Math.random() * 2), 1));
    }
    this.start = { x: 5 * TILE, y: 17 * TILE - 26 };
    this.movers = [];
    this.scenery = makeScenery(themeName);
    this.sceneryId = Math.random();
  },

  // Background decoration for the title screen. Everything is drawn from the theme's
  // own colors so it always matches. `time` in seconds makes stars twinkle and clouds drift.
  drawScenery(ctx) {
    const t = this.theme;
    const time = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    const groundY = 17 * TILE;
    ctx.save();
    for (const item of this.scenery) {
      if (item.kind === "star") {
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(time * 2 + item.phase);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fill();
      } else if (item.kind === "moon" || item.kind === "sun") {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = item.kind === "sun" ? "#ffe066" : "#f4f1e0";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (item.kind === "moon") { ctx.fillStyle = t.bg; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(item.x + item.r * 0.3, item.y - item.r * 0.2, item.r * 0.3, 0, Math.PI * 2); ctx.fill(); }
      } else if (item.kind === "cloud") {
        const x = ((item.x + time * item.speed) % (LEVEL_W + 200)) - 100;
        ctx.globalAlpha = 0.8; ctx.fillStyle = "#ffffff";
        for (const [dx, dy, r] of [[0, 0, item.w * 0.22], [item.w * 0.25, -item.w * 0.08, item.w * 0.28], [item.w * 0.5, 0, item.w * 0.2]]) {
          ctx.beginPath(); ctx.arc(x + dx, item.y + dy, r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (item.kind === "hills") {
        // Two rolling silhouettes: the far one fainter and taller, the near one darker.
        const base = groundY - (item.layer === 0 ? 40 : 8), amp = item.layer === 0 ? 70 : 38;
        ctx.globalAlpha = item.layer === 0 ? 0.45 : 0.85;
        ctx.fillStyle = t.solid;
        ctx.beginPath(); ctx.moveTo(0, groundY);
        for (let x = 0; x <= LEVEL_W; x += 20) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + item.seed) * Math.cos(x * 0.004 + item.seed * 0.5)));
        ctx.lineTo(LEVEL_W, groundY); ctx.closePath(); ctx.fill();
      } else {
        // Props standing on the floor, drawn as soft silhouettes.
        ctx.globalAlpha = 0.75;
        const { x, h } = item;
        if (item.kind === "tree") {
          ctx.fillStyle = t.solid; ctx.fillRect(x - 3, groundY - h * 0.45, 6, h * 0.45);
          ctx.fillStyle = t.solidTop; ctx.beginPath(); ctx.arc(x, groundY - h * 0.6, h * 0.35, 0, Math.PI * 2); ctx.fill();
        } else if (item.kind === "cactus") {
          ctx.fillStyle = t.solidTop;
          ctx.fillRect(x - 4, groundY - h, 8, h);
          ctx.fillRect(x - 14, groundY - h * 0.6, 10, 5); ctx.fillRect(x - 14, groundY - h * 0.6, 5, h * 0.25);
          ctx.fillRect(x + 4, groundY - h * 0.75, 10, 5); ctx.fillRect(x + 9, groundY - h * 0.75, 5, h * 0.3);
        } else if (item.kind === "crystal") {
          ctx.fillStyle = t.solidTop; ctx.globalAlpha = 0.5;
          for (const [dx, hh] of [[-10, h * 0.6], [0, h], [9, h * 0.7]]) { ctx.beginPath(); ctx.moveTo(x + dx - 5, groundY); ctx.lineTo(x + dx, groundY - hh); ctx.lineTo(x + dx + 5, groundY); ctx.closePath(); ctx.fill(); }
        } else if (item.kind === "tower") {
          ctx.fillStyle = t.solid; ctx.fillRect(x - 8, groundY - h, 16, h);
          ctx.fillStyle = t.spike; ctx.globalAlpha = 0.4 + 0.6 * (Math.sin(time * 3 + x) > 0 ? 1 : 0);
          ctx.fillRect(x - 2, groundY - h - 4, 4, 4);
        } else {   // stump
          ctx.fillStyle = t.solid; ctx.fillRect(x - 6, groundY - h * 0.3, 12, h * 0.3);
        }
      }
    }
    ctx.restore();
  },

  draw(ctx) {
    const t = this.theme;

    // Background first, then everything else on top of it.
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, LEVEL_W, LEVEL_H);
    if (this.scenery.length) this.drawScenery(ctx);

    // Faint grid so you can see the tiles. Handy when we start placing pieces.
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= LEVEL_W; x += TILE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LEVEL_H); ctx.stroke();
    }
    for (let y = 0; y <= LEVEL_H; y += TILE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LEVEL_W, y); ctx.stroke();
    }

    // Solids: blocks with a bright top edge
    for (const s of this.solids) {
      ctx.fillStyle = t.solid;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = t.solidTop;
      ctx.fillRect(s.x, s.y, s.w, 3);
    }
    // The course's moving platforms.
    for (const mover of this.movers) this.drawMover(ctx, mover, t);

    // Traps. Each kind looks different so you know what you are running at:
    //   spike    kills on touch (the level's built-in hazards are spikes too)
    //   crumble  a fake platform that gives way just after you land on it
    //   glue     slows you to a crawl, and you cannot jump while in it
    //   bumper   flings you sideways, away from it
    //   spring   a launch pad: land on it and fly upward
    //   ice      slippery: you keep sliding after you stop pushing
    //   decoy    looks exactly like spikes to everyone but its owner, and does nothing
    // Pencil sketches: paper-white squares outlined in the drawer's color, fading out.
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    for (const block of this.drawnSolids()) {
      ctx.globalAlpha = Math.min(1, (block.until - now) / 600);
      ctx.fillStyle = "#f4f1e0";
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.strokeStyle = block.color || "#ffd23c";
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
      ctx.globalAlpha = 1;
    }

    for (const hazard of this.hazards) {
      if (hazard.kind === "crumble") { this.drawCrumbler(ctx, hazard, t); continue; }
      if (hazard.kind === "glue") { this.drawGlue(ctx, hazard); continue; }
      if (hazard.kind === "bumper") { this.drawBumper(ctx, hazard); continue; }
      if (hazard.kind === "spring") { this.drawSpring(ctx, hazard); continue; }
      if (hazard.kind === "ice") { this.drawIce(ctx, hazard); continue; }
      if (hazard.kind === "portal") { if (!hazard.taken) this.drawPortal(ctx, hazard); continue; }
      if (hazard.kind === "mover") { this.drawMover(ctx, hazard._box || hazard, t, true); continue; }
      // spikes and decoys draw the same; the owner of a decoy gets a faint dashed outline
      if (hazard.kind === "decoy" && typeof Network !== "undefined" && hazard.owner === Network.id) {
        ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1;
        ctx.strokeRect(hazard.x + 1, hazard.y + 1, hazard.w - 2, hazard.h - 2); ctx.restore();
      }
      ctx.fillStyle = t.spike;
      const spikeWidth = 12;
      for (let x = hazard.x; x < hazard.x + hazard.w; x += spikeWidth) {
        ctx.beginPath();
        ctx.moveTo(x, hazard.y + hazard.h);
        ctx.lineTo(x + spikeWidth / 2, hazard.y);
        ctx.lineTo(Math.min(x + spikeWidth, hazard.x + hazard.w), hazard.y + hazard.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = t.spikeBase;
      ctx.fillRect(hazard.x, hazard.y + hazard.h - 3, hazard.w, 3);
    }

    // Flag: a pole and a triangle
    const f = this.flag;
    ctx.fillStyle = t.pole;
    ctx.fillRect(f.x + 4, f.y, 3, f.h);
    ctx.fillStyle = "#ffd23c";
    ctx.beginPath();
    ctx.moveTo(f.x + 7, f.y + 2);
    ctx.lineTo(f.x + 26, f.y + 10);
    ctx.lineTo(f.x + 7, f.y + 18);
    ctx.closePath();
    ctx.fill();
  },

  // A picture of an item for the build-phase cards: the trap drawn into a 30x30 box,
  // or a pink eraser block with a white X.
  drawItemIcon(ctx, item) {
    const box = { x: 0, y: 0, w: TILE, h: TILE };
    const t = this.theme;
    ctx.clearRect(0, 0, TILE, TILE);
    if (item === "pencil") {
      // A yellow pencil on the slant: pink eraser, wood tip, dark point.
      ctx.save(); ctx.translate(15, 15); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "#ff8fb0"; ctx.fillRect(-14, -4, 5, 8);
      ctx.fillStyle = "#ffd23c"; ctx.fillRect(-9, -4, 16, 8);
      ctx.fillStyle = "#f0c9a0"; ctx.beginPath(); ctx.moveTo(7, -4); ctx.lineTo(14, 0); ctx.lineTo(7, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0b0b14"; ctx.beginPath(); ctx.moveTo(11, -1.7); ctx.lineTo(14, 0); ctx.lineTo(11, 1.7); ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    if (item === "portal") { this.drawPortal(ctx, box); return; }
    if (item === "mover") { this.drawMover(ctx, box, t, true); return; }
    if (item === "eraser") {
      ctx.fillStyle = "#ff3c78";
      ctx.fillRect(3, 8, 24, 16);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(9, 11); ctx.lineTo(21, 21); ctx.moveTo(21, 11); ctx.lineTo(9, 21); ctx.stroke();
      return;
    }
    if (item === "crumble") { this.drawCrumbler(ctx, { ...box, kind: "crumble" }, t); return; }
    if (item === "glue") { this.drawGlue(ctx, box); return; }
    if (item === "bumper") { this.drawBumper(ctx, box); return; }
    if (item === "spring") { this.drawSpring(ctx, box); return; }
    if (item === "ice") { this.drawIce(ctx, box); return; }
    if (item === "decoy") {
      // spikes with a question mark: they only LOOK deadly
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.strokeRect(1, 1, TILE - 2, TILE - 2); ctx.restore();
    }
    // spikes
    ctx.fillStyle = t.spike;
    for (let x = 0; x < TILE; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, TILE); ctx.lineTo(x + 6, 0); ctx.lineTo(Math.min(x + 12, TILE), TILE); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = t.spikeBase;
    ctx.fillRect(0, TILE - 3, TILE, 3);
  },

  // A platform-looking block with cracks. It shivers once someone has stepped on it.
  drawCrumbler(ctx, c, t) {
    if (c._gone) return;
    const shake = c._crumbleAt !== undefined ? Math.sin(c._crumbleAt * 60) * 2 : 0;
    const x = c.x + shake;
    ctx.fillStyle = t.solid;
    ctx.fillRect(x, c.y, c.w, c.h);
    ctx.fillStyle = t.solidTop;
    ctx.fillRect(x, c.y, c.w, 3);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 6, c.y + 4); ctx.lineTo(x + 12, c.y + 13); ctx.lineTo(x + 8, c.y + 22); ctx.lineTo(x + 14, c.y + 29);
    ctx.moveTo(x + 22, c.y + 3); ctx.lineTo(x + 18, c.y + 12); ctx.lineTo(x + 25, c.y + 19);
    ctx.stroke();
  },

  // A green blob with drips over the top edge of the tile.
  drawGlue(ctx, g) {
    ctx.fillStyle = "rgba(140, 255, 60, 0.85)";
    ctx.beginPath();
    ctx.moveTo(g.x, g.y + g.h);
    ctx.lineTo(g.x, g.y + 14);
    ctx.quadraticCurveTo(g.x + 5, g.y + 2, g.x + 10, g.y + 12);
    ctx.quadraticCurveTo(g.x + 15, g.y - 2, g.x + 20, g.y + 10);
    ctx.quadraticCurveTo(g.x + 25, g.y + 4, g.x + g.w, g.y + 16);
    ctx.lineTo(g.x + g.w, g.y + g.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(60, 160, 20, 0.9)";
    ctx.fillRect(g.x + 8, g.y + 18, 3, 8);
    ctx.fillRect(g.x + 19, g.y + 20, 3, 6);
  },

  // A yellow launch pad: a coil with a plate on top.
  // How tall the spring is right now, as a fraction of normal. A bounce (s.bouncedAt, a
  // performance.now() stamp set when someone lands on it) squashes it flat, then it
  // overshoots tall and settles: 1 -> 0.4 -> 1.3 -> 1 over about 0.6 s.
  springScale(s) {
    if (!s.bouncedAt) return 1;
    const age = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - s.bouncedAt) / 1000;
    if (age < 0.12) return 1 - 0.6 * (age / 0.12);                                   // squash
    if (age < 0.3) return 0.4 + 0.9 * ((age - 0.12) / 0.18);                          // spring up past normal
    if (age < 0.6) return 1.3 - 0.3 * ((age - 0.3) / 0.3);                            // settle
    return 1;
  },

  drawSpring(ctx, s) {
    // Squash and stretch from the base, so the pad stays planted on the ground.
    const scale = this.springScale(s);
    ctx.save();
    ctx.translate(0, s.y + s.h);
    ctx.scale(1, scale);
    ctx.translate(0, -(s.y + s.h));
    ctx.strokeStyle = "#ffd23c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = s.y + s.h - 4 - i * 5;
      ctx.moveTo(s.x + 7, y); ctx.lineTo(s.x + s.w - 7, y - 2.5);
    }
    ctx.stroke();
    ctx.fillStyle = "#ffe680";
    ctx.fillRect(s.x + 3, s.y + 6, s.w - 6, 5);
    ctx.fillStyle = "#ffd23c";
    ctx.fillRect(s.x + 3, s.y + s.h - 4, s.w - 6, 4);
    ctx.restore();
  },

  // A moving platform: a block in the course colors with sliding chevrons so you can tell it
  // moves. Player-placed ones get a yellow edge.
  drawMover(ctx, m, t, placed = false) {
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    ctx.fillStyle = t.solid;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = placed ? "#ffd23c" : t.solidTop;
    ctx.fillRect(m.x, m.y, m.w, 3);
    ctx.save();
    ctx.beginPath(); ctx.rect(m.x, m.y + 4, m.w, m.h - 4); ctx.clip();
    ctx.strokeStyle = placed ? "rgba(255, 210, 60, 0.7)" : "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    const shift = (now * 20) % 12;
    for (let x = m.x - 12 + shift; x < m.x + m.w + 12; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, m.y + 5); ctx.lineTo(x + 5, m.y + m.h / 2 + 1); ctx.lineTo(x, m.y + m.h - 3); ctx.stroke();
    }
    ctx.restore();
  },

  // The Teleport Ball pickup: a swirling violet orb with a slow-turning ring.
  drawPortal(ctx, p) {
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    ctx.save();
    ctx.shadowColor = "#c98bff"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#7b3fe4";
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e6d5ff";
    ctx.beginPath(); ctx.arc(cx - 2.5, cy - 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c98bff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, 12, 4.5, now * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  },

  // A pale blue ice patch with a glint.
  drawIce(ctx, i) {
    ctx.fillStyle = "rgba(190, 235, 255, 0.85)";
    ctx.fillRect(i.x, i.y + i.h - 10, i.w, 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(i.x + 4, i.y + i.h - 8, 8, 2);
    ctx.fillRect(i.x + 16, i.y + i.h - 6, 5, 2);
    ctx.strokeStyle = "rgba(120, 200, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(i.x + 0.5, i.y + i.h - 9.5, i.w - 1, 9);
  },

  // A round pink bumper with arrows pointing the way it will throw you.
  drawBumper(ctx, b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.fillStyle = "#ff3cb4";
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 5); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx - 3, cy + 5);
    ctx.moveTo(cx + 3, cy - 5); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx + 3, cy + 5);
    ctx.stroke();
  },
};

Level.load(0);

// The server needs the same level data to check trap placement, so this file
// is loaded by Node too. In the browser "module" does not exist and this line is skipped.
if (typeof module !== "undefined") module.exports = { LEVELS, TILE, LEVEL_W, LEVEL_H };
