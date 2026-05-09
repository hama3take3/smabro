// ゲーム本体: 物理 / 判定 / 描画
// 1024 x 576 のロジック座標で動作する。

window.Game = (() => {
  const W = 1024;
  const H = 576;

  // ステージ: メイン床 + すり抜け床 2 枚
  const STAGE = {
    main: { x: 162, y: 410, w: 700, h: 24 },
    soft: [
      { x: 200, y: 290, w: 220, h: 12 },
      { x: 604, y: 290, w: 220, h: 12 },
    ],
    blast: { left: -80, right: W + 80, top: -160, bottom: H + 160 },
  };

  const GRAVITY = 0.55;
  const MAX_FALL = 12;
  const AIR_DRAG = 0.92;
  const GROUND_FRICTION = 0.78;
  const AIR_CONTROL = 0.35;
  const SHIELD_HP_MAX = 100;
  const SHIELD_REGEN = 0.4; // /frame
  const SHIELD_DRAIN_HIT = 18;
  const RESPAWN_INVULN = 90;
  const MATCH_TIME_FRAMES = 60 * 90; // 90 秒

  // --- ユーティリティ ---
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // プレイヤーを作る
  function makePlayer(index, charDef, spawnX) {
    return {
      index,
      char: charDef,
      x: spawnX,
      y: 200,
      vx: 0,
      vy: 0,
      w: 40,
      h: 60,
      facing: index === 0 ? 1 : -1,
      onGround: false,
      jumpsLeft: 2,
      damage: 0, // %
      stocks: 3,
      // 状態: idle, attack, hitstun, shield, shieldBroken, dead, respawning
      state: "idle",
      stateTimer: 0,
      // 現在攻撃情報
      attackKey: null,
      attackPhase: null, // startup/active/recovery
      attackElapsed: 0,
      attackHitTargets: new Set(),
      // シールド
      shieldHp: SHIELD_HP_MAX,
      shielding: false,
      // 必殺技クールダウン
      specialCD: 0,
      // 無敵
      invuln: 60,
      // 死亡演出
      deadTimer: 0,
    };
  }

  function newMatch(charA, charB) {
    return {
      players: [makePlayer(0, charA, 360), makePlayer(1, charB, 664)],
      projectiles: [],
      effects: [],
      timer: MATCH_TIME_FRAMES,
      paused: false,
      over: false,
      winner: null,
      flashFrame: 0,
    };
  }

  // -------------------- 入力 --------------------
  function readInput(p, keymap) {
    const I = window.Input;
    return {
      left: I.held(keymap.left),
      right: I.held(keymap.right),
      up: I.pressed(keymap.up),
      down: I.held(keymap.down),
      jab: I.pressed(keymap.jab),
      strong: I.pressed(keymap.strong),
      special: I.pressed(keymap.special),
      shield: I.held(keymap.shield),
    };
  }

  // -------------------- 物理: ステージとの衝突 --------------------
  function applyStageCollision(p, prevY) {
    p.onGround = false;
    const platforms = [STAGE.main, ...STAGE.soft];
    for (const plat of platforms) {
      const isSoft = plat !== STAGE.main;
      // 落下中で、前フレームは床より上、現フレームは床に食い込んでいる
      const feetPrev = prevY + p.h;
      const feetNow = p.y + p.h;
      const horizontallyOverlap =
        p.x + p.w * 0.2 < plat.x + plat.w && p.x + p.w * 0.8 > plat.x;
      if (
        p.vy >= 0 &&
        horizontallyOverlap &&
        feetPrev <= plat.y + 1 &&
        feetNow >= plat.y
      ) {
        // すり抜け床は下入力で抜ける
        if (isSoft && p._wantDrop) continue;
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpsLeft = 2;
      }
    }
  }

  // -------------------- プレイヤー更新 --------------------
  function updatePlayer(p, input, opp, match) {
    if (p.state === "dead") {
      p.deadTimer--;
      if (p.deadTimer <= 0) {
        // リスポーン
        p.x = 400 + p.index * 200;
        p.y = 80;
        p.vx = 0;
        p.vy = 0;
        p.damage = 0;
        p.state = "idle";
        p.invuln = RESPAWN_INVULN;
        p.shieldHp = SHIELD_HP_MAX;
      }
      return;
    }

    if (p.invuln > 0) p.invuln--;
    if (p.specialCD > 0) p.specialCD--;

    // ヒットストップ / シールドブレイク中は操作不能
    const canAct =
      p.state !== "hitstun" &&
      p.state !== "shieldBroken" &&
      p.state !== "attack";

    // すり抜け床ドロップ用
    p._wantDrop = canAct && input.down && p.onGround;

    // シールド
    p.shielding = false;
    if (canAct && input.shield && p.onGround && p.shieldHp > 0) {
      p.shielding = true;
      p.state = "shield";
      // シールド中は移動しない (ちょっとだけ滑る)
      p.vx *= 0.6;
    } else if (p.state === "shield") {
      p.state = "idle";
    }

    // シールド回復 / 消耗
    if (!p.shielding) {
      p.shieldHp = Math.min(SHIELD_HP_MAX, p.shieldHp + SHIELD_REGEN);
    }

    // 移動
    if (canAct && !p.shielding) {
      const accel = p.onGround ? 1 : AIR_CONTROL;
      const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (target !== 0) {
        p.facing = target;
        p.vx += target * p.char.speed * 0.25 * accel;
        p.vx = clamp(p.vx, -p.char.speed, p.char.speed);
      }
      // ジャンプ
      if (input.up && p.jumpsLeft > 0) {
        p.vy = -p.char.jump;
        p.jumpsLeft--;
        // 空中ジャンプは少し速度をリセット
        if (!p.onGround) p.vx *= 0.8;
      }
      // 攻撃発動
      if (input.jab) startAttack(p, "jab");
      else if (input.strong) startAttack(p, "strong");
      else if (input.special && p.specialCD <= 0) {
        startAttack(p, "special");
        p.specialCD = 60; // 1 秒
      }
    }

    // 摩擦 / 空気抵抗
    if (p.onGround) p.vx *= GROUND_FRICTION;
    else p.vx *= AIR_DRAG;

    // 重力
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);

    // 位置更新
    const prevY = p.y;
    p.x += p.vx;
    p.y += p.vy;
    applyStageCollision(p, prevY);

    // 攻撃進行
    if (p.state === "attack") {
      p.attackElapsed++;
      const atk = window.ATTACKS[p.attackKey];
      if (p.attackElapsed === atk.startup) {
        p.attackPhase = "active";
        p.attackHitTargets.clear();
        // 必殺技は飛び道具を放出
        if (atk.projectile) {
          spawnProjectile(p, match);
        }
      }
      if (p.attackElapsed === atk.startup + atk.active) {
        p.attackPhase = "recovery";
      }
      if (p.attackElapsed >= atk.startup + atk.active + atk.recovery) {
        p.state = "idle";
        p.attackKey = null;
        p.attackPhase = null;
      }
    }

    // 状態タイマー
    if (p.state === "hitstun" || p.state === "shieldBroken") {
      p.stateTimer--;
      if (p.stateTimer <= 0) {
        p.state = "idle";
      }
    }

    // ブラストゾーン判定
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    if (
      cx < STAGE.blast.left ||
      cx > STAGE.blast.right ||
      cy < STAGE.blast.top ||
      cy > STAGE.blast.bottom
    ) {
      p.stocks--;
      p.state = "dead";
      p.deadTimer = 60;
      match.flashFrame = 8;
      // 試合終了判定は外側で
    }
  }

  function startAttack(p, key) {
    p.state = "attack";
    p.attackKey = key;
    p.attackPhase = "startup";
    p.attackElapsed = 0;
    p.attackHitTargets.clear();
  }

  // -------------------- 飛び道具 --------------------
  function spawnProjectile(p, match) {
    const atk = window.ATTACKS.special;
    const pj = atk.projectile;
    match.projectiles.push({
      x: p.x + p.w / 2 + p.facing * 30 - pj.w / 2,
      y: p.y + p.h * 0.4,
      w: pj.w,
      h: pj.h,
      vx: p.facing * pj.speed,
      vy: 0,
      life: pj.life,
      owner: p.index,
      color: pj.color,
      damage: atk.damage,
      baseKB: atk.baseKB,
      kbGrowth: atk.kbGrowth,
      angleDeg: atk.angleDeg,
      facing: p.facing,
    });
  }

  function updateProjectiles(match) {
    const survivors = [];
    for (const pj of match.projectiles) {
      pj.x += pj.vx;
      pj.life--;
      if (pj.life <= 0) continue;
      if (pj.x < -50 || pj.x > W + 50) continue;
      // 当たり判定
      let hit = false;
      for (const target of match.players) {
        if (target.index === pj.owner) continue;
        if (target.state === "dead") continue;
        if (target.invuln > 0) continue;
        const tb = { x: target.x, y: target.y, w: target.w, h: target.h };
        if (aabb(pj, tb)) {
          applyHit(target, pj, match);
          hit = true;
          break;
        }
      }
      if (!hit) survivors.push(pj);
    }
    match.projectiles = survivors;
  }

  // -------------------- 攻撃ヒット判定 --------------------
  function attackHitbox(p) {
    if (p.state !== "attack" || p.attackPhase !== "active") return null;
    const atk = window.ATTACKS[p.attackKey];
    if (!atk.hitbox) return null;
    const hb = atk.hitbox;
    const x =
      p.facing === 1
        ? p.x + p.w / 2 + hb.dx
        : p.x + p.w / 2 - hb.dx - hb.w;
    return { x, y: p.y + p.h / 2 + hb.dy, w: hb.w, h: hb.h };
  }

  function resolveAttacks(match) {
    for (const attacker of match.players) {
      const hb = attackHitbox(attacker);
      if (!hb) continue;
      const atk = window.ATTACKS[attacker.attackKey];
      if (atk.projectile) continue; // 必殺は近接判定なし (発射のみ)
      for (const target of match.players) {
        if (target === attacker) continue;
        if (target.state === "dead") continue;
        if (target.invuln > 0) continue;
        if (attacker.attackHitTargets.has(target.index)) continue;
        const tb = { x: target.x, y: target.y, w: target.w, h: target.h };
        if (aabb(hb, tb)) {
          attacker.attackHitTargets.add(target.index);
          // シールド中ならダメージ無効、シールド HP のみ削る
          if (target.shielding) {
            target.shieldHp -= SHIELD_DRAIN_HIT;
            if (target.shieldHp <= 0) {
              target.shieldHp = 0;
              target.state = "shieldBroken";
              target.stateTimer = 60;
              target.shielding = false;
            }
            spawnEffect(match, hb.x + hb.w / 2, hb.y + hb.h / 2, "#5fd0ff");
          } else {
            applyHit(target, {
              damage: atk.damage,
              baseKB: atk.baseKB,
              kbGrowth: atk.kbGrowth,
              angleDeg: atk.angleDeg,
              facing: attacker.facing,
            }, match);
          }
        }
      }
    }
  }

  function applyHit(target, hit, match) {
    target.damage += hit.damage;
    const kb =
      ((hit.baseKB + target.damage * hit.kbGrowth) / target.char.weight) * 0.55;
    const rad = (hit.angleDeg * Math.PI) / 180;
    target.vx = hit.facing * Math.cos(rad) * kb;
    target.vy = -Math.sin(rad) * kb - 1.5;
    target.state = "hitstun";
    target.stateTimer = Math.max(8, Math.floor(kb * 4));
    target.facing = -hit.facing;
    target.onGround = false;
    target.jumpsLeft = 1;
    spawnEffect(match, target.x + target.w / 2, target.y + target.h / 2, "#ffd24a");
    match.flashFrame = Math.min(6, Math.max(match.flashFrame, Math.floor(kb / 2)));
  }

  function spawnEffect(match, x, y, color) {
    match.effects.push({ x, y, life: 14, max: 14, color });
  }

  function updateEffects(match) {
    match.effects = match.effects.filter((e) => --e.life > 0);
    if (match.flashFrame > 0) match.flashFrame--;
  }

  // -------------------- 勝敗判定 --------------------
  function checkWinner(match) {
    if (match.over) return;
    match.timer--;
    const alive = match.players.filter((p) => p.stocks > 0);
    if (alive.length <= 1) {
      match.over = true;
      match.winner = alive.length === 1 ? alive[0].index : -1;
      return;
    }
    if (match.timer <= 0) {
      // ストック → ダメージ% で判定
      const [a, b] = match.players;
      if (a.stocks !== b.stocks) {
        match.winner = a.stocks > b.stocks ? 0 : 1;
      } else if (a.damage !== b.damage) {
        match.winner = a.damage < b.damage ? 0 : 1;
      } else {
        match.winner = -1;
      }
      match.over = true;
    }
  }

  // -------------------- 1 フレーム進行 --------------------
  function step(match) {
    if (match.over) return;
    const inputs = match.players.map((p, i) => readInput(p, window.KEYMAP[i]));
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i];
      const opp = match.players[1 - i];
      updatePlayer(p, inputs[i], opp, match);
    }
    resolveAttacks(match);
    updateProjectiles(match);
    updateEffects(match);
    checkWinner(match);
  }

  // -------------------- 描画 --------------------
  function drawStage(ctx) {
    // 背景グラデ
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1130");
    g.addColorStop(1, "#1a0e2c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 遠景の星
    ctx.fillStyle = "rgba(180,200,255,0.5)";
    for (let i = 0; i < 60; i++) {
      const x = (i * 137) % W;
      const y = (i * 71) % (H - 200);
      ctx.fillRect(x, y, 2, 2);
    }

    // メイン床
    drawPlatform(ctx, STAGE.main, "#3a4990", "#aab8ff");
    // すり抜け床
    for (const s of STAGE.soft) drawPlatform(ctx, s, "#374072", "#8aa0ff");
  }

  function drawPlatform(ctx, p, body, edge) {
    ctx.fillStyle = body;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = edge;
    ctx.fillRect(p.x, p.y, p.w, 3);
  }

  function drawPlayer(ctx, p) {
    if (p.state === "dead") return;
    ctx.save();

    // 無敵中点滅
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // 本体
    const baseColor = p.state === "hitstun" ? "#ff6060" : p.char.color;
    if (typeof p.char.draw === "function") {
      p.char.draw(ctx, p.x, p.y, p.w, p.h, p.facing, baseColor, p.char.accent);
    } else {
      ctx.fillStyle = baseColor;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = p.char.accent;
      const eyeX = p.facing === 1 ? p.x + p.w - 12 : p.x + 6;
      ctx.fillRect(eyeX, p.y + 12, 6, 6);
    }

    // プレイヤー番号バッジ
    ctx.fillStyle = p.index === 0 ? "#ff8c4a" : "#5fb4ff";
    ctx.fillRect(p.x + p.w / 2 - 6, p.y - 14, 12, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`P${p.index + 1}`, p.x + p.w / 2, p.y - 6);

    // シールド
    if (p.shielding) {
      ctx.beginPath();
      ctx.arc(
        p.x + p.w / 2,
        p.y + p.h / 2,
        p.w * 0.7 * (p.shieldHp / 100),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(120,200,255,0.35)";
      ctx.fill();
      ctx.strokeStyle = "rgba(180,230,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 攻撃ヒットボックス可視化
    const hb = attackHitbox(p);
    if (hb) {
      const atk = window.ATTACKS[p.attackKey];
      ctx.fillStyle = atk.color + "aa";
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    } else if (p.state === "attack" && p.attackPhase === "startup") {
      // 発生前の予兆
      const atk = window.ATTACKS[p.attackKey];
      ctx.fillStyle = atk.color + "44";
      const glow = {
        x: p.facing === 1 ? p.x + p.w : p.x - 12,
        y: p.y + 10,
        w: 12,
        h: 30,
      };
      ctx.fillRect(glow.x, glow.y, glow.w, glow.h);
    }

    // シールドブレイク中はスタンマーク
    if (p.state === "shieldBroken") {
      ctx.fillStyle = "#fff";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦", p.x + p.w / 2, p.y - 16);
    }
    ctx.restore();
  }

  function drawProjectiles(ctx, match) {
    for (const pj of match.projectiles) {
      ctx.fillStyle = pj.color;
      ctx.fillRect(pj.x, pj.y, pj.w, pj.h);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(pj.x + pj.w / 2 - 2, pj.y + pj.h / 2 - 2, 4, 4);
    }
  }

  function drawEffects(ctx, match) {
    for (const e of match.effects) {
      const t = e.life / e.max;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      const r = (1 - t) * 28 + 6;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (match.flashFrame > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.06 * match.flashFrame})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawHUD(ctx, match) {
    // 上部バー
    ctx.fillStyle = "rgba(8,12,30,0.8)";
    ctx.fillRect(0, 0, W, 70);

    // タイマー
    const t = Math.max(0, match.timer);
    const sec = Math.ceil(t / 60);
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    ctx.fillStyle = "#e8ecff";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${mm}:${ss}`, W / 2, 42);

    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i];
      const baseX = i === 0 ? 30 : W - 270;
      const accent = i === 0 ? "#ff8c4a" : "#5fb4ff";

      // 背景
      ctx.fillStyle = "rgba(40,50,90,0.6)";
      ctx.fillRect(baseX, 8, 240, 56);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(baseX, 8, 240, 56);

      // P番号 + キャラ名
      ctx.fillStyle = accent;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`P${i + 1}`, baseX + 10, 26);
      ctx.fillStyle = "#e8ecff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(p.char.name, baseX + 36, 26);

      // ダメージ%
      const pct = Math.floor(p.damage);
      const tone = pct < 50 ? "#e8ecff" : pct < 100 ? "#ffd54a" : pct < 150 ? "#ff8c4a" : "#ff4a4a";
      ctx.fillStyle = tone;
      ctx.font = "bold 26px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${pct}%`, baseX + 230, 50);

      // ストックアイコン
      ctx.textAlign = "left";
      for (let s = 0; s < p.stocks; s++) {
        ctx.fillStyle = p.char.color;
        ctx.fillRect(baseX + 10 + s * 14, 44, 10, 10);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(baseX + 10 + s * 14, 44, 10, 10);
      }
    }
  }

  function drawResult(ctx, match) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px sans-serif";
    if (match.winner === -1) {
      ctx.fillText("DRAW", W / 2, H / 2 - 10);
    } else {
      const w = match.players[match.winner];
      ctx.fillStyle = w.char.color;
      ctx.fillText(`P${match.winner + 1} WIN!`, W / 2, H / 2 - 10);
      ctx.fillStyle = "#cdd6ff";
      ctx.font = "20px sans-serif";
      ctx.fillText(w.char.name, W / 2, H / 2 + 24);
    }
    ctx.fillStyle = "#9bb1ff";
    ctx.font = "16px sans-serif";
    ctx.fillText("Enter / Space: もう一度    R: タイトルへ", W / 2, H / 2 + 80);
  }

  function render(ctx, match) {
    drawStage(ctx);
    drawProjectiles(ctx, match);
    for (const p of match.players) drawPlayer(ctx, p);
    drawEffects(ctx, match);
    drawHUD(ctx, match);
    if (match.over) drawResult(ctx, match);
  }

  return { newMatch, step, render, W, H };
})();
