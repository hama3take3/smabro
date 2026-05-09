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
