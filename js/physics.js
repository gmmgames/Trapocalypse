// ------------------------------------------------------------
// physics.js
// The math that makes things fall and stops them going through
// walls. Everything in the game is a rectangle, which makes the
// "did we hit it?" question easy.
// ------------------------------------------------------------

const Physics = {
  GRAVITY: 2000,     // pixels per second, per second. Bigger = falls faster.
  MAX_FALL: 900,     // top speed when falling so things never tunnel through floors

  // Do two rectangles overlap? Each has x, y, w (width), h (height).
  // If ANY of the four "gap" checks is true they cannot be touching.
  overlaps(a, b) {
    return !(
      a.x + a.w <= b.x ||   // a is fully to the left of b
      a.x >= b.x + b.w ||   // a is fully to the right of b
      a.y + a.h <= b.y ||   // a is fully above b
      a.y >= b.y + b.h      // a is fully below b
    );
  },

  // Move a body by its velocity and push it back out of any solid it hits.
  // We move on X first, then Y. Doing one axis at a time is the classic
  // trick that keeps corners from acting weird.
  //
  // body:   { x, y, w, h, vx, vy, onGround }
  // solids: array of rectangles you cannot pass through
  // dt:     seconds since last frame (about 0.016 at 60fps)
  moveAndCollide(body, solids, dt) {
    // --- gravity ---
    body.vy += this.GRAVITY * dt;
    if (body.vy > this.MAX_FALL) body.vy = this.MAX_FALL;

    // --- horizontal ---
    body.x += body.vx * dt;
    for (const s of solids) {
      if (this.overlaps(body, s)) {
        if (body.vx > 0) body.x = s.x - body.w;      // hit a wall on our right
        else if (body.vx < 0) body.x = s.x + s.w;    // hit a wall on our left
        body.vx = 0;
      }
    }

    // --- vertical ---
    body.onGround = false;
    body.y += body.vy * dt;
    for (const s of solids) {
      if (this.overlaps(body, s)) {
        if (body.vy > 0) {                            // landed on top of something
          body.y = s.y - body.h;
          body.onGround = true;
        } else if (body.vy < 0) {                     // bonked our head
          body.y = s.y + s.h;
        }
        body.vy = 0;
      }
    }
  },
};
