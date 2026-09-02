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

  // "jumpPressed" is true for ONE frame only, the moment you press.
  // That stops the player from bouncing forever while holding the key.
  jumpPressed: false,
  _jumpWasDown: false,

  // Call this once per frame from the game loop.
  update() {
    this.jumpPressed = this.jump && !this._jumpWasDown;
    this._jumpWasDown = this.jump;
  },
};

// Which keys mean what. Arrow keys AND WASD both work.
const KEY_MAP = {
  ArrowLeft: "left",  a: "left",  A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "jump",    w: "jump",  W: "jump", " ": "jump",
};

window.addEventListener("keydown", (e) => {
  // Text fields need the keyboard, especially because W/A/S/D are controls.
  if (e.target.matches("input, textarea, select")) return;
  const action = KEY_MAP[e.key];
  if (action) {
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
