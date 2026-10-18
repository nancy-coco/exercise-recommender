// 운동별 16x16 픽셀 캐릭터 (SVG로 그린다)
// 그림 = 배경(scene) + 뒤 소품(behind) + 자세(pose) + 앞 소품(front)
// 격자 문자 하나가 픽셀 하나이고, "."은 투명이다

const SPRITE_SIZE = 16;

const BASE_COLORS = {
  h: "#3b2a20", // 머리카락
  s: "#f5c9a0", // 피부
  e: "#222222", // 눈
  t: "#ff6b3d", // 상의 (운동마다 바꿈)
  p: "#2f4b8f", // 하의
  f: "#333333", // 신발
  k: "#2b2b2b", // 검정 소품
  g: "#9aa0aa", // 금속
  w: "#ffffff",
  r: "#e04848", // 빨강 (글러브, 자전거 등)
  y: "#ffd23f", // 공 (운동마다 바꿈)
  o: "#f08a24",
  G: "#5cb85c",
  b: "#6ec6ff", // 물
  m: "#b58cff", // 매트
  B: "#a0703c", // 나무
  M: "#9bb59a", // 산
};

const SCENES = {
  outdoor: { sky: "#d6efff", ground: "#7cc46b" },
  indoor: { sky: "#fff4e0", ground: "#e3c9a0" },
  water: { sky: "#d6efff", ground: "#4fa8e0" },
  wall: { sky: "#ead9bb", ground: "#c9b48f" },
};

const POSES = {
  walk: [
    "................",
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hssssh.....",
    ".....sesses.....",
    "......ssss......",
    ".....tttttt.....",
    "....stttttts....",
    "...s.tttttt.s...",
    ".....pppppp.....",
    ".....pp..pp.....",
    "....pp....pp....",
    "....pp....pp....",
    "...ff......ff...",
    "................",
  ],
  run: [
    "................",
    "................",
    ".......hhhh.....",
    "......hhhhhh....",
    "......hssssh....",
    "......sesses....",
    ".......ssss.....",
    "...ss.tttttt....",
    "....ssttttttss..",
    "......tttttt.ss.",
    "......pppppp....",
    ".....ppp..ppp...",
    "...ppp......pp..",
    "..ff.........pp.",
    ".............ff.",
    "................",
  ],
  jump: [
    "...s........s...",
    "....s.hhhh.s....",
    "....shhhhhhs....",
    "....shsssshs....",
    "....tsessest....",
    "....ttsssstt....",
    ".....tttttt.....",
    ".....tttttt.....",
    ".....pppppp.....",
    "....pp....pp....",
    "...pp......pp...",
    "..ff........ff..",
    "................",
    "................",
    "................",
    "................",
  ],
  lift: [
    "................",
    "................",
    "....s......s....",
    "....s.hhhh.s....",
    "....shhhhhhs....",
    "....thssssht....",
    ".....sesses.....",
    "......ssss......",
    ".....tttttt.....",
    ".....tttttt.....",
    ".....pppppp.....",
    "....ppp..ppp....",
    "...pp......pp...",
    "...pp......pp...",
    "..fff......fff..",
    "................",
  ],
  stretch: [
    "................",
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hssssh.....",
    ".....sesses.....",
    "......ssss......",
    "ssssttttttttssss",
    ".....tttttt.....",
    ".....tttttt.....",
    ".....pppppp.....",
    "....ppp..ppp....",
    "...ppp....ppp...",
    "..ppp......ppp..",
    ".ff..........ff.",
    "................",
  ],
  sit: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hssssh.....",
    ".....sesses.....",
    "......ssss......",
    ".....tttttt.....",
    "....stttttts....",
    "...s.tttttt.s...",
    "..pppppppppppp..",
    "..ff.pppppp.ff..",
    "................",
  ],
  swim: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "........ss......",
    ".......t..s.hhh.",
    "..ffpppptttthhh.",
    "bbbbbbbbbbbbsesb",
    "bbbbbbbbbbbbbbbb",
    "bbbwbbbbbbbbbwbb",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbwbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
  ],
  bike: [
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hhssss.....",
    ".....hssses.....",
    "......ssss......",
    ".....tttt.......",
    ".....ttttts.....",
    ".....tttt..ss...",
    "....rpppp..k....",
    "..kkk.rpp..kkk..",
    ".k...kr.ppk...k.",
    ".k.g.krrffk.g.k.",
    ".k...k....k...k.",
    "..kkk......kkk..",
    "................",
  ],
  racket: [
    "................",
    "............kkk.",
    "......hhhh.k...k",
    ".....hhhhhhk...k",
    ".....hssssh.kkk.",
    ".....sesses..g..",
    "......ssss..ss..",
    "....tttttttss...",
    "...sstttttt.....",
    "..ss.tttttt.....",
    ".....pppppp.....",
    ".....pp..pp.....",
    ".....pp..pp.....",
    ".....pp..pp.....",
    "....fff..fff....",
    "................",
  ],
  punch: [
    "................",
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hhssss.....",
    ".....hssses.....",
    "......ssss......",
    ".....ttttttttrr.",
    "...rrtttttt..rr.",
    ".....tttttt.....",
    ".....pppppp.....",
    "....pp...pp.....",
    "...pp.....pp....",
    "..pp.......pp...",
    ".ff.........ff..",
    "................",
  ],
  climb: [
    "................",
    "...s........s...",
    "...s..hhhh..s...",
    "....shhhhhhs....",
    "....thhhhhht....",
    ".....hhhhhh.....",
    ".....tttttt.....",
    ".....tttttt.....",
    ".....pppppp.....",
    ".....pp..pp.....",
    "....pp....pp....",
    "...ff.....pp....",
    "..........ff....",
    "................",
    "................",
    "................",
  ],
};

