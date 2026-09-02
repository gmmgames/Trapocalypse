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
  victory() {
    [523, 523, 523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, i * 0.13, i === 5 ? 0.8 : 0.16, "square", 0.14));
  },
};

// Any press anywhere wakes the audio up. Browsers need this.
window.addEventListener("pointerdown", () => Sfx.unlock());
window.addEventListener("keydown", () => Sfx.unlock());
