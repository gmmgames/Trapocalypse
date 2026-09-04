// ------------------------------------------------------------
// editor.js
// The level editor: paint blocks, spikes, movers, a start and a flag
// onto a tile grid, save courses in this browser, test-run them, and
// (from the lobby) hand them to the room so everyone can vote for them.
// A saved course is plain data shaped like the built-in ones in level.js,
// with the theme written as its name ("neon", "rust", ...).
// ------------------------------------------------------------

const Editor = {
  open: false,
  testing: false,       // running around inside the course you are editing
  tool: "block",
  level: null,          // the course being edited
  drawing: false,
  lastTile: null,
  hover: null,          // the tile under the pointer, for the highlight
  STORAGE_KEY: "trapocalypse.courses",
  SIZES: { small: { cols: 32, rows: 18 }, big: { cols: 48, rows: 27 } },
  MAX_TILES: 900,
  MAX_SAVED: 12,

  blank(name = "My Course", size = "small", theme = "neon") {
    const { cols, rows } = this.SIZES[size];
    return {
      name, theme, cols, rows,
      solids: [{ x: 0, y: (rows - 2) * TILE, w: cols * TILE, h: 2 * TILE }],   // a floor to start from
      hazards: [], movers: [],
      start: { x: TILE + 4, y: (rows - 2) * TILE - 26 },
      flag: { x: (cols - 3) * TILE, y: (rows - 4) * TILE, w: TILE, h: 2 * TILE },
    };
  },

  // ---- opening and closing ----
  show() {
    this.open = true; this.testing = false;
    if (!this.level) this.level = this.blank();
    Game.mode = "editor"; Game.phase = "editor";
    document.getElementById("online-panel").classList.add("hidden");
    document.getElementById("editor").classList.remove("hidden");
    document.getElementById("editor-stop").classList.add("hidden");
    this.fillThemes();
    this.syncForm();
    this.refreshList();
    this.apply();
  },
  close() {
    this.open = false; this.testing = false;
    document.getElementById("editor").classList.add("hidden");
    document.getElementById("editor-stop").classList.add("hidden");
    Game.leaveOnline("Create a room or join a friend.");
  },
  // Put the course on screen (and the runner on its start, as the start marker).
  apply() {
    Level.applyCustom(this.level);
    Player.spawn();
  },

  // ---- painting ----
  tileAt(clientX, clientY) {
    const b = canvas.getBoundingClientRect();
    return { col: Math.floor(((clientX - b.left) / b.width) * this.level.cols), row: Math.floor(((clientY - b.top) / b.height) * this.level.rows) };
  },
  pointer(event, kind) {
    if (this.testing) return;
    const tile = this.tileAt(event.clientX, event.clientY);
    this.hover = tile;
    if (kind === "down") { this.drawing = true; this.lastTile = null; }
    if (kind === "up") { this.drawing = false; this.lastTile = null; return; }
    if (!this.drawing) return;
    if (this.lastTile && this.lastTile.col === tile.col && this.lastTile.row === tile.row) return;
    this.lastTile = tile;
    this.paint(this.tool, tile.col, tile.row);
  },
  // Apply the tool to one tile. Anything already on that tile is cleared first.
  paint(tool, col, row) {
    const L = this.level;
    if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return;
    const x = col * TILE, y = row * TILE;
    const box = { x, y, w: TILE, h: TILE };
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    // Carve the tile out of any block it sits in (blocks are stored as 1-tile pieces, except the starting floor).
    L.solids = L.solids.flatMap((s) => (overlaps(s, box) ? this.splitOut(s, box) : [s]));
    L.hazards = L.hazards.filter((h) => !overlaps(h, box));
    L.movers = L.movers.filter((m) => !overlaps({ x: m.x, y: m.y, w: m.w + m.dx, h: m.h }, box));
    if (tool === "block") L.solids.push(box);
    else if (tool === "spike") L.hazards.push(box);
    else if (tool === "mover") L.movers.push({ x, y, w: TILE * 2, h: TILE, dx: 90, dy: 0, period: 3 });
    else if (tool === "start") L.start = { x: x + 4, y: y + TILE - 26 };
    else if (tool === "flag") L.flag = { x, y: Math.max(0, y - TILE), w: TILE, h: TILE * 2 };
    // "erase" has already done its work above.
    this.apply();
    this.note(this.countTiles() > this.MAX_TILES ? `Too many pieces (${this.countTiles()} of ${this.MAX_TILES}).` : "");
  },
  // Break a rectangle into 1-tile pieces, leaving out the tile being carved.
  splitOut(rect, hole) {
    const pieces = [];
    for (let x = rect.x; x < rect.x + rect.w; x += TILE) for (let y = rect.y; y < rect.y + rect.h; y += TILE) {
      if (x === hole.x && y === hole.y) continue;
      pieces.push({ x, y, w: TILE, h: TILE });
    }
    return pieces;
  },
  countTiles() { const L = this.level; return L.solids.reduce((n, s) => n + (s.w / TILE) * (s.h / TILE), 0) + L.hazards.length + L.movers.length; },

  // ---- the form ----
  fillThemes() {
    const select = document.getElementById("editor-theme");
    if (select.children.length) return;
    select.replaceChildren(...Object.keys(THEMES).map((name) => { const o = document.createElement("option"); o.value = name; o.textContent = name; return o; }));
  },
  syncForm() {
    document.getElementById("editor-name").value = this.level.name;
    document.getElementById("editor-theme").value = this.level.theme;
    document.getElementById("editor-size").value = this.level.cols === 48 ? "big" : "small";
    document.querySelectorAll("#editor-tools .tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === this.tool));
  },
  setTool(tool) { this.tool = tool; this.syncForm(); },
  setTheme(theme) { if (THEMES[theme]) { this.level.theme = theme; this.apply(); } },
  setName(name) { this.level.name = name.slice(0, 24); },
  setSize(size) {
    if (!this.SIZES[size] || this.SIZES[size].cols === this.level.cols) return;
    this.level = this.blank(this.level.name, size, this.level.theme);   // a new size starts a fresh grid
    this.syncForm(); this.apply();
  },
  clear() { this.level = this.blank(this.level.name, this.level.cols === 48 ? "big" : "small", this.level.theme); this.apply(); },
  note(text) { document.getElementById("editor-note").textContent = text; },

  // ---- saving in this browser ----
  saved() { try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]"); } catch (error) { return []; } },
  store(list) { try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list.slice(0, this.MAX_SAVED))); } catch (error) { /* ignore */ } },
  save() {
    const problem = this.validate(this.level);
    if (problem) { this.note(problem); return false; }
    const list = this.saved().filter((c) => c.name !== this.level.name);
    list.unshift(JSON.parse(JSON.stringify(this.level)));
    this.store(list);
    this.refreshList();
    this.note(`Saved "${this.level.name}". In a lobby the host can add saved courses to the room.`);
    return true;
  },
  load(name) {
    const course = this.saved().find((c) => c.name === name);
    if (!course) return;
    this.level = JSON.parse(JSON.stringify(course));
    this.syncForm(); this.apply();
    this.note(`Loaded "${name}".`);
  },
  remove(name) {
    this.store(this.saved().filter((c) => c.name !== name));
    this.refreshList();
    this.note(`Deleted "${name}".`);
  },
  refreshList() {
    const select = document.getElementById("editor-saved");
    select.replaceChildren(...[["", "Load…"], ...this.saved().map((c) => [c.name, c.name])].map(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; }));
  },

  // What makes a course acceptable (the server checks the same things).
  validate(level) {
    if (!level || typeof level.name !== "string" || !level.name.trim()) return "Give the course a name.";
    if (level.name.length > 24) return "Name too long (24 letters max).";
    if (typeof ChatFilter !== "undefined" && !ChatFilter.isClean(level.name)) return "That name isn't allowed.";
    if (!Object.values(this.SIZES).some((s) => s.cols === level.cols && s.rows === level.rows)) return "Bad course size.";
    if (!THEMES[level.theme]) return "Bad theme.";
    const W = level.cols * TILE, H = level.rows * TILE;
    const inside = (r) => Number.isFinite(r.x) && Number.isFinite(r.y) && r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H;
    if (![...level.solids, ...level.hazards, level.flag].every(inside)) return "Something is off the course.";
    if (!level.movers.every((m) => inside(m) && inside({ x: m.x + m.dx, y: m.y + m.dy, w: m.w, h: m.h }))) return "A mover slides off the course.";
    const tiles = level.solids.reduce((n, s) => n + (s.w / TILE) * (s.h / TILE), 0) + level.hazards.length + level.movers.length;
    if (tiles > this.MAX_TILES) return `Too many pieces (${tiles} of ${this.MAX_TILES}).`;
    if (!level.solids.length) return "Put down at least one block.";
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const startBox = { x: level.start.x, y: level.start.y, w: 22, h: 26 };
    if (level.solids.some((s) => overlaps(s, startBox))) return "The start is inside a block.";
    if (level.solids.some((s) => overlaps(s, level.flag))) return "The flag is inside a block.";
    if (!level.solids.some((s) => overlaps(s, { x: level.flag.x + 2, y: level.flag.y + level.flag.h, w: TILE - 4, h: 2 }))) return "The flag needs a block under it.";
    if (!level.solids.some((s) => overlaps(s, { x: startBox.x + 2, y: startBox.y + startBox.h, w: startBox.w - 4, h: 2 }))) return "The start needs a block under it.";
    return null;
  },

  // ---- test run: play the course solo, then come back ----
  test() {
    const problem = this.validate(this.level);
    if (problem) { this.note(problem); return; }
    this.testing = true;
    document.getElementById("editor").classList.add("hidden");
    document.getElementById("editor-stop").classList.remove("hidden");
    Game.mode = "solo"; Game.phase = "run"; Game.complete = false; Game._resetTimer = 0;
    Level.applyCustom(this.level);
    Player.spawn();
    Game.say("Test run! Reach the flag.", 2.5);
  },
  stopTest() { this.show(); },

  // A faint highlight on the tile under the pointer, plus the tool name.
  drawOverlay(ctx) {
    if (!this.open || this.testing || !this.hover) return;
    const { col, row } = this.hover;
    if (col < 0 || row < 0 || col >= this.level.cols || row >= this.level.rows) return;
    ctx.save();
    ctx.strokeStyle = this.tool === "erase" ? "#ff5a3c" : "#ffd23c";
    ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    const w = this.tool === "mover" ? TILE * 2 : TILE, h = this.tool === "flag" ? TILE * 2 : TILE, y = this.tool === "flag" ? (row - 1) * TILE : row * TILE;
    ctx.strokeRect(col * TILE + 1, y + 1, w - 2, h - 2);
    ctx.restore();
  },
};

// Buttons and inputs on the editor bar.
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("menu-editor").addEventListener("click", () => Editor.show());
  document.getElementById("editor-close").addEventListener("click", () => Editor.close());
  document.getElementById("editor-save").addEventListener("click", () => Editor.save());
  document.getElementById("editor-test").addEventListener("click", () => Editor.test());
  document.getElementById("editor-stop").addEventListener("click", () => Editor.stopTest());
  document.getElementById("editor-clear").addEventListener("click", () => Editor.clear());
  document.getElementById("editor-delete").addEventListener("click", () => { const name = document.getElementById("editor-saved").value; if (name) Editor.remove(name); });
  document.getElementById("editor-saved").addEventListener("change", (event) => { if (event.target.value) Editor.load(event.target.value); });
  document.getElementById("editor-name").addEventListener("input", (event) => Editor.setName(event.target.value));
  document.getElementById("editor-theme").addEventListener("change", (event) => Editor.setTheme(event.target.value));
  document.getElementById("editor-size").addEventListener("change", (event) => Editor.setSize(event.target.value));
  document.querySelectorAll("#editor-tools .tool").forEach((button) => button.addEventListener("click", () => Editor.setTool(button.dataset.tool)));
});
