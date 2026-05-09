// シーン管理 / メインループ

(() => {
  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // シーン: title -> select -> battle -> result(=match.over)
  let scene = "title";
  let match = null;
  // セレクト状態
  const select = {
    cursors: [0, 1], // 各プレイヤーが選んでいる index
    confirmed: [false, false],
  };

  // ----- タイトル画面 -----
  function updateTitle() {
    if (
      window.Input.pressed("Space") ||
      window.Input.pressed("Enter") ||
      window.Input.pressed("KeyZ")
    ) {
      scene = "select";
      select.cursors = [0, 1 % window.CHARACTERS.length];
      select.confirmed = [false, false];
    }
  }

  function drawTitle() {
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1130");
    g.addColorStop(1, "#1a0e2c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 星
    ctx.fillStyle = "rgba(180,200,255,0.4)";
    for (let i = 0; i < 100; i++) {
      ctx.fillRect((i * 173) % W, (i * 89) % H, 2, 2);
    }
    // タイトル
    ctx.textAlign = "center";
    ctx.fillStyle = "#9bb1ff";
    ctx.font = "bold 78px sans-serif";
    ctx.fillText("SmaBro-Web", W / 2, H / 2 - 40);
    ctx.fillStyle = "#cdd6ff";
    ctx.font = "20px sans-serif";
    ctx.fillText("ローカル 2 人対戦 プラットフォーム・ファイター", W / 2, H / 2);
    ctx.fillStyle = "#ffd24a";
    ctx.font = "bold 22px sans-serif";
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) ctx.fillText("PRESS  SPACE / ENTER", W / 2, H / 2 + 70);
    ctx.fillStyle = "#8a93c0";
    ctx.font = "14px sans-serif";
    ctx.fillText("P1: WASD + F/G/H/Space    P2: 矢印 + ;/'/Enter/RShift", W / 2, H - 40);
  }

  // ----- キャラセレクト画面 -----
  function updateSelect() {
    const I = window.Input;
    const km = window.KEYMAP;
    const n = window.CHARACTERS.length;
    for (let i = 0; i < 2; i++) {
      if (select.confirmed[i]) {
        // 確定解除
        if (I.pressed(km[i].shield)) select.confirmed[i] = false;
        continue;
      }
      if (I.pressed(km[i].left))
        select.cursors[i] = (select.cursors[i] + n - 1) % n;
      if (I.pressed(km[i].right))
        select.cursors[i] = (select.cursors[i] + 1) % n;
      if (I.pressed(km[i].jab) || I.pressed(km[i].special)) {
        select.confirmed[i] = true;
      }
    }
    // 両者確定したら開始
    if (select.confirmed[0] && select.confirmed[1]) {
      const a = window.CHARACTERS[select.cursors[0]];
      const b = window.CHARACTERS[select.cursors[1]];
      match = window.Game.newMatch(a, b);
      scene = "battle";
    }
    // R でタイトルへ
    if (I.pressed("KeyR")) scene = "title";
  }

  function drawSelect() {
    ctx.fillStyle = "#0c1230";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#9bb1ff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("CHARACTER SELECT", W / 2, 60);

    const chars = window.CHARACTERS;
    const cardW = 180,
      cardH = 220,
      gap = 30;
    const totalW = chars.length * cardW + (chars.length - 1) * gap;
    const startX = (W - totalW) / 2;
    const y = 120;

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const x = startX + i * (cardW + gap);

      ctx.fillStyle = "#1a2050";
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = "#3a4990";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardW, cardH);

      // キャラ立ち絵代わり (色矩形)
      ctx.fillStyle = c.color;
      ctx.fillRect(x + cardW / 2 - 30, y + 30, 60, 90);
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + cardW / 2 + 12, y + 50, 8, 8);

      // 名前
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(c.name, x + cardW / 2, y + 150);

      // ステータス
      ctx.fillStyle = "#aab8ff";
      ctx.font = "11px sans-serif";
      ctx.fillText(`重さ ${c.weight.toFixed(2)}`, x + cardW / 2, y + 172);
      ctx.fillText(`速さ ${c.speed.toFixed(1)}`, x + cardW / 2, y + 188);
      ctx.fillText(`跳力 ${c.jump.toFixed(1)}`, x + cardW / 2, y + 204);

      // 各プレイヤーのカーソル枠
      for (let p = 0; p < 2; p++) {
        if (select.cursors[p] === i) {
          const offset = p === 0 ? -4 : 4;
          ctx.strokeStyle = p === 0 ? "#ff8c4a" : "#5fb4ff";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + offset, y + offset, cardW - offset * 2, cardH - offset * 2);
          // ラベル
          ctx.fillStyle = p === 0 ? "#ff8c4a" : "#5fb4ff";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = p === 0 ? "left" : "right";
          ctx.fillText(
            select.confirmed[p] ? `P${p + 1} OK!` : `P${p + 1}`,
            p === 0 ? x + 8 : x + cardW - 8,
            y + 20
          );
          ctx.textAlign = "center";
        }
      }
    }

    // 説明
    ctx.fillStyle = "#cdd6ff";
    ctx.font = "14px sans-serif";
    ctx.fillText(
      "← →: 選択   弱攻撃 / 必殺で確定   シールドで取消   R: タイトル",
      W / 2,
      H - 60
    );

    // 選択中キャラの説明
    for (let p = 0; p < 2; p++) {
      const c = window.CHARACTERS[select.cursors[p]];
      ctx.fillStyle = p === 0 ? "#ff8c4a" : "#5fb4ff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = p === 0 ? "left" : "right";
      ctx.fillText(`P${p + 1}: ${c.name}`, p === 0 ? 30 : W - 30, H - 30);
      ctx.fillStyle = "#aab8ff";
      ctx.font = "12px sans-serif";
      ctx.fillText(c.description, p === 0 ? 30 : W - 30, H - 12);
    }
  }

  // ----- 対戦 -----
  function updateBattle() {
    if (!match) return;
    if (!match.over) {
      window.Game.step(match);
    } else {
      if (
        window.Input.pressed("Enter") ||
        window.Input.pressed("Space")
      ) {
        const a = window.CHARACTERS[select.cursors[0]];
        const b = window.CHARACTERS[select.cursors[1]];
        match = window.Game.newMatch(a, b);
      }
    }
    if (window.Input.pressed("KeyR")) {
      scene = "title";
      match = null;
    }
  }

  function drawBattle() {
    if (!match) return;
    window.Game.render(ctx, match);
  }

  // ----- メインループ -----
  function loop() {
    if (scene === "title") {
      updateTitle();
      drawTitle();
    } else if (scene === "select") {
      updateSelect();
      drawSelect();
    } else if (scene === "battle") {
      updateBattle();
      drawBattle();
    }
    window.Input.endFrame();
    requestAnimationFrame(loop);
  }

  // フォーカスを当ててキー入力を確実に拾う
  canvas.tabIndex = 0;
  canvas.addEventListener("click", () => canvas.focus());
  loop();
})();
