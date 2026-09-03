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
const THEMES = {
  neon:   { bg: "#0b0b14", grid: "rgba(255,255,255,0.04)", solid: "#1c1c2e", solidTop: "#4df0ff", spike: "#ff3c78", spikeBase: "#ffb3c9", pole: "#ffffff", dust: "rgba(200,200,230,0.7)" },
  rust:   { bg: "#171008", grid: "rgba(255,180,80,0.05)",  solid: "#3a2414", solidTop: "#ff8c1a", spike: "#d8dde3", spikeBase: "#8a949e", pole: "#e8e8ff", dust: "rgba(255,190,120,0.6)" },
  dusk:   { bg: "#160f24", grid: "rgba(255,255,255,0.04)", solid: "#2d2044", solidTop: "#c98bff", spike: "#ffb830", spikeBase: "#ffe0a0", pole: "#ffffff", dust: "rgba(220,200,255,0.6)" },
  grotto: { bg: "#06202a", grid: "rgba(120,220,220,0.05)", solid: "#1e3d45", solidTop: "#6fd3c8", spike: "#ff8a5c", spikeBase: "#ffc9b3", pole: "#dffbf7", dust: "rgba(160,220,220,0.5)" },
  ash:    { bg: "#1c1a1a", grid: "rgba(255,120,60,0.05)",  solid: "#3a3232", solidTop: "#ff5a1f", spike: "#ffb347", spikeBase: "#ffe0b3", pole: "#e8e8ff", dust: "rgba(140,140,140,0.7)" },
  meadow: { bg: "#9ad7f5", grid: "rgba(0,0,0,0.04)",       solid: "#6b4a2b", solidTop: "#7ed957", spike: "#3b2a1a", spikeBase: "#5a3d24", pole: "#3b2a1a", dust: "rgba(120,90,50,0.6)" },
  frost:  { bg: "#0e1a2e", grid: "rgba(200,230,255,0.05)", solid: "#24405f", solidTop: "#dff6ff", spike: "#bfe9ff", spikeBase: "#ffffff", pole: "#ffffff", dust: "rgba(230,245,255,0.7)" },
};

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
    // Islands over lava. Miss a jump and you are gone.
    name: "Ashfall",
    theme: THEMES.ash,
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
    // Icy steps over deep crevasses.
    name: "Frostbite Ridge",
    theme: THEMES.frost,
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
];

const Level = {
  index: 0,
  name: "",
  solids: [],
  hazards: [],
  start: { x: 0, y: 0 },
  flag: { x: 0, y: 0, w: 0, h: 0 },
  theme: THEMES.neon,

  load(index) {
    this.index = index;
    const level = LEVELS[index];
    this.name = level.name;
    this.theme = level.theme;
    this.solids = level.solids.map((solid) => ({ ...solid }));
    this.hazards = level.hazards.map((hazard) => ({ ...hazard }));
    this.start = { ...level.start };
    this.flag = { ...level.flag };
  },

  draw(ctx) {
    const t = this.theme;

    // Background first, then everything else on top of it.
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, LEVEL_W, LEVEL_H);

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

    // Hazards: spikes in the theme's warning color, readable at a glance.
    for (const hazard of this.hazards) {
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
};

Level.load(0);

// The server needs the same level data to check trap placement, so this file
// is loaded by Node too. In the browser "module" does not exist and this line is skipped.
if (typeof module !== "undefined") module.exports = { LEVELS, TILE, LEVEL_W, LEVEL_H };