// 소품은 필요한 줄만 적는다: { 줄 번호: "16글자" }
const PROPS = {
  mat: { 15: ".mmmmmmmmmmmmmm." },
  ball: { 1: ".yy.............", 2: ".yy............." },
  barbell: { 0: ".k............k.", 1: ".kggggggggggggk.", 2: ".k............k." },
  kettlebells: { 10: "..kk........kk..", 11: ".kkkk......kkkk.", 12: ".kkkk......kkkk." },
  band: { 2: ".....rrrrrr....." },
  pullupBar: Object.fromEntries(
    Array.from({ length: 15 }, (_, row) => [row + 1, row === 0 ? "gggggggggggggggg" : "g..............g"])
  ),
  rope: {
    0: "..k..........k..",
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, ".k............k."])),
    13: "..kkkkkkkkkkkk..",
  },
  notes: { 4: ".k............k.", 5: ".k...........kk.", 6: "kk...........kk.", 7: "k..............." },
  mountain: {
    3: "............w...",
    4: "...........www..",
    5: "..........MMMMM.",
    6: ".........MMMMMMM",
    7: "........MMMMMMMM",
    8: ".......MMMMMMMMM",
    9: "......MMMMMMMMMM",
    10: ".....MMMMMMMMMMM",
    11: "....MMMMMMMMMMMM",
    12: "...MMMMMMMMMMMMM",
    13: "..MMMMMMMMMMMMMM",
    14: ".MMMMMMMMMMMMMMM",
  },
  stairs: { 11: "............BBBB", 12: "............BBBB", 13: "..........BBBBBB", 14: "..........BBBBBB" },
  flag: {
    2: "...........rrrk.",
    3: "............rrk.",
    ...Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 4, "..............k."])),
  },
  bag: { 10: "............GG..", 11: "...........GGGG.", 12: "...........GGGG.", 13: "............GG.." },
  poles: {
    10: "...g.........g..",
    11: "..g..........g..",
    12: "..g...........g.",
    13: ".g............g.",
    14: ".g.............g",
  },
  wheels: { 14: "..gg............", 15: ".............gg." },
  roller: { 15: "...oooooooooo..." },
  rower: { 12: "..............kk", 13: "..............kk", 14: "..............kk", 15: "gggggggggggggggg" },
  barreBar: { 10: "BBBBBBBBBBBBBBBB" },
  screen: { 1: "...........kkkkk", 2: "...........kbbbk", 3: "...........kbbbk", 4: "...........kkkkk", 5: ".............k.." },
  sweat: { 1: "...b........b...", 2: "..b..........b.." },
  waterFront: Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [i + 10, i === 0 ? "bwbbbbbbbbbbbwbb" : "bbbbbbbbbbbbbbbb"])
  ),
  holds: {
    0: "..yy........rr..",
    4: "..............G.",
    6: ".b..............",
    8: "..............y.",
    12: "..GG............",
    13: "..........bb....",
    14: "......r.........",
  },
};

