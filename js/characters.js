// キャラクター定義
// weight: 1 が標準、軽いほど吹っ飛ぶ
// speed:  地上の左右速度 (px/frame @60fps)
// jump:   ジャンプ初速 (上向き正)

window.CHARACTERS = [
  {
    id: "kakuto",
    name: "カクト君",
    color: "#ffb84d",
    accent: "#ff7a00",
    weight: 1.0,
    speed: 3.6,
    jump: 11,
    description: "バランス型。クセのない標準性能。",
  },
  {
    id: "speedy",
    name: "スピーディ",
    color: "#7ee0ff",
    accent: "#0090d0",
    weight: 0.8,
    speed: 4.6,
    jump: 12.5,
    description: "高速・高機動。ただし吹っ飛びやすい。",
  },
  {
    id: "heavy",
    name: "ヘビー",
    color: "#c8a0ff",
    accent: "#7030c0",
    weight: 1.35,
    speed: 2.8,
    jump: 9.5,
    description: "高耐久パワー型。動きは重いが粘り強い。",
  },
  {
    id: "skydragon",
    name: "スカイドラゴン",
    color: "#3fb87a",
    accent: "#ffa844",
    weight: 1.2,
    speed: 4.0,
    jump: 13.0,
    description: "空の支配者。重さも速さも兼ね備えたオールラウンダー。",
    draw(ctx, x, y, w, h, facing, color, accent) {
      // 本体
      ctx.fillStyle = color;
      ctx.fillRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.82);
      // 頭の角飾り
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y);
      ctx.lineTo(x + w * 0.18, y + h * 0.22);
      ctx.lineTo(x + w * 0.82, y + h * 0.22);
      ctx.closePath();
      ctx.fill();
      // 黄色のリボン模様
      ctx.fillStyle = "#ffd24a";
      ctx.fillRect(x + w * 0.1, y + h * 0.46, w * 0.8, h * 0.06);
      ctx.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.06);
      // 腹側の黄色ドット
      ctx.fillStyle = "#ffd24a";
      ctx.fillRect(x + w * 0.45, y + h * 0.58, w * 0.1, h * 0.06);
      // 目
      ctx.fillStyle = "#ff3a3a";
      const ex = facing === 1 ? x + w * 0.66 : x + w * 0.22;
      ctx.fillRect(ex, y + h * 0.27, w * 0.12, h * 0.08);
      // 牙
      ctx.fillStyle = "#fff";
      const mx = facing === 1 ? x + w * 0.78 : x + w * 0.12;
      ctx.fillRect(mx, y + h * 0.36, w * 0.1, h * 0.04);
    },
  },
  {
    id: "tanuki",
    name: "たぬき店主",
    color: "#a87545",
    accent: "#6fc88a",
    weight: 0.9,
    speed: 3.4,
    jump: 10.5,
    description: "穏やかな店主。立ち回り重視のテクニカル型。",
    draw(ctx, x, y, w, h, facing, color, accent) {
      // シャツ
      ctx.fillStyle = "#dff5e2";
      ctx.fillRect(x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.32);
      // 葉っぱ柄
      ctx.fillStyle = accent;
      ctx.fillRect(x + w * 0.18, y + h * 0.62, w * 0.1, h * 0.08);
      ctx.fillRect(x + w * 0.46, y + h * 0.7, w * 0.1, h * 0.08);
      ctx.fillRect(x + w * 0.72, y + h * 0.62, w * 0.1, h * 0.08);
      // ズボン / 足
      ctx.fillStyle = "#f0e6c8";
      ctx.fillRect(x + w * 0.15, y + h * 0.85, w * 0.7, h * 0.15);
      // 頭
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.28, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      // 耳
      ctx.beginPath();
      ctx.arc(x + w * 0.22, y + h * 0.08, w * 0.13, 0, Math.PI * 2);
      ctx.arc(x + w * 0.78, y + h * 0.08, w * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8da0";
      ctx.beginPath();
      ctx.arc(x + w * 0.22, y + h * 0.08, w * 0.06, 0, Math.PI * 2);
      ctx.arc(x + w * 0.78, y + h * 0.08, w * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // 目元の黒帯 (シグネチャ)
      ctx.fillStyle = "#3a2010";
      ctx.fillRect(x + w * 0.12, y + h * 0.22, w * 0.76, h * 0.09);
      // 白目
      ctx.fillStyle = "#fff";
      const exL = x + w * 0.3;
      const exR = x + w * 0.55;
      ctx.fillRect(exL, y + h * 0.24, w * 0.15, h * 0.06);
      ctx.fillRect(exR, y + h * 0.24, w * 0.15, h * 0.06);
      // 黒目 (向きで寄せる)
      ctx.fillStyle = "#1a3060";
      const offset = facing === 1 ? w * 0.07 : 0;
      ctx.fillRect(exL + offset, y + h * 0.25, w * 0.07, h * 0.05);
      ctx.fillRect(exR + offset, y + h * 0.25, w * 0.07, h * 0.05);
      // 鼻
      ctx.fillStyle = "#1a0a05";
      ctx.fillRect(x + w * 0.43, y + h * 0.36, w * 0.14, h * 0.06);
    },
  },
];

// 攻撃パラメータ (全キャラ共通)
// frames: 発生 / 持続 / 後隙
// damage: ダメージ%
// baseKB: 固定吹っ飛び
// kbGrowth: ダメージ依存吹っ飛び倍率
// hitbox: 攻撃判定 (キャラ前方への矩形)
window.ATTACKS = {
  jab: {
    name: "弱",
    startup: 4,
    active: 4,
    recovery: 10,
    damage: 4,
    baseKB: 2.5,
    kbGrowth: 0.05,
    angleDeg: 35, // 上向き角度
    hitbox: { dx: 28, dy: -10, w: 38, h: 30 },
    color: "#ffffff",
  },
  strong: {
    name: "強",
    startup: 12,
    active: 6,
    recovery: 22,
    damage: 12,
    baseKB: 5,
    kbGrowth: 0.14,
    angleDeg: 25,
    hitbox: { dx: 30, dy: -20, w: 60, h: 50 },
    color: "#ffd066",
  },
  special: {
    name: "必殺",
    startup: 14,
    active: 4,
    recovery: 26,
    damage: 8,
    baseKB: 4,
    kbGrowth: 0.10,
    angleDeg: 12,
    // 必殺技は飛び道具を発生させる (game.js 側で扱う)
    projectile: {
      speed: 9,
      life: 60,
      w: 22,
      h: 14,
      color: "#ff60a0",
    },
    color: "#ff60a0",
  },
};
