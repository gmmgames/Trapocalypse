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
