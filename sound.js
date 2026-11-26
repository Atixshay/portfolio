/* Sound for the portfolio: soft keyboard clicks, tap blips and optional background music.
   Browsers only allow audio after a tap/click/key press, so sound starts on the first interaction.
   Toggle it with the "sound" button in the header. Choice is remembered.
   Background music: put your file at assets/music.mp3 (next to assets/fonts/). It starts when the
   visitor first taps/clicks (e.g. "enter") and carries on, from the same spot, on the next page.
   Use a different path with data-music="/assets/yourfile.mp3" on the <script src="/sound.js"> tag. */
(() => {
  const KEY = "encorins.sound";
  const musicSrc = (document.currentScript && document.currentScript.dataset.music) || "/assets/music.mp3";
  const POS = "encorins.music.pos";
  let on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch {}
  let ctx = null, master = null, music = null, lastTick = 0;

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };

  const noiseBuf = () => {
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    return buf;
  };

  // mechanical key click
  const click = (vol = 0.22) => {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf();
    src.playbackRate.value = 0.85 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800 + Math.random() * 1400;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(170 + Math.random() * 30, t);
    og.gain.setValueAtTime(vol * 0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.06);
  };

  // soft rising blip for taps on links and buttons
  const blip = (hi = false) => {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(hi ? 740 : 520, t);
    o.frequency.exponentialRampToValueAtTime(hi ? 1100 : 780, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.14);
  };

  // ---- background music ----
  // A page change always stops audio, and browsers block autoplay on the new page until the
  // visitor taps once. So: try to play at load, and keep retrying on every tap until it is playing.
  let musicExists = null; // null = unknown, true/false after the file check
  let checking = null;
  let paintBtn = () => {};
  const isPlaying = () => !!music && !music.paused && !music.ended;

  const loadMusic = () => {
    if (checking) return checking;
    checking = fetch(musicSrc, { method: "HEAD" }).then((r) => {
      musicExists = r.ok;
      if (!r.ok) return;
      music = new Audio(musicSrc);
      music.loop = true;
      music.volume = 0.35;
      music.preload = "auto";
      let pos = 0;
      try { pos = parseFloat(sessionStorage.getItem(POS)) || 0; } catch {}
      music.addEventListener("loadedmetadata", () => { if (pos > 0 && pos < music.duration) music.currentTime = pos; }, { once: true });
      ["play", "playing", "pause", "ended", "error", "stalled"].forEach((ev) => music.addEventListener(ev, () => paintBtn()));
    }).catch(() => { musicExists = false; });
    return checking;
  };

  const startMusic = () => {
    if (!on) return;
    loadMusic().then(() => {
      if (music && music.paused) music.play().then(() => paintBtn()).catch(() => paintBtn()); // blocked: retry on next tap
    });
  };

  // remember where the music was so the next page can carry on from there
  const savePos = () => { try { if (music && music.currentTime) sessionStorage.setItem(POS, String(music.currentTime)); } catch {} };
  addEventListener("pagehide", savePos);
  setInterval(savePos, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (music) music.pause(); } else startMusic();
  });

  // button in the header
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sound-toggle";
  const paint = () => {
    const waiting = on && musicExists && !isPlaying();
    btn.textContent = !on ? "♪ sound off" : waiting ? "♪ tap for music" : "♪ sound on";
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    on = !on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
    paint();
    if (on) { ensure(); blip(true); startMusic(); }
    else if (music) music.pause();
    paint();
  });
  paint();
  paintBtn = paint;
  const nav = document.querySelector(".frame-top .switch");
  if (nav) nav.insertBefore(btn, nav.firstChild); else document.body.appendChild(btn);

  // every tap/key press is a chance to (re)start the music until it is actually playing
  const unlock = (e) => {
    if (e.target && e.target.closest && e.target.closest(".sound-toggle")) return;
    ensure();
    if (!isPlaying()) startMusic();
  };
  ["pointerup", "click", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  startMusic(); // works straight away for returning visitors; otherwise waits for the first tap

  window.addEventListener("keydown", (e) => { if (!e.repeat && e.key.length <= 12) click(); }, true);
  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".sound-toggle")) return;
    const t = e.target.closest && e.target.closest("a, button, .wheel *, .tabline");
    if (t) blip(!!t.closest(".enter, .theme-key")); else click(0.12);
  }, true);

  // typed commands (":e ~/Projects", ":colorscheme ...") tick as they appear
  new MutationObserver((muts) => {
    const now = performance.now();
    if (now - lastTick < 45) return;
    for (const m of muts) {
      const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
      if (el && el.closest && el.closest(".cmd") && (m.addedNodes.length || m.type === "characterData")) { lastTick = now; click(0.14); break; }
    }
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
})();
