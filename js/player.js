// ------------------------------------------------------------
// player.js
// The runner. A little glowing square with feelings.
// Try changing the numbers at the top and see what happens.
// ------------------------------------------------------------

const Player = {
  // --- tuning knobs ---
  RUN_SPEED: 260,      // pixels per second sideways
  JUMP_SPEED: 720,     // how hard we launch upward (bigger = higher jump)
  COYOTE_TIME: 0.08,   // seconds you can still jump after walking off an edge
  JUMP_BUFFER: 0.10,   // seconds a jump press is "remembered" before landing
  SPIKE_INSET_SIDE: 4, // pixels shaved off each side of a spike's deadly area
  SPIKE_INSET_TOP: 6,  // pixels shaved off the top, so grazing the tips is not a death

  // --- the body the physics engine moves ---
  x: 0, y: 0, w: 22, h: 26,
  vx: 0, vy: 0,
  onGround: false,

  // --- state ---
  color: "#ff3c78",    // body color; online mode sets this to the color you picked
  facing: 1,           // 1 = right, -1 = left
  alive: true,
  finished: false,
  _coyote: 0,
  _buffer: 0,

  // Put the player back at the start, fresh.
  spawn() {
    this.x = Level.start.x;
    this.y = Level.start.y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
    this.finished = false;
    this.facing = 1;
    this._coyote = 0;
    this._buffer = 0;
  },

  update(dt) {
    if (!this.alive || this.finished) return;

    // 1. Sideways movement straight from input
    this.vx = 0;
    if (Input.left)  { this.vx = -this.RUN_SPEED; this.facing = -1; }
    if (Input.right) { this.vx =  this.RUN_SPEED; this.facing =  1; }

    // 2. Jump forgiveness timers.
    //    Coyote time: a tiny grace period after leaving a ledge.
    //    Jump buffer: press slightly before landing and it still counts.
    this._coyote = this.onGround ? this.COYOTE_TIME : this._coyote - dt;
    this._buffer = Input.jumpPressed ? this.JUMP_BUFFER : this._buffer - dt;

    if (this._buffer > 0 && this._coyote > 0) {
      this.vy = -this.JUMP_SPEED;   // negative Y is UP on a canvas
      this._buffer = 0;
      this._coyote = 0;
    }

    // Let go of jump early = shorter hop. Feels much better than fixed jumps.
    if (!Input.jump && this.vy < -200) this.vy = -200;

    // 3. Move and bump into things
    const wasOnGround = this.onGround;   // remembered so we can tell a landing from standing still
    Physics.moveAndCollide(this, Level.solids, dt);

    // Traps are checked after movement so touching a spike is immediately fatal.
    // The deadly box is a little smaller than the drawn tile (a "hitbox" is the
    // invisible rectangle used for touching), so near misses feel fair.
    for (const hazard of Level.hazards) {
      const deadly = {
        x: hazard.x + this.SPIKE_INSET_SIDE,
        y: hazard.y + this.SPIKE_INSET_TOP,
        w: hazard.w - this.SPIKE_INSET_SIDE * 2,
        h: hazard.h - this.SPIKE_INSET_TOP,
      };
      if (Physics.overlaps(this, deadly)) {
        this.die(hazard);   // pass the spike along so its owner can get credit
        return;
      }
    }

    // 4. Keep inside the left and right edges of the level
    if (this.x < 0) this.x = 0;
    if (this.x + this.w > LEVEL_W) this.x = LEVEL_W - this.w;

    // 5. Fell off the bottom? That is a death.
    if (this.y > LEVEL_H + 100) { this.die(); return; }

    // 6. Dust under our feet. We only get here if the spikes didn't get us,
    //    so a landing on spikes never puffs (the spike check above returned).
    const feetX = this.x + this.w / 2, feetY = this.y + this.h;
    if (this.onGround && !wasOnGround) Dust.landing(feetX, feetY);
    else if (this.onGround && this.vx !== 0) Dust.trail("me", feetX, feetY, dt);

    // 7. Touched the flag? Victory.
    if (Physics.overlaps(this, Level.flag)) this.finish();
  },

  // hazard is the spike that got us, or nothing if we fell off the bottom.
  die(hazard = null) {
    this.alive = false;
    Game.onPlayerDied(hazard);
  },

  finish() {
    this.finished = true;
    Game.onPlayerFinished();
  },

  draw(ctx) {
    if (!this.alive) return;

    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.shadowBlur = 0;

    // Two little eyes that look where you are going
    ctx.fillStyle = "#0b0b14";
    const eyeX = this.facing === 1 ? this.x + 13 : this.x + 5;
    ctx.fillRect(eyeX, this.y + 7, 4, 4);
    ctx.fillRect(eyeX + (this.facing === 1 ? -6 : 6), this.y + 7, 4, 4);
  },
};
