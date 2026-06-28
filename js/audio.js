/*
 * Taco-Vaidor — audio engine
 * Web Audio port of the original pygame synth (no audio files needed).
 * Every sound effect and both background-music loops are generated
 * procedurally into AudioBuffers, mirroring the Python make_tone /
 * make_pop_loop / make_classic_loop routines.
 */
(function (global) {
  "use strict";

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  const GameAudio = {
    ctx: null,
    masterGain: null, // SFX bus
    musicGain: null, // BGM bus
    volume: 0.5,
    buffers: {}, // name -> AudioBuffer (SFX)
    music: { pop: null, classic: null },
    musicSource: null,
    currentMusic: null,
    ready: false,

    /* Create the AudioContext and pre-render every buffer. Must be called
       from a user gesture (click / keypress) per browser autoplay rules. */
    init() {
      if (this.ready) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      this.ctx = new AC();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volume;
      this.musicGain.connect(this.ctx.destination);

      this._buildSfx();
      this._buildMusic();
      this.ready = true;
    },

    resume() {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },

    setVolume(v) {
      this.volume = clamp01(v);
      if (this.masterGain) this.masterGain.gain.value = this.volume;
      if (this.musicGain) this.musicGain.gain.value = this.volume;
    },

    /* ---- Tone synthesis (port of Python make_tone) ---- */
    _makeTone(freq, durationMs, volume, waveform) {
      const sr = this.ctx.sampleRate;
      const n = Math.floor((sr * durationMs) / 1000);
      const buffer = this.ctx.createBuffer(1, n, sr);
      const data = buffer.getChannelData(0);
      const fade = Math.max(1, Math.floor(0.003 * sr));
      const twoPiF = 2.0 * Math.PI * freq;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let s;
        if (waveform === "square") {
          s = Math.sin(twoPiF * t) >= 0 ? 1.0 : -1.0;
        } else if (waveform === "noise") {
          s = Math.random() * 2 - 1;
        } else {
          s = Math.sin(twoPiF * t); // sine
        }
        if (i > n - fade) s *= (n - i) / fade;
        data[i] = clamp01(volume) * s;
      }
      return buffer;
    },

    _buildSfx() {
      const T = (f, d, v, w) => this._makeTone(f, d, v, w);
      this.buffers = {
        shoot: T(880, 90, 0.45, "square"),
        hit: T(200, 110, 0.55, "noise"),
        playerhit: T(110, 220, 0.6, "noise"),
        step: T(520, 60, 0.35, "square"),
        drop: T(240, 80, 0.45, "square"),
        gameover: T(160, 900, 0.5, "sine"),
        boss_intro: T(220, 700, 0.6, "sine"),
        boss_hit: T(140, 70, 0.6, "noise"),
        boss_die: T(90, 1200, 0.7, "noise"),
        potion_spawn: T(660, 180, 0.45, "sine"),
        potion_get: T(990, 220, 0.6, "square"),
      };
    },

    /* ---- Background music (port of make_pop_loop / make_classic_loop) ---- */
    _makePopLoop(seconds) {
      const sr = this.ctx.sampleRate;
      const n = Math.floor(sr * seconds);
      const buffer = this.ctx.createBuffer(1, n, sr);
      const data = buffer.getChannelData(0);
      const sub = Math.floor(sr / 4);
      const hatLen = Math.max(1, Math.floor(sr / 8));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const beat = Math.floor((t * 130) / 60);
        const bassFreq = beat % 2 === 0 ? 110 : 165;
        const bassEnv = 0.9 * Math.max(0.0, 1.0 - (i % sub) / (sub * 0.6));
        const bass = Math.sin(2 * Math.PI * bassFreq * t) * bassEnv;
        const chordGate = beat % 4 === 0 || beat % 4 === 2 ? 0.6 : 0.2;
        const chord =
          (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 440 * t)) *
          0.25 *
          chordGate;
        const hatPhase = (i % hatLen) / hatLen;
        const hat = (Math.random() * 2 - 1) * Math.max(0, 0.18 - hatPhase) * 0.6;
        let s = (bass * 0.6 + chord * 0.8 + hat * 0.5) * 0.35;
        data[i] = Math.max(-1, Math.min(1, s));
      }
      return buffer;
    },

    _makeClassicLoop(seconds) {
      const sr = this.ctx.sampleRate;
      const n = Math.floor(sr * seconds);
      const buffer = this.ctx.createBuffer(1, n, sr);
      const data = buffer.getChannelData(0);
      const notes = [220.0, 261.63, 329.63, 392.0];
      const div = Math.max(1, Math.floor(sr / ((170 / 60) * 6)));
      const period = Math.max(1, Math.floor(sr / (170 / 60)));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const beat = Math.floor((t * 170) / 60);
        const arpIdx = Math.floor(i / div) % notes.length;
        const arp = Math.sin(2 * Math.PI * notes[arpIdx] * t) * 0.6;
        let chord = 0.0;
        if (beat % 2 === 0) {
          const stabPhase = (i % period) / period;
          const env = Math.max(0.0, 1.0 - stabPhase * 6);
          chord =
            (Math.sin(2 * Math.PI * 220 * t) +
              Math.sin(2 * Math.PI * 261.63 * t) +
              Math.sin(2 * Math.PI * 329.63 * t)) *
            0.2 *
            env;
        }
        let s = (arp + chord) * 0.35;
        data[i] = Math.max(-1, Math.min(1, s));
      }
      return buffer;
    },

    _buildMusic() {
      this.music.pop = this._makePopLoop(8);
      this.music.classic = this._makeClassicLoop(8);
    },

    /* ---- Playback ---- */
    play(name) {
      if (!this.ready) return;
      const buf = this.buffers[name];
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.masterGain);
      src.start();
    },

    playMusic(kind) {
      if (!this.ready || this.currentMusic === kind) return;
      this.stopMusic();
      const buf = this.music[kind];
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.musicGain);
      src.start();
      this.musicSource = src;
      this.currentMusic = kind;
    },

    stopMusic() {
      if (this.musicSource) {
        try {
          this.musicSource.stop();
        } catch (e) {
          /* already stopped */
        }
        this.musicSource.disconnect();
        this.musicSource = null;
      }
      this.currentMusic = null;
    },
  };

  global.GameAudio = GameAudio;
})(window);
