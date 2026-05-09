// キーボード入力管理
// Input.pressed(code): そのフレームに押し始めた
// Input.held(code):    押されている
// Input.released(code):そのフレームに離した
// Input.endFrame():    1 ループの最後に呼んで pressed/released をクリア

window.Input = (() => {
  const held = new Set();
  const justPressed = new Set();
  const justReleased = new Set();

  // ブラウザのデフォルト動作 (スペースでスクロール、; やシングルクォートのクイックフィルタ等) を抑制したいキー
  const PREVENT = new Set([
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
    "Quote",
    "Semicolon",
    "ShiftRight",
    "Tab",
    "Slash",
  ]);

  window.addEventListener("keydown", (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (!held.has(e.code)) justPressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener("keyup", (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    held.delete(e.code);
    justReleased.add(e.code);
  });
  window.addEventListener("blur", () => {
    held.clear();
  });

  return {
    held: (code) => held.has(code),
    pressed: (code) => justPressed.has(code),
    released: (code) => justReleased.has(code),
    endFrame() {
      justPressed.clear();
      justReleased.clear();
    },
  };
})();

// プレイヤー別のキー割り当て
window.KEYMAP = [
  {
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    down: "KeyS",
    jab: "KeyF",
    strong: "KeyG",
    special: "KeyH",
    shield: "Space",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    jab: "Semicolon",
    strong: "Quote",
    special: "Enter",
    shield: "ShiftRight",
  },
];
