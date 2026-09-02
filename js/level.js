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

const LEVELS = [
  {
    name: "Neon Ascent",
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
];

const Level = {
  index: 0,
  name: "",
  solids: [],
  hazards: [],
  start: { x: 0, y: 0 },
  flag: { x: 0, y: 0, w: 0, h: 0 },

  load(index) {
    this.index = index;
    const level = LEVELS[index];
    this.name = level.name;
    this.solids = level.solids.map((solid) => ({ ...solid }));
    this.hazards = level.hazards.map((hazard) => ({ ...hazard }));
    this.start = { ...level.start };
    this.flag = { ...level.flag };
  },

  draw(ctx) {
    // Faint grid so you can see the tiles. Handy when we start placing pieces.
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= LEVEL_W; x += TILE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LEVEL_H); ctx.stroke();
    }
    for (let y = 0; y <= LEVEL_H; y += TILE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LEVEL_W, y); ctx.stroke();
    }

    // Solids: dark blocks with a glowing top edge
    for (const s of this.solids) {
      ctx.fillStyle = "#1c1c2e";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = "#4df0ff";
      ctx.fillRect(s.x, s.y, s.w, 3);
    }

    // Hazards: bright warning spikes make the danger readable at a glance.
    for (const hazard of this.hazards) {
      ctx.fillStyle = "#ff3c78";
      const spikeWidth = 12;
      for (let x = hazard.x; x < hazard.x + hazard.w; x += spikeWidth) {
        ctx.beginPath();
        ctx.moveTo(x, hazard.y + hazard.h);
        ctx.lineTo(x + spikeWidth / 2, hazard.y);
        ctx.lineTo(Math.min(x + spikeWidth, hazard.x + hazard.w), hazard.y + hazard.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#ffb3c9";
      ctx.fillRect(hazard.x, hazard.y + hazard.h - 3, hazard.w, 3);
    }

    // Flag: a pole and a triangle
    const f = this.flag;
    ctx.fillStyle = "#ffffff";
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