// behind: 캐릭터 뒤에 그릴 소품, front: 캐릭터 앞에 그릴 소품, colors: 색 덮어쓰기
const EXERCISE_SPRITES = {
  walking: { pose: "walk", scene: "outdoor", colors: { t: "#5cb85c" } },
  running: { pose: "run", scene: "outdoor", colors: { t: "#ff6b3d" } },
  "running-crew": { pose: "run", scene: "outdoor", colors: { t: "#2f6bff" } },
  "home-training": { pose: "lift", scene: "indoor", behind: ["mat"], colors: { t: "#ff6b3d" } },
  tabata: { pose: "jump", scene: "indoor", colors: { t: "#e04848" } },
  stretching: { pose: "sit", scene: "indoor", behind: ["mat"], colors: { t: "#3fb8b0" } },
  yoga: { pose: "stretch", scene: "indoor", behind: ["mat"], colors: { t: "#b58cff", m: "#7fd1c8" } },
  pilates: { pose: "sit", scene: "indoor", behind: ["mat"], colors: { t: "#ff8fb1" } },
  "weight-training": { pose: "lift", scene: "indoor", front: ["barbell"], colors: { t: "#555b66" } },
  crossfit: { pose: "lift", scene: "indoor", front: ["barbell"], colors: { t: "#f08a24" } },
  climbing: { pose: "climb", scene: "wall", behind: ["holds"], colors: { t: "#2f6bff" } },
  swimming: { pose: "swim", scene: "water", colors: { t: "#ff8fb1", h: "#e04848" } },
  "aqua-aerobics": { pose: "jump", scene: "water", front: ["waterFront"], colors: { t: "#ff8fb1", h: "#2f6bff" } },
  cycling: { pose: "bike", scene: "outdoor", colors: { t: "#ffd23f" } },
  "indoor-cycling": { pose: "bike", scene: "indoor", colors: { t: "#e04848", r: "#555b66" } },
  hiking: { pose: "walk", scene: "outdoor", behind: ["mountain"], colors: { t: "#f08a24" } },
  "trail-running": { pose: "run", scene: "outdoor", behind: ["mountain"], colors: { t: "#5cb85c" } },
  "jump-rope": { pose: "jump", scene: "outdoor", front: ["rope"], colors: { t: "#2f6bff" } },
  badminton: { pose: "racket", scene: "indoor", front: ["ball"], colors: { t: "#3fb8b0", y: "#ffffff" } },
  tennis: { pose: "racket", scene: "outdoor", front: ["ball"], colors: { t: "#2f6bff", y: "#d4f04a" } },
  pickleball: { pose: "racket", scene: "outdoor", front: ["ball"], colors: { t: "#ff8fb1", y: "#ffd23f" } },
  futsal: { pose: "run", scene: "outdoor", front: ["ball"], colors: { t: "#e04848", y: "#ffffff" } },
  basketball: { pose: "run", scene: "outdoor", front: ["ball"], colors: { t: "#2f6bff", y: "#f08a24" } },
  boxing: { pose: "punch", scene: "indoor", colors: { t: "#555b66" } },
  "jiu-jitsu": { pose: "punch", scene: "indoor", behind: ["mat"], colors: { t: "#f4f4f4", r: "#f5c9a0", m: "#2f6bff" } },
  "dance-fitness": { pose: "jump", scene: "indoor", front: ["notes"], colors: { t: "#ff8fb1" } },
  "kpop-dance": { pose: "jump", scene: "indoor", front: ["notes"], colors: { t: "#b58cff" } },
  barre: { pose: "stretch", scene: "indoor", behind: ["barreBar"], colors: { t: "#ff8fb1" } },
  "foam-rolling": { pose: "sit", scene: "indoor", front: ["roller"], colors: { t: "#3fb8b0" } },
  "tai-chi": { pose: "stretch", scene: "outdoor", colors: { t: "#f4f4f4" } },
  "band-workout": { pose: "lift", scene: "indoor", front: ["band"], colors: { t: "#5cb85c" } },
  kettlebell: { pose: "walk", scene: "indoor", front: ["kettlebells"], colors: { t: "#2f6bff" } },
  "stair-climbing": { pose: "walk", scene: "indoor", behind: ["stairs"], colors: { t: "#f08a24" } },
  plogging: { pose: "walk", scene: "outdoor", front: ["bag"], colors: { t: "#5cb85c" } },
  golf: { pose: "walk", scene: "outdoor", behind: ["flag"], colors: { t: "#ffd23f" } },
  "table-tennis": { pose: "racket", scene: "indoor", front: ["ball"], colors: { t: "#e04848", y: "#f08a24" } },
  "inline-skating": { pose: "run", scene: "outdoor", front: ["wheels"], colors: { t: "#b58cff" } },
  rowing: { pose: "sit", scene: "indoor", front: ["rower"], colors: { t: "#2f6bff" } },
  "outdoor-workout": { pose: "lift", scene: "outdoor", behind: ["pullupBar"], colors: { t: "#555b66" } },
  "nordic-walking": { pose: "walk", scene: "outdoor", front: ["poles"], colors: { t: "#e04848" } },
  "hot-yoga": { pose: "stretch", scene: "indoor", behind: ["mat"], front: ["sweat"], colors: { t: "#e04848", m: "#ffb36b" } },
  "park-yoga": { pose: "stretch", scene: "outdoor", behind: ["mat"], colors: { t: "#5cb85c" } },
  "calisthenics-routine": { pose: "jump", scene: "outdoor", colors: { t: "#ffd23f" } },
  "online-group-workout": { pose: "sit", scene: "indoor", behind: ["mat"], front: ["screen"], colors: { t: "#ff8fb1" } },
};

