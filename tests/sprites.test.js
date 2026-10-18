// 실행: node --test tests/sprites.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { SPRITE_SIZE, POSES, PROPS, SCENES, EXERCISE_SPRITES, spriteLayers } = require("../sprites.js");
const exercises = require("../data/exercises.json");

test("모든 운동에 픽셀 그림이 지정되어 있다", () => {
  exercises.forEach(({ id }) => assert.ok(EXERCISE_SPRITES[id], `${id} 그림 없음`));
});

test("그림 설정이 존재하는 자세·배경·소품만 쓴다", () => {
  Object.entries(EXERCISE_SPRITES).forEach(([id, config]) => {
    assert.ok(POSES[config.pose], `${id}: 자세 ${config.pose} 없음`);
    assert.ok(SCENES[config.scene], `${id}: 배경 ${config.scene} 없음`);
    [...(config.behind ?? []), ...(config.front ?? [])].forEach((name) => {
      assert.ok(PROPS[name], `${id}: 소품 ${name} 없음`);
    });
  });
});

test("모든 격자가 16x16이고 정의된 색만 쓴다", () => {
  Object.keys(EXERCISE_SPRITES).forEach((id) => {
    const { colors, layers } = spriteLayers(id);
    layers.forEach((rows) => {
      assert.equal(rows.length, SPRITE_SIZE, id);
      rows.forEach((line, y) => {
        assert.equal(line.length, SPRITE_SIZE, `${id} ${y}번째 줄: "${line}"`);
        [...line].forEach((char) => assert.ok(char === "." || colors[char], `${id}: 색 "${char}" 없음`));
      });
    });
  });
});
