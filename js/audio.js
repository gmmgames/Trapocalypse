// ------------------------------------------------------------
// audio.js
// Sound effects made from scratch with the Web Audio API, so there
// are no sound files to download. An "oscillator" is a tiny tone
// generator: give it a frequency (pitch) and it hums. Chain a few
// together with a volume curve and you get a chime.
//
// Browsers refuse to play audio until the player has clicked or
// tapped something, so Sfx.unlock() runs on the first pointer press.
// ------------------------------------------------------------

const Sfx = {
  ctx: null,       // the AudioContext, created on first user gesture
  muted: false,

  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  // Play one note. freq in hertz, start/duration in seconds from now.
  // "type" is the wave shape: sine is soft, square is chiptune, triangle in between.
  tone(freq, start = 0, duration = 0.15, type = "triangle", volume = 0.25) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    // Volume ramps up fast then fades out, so notes do not click.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  },

  // A burst of static that drops in pitch. Used when a trap crumbles.
  noise(duration = 0.4, volume = 0.2) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(now);
  },

  // --- the actual effects the game calls ---

  // A little hop: two quick rising notes.
  jump() {
    this.tone(440, 0, 0.06, "square", 0.06);
    this.tone(660, 0.05, 0.08, "square", 0.06);
  },

  // Splat: a burst of static and a low thud.
  // Picking a color: a paint bucket splosh. A short splash of noise, a wet "glup" that
  // drops in pitch, and a bright little drip at the end.
  paint() {
    this.noise(0.3, 0.16);
    this.tone(320, 0, 0.14, "sine", 0.2);
    this.tone(180, 0.06, 0.2, "sine", 0.22);
    this.tone(120, 0.14, 0.24, "triangle", 0.16);
    this.tone(1400, 0.26, 0.06, "sine", 0.08);   // the drip
  },

  splat() {
    this.noise(0.22, 0.22);
    this.tone(110, 0, 0.18, "sawtooth", 0.18);
  },

  // Last 15 seconds of a run: a dry tick each second.
  tick() {
    this.tone(1800, 0, 0.03, "square", 0.08);
    this.tone(900, 0.02, 0.04, "square", 0.06);
  },

  // You reached the flag: a quick rising flourish.
  finish() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => this.tone(freq, i * 0.06, 0.18, "triangle", 0.16));
    this.tone(1568, 0.32, 0.4, "sine", 0.1);
  },

  // Weapons.
  dash() { this.tone(300, 0, 0.05, "sawtooth", 0.1); this.tone(900, 0.03, 0.12, "sawtooth", 0.08); },
  shieldPop() { this.tone(1200, 0, 0.08, "sine", 0.2); this.noise(0.2, 0.15); },
  freeze() { [1400, 1100, 800, 500].forEach((f, i) => this.tone(f, i * 0.07, 0.25, "sine", 0.12)); },
  boots() { this.tone(500, 0, 0.06, "square", 0.08); this.tone(750, 0.05, 0.06, "square", 0.08); this.tone(1000, 0.1, 0.1, "square", 0.08); },

  // Bumper: a springy boing.
  bump() {
    this.tone(200, 0, 0.08, "square", 0.14);
    this.tone(400, 0.06, 0.16, "triangle", 0.14);
  },

  // The clock ran out: a falling two-note buzz.
  timeUp() {
    this.tone(330, 0, 0.18, "square", 0.12);
    this.tone(220, 0.18, 0.35, "square", 0.12);
  },

  // You scored: two quick rising notes.
  score() {
    this.tone(660, 0, 0.12);
    this.tone(990, 0.1, 0.2);
  },

  // Someone else scored: one soft blip so you know without being startled.
  otherScore() {
    this.tone(520, 0, 0.1, "sine", 0.12);
  },

  // First One There: a little fanfare.
  fanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, i * 0.09, 0.22, "square", 0.12));
  },

  // Milestone (every 10 points): a longer arpeggio with a shimmer on top.
  milestone() {
    [392, 523, 659, 784, 1047, 1319].forEach((freq, i) => this.tone(freq, i * 0.08, 0.35, "triangle", 0.2));
    this.tone(2093, 0.5, 0.6, "sine", 0.08);
  },

  // A trap being erased: crunch, then a low thud.
  crumble() {
    this.noise(0.45, 0.25);
    this.tone(90, 0.25, 0.25, "sine", 0.3);
  },

  // Picking up an item.
  pickup() {
    this.tone(880, 0, 0.08, "square", 0.1);
    this.tone(1320, 0.07, 0.12, "square", 0.1);
  },

  // Match over.
  // One beat of the podium disco: a thumping kick every beat, a hi-hat tick on the off
  // beats, and a bouncing bass line that repeats every eight beats.
  discoBeat(step) {
    this.tone(70, 0, 0.12, "square", 0.22);                                   // kick
    if (step % 2 === 1) this.tone(2200, 0, 0.03, "square", 0.05);            // hi-hat
    const bass = [131, 131, 165, 131, 196, 165, 131, 98][step % 8];
    this.tone(bass, 0.02, 0.2, "sawtooth", 0.07);
  },

  victory() {
    [523, 523, 523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, i * 0.13, i === 5 ? 0.8 : 0.16, "square", 0.14));
  },
};

// Menu music: loops assets/music/menu.mp3 on the title screen. If the file is missing nothing
// plays and nothing breaks. Follows the Sounds switch.
const Music = {
  el: null,
  wanted: false,    // should it be playing right now (title screen)?
  missing: false,   // the file failed to load
  ensure() {
    if (this.el) return;
    this.el = new Audio("assets/music/menu.mp3");
    this.el.loop = true;
    this.el.volume = 0.22;   // background level: under the sound effects
    this.el.addEventListener("error", () => { this.missing = true; });
  },
  play() {
    this.wanted = true;
    this.ensure();
    if (Sfx.muted || this.missing || !this.el.paused) return;
    this.el.play().catch(() => { /* autoplay refused until a real gesture; the next press retries */ });
  },
  stop() {
    this.wanted = false;
    if (this.el) { this.el.pause(); this.el.currentTime = 0; }
  },
  refresh() {   // the Sounds switch changed
    if (this.wanted && !Sfx.muted) this.play();
    else if (this.el) this.el.pause();
  },
};

// Switching tabs or minimizing pauses the music; coming back picks it up again (if it was wanted).
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (Music.el && !Music.el.paused) Music.el.pause(); }
  else Music.refresh();
});

// Any press anywhere wakes the audio up. Browsers need this.
window.addEventListener("pointerdown", () => Sfx.unlock());
window.addEventListener("keydown", () => Sfx.unlock());
