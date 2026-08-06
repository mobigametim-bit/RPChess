const SETTINGS_KEY = 'rpchess.shell.settings.v2';
const MUSIC_TRACKS = Object.freeze([
  'music/echoes_iron_throne_01.mp3',
  'music/echoes_iron_throne_02.mp3',
  'music/echoes_iron_throne_03.mp3',
  'music/echoes_iron_throne_04.mp3'
]);

function clamp01(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function readAudioSettings(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(SETTINGS_KEY) || '{}');
    return Object.freeze({
      masterVolume: clamp01(parsed.masterVolume, 0.62),
      musicVolume: clamp01(parsed.musicVolume, 0.38),
      sfxVolume: clamp01(parsed.sfxVolume, 0.72)
    });
  } catch (_error) {
    return Object.freeze({ masterVolume: 0.62, musicVolume: 0.38, sfxVolume: 0.72 });
  }
}

class VerticalSliceAudio {
  constructor(options = {}) {
    this.storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    this.settings = readAudioSettings(this.storage);
    this.context = null;
    this.music = typeof Audio === 'function' ? new Audio() : null;
    this.musicIndex = 0;
    this.activated = false;
    this.previousSnapshot = null;
    this.seenEvents = new Set();
    this.lastFanfareKey = null;
    this.fanfare = typeof Audio === 'function' ? new Audio('SFX/win_fanfare.mp3') : null;
    if (this.music) {
      this.music.preload = 'metadata';
      this.music.loop = false;
      this.music.addEventListener('ended', () => this.nextTrack());
      this.music.addEventListener('error', () => setTimeout(() => this.nextTrack(), 500));
      this.loadTrack();
    }
    if (this.fanfare) this.fanfare.preload = 'auto';
  }

  applySettings(settings = readAudioSettings(this.storage)) {
    this.settings = Object.freeze({
      masterVolume: clamp01(settings.masterVolume, 0.62),
      musicVolume: clamp01(settings.musicVolume, 0.38),
      sfxVolume: clamp01(settings.sfxVolume, 0.72)
    });
    if (this.music) {
      this.music.volume = this.settings.masterVolume * this.settings.musicVolume;
      this.music.muted = this.music.volume <= 0;
      if (this.activated && !this.music.muted && this.music.paused) this.music.play().catch(() => {});
      if (this.music.muted && !this.music.paused) this.music.pause();
    }
    if (this.fanfare) this.fanfare.volume = this.settings.masterVolume * this.settings.sfxVolume;
  }

  activate() {
    this.activated = true;
    this.ensureContext();
    this.applySettings(this.settings);
    if (this.music && !this.music.muted && this.music.paused) this.music.play().catch(() => {});
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
    if (this.activated && this.music && !this.music.muted) this.music.play().catch(() => {});
  }

  tone(frequency, duration = 0.08, type = 'sine', gain = 0.06, delay = 0) {
    const volume = this.settings.masterVolume * this.settings.sfxVolume;
    if (volume <= 0) return;
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const amplifier = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    amplifier.gain.setValueAtTime(Math.max(0.0001, gain * volume), start);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amplifier);
    amplifier.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  sweep(from, to, duration = 0.18, type = 'sine', gain = 0.055) {
    const volume = this.settings.masterVolume * this.settings.sfxVolume;
    if (volume <= 0) return;
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const amplifier = context.createGain();
    const start = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, from), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    amplifier.gain.setValueAtTime(Math.max(0.0001, gain * volume), start);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amplifier);
    amplifier.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  click() { this.tone(520, 0.045, 'square', 0.032); }
  move() { this.tone(270, 0.075, 'triangle', 0.05); }
  capture() { this.tone(128, 0.15, 'sawtooth', 0.075); this.tone(86, 0.17, 'triangle', 0.04, 0.035); }
  ability() { this.sweep(180, 980, 0.22, 'triangle', 0.055); }
  ward() { this.sweep(980, 360, 0.2, 'sine', 0.05); }
  check() { this.tone(92, 0.18, 'sawtooth', 0.05); this.tone(138, 0.16, 'square', 0.034, 0.09); }
  defeat() { this.sweep(320, 70, 0.45, 'sawtooth', 0.055); }

  playFanfare(key = 'victory') {
    if (!this.fanfare || this.lastFanfareKey === key || this.settings.masterVolume * this.settings.sfxVolume <= 0) return;
    this.lastFanfareKey = key;
    this.fanfare.volume = this.settings.masterVolume * this.settings.sfxVolume;
    try { this.fanfare.pause(); this.fanfare.currentTime = 0; } catch (_error) {}
    this.fanfare.play().catch(() => {
      this.tone(392, 0.18, 'triangle', 0.055);
      this.tone(523.25, 0.2, 'triangle', 0.06, 0.14);
      this.tone(659.25, 0.22, 'sine', 0.07, 0.28);
      this.tone(783.99, 0.38, 'sine', 0.075, 0.43);
    });
  }

  observe(snapshot) {
    if (!snapshot) return;
    const previous = this.previousSnapshot;
    const events = snapshot.scenario?.recentBattleEvents || [];
    for (const event of events) {
      if (!event?.id || this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id);
      if (event.type === 'PieceCaptured') this.capture();
      else if (event.type === 'PieceMoved') this.move();
      else if (event.type === 'AbilityUsed' || event.type === 'PreviewedChargeCompleted' || event.type === 'FormationAdvanced') this.ability();
      else if (event.type === 'CapturePrevented' || event.type === 'StatusApplied') this.ward();
      else if (event.type === 'KingChecked') this.check();
      else if (event.type === 'CheckmateDeclared') this.playFanfare(`mate:${event.id}`);
    }
    if (snapshot.status === 'reward' && previous?.status !== 'reward') this.playFanfare(`reward:${snapshot.currentNode?.id || snapshot.transcriptLength || Date.now()}`);
    if (snapshot.status === 'complete' && previous?.status !== 'complete') this.playFanfare(`complete:${snapshot.seed}`);
    if (snapshot.status === 'failed' && previous?.status !== 'failed') this.defeat();
    this.previousSnapshot = snapshot;
  }

  destroy() {
    this.music?.pause();
    this.fanfare?.pause();
    this.context?.close?.().catch(() => {});
  }
}

export { SETTINGS_KEY, MUSIC_TRACKS, clamp01, readAudioSettings, VerticalSliceAudio };
