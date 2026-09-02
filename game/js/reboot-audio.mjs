const MUSIC_TRACKS = Object.freeze([
  'music/echoes_iron_throne_01.mp3',
  'music/echoes_iron_throne_02.mp3',
  'music/echoes_iron_throne_03.mp3',
  'music/echoes_iron_throne_04.mp3'
]);

function clampPercent(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}

function randomMusicIndex() {
  if (MUSIC_TRACKS.length <= 1) return 0;
  return Math.floor(Math.random() * MUSIC_TRACKS.length);
}

class RebootAudio {
  constructor(settings = {}) {
    this.settings = {
      music: clampPercent(settings.music, 70),
      sfx: clampPercent(settings.sfx, 80)
    };
    this.musicIndex = randomMusicIndex();
    this.activated = false;
    this.context = null;
    this.music = typeof Audio === 'function' ? new Audio() : null;
    if (this.music) {
      this.music.preload = 'metadata';
      this.music.loop = false;
      this.music.addEventListener('ended', () => this.nextTrack());
      this.music.addEventListener('error', () => setTimeout(() => this.nextTrack(), 500));
      this.loadTrack();
      this.applySettings(this.settings);
    }
  }

  ensureContext() {
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (Context) this.context = new Context();
    }
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
    return this.context;
  }

  loadTrack() {
    if (!this.music) return;
    this.music.src = MUSIC_TRACKS[this.musicIndex % MUSIC_TRACKS.length];
    this.music.load();
  }

  nextTrack() {
    this.musicIndex = (this.musicIndex + 1) % MUSIC_TRACKS.length;
    this.loadTrack();
    if (this.activated && this.settings.music > 0) this.music?.play().catch(() => {});
  }

  activate() {
    this.activated = true;
    this.ensureContext();
    this.applySettings(this.settings);
  }

  applySettings(settings = this.settings) {
    this.settings.music = clampPercent(settings.music, this.settings.music);
    this.settings.sfx = clampPercent(settings.sfx, this.settings.sfx);
    if (!this.music) return;
    this.music.volume = Math.min(1, (this.settings.music / 100) * 0.55);
    this.music.muted = this.settings.music <= 0;
    if (this.music.muted) {
      if (!this.music.paused) this.music.pause();
    } else if (this.activated && this.music.paused) {
      this.music.play().catch(() => {});
    }
  }

  tone(frequency = 520, duration = 0.045, type = 'square', gain = 0.032) {
    if (!this.activated || this.settings.sfx <= 0) return;
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const amplifier = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    amplifier.gain.setValueAtTime(Math.max(0.0001, gain * (this.settings.sfx / 100)), now);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(amplifier);
    amplifier.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  click() { this.tone(520, 0.045, 'square', 0.032); }
  open() { this.tone(680, 0.07, 'triangle', 0.042); }
  close() { this.tone(360, 0.055, 'triangle', 0.028); }
  adjust() { this.tone(760, 0.025, 'sine', 0.018); }
  move() { this.tone(430, 0.05, 'triangle', 0.026); }
  capture() { this.tone(245, 0.085, 'triangle', 0.045); }
  check() { this.tone(720, 0.095, 'square', 0.04); }

  destroy() {
    this.music?.pause();
    this.context?.close?.().catch(() => {});
  }
}

export { MUSIC_TRACKS, RebootAudio };
