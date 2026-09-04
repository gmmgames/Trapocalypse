// ------------------------------------------------------------
// input.js
// One job: turn keyboard keys and touch buttons into three
// simple true/false values: left, right, jump.
// The rest of the game never cares HOW you pressed jump.
// ------------------------------------------------------------

const Input = {
  left: false,
  right: false,
  jump: false,
  use: false,          // the Final Battle weapon button (X or Shift, or USE on a phone)

  // "jumpPressed" is true for ONE frame only, the moment you press.
  // That stops the player from bouncing forever while holding the key.
  jumpPressed: false,
  _jumpWasDown: false,
  usePressed: false,
  _useWasDown: false,
  // A tap so quick that it starts AND ends between two frames would otherwise be
  // lost. The key handlers set these latches, and update() turns them into a press.
  _jumpQueued: false,
  _useQueued: false,

  // Call this once per frame from the game loop.
  update() {
    this.jumpPressed = (this.jump && !this._jumpWasDown) || this._jumpQueued;
    this._jumpWasDown = this.jump;
    this._jumpQueued = false;
    this.usePressed = (this.use && !this._useWasDown) || this._useQueued;
    this._useWasDown = this.use;
    this._useQueued = false;
  },
};

// Which keys mean what. Arrow keys AND WASD both work.
const KEY_MAP = {
  ArrowLeft: "left",  a: "left",  A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "jump",    w: "jump",  W: "jump", " ": "jump",
  x: "use", X: "use", Shift: "use",
};

window.addEventListener("keydown", (e) => {
  // Text fields need the keyboard, especially because W/A/S/D are controls.
  if (e.target.matches("input, textarea, select")) return;
  const action = KEY_MAP[e.key];
  if (action) {
    if (!Input[action]) {   // a fresh press (not the keyboard's auto-repeat)
      if (action === "jump") Input._jumpQueued = true;
      if (action === "use") Input._useQueued = true;
    }
    Input[action] = true;
    e.preventDefault(); // stops space bar from scrolling the page
  }
});

window.addEventListener("keyup", (e) => {
  const action = KEY_MAP[e.key];
  if (action) Input[action] = false;
});

// Touch buttons: press down = true, lift finger = false.
document.querySelectorAll(".touch-btn").forEach((btn) => {
  const action = btn.dataset.action;

  const press = (e) => {
    e.preventDefault();
    if (action === "jump") Input._jumpQueued = true;
    if (action === "use") Input._useQueued = true;
    Input[action] = true;
    btn.classList.add("pressed");
  };
  const release = (e) => {
    e.preventDefault();
    Input[action] = false;
    btn.classList.remove("pressed");
  };

  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
});
