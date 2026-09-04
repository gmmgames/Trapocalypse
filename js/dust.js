// ------------------------------------------------------------
// dust.js
// Little puffs under a runner's feet: a trail while running on the
// ground, a burst on landing. Purely visual, nothing here affects
// the game rules. A "particle" is just a tiny square with a position,
// a speed, and a lifetime; we move it a little each frame and fade it
// out until it disappears.
// ------------------------------------------------------------

const Dust = {
  particles: [],
  _trailTimers: {},   // one timer per runner, so each leaves an evenly spaced trail

  // Make `count` puffs around a point on the ground. x is the center, y the ground line.
  spawn(x, y, count, spread) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y - Math.random() * 3,
        vx: (Math.random() - 0.5) * 70,
        vy: -15 - Math.random() * 35,          // negative = upward
        size: 2 + Math.random() * 3,
        age: 0,
        life: 0.3 + Math.random() * 0.25,      // seconds until it is gone
      });
    }
  },

  // Called every frame while a runner is moving on the ground. `key` tells runners apart.
  trail(key, x, y, dt) {
    this._trailTimers[key] = (this._trailTimers[key] || 0) - dt;
    if (this._trailTimers[key] > 0) return;
    this._trailTimers[key] = 0.08;
    this.spawn(x, y, 1, 10);
  },

  // Called once when a runner's feet hit the ground.
  landing(x, y) {
    this.spawn(x, y, 8, 20);
  },

  update(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt;          // puffs slow their rise and drift back down
      p.vx *= 0.9;              // and lose sideways speed
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  },

  draw(ctx) {
    ctx.fillStyle = Level.theme.dust;
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / p.life;   // fade out over its life
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },
};

// Confetti: little spinning rectangles in bright colors that pop out of a runner who
// reaches the flag, arc up, and tumble down.
const Confetti = {
  pieces: [],
  COLORS: ["#ff3c78", "#ffd23c", "#4df0ff", "#5cf05a", "#c85cff", "#ff8c1a", "#ffffff"],

  burst(x, y, accent) {
    for (let i = 0; i < 36; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;   // mostly upward
      const speed = 220 + Math.random() * 260;
      this.pieces.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 4 + Math.random() * 4, h: 3 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 12,
        angle: Math.random() * Math.PI,
        color: i % 3 === 0 && accent ? accent : this.COLORS[i % this.COLORS.length],
        age: 0, life: 1.1 + Math.random() * 0.6,
      });
    }
  },

  update(dt) {
    for (const p of this.pieces) {
      p.age += dt;
      p.vy += 900 * dt;          // gravity, lighter than the runner's
      p.vx *= 0.985;             // air drag
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
    this.pieces = this.pieces.filter((p) => p.age < p.life);
  },

  draw(ctx) {
    for (const p of this.pieces) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p.life - p.age) / 0.4);   // fade at the very end
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  },
};
