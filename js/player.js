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
  GLUE_FACTOR: 0.35,   // how much of your speed you keep inside glue
  KNOCK_SPEED: 650,    // pixels per second a bumper throws you
  KNOCK_TIME: 0.3,     // seconds a bumper overrides your controls
  CRUMBLE_DELAY: 0.35, // seconds a crumbler holds after you land on it

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
  _knock: 0,           // seconds left of bumper knockback
  _knockVx: 0,         // and which way it throws us

  // Put the player back at the start, fresh.
  spawn() {
    this.x = Level.start.x;
    this.y = Level.start.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;   // every start point is on the ground, so no "landing" puff on spawn
    this.alive = true;
    this.finished = false;
    this.facing = 1;
    this._coyote = 0;
    this._buffer = 0;
    this._knock = 0;
  },

  update(dt) {
    // Crumblers that someone stepped on count down, then give way.
    for (const c of Level.hazards) {
      if (c.kind === "crumble" && c._crumbleAt !== undefined && !c._gone) {
        c._crumbleAt -= dt;
        if (c._crumbleAt <= 0) { c._gone = true; Dust.spawn(c.x + c.w / 2, c.y + c.h, 10, c.w); Sfx.crumble(); }
      }
    }
    if (!this.alive || this.finished) return;

    // 1. Sideways movement straight from input
    this.vx = 0;
    if (Input.left)  { this.vx = -this.RUN_SPEED; this.facing = -1; }
    if (Input.right) { this.vx =  this.RUN_SPEED; this.facing =  1; }

    // Glue: wading through it is slow, and you cannot jump out of it.
    const inGlue = Level.hazards.some((h) => h.kind === "glue" && Physics.overlaps(this, h));
    if (inGlue) this.vx *= this.GLUE_FACTOR;

    // A bumper's throw overrides your controls for a moment.
    if (this._knock > 0) { this._knock -= dt; this.vx = this._knockVx; }

    // 2. Jump forgiveness timers.
    //    Coyote time: a tiny grace period after leaving a ledge.
    //    Jump buffer: press slightly before landing and it still counts.
    this._coyote = this.onGround && !inGlue ? this.COYOTE_TIME : this._coyote - dt;
    this._buffer = Input.jumpPressed ? this.JUMP_BUFFER : this._buffer - dt;

    if (this._buffer > 0 && this._coyote > 0) {
      this.vy = -this.JUMP_SPEED;   // negative Y is UP on a canvas
      this._buffer = 0;
      this._coyote = 0;
      Sfx.jump();
    }

    // Let go of jump early = shorter hop. Feels much better than fixed jumps.
    if (!Input.jump && this.vy < -200) this.vy = -200;

    // 3. Move and bump into things. Crumblers count as solid until they give way.
    const wasOnGround = this.onGround;   // remembered so we can tell a landing from standing still
    const solids = Level.solids.concat(Level.hazards.filter((h) => h.kind === "crumble" && !h._gone));
    Physics.moveAndCollide(this, solids, dt);

    // Traps are checked after movement so touching a spike is immediately fatal.
    // The deadly box is a little smaller than the drawn tile (a "hitbox" is the
    // invisible rectangle used for touching), so near misses feel fair.
    for (const hazard of Level.hazards) {
      if (hazard.kind && hazard.kind !== "spike") continue;   // only spikes kill
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

    // Bumpers: touch one and it throws you away from it (and a little upward).
    if (this._knock <= 0) {
      const bumper = Level.hazards.find((h) => h.kind === "bumper" && Physics.overlaps(this, h));
      if (bumper) {
        const direction = this.x + this.w / 2 < bumper.x + bumper.w / 2 ? -1 : 1;
        this._knock = this.KNOCK_TIME;
        this._knockVx = direction * this.KNOCK_SPEED;
        this.vy = -260;
        Sfx.bump();
      }
    }

    // Crumblers: landing on one starts its countdown.
    if (this.onGround) {
      for (const c of Level.hazards) {
        if (c.kind === "crumble" && !c._gone && c._crumbleAt === undefined &&
            this.y + this.h === c.y && this.x < c.x + c.w && this.x + this.w > c.x) c._crumbleAt = this.CRUMBLE_DELAY;
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