const DEFAULT_SPRITE = { pose: "walk", scene: "indoor" };

function propToRows(prop) {
  const rows = Array(SPRITE_SIZE).fill(".".repeat(SPRITE_SIZE));
  Object.entries(prop).forEach(([row, line]) => {
    rows[Number(row)] = line;
  });
  return rows;
}

// 같은 색이 가로로 이어지면 사각형 하나로 합쳐 SVG 요소 수를 줄인다
function rowsToRects(rows, colors) {
  const rects = [];
  rows.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const char = line[x];
      if (char === ".") {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < line.length && line[end] === char) end += 1;
      rects.push({ x, y, width: end - x, fill: colors[char] });
      x = end;
    }
  });
  return rects;
}

function spriteLayers(exerciseId) {
  const config = EXERCISE_SPRITES[exerciseId] ?? DEFAULT_SPRITE;
  const colors = { ...BASE_COLORS, ...config.colors };
  const layers = [
    ...(config.behind ?? []).map((name) => propToRows(PROPS[name])),
    POSES[config.pose],
    ...(config.front ?? []).map((name) => propToRows(PROPS[name])),
  ];
  return { scene: SCENES[config.scene], colors, layers };
}

function createSprite(exerciseId, label) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.classList.add("sprite");

  const { scene, colors, layers } = spriteLayers(exerciseId);
  const addRect = ({ x, y, width, height = 1, fill }) => {
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", fill);
    svg.append(rect);
  };

  addRect({ x: 0, y: 0, width: SPRITE_SIZE, height: SPRITE_SIZE - 1, fill: scene.sky });
  addRect({ x: 0, y: SPRITE_SIZE - 1, width: SPRITE_SIZE, fill: scene.ground });
  layers.forEach((rows) => rowsToRects(rows, colors).forEach(addRect));
  return svg;
}

// 결과 이미지 저장용: 캔버스에 같은 그림을 그린다 (size는 16의 배수여야 선명하다)
function drawSprite(ctx, exerciseId, x, y, size) {
  const pixel = size / SPRITE_SIZE;
  const { scene, colors, layers } = spriteLayers(exerciseId);
  ctx.fillStyle = scene.sky;
  ctx.fillRect(x, y, size, size - pixel);
  ctx.fillStyle = scene.ground;
  ctx.fillRect(x, y + size - pixel, size, pixel);
  layers.forEach((rows) =>
    rowsToRects(rows, colors).forEach((rect) => {
      ctx.fillStyle = rect.fill;
      ctx.fillRect(x + rect.x * pixel, y + rect.y * pixel, rect.width * pixel, pixel);
    })
  );
}

if (typeof module !== "undefined") {
  module.exports = { SPRITE_SIZE, BASE_COLORS, POSES, PROPS, SCENES, EXERCISE_SPRITES, spriteLayers };
}
