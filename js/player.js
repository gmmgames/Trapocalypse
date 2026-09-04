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
  SPRING_SPEED: 1050,  // how hard a Spring launches you (a normal jump is 720)
  ICE_GRIP: 4,         // how quickly your speed catches up with your input on Ice (lower = slipperier)
  WALL_SLIDE_SPEED: 110, // top falling speed while pressed against a wall
  WALL_JUMP_VX: 340,   // sideways speed a wall jump throws you away from the wall
  WALL_JUMP_LOCK: 0.18, // seconds a wall jump overrides your left/right
  WALL_COYOTE: 0.1,    // seconds you can still wall jump after leaving the wall

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
  _shortHop: true,     // whether letting go of jump can cut the current jump short
  onWall: 0,           // set by the physics: 1 wall on the right, -1 on the left, 0 none
  _wallCoyote: 0,      // seconds left in which a wall jump is still allowed
  _wallSide: 0,        // which side that wall was on
  _wallLock: 0,        // seconds a wall jump still steers us
  _wallLockVx: 0,
  sliding: false,      // pressed against a wall and easing down it
  _iceVx: 0,           // your actual sideways speed on ice, which lags behind what you press
  _knock: 0,           // seconds left of bumper knockback
  _knockVx: 0,         // and which way it throws us

  // --- Final Battle weapon (null outside a Final Battle) ---
  //   boots    one extra jump while in the air
  //   dash     X / Shift: a short burst forward, 1.5 s cooldown
  //   shield   the first spike touch is survived
  //   freeze   X / Shift once: the other fighters freeze (the server tells everyone)
  //   bomb     X / Shift once: a spike trap appears under your feet (via the server)
  //   feather  gravity is a bit more than half
  weapon: null,
  weaponUsed: false,   // for the one-shot weapons
  gravityScale: 1,
  _boots: false,       // extra jump still available
  _dash: 0,            // seconds of dash left
  _dashCooldown: 0,
  _shield: false,
  _immune: 0,          // seconds of spike immunity after the shield pops
  frozen: 0,           // seconds left frozen by a Freeze Ray

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
    this._dash = 0; this._dashCooldown = 0; this._immune = 0; this.frozen = 0;
    this.onWall = 0; this._wallCoyote = 0; this._wallLock = 0; this.sliding = false;
    this.setWeapon(this.weapon);   // re-arm whatever we hold (nothing outside a Final Battle)
  },

  // Hand the runner a weapon (or null to take it away). Called at run start.
  setWeapon(weapon) {
    this.weapon = weapon;
    this.weaponUsed = false;
    this._boots = weapon === "boots";
    this._shield = weapon === "shield";
    this.gravityScale = weapon === "feather" ? 0.55 : 1;
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

    // Frozen by a Freeze Ray: you just stand there (gravity still applies).
    if (this.frozen > 0) {
      this.frozen -= dt;
      this.vx = 0;
      Physics.moveAndCollide(this, Level.solids, dt);
      return;
    }
    this._immune = Math.max(0, this._immune - dt);
    this._dashCooldown = Math.max(0, this._dashCooldown - dt);

    // 1. Sideways movement straight from input
    this.vx = 0;
    if (Input.left)  { this.vx = -this.RUN_SPEED; this.facing = -1; }
    if (Input.right) { this.vx =  this.RUN_SPEED; this.facing =  1; }

    // Glue: wading through it is slow, and you cannot jump out of it.
    const inGlue = Level.hazards.some((h) => h.kind === "glue" && Physics.overlaps(this, h));
    if (inGlue) this.vx *= this.GLUE_FACTOR;

    // Ice: your speed only drifts toward what you press, so you slide on after letting go.
    const onIce = this.onGround && Level.hazards.some((h) => h.kind === "ice" && Physics.overlaps(this, h));
    if (onIce) { this._iceVx += (this.vx - this._iceVx) * Math.min(1, dt * this.ICE_GRIP); this.vx = this._iceVx; }
    else this._iceVx = this.vx;

    // A bumper's throw, or a wall jump, overrides your controls for a moment.
    if (this._knock > 0) { this._knock -= dt; this.vx = this._knockVx; }
    if (this._wallLock > 0) { this._wallLock -= dt; this.vx = this._wallLockVx; }

    // Weapon button: dash, or ask the server to freeze / drop a bomb.
    if (Input.usePressed && this.weapon) {
      if (this.weapon === "dash" && this._dashCooldown <= 0) { this._dash = 0.15; this._dashCooldown = 1.5; Sfx.dash(); }
      if ((this.weapon === "freeze" || this.weapon === "bomb") && !this.weaponUsed) Game.useWeapon();
    }
    if (this._dash > 0) { this._dash -= dt; this.vx = this.facing * 900; this.vy = 0; }

    // 2. Jump forgiveness timers.
    //    Coyote time: a tiny grace period after leaving a ledge.
    //    Jump buffer: press slightly before landing and it still counts.
    this._coyote = this.onGround && !inGlue ? this.COYOTE_TIME : this._coyote - dt;
    this._buffer = Input.jumpPressed ? this.JUMP_BUFFER : this._buffer - dt;
    if (this._buffer > 0 && this._coyote > 0) {
      this.vy = -this.JUMP_SPEED;   // negative Y is UP on a canvas
      this._buffer = 0;
      this._coyote = 0;
      this._shortHop = true;        // this jump can be cut short by letting go
      Sfx.jump();
    } else if (Input.jumpPressed && !this.onGround && this._coyote <= 0 && this._wallCoyote > 0 && !inGlue) {
      // Wall jump: kick off the wall, away from it and up.
      this.vy = -this.JUMP_SPEED * 0.9;
      this._wallLock = this.WALL_JUMP_LOCK;
      this._wallLockVx = -this._wallSide * this.WALL_JUMP_VX;
      this.facing = -this._wallSide;
      this._wallCoyote = 0;
      this._shortHop = false;   // a tap is enough: the kick is never cut short
      Dust.spawn(this.x + (this._wallSide > 0 ? this.w : 0), this.y + this.h * 0.7, 6, 8);
      Sfx.jump();
    } else if (Input.jumpPressed && this._boots && !this.onGround && this._coyote <= 0) {
      // Rocket Boots: one more jump from thin air. A tap gives the full boost.
      this.vy = -this.JUMP_SPEED * 0.9;
      this._boots = false;
      this._shortHop = false;
      Dust.spawn(this.x + this.w / 2, this.y + this.h, 8, 20);
      Sfx.boots();
    }
    if (this.onGround && this.weapon === "boots") this._boots = true;   // the extra jump comes back when you land

    // Let go of jump early = shorter hop. Feels much better than fixed jumps.
    if (this._shortHop && !Input.jump && this.vy < -200 && this._dash <= 0) this.vy = -200;

    // 3. Move and bump into things. Crumblers count as solid until they give way.
    const wasOnGround = this.onGround;   // remembered so we can tell a landing from standing still
    const solids = Level.solids.concat(Level.hazards.filter((h) => h.kind === "crumble" && !h._gone));
    if (this._dash > 0) this.gravityScale = 0;   // a dash flies level
    Physics.moveAndCollide(this, solids, dt);
    if (this._dash <= 0) this.gravityScale = this.weapon === "feather" ? 0.55 : 1;

    // Wall slide: in the air, falling, pushing into a wall -> ease down it slowly,
    // and remember the wall for a moment so a wall jump still works just after letting go.
    const pushingIntoWall = (this.onWall === 1 && Input.right) || (this.onWall === -1 && Input.left);
    this.sliding = !this.onGround && this.vy > 0 && pushingIntoWall && !inGlue;
    if (this.sliding) {
      this.vy = Math.min(this.vy, this.WALL_SLIDE_SPEED);
      this._wallCoyote = this.WALL_COYOTE;
      this._wallSide = this.onWall;
      Dust.trail("wall", this.x + (this.onWall > 0 ? this.w : 0), this.y + this.h, dt);
    } else {
      this._wallCoyote -= dt;
    }

    // Traps are checked after movement so touching a spike is immediately fatal.
    // The deadly box is a little smaller than the drawn tile (a "hitbox" is the
    // invisible rectangle used for touching), so near misses feel fair.
    for (const hazard of Level.hazards) {
      if (hazard.kind && hazard.kind !== "spike") continue;   // only spikes kill
      if (this._immune > 0) break;
      const deadly = {
        x: hazard.x + this.SPIKE_INSET_SIDE,
        y: hazard.y + this.SPIKE_INSET_TOP,
        w: hazard.w - this.SPIKE_INSET_SIDE * 2,
        h: hazard.h - this.SPIKE_INSET_TOP,
      };
      if (Physics.overlaps(this, deadly)) {
        if (this._shield) {
          // The shield takes the hit: it pops, and you are safe for a moment to get clear.
          this._shield = false;
          this._immune = 0.6;
          Sfx.shieldPop();
          Game.say("Shield popped!", 1.5);
          break;
        }
        this.die(hazard);   // pass the spike along so its owner can get credit
        return;
      }
    }

    // Bumpers: touch one and it throws you straight away from its center, so the
    // angle you hit it at decides where you go. Land on top: launched up. Clip the
    // side: flung sideways. Catch the underside: slammed down.
    if (this._knock <= 0) {
      const bumper = Level.hazards.find((h) => h.kind === "bumper" && Physics.overlaps(this, h));
      if (bumper) {
        let dx = (this.x + this.w / 2) - (bumper.x + bumper.w / 2);
        let dy = (this.y + this.h / 2) - (bumper.y + bumper.h / 2);
        const length = Math.hypot(dx, dy) || 1;
        dx /= length; dy /= length;
        if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) { dx = -this.facing; dy = 0; }   // dead center: straight back
        this._knock = this.KNOCK_TIME;
        this._knockVx = dx * this.KNOCK_SPEED;
        this.vy = dy * this.KNOCK_SPEED - 120;   // a touch of lift so ground bumpers still pop you up a bit
        this._shortHop = false;                  // a throw is not a jump: letting go must not cut it short
        Sfx.bump();
      }
    }

    // Springs: step or land on one and it launches you skyward. It only fires while you are
    // moving down or standing, so the launch itself does not re-trigger it.
    if (this.vy >= 0) {
      const spring = Level.hazards.find((h) => h.kind === "spring" && Physics.overlaps(this, h));
      if (spring) {
        this.vy = -this.SPRING_SPEED;
        this.onGround = false;
        this._shortHop = false;
        Dust.spawn(spring.x + spring.w / 2, spring.y + spring.h, 10, spring.w);
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

  avatar: "cube",      // which character model you picked in the lobby

  draw(ctx) {
    if (!this.alive) return;
    drawAvatar(ctx, this.x, this.y, this.w, this.h, this.color, this.facing, this.avatar);

    // Shield: a ring. Frozen: an icy tint.
    if (this._shield || this._immune > 0) {
      ctx.strokeStyle = this._shield ? "rgba(120, 220, 255, 0.9)" : "rgba(120, 220, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 20, 0, Math.PI * 2); ctx.stroke();
    }
    if (this.frozen > 0) {
      ctx.fillStyle = "rgba(160, 230, 255, 0.55)";
      ctx.fillRect(this.x - 3, this.y - 3, this.w + 6, this.h + 6);
    }

  },
};

// Every runner is the same 22x26 box for the physics; the avatar only changes how the
// box is painted. Shared by your own runner and everyone else's.
// Every shape uses the same 22x26 hitbox; ears, horns and tails are just paint.
const AVATARS = ["cube", "ball", "wedge", "ghost", "diamond", "dino", "unicorn", "cat", "bunny", "robot"];
function drawAvatar(ctx, x, y, w, h, color, facing, avatar) {
  ctx.save();
  // Draw everything as if facing right, then mirror the whole thing when facing left.
  const cx = x + w / 2;
  if (facing === -1) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  const cy = y + h / 2, INK = "#0b0b14";
  const eyes = (eyeY, frontX, spread = 6, size = 4) => {   // two dots, the front one at frontX
    ctx.fillStyle = INK;
    ctx.fillRect(frontX, eyeY, size, size);
    ctx.fillRect(frontX - spread, eyeY, size, size);
  };
  ctx.beginPath();
  if (avatar === "ball") {
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.shadowBlur = 0; eyes(y + 7, x + 13);
  } else if (avatar === "wedge") {
    ctx.moveTo(x, y); ctx.lineTo(x + w, cy); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.fill(); ctx.shadowBlur = 0; eyes(y + h / 2 - 2, x + 11, 4);
  } else if (avatar === "ghost") {
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(cx, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w * 0.75, y + h - 5); ctx.lineTo(x + w * 0.5, y + h); ctx.lineTo(x + w * 0.25, y + h - 5); ctx.closePath();
    ctx.fill(); ctx.shadowBlur = 0; eyes(y + 7, x + 13);
  } else if (avatar === "diamond") {
    ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy); ctx.closePath();
    ctx.fill(); ctx.shadowBlur = 0; eyes(y + 9, x + 13, 5, 3);
  } else if (avatar === "dino") {
    // Stocky body, head poking forward, tail out the back, plates down the spine.
    ctx.roundRect(x, y + 8, w - 4, h - 8, 4);                       // body
    ctx.rect(x + 8, y + 2, w - 4, 11);                               // head
    ctx.moveTo(x, y + 14); ctx.lineTo(x - 6, y + 20); ctx.lineTo(x + 2, y + 22); ctx.closePath();   // tail
    for (let i = 0; i < 3; i++) { const px = x + 1 + i * 5; ctx.moveTo(px, y + 9); ctx.lineTo(px + 2.5, y + 4); ctx.lineTo(px + 5, y + 9); }   // plates
    ctx.fill(); ctx.shadowBlur = 0;
    eyes(y + 5, x + 20, 0, 3);
    ctx.fillRect(x + 18, y + 10, 8, 1.5);                            // mouth line
  } else if (avatar === "unicorn") {
    // Horse head on a chest, a swoop of mane, and a horn.
    ctx.roundRect(x, y + 10, w, h - 10, 5);                          // chest
    ctx.roundRect(x + 4, y + 4, w - 2, 13, 4);                       // head + muzzle
    ctx.moveTo(x + 2, y + 6); ctx.lineTo(x - 3, y + 14); ctx.lineTo(x + 4, y + 18); ctx.closePath();   // mane
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffe66d";                                       // golden horn
    ctx.beginPath(); ctx.moveTo(x + 9, y + 5); ctx.lineTo(x + 12, y - 5); ctx.lineTo(x + 15, y + 5); ctx.closePath(); ctx.fill();
    eyes(y + 7, x + 15, 0, 3);
    ctx.fillRect(x + 22, y + 12, 2, 2);                              // nostril
  } else if (avatar === "cat") {
    ctx.rect(x, y + 6, w, h - 6);
    ctx.moveTo(x, y + 7); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x + 8, y + 6);            // ears
    ctx.moveTo(x + w - 8, y + 6); ctx.lineTo(x + w - 3, y - 1); ctx.lineTo(x + w, y + 7);
    ctx.fill(); ctx.shadowBlur = 0;
    eyes(y + 11, x + 14, 7);
    ctx.fillStyle = INK; ctx.fillRect(x + 10, y + 16, 2, 2);          // nose
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (const wy of [16, 19]) { ctx.fillRect(x - 3, y + wy, 7, 1); ctx.fillRect(x + w - 4, y + wy, 7, 1); }   // whiskers
  } else if (avatar === "bunny") {
    ctx.roundRect(x, y + 8, w, h - 8, 5);
    ctx.roundRect(x + 3, y - 6, 6, 16, 3);                           // two tall ears
    ctx.roundRect(x + 13, y - 6, 6, 16, 3);
    ctx.fill(); ctx.shadowBlur = 0;
    eyes(y + 13, x + 14, 7, 3);
    ctx.fillStyle = "#ffb3c9"; ctx.fillRect(x + 10, y + 17, 3, 2);     // pink nose
  } else if (avatar === "robot") {
    ctx.rect(x, y + 4, w, h - 4);
    ctx.rect(cx - 1, y - 2, 2, 7);                                    // antenna
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(x + 3, y + 8, w - 6, 6);        // visor
    ctx.fillStyle = "#7dffb3"; ctx.fillRect(x + 6, y + 10, 3, 2); ctx.fillRect(x + 13, y + 10, 3, 2);   // glowing eyes
    ctx.fillStyle = INK; for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 4, y + 18, 2, 3);        // teeth
  } else {
    ctx.rect(x, y, w, h);   // the classic cube
    ctx.fill(); ctx.shadowBlur = 0; eyes(y + 7, x + 13);
  }
  ctx.restore();
}
