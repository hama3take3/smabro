// 効果音 / BGM
// 外部ファイル不要の Web Audio API による合成サウンド。
// SfxKit.sfx.<name>() で効果音、SfxKit.startBGM() / stopBGM() で BGM。
// AudioContext はブラウザの自動再生制限により最初のユーザー操作で resume する。

window.SfxKit = (() => {
  let ac = null;
  let master = null;

  function ensure() {
    if (ac) return ac;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = 0.45;
    master.connect(ac.destination);
    return ac;
  }

  function resume() {
    ensure();
    if (ac && ac.state === "suspended") ac.resume();
  }

  // ---- 基本パーツ ----
  function tone({ type = "square", f0 = 440, f1, dur = 0.1, gain = 0.2, when = 0 }) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 != null) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ filter = "bandpass", freq = 1500, Q = 1, dur = 0.1, gain = 0.3, when = 0 }) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ---- SE 一覧 ----
  const sfx = {
    jab() {
      tone({ type: "square", f0: 720, f1: 360, dur: 0.06, gain: 0.18 });
    },
    strong() {
      tone({ type: "sawtooth", f0: 540, f1: 200, dur: 0.18, gain: 0.25 });
    },
    special() {
      tone({ type: "triangle", f0: 700, f1: 1300, dur: 0.18, gain: 0.22 });
      tone({ type: "square", f0: 200, f1: 100, dur: 0.18, gain: 0.1 });
    },
    hit() {
      noise({ filter: "bandpass", freq: 900, Q: 0.6, dur: 0.12, gain: 0.45 });
      tone({ type: "square", f0: 220, f1: 90, dur: 0.1, gain: 0.18 });
    },
    bigHit() {
      noise({ filter: "lowpass", freq: 700, dur: 0.28, gain: 0.55 });
      tone({ type: "sawtooth", f0: 200, f1: 60, dur: 0.28, gain: 0.25 });
    },
    shield() {
      noise({ filter: "highpass", freq: 3500, dur: 0.07, gain: 0.25 });
      tone({ type: "triangle", f0: 1800, f1: 800, dur: 0.07, gain: 0.1 });
    },
    shieldBreak() {
      tone({ type: "square", f0: 1300, f1: 200, dur: 0.45, gain: 0.28 });
      noise({ filter: "highpass", freq: 1500, dur: 0.45, gain: 0.35 });
    },
    jump() {
      tone({ type: "triangle", f0: 360, f1: 720, dur: 0.07, gain: 0.12 });
    },
    doubleJump() {
      tone({ type: "triangle", f0: 520, f1: 980, dur: 0.07, gain: 0.12 });
    },
    ko() {
      tone({ type: "sawtooth", f0: 1400, f1: 90, dur: 0.7, gain: 0.32 });
      noise({ filter: "lowpass", freq: 400, dur: 0.7, gain: 0.2 });
    },
    cursor() {
      tone({ type: "square", f0: 600, f1: 720, dur: 0.04, gain: 0.13 });
    },
    confirm() {
      tone({ type: "square", f0: 700, f1: 1100, dur: 0.12, gain: 0.18 });
    },
    cancel() {
      tone({ type: "square", f0: 500, f1: 280, dur: 0.1, gain: 0.16 });
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) =>
        tone({ type: "triangle", f0: f, dur: 0.18, gain: 0.22, when: i * 0.13 })
      );
    },
  };

  // ---- BGM (フレーム駆動の look-ahead スケジューラ) ----
  let bgmActive = false;
  let bgmNext = 0;
  let bgmStep = 0;
  const BPM = 132;
  const BEAT = 60 / BPM;
  const SIXTEENTH = BEAT / 4;
  const ROOT = 220; // A3
  // マイナースケール基調のループ
  const ARP = [0, 7, 12, 7, 3, 10, 12, 15, 0, 7, 12, 14, 5, 12, 15, 12];
  const BASS = [0, 0, 0, 0, -4, -4, -4, -4, -7, -7, -7, -7, -5, -5, -5, -5];

  function scheduleStep(step, t) {
    // 旋律 (高音三角波)
    const a = ARP[step % ARP.length];
    const af = ROOT * Math.pow(2, a / 12);
    {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "triangle";
      o.frequency.value = af * 2;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + SIXTEENTH * 0.85);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + SIXTEENTH);
    }
    // ベース (8 分単位)
    if (step % 2 === 0) {
      const b = BASS[(step / 2) % BASS.length];
      const bf = (ROOT / 2) * Math.pow(2, b / 12);
      const o = ac.createOscillator();
      const g = ac.createGain();
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      o.type = "sawtooth";
      o.frequency.value = bf;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + SIXTEENTH * 1.7);
      o.connect(lp).connect(g).connect(master);
      o.start(t);
      o.stop(t + SIXTEENTH * 2);
    }
    // ハイハット風 (裏拍)
    if (step % 2 === 1) {
      const len = Math.floor(ac.sampleRate * 0.04);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(hp).connect(g).connect(master);
      src.start(t);
      src.stop(t + 0.05);
    }
    // キック (4 拍頭)
    if (step % 4 === 0) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.16);
    }
  }

  function startBGM() {
    if (!ensure()) return;
    if (bgmActive) return;
    bgmActive = true;
    bgmStep = 0;
    bgmNext = ac.currentTime + 0.08;
  }

  function stopBGM() {
    bgmActive = false;
  }

  function bgmUpdate() {
    if (!bgmActive || !ac) return;
    while (bgmNext < ac.currentTime + 0.18) {
      scheduleStep(bgmStep, bgmNext);
      bgmNext += SIXTEENTH;
      bgmStep++;
    }
  }

  // ユーザー操作で AudioContext 再開
  const resumeOnce = () => {
    resume();
    window.removeEventListener("keydown", resumeOnce);
    window.removeEventListener("pointerdown", resumeOnce);
  };
  window.addEventListener("keydown", resumeOnce);
  window.addEventListener("pointerdown", resumeOnce);

  return { sfx, ensure, resume, startBGM, stopBGM, bgmUpdate };
})();
