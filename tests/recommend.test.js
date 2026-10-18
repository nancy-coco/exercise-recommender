// 실행: node --test tests/recommend.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { recommend, buildReason, LOW_IMPACT_ONLY } = require("../recommend.js");
const exercises = require("../data/exercises.json");
const trendsFile = require("../data/trends.json");

const trendIds = new Set(trendsFile.trends.map((trend) => trend.id));

const PURPOSES = ["다이어트", "근력", "유연성·자세", "스트레스 해소", "사람 만나기"];

// 목적은 1~3개를 고를 수 있으므로 가능한 모든 조합(5 + 10 + 10 = 25가지)
function subsets(list, maxSize) {
  const result = [];
  const walk = (start, current) => {
    if (current.length > 0) result.push([...current]);
    if (current.length === maxSize) return;
    for (let i = start; i < list.length; i += 1) walk(i + 1, [...current, list[i]]);
  };
  walk(0, []);
  return result;
}

const REQUIRED_BASE = {
  activity: ["정적·가볍게", "적당히", "동적·땀 흠뻑", "상관없음"],
  people: ["혼자", "함께", "상관없음"],
  place: ["집", "헬스장·스튜디오", "야외", "상관없음"],
  time: ["15분 이하", "30분", "1시간 이상", "상관없음"],
};
const REQUIRED = { purpose: subsets(PURPOSES, 3), ...REQUIRED_BASE };
// 세부항목 전체 조합과 곱할 때는 목적 1개짜리만 써서 테스트 시간을 줄인다
const REQUIRED_SINGLE_PURPOSE = { purpose: PURPOSES.map((purpose) => [purpose]), ...REQUIRED_BASE };

// 세부항목은 null(선택 안 함)도 포함
const DETAIL = {
  budget: [null, "무료", "장비만 구매", "월 회비 OK"],
  level: [null, "완전 입문", "운동 좀 해봄"],
  mood: [null, "경쟁·승부", "그냥 즐기기"],
  lowImpact: [null, LOW_IMPACT_ONLY, "상관없음"],
  style: [null, "같은 루틴 반복형", "매번 새로운 거 좋아하는 형"],
};

function* combinations(options) {
  const entries = Object.entries(options);
  function* walk(index, current) {
    if (index === entries.length) {
      yield { ...current };
      return;
    }
    const [key, values] = entries[index];
    for (const value of values) {
      current[key] = value;
      yield* walk(index + 1, current);
    }
  }
  yield* walk(0, {});
}

function answersOf(required, detail, trendFirst) {
  return { ...required, ...detail, trendFirst };
}

test("운동 데이터 id가 중복되지 않고, trends.json의 id는 모두 운동 데이터에 있다", () => {
  const ids = exercises.map((exercise) => exercise.id);
  assert.equal(new Set(ids).size, ids.length);
  trendIds.forEach((id) => assert.ok(ids.includes(id), `${id}가 exercises.json에 없음`));
});

function checkResults(answers) {
  const results = recommend(exercises, answers, trendIds);
  const label = JSON.stringify(answers);

  assert.equal(results.length, 3, label);
  assert.equal(new Set(results.map((r) => r.exercise.id)).size, 3, label);
  for (let i = 1; i < results.length; i += 1) {
    assert.ok(results[i - 1].score >= results[i].score, label);
  }

  results.forEach((result) => {
    if (answers.lowImpact === LOW_IMPACT_ONLY) assert.equal(result.exercise.lowImpact, true, label);
    const { main, extras } = buildReason(result, answers);
    const text = [main, ...extras].join(" ");
    assert.ok(main.length > 0, label);
    assert.ok(!/undefined|null|··|\s·|·\s/.test(text), `${label} → ${text}`);
  });
}

test("필수 질문 모든 조합(목적 1~3개 포함)에서 결과 3개가 겹치지 않고, 점수순이며, 이유 문장이 정상이다", () => {
  let checked = 0;
  for (const required of combinations(REQUIRED)) {
    for (const trendFirst of [true, false]) {
      checkResults(answersOf(required, {}, trendFirst));
      checked += 1;
    }
  }
  assert.equal(checked, 25 * 4 * 3 * 4 * 4 * 2);
});

test("세부항목 모든 조합에서도 결과와 이유 문장이 정상이다", () => {
  let checked = 0;
  for (const required of combinations(REQUIRED_SINGLE_PURPOSE)) {
    for (const detail of combinations(DETAIL)) {
      checkResults(answersOf(required, detail, true));
      checked += 1;
    }
  }
  assert.equal(checked, 5 * 4 * 3 * 4 * 4 * 324);
});

test("목적 여러 개: 하나만 맞아도 3점(쌓이지 않음), 고른 순서는 결과에 영향 없음, 이유에는 맞는 목적만", () => {
  const pilates = exercises.find((exercise) => exercise.id === "pilates"); // 목적: 유연성·자세, 근력
  const base = { activity: "상관없음", people: "상관없음", place: "상관없음", time: "상관없음", trendFirst: false };

  const [one] = recommend([pilates], { ...base, purpose: ["근력"] });
  const [two] = recommend([pilates], { ...base, purpose: ["근력", "유연성·자세", "다이어트"] });
  assert.equal(one.score, 3);
  assert.equal(two.score, 3);

  const answers = { ...base, purpose: ["다이어트", "근력", "유연성·자세"] };
  assert.equal(buildReason(two, answers).main, "근력·자세 교정 목적에 잘 맞는 운동이에요.");

  const ids = (purpose) => recommend(exercises, { ...base, purpose }, trendIds).map((r) => r.exercise.id);
  assert.deepEqual(ids(["다이어트", "근력"]), ids(["근력", "다이어트"]));
});

test("점수: 목적 3점, 필수 2점, 세부 1점, 상관없음 제외, 트렌드 +2점", () => {
  const pilates = exercises.find((exercise) => exercise.id === "pilates");
  const answers = {
    purpose: "근력", // +3
    activity: "적당히", // +2
    people: "상관없음", // 제외
    place: "집", // +2
    time: "15분 이하", // 불일치
    budget: "월 회비 OK", // +1
    level: null,
    mood: null,
    lowImpact: LOW_IMPACT_ONLY, // +1
    style: "매번 새로운 거 좋아하는 형", // 불일치
    trendFirst: true, // +2
  };
  const [result] = recommend([pilates], answers, new Set(["pilates"]));
  assert.equal(result.score, 3 + 2 + 2 + 1 + 1 + 2);
  assert.deepEqual(result.matched, ["purpose", "activity", "place", "budget", "lowImpact"]);

  const [withoutTrend] = recommend([pilates], { ...answers, trendFirst: false }, new Set(["pilates"]));
  assert.equal(withoutTrend.score, result.score - 2);
});

test("같은 답이면 몇 번을 계산해도 같은 결과가 나온다 (공유 링크용)", () => {
  const answers = {
    purpose: "사람 만나기",
    activity: "동적·땀 흠뻑",
    people: "함께",
    place: "야외",
    time: "1시간 이상",
    trendFirst: false,
  };
  const ids = () => recommend(exercises, answers, trendIds).map((r) => r.exercise.id);
  const first = ids();
  for (let i = 0; i < 5; i += 1) assert.deepEqual(ids(), first);
  // 입력 배열 순서가 바뀌어도 결과는 같아야 한다
  const reversed = recommend([...exercises].reverse(), answers, trendIds).map((r) => r.exercise.id);
  assert.deepEqual(reversed, first);
});

test("부담 제외 조건에 걸리지 않는 운동은 모두 한 번 이상 추천된다", () => {
  const recommended = new Set();
  for (const required of combinations(REQUIRED)) {
    for (const trendFirst of [true, false]) {
      recommend(exercises, answersOf(required, {}, trendFirst), trendIds).forEach((r) => recommended.add(r.exercise.id));
    }
  }
  const never = exercises.filter((exercise) => !recommended.has(exercise.id)).map((exercise) => exercise.id);
  assert.deepEqual(never, []);
});

test("추천 이유가 PRD 예시 문장 형태로 만들어진다", () => {
  const answers = {
    purpose: "다이어트",
    activity: "동적·땀 흠뻑",
    people: "혼자",
    place: "집",
    time: "15분 이하",
    trendFirst: false,
  };
  const reason = buildReason({ matched: ["purpose", "people", "place", "time"], isTrend: false }, answers);
  assert.equal(reason.main, "혼자, 집에서, 15분 안에 할 수 있는 다이어트 운동이에요.");
});

test("목적 × 활동성(상관없음 포함) 모두 운동 유형이 있고, 인원에 따라 앞말이 붙는다", () => {
  const { getExerciseType } = require("../recommend.js");
  for (const purpose of REQUIRED.purpose) {
    for (const activity of REQUIRED.activity) {
      for (const people of REQUIRED.people) {
        const type = getExerciseType({ purpose, activity, people });
        assert.ok(type, `${purpose}/${activity} 유형 없음`);
        assert.ok(type.emoji && type.desc, `${purpose}/${activity} 설명 없음`);
        assert.ok(type.title.endsWith(type.name) && type.title.length > type.name.length);
      }
    }
  }
  assert.equal(getExerciseType({ purpose: "사람 만나기", activity: "동적·땀 흠뻑", people: "함께" }).title, "함께라서 신나는 열정 팀플레이어");
  // 목적을 여러 개 고르면 처음 고른 목적으로 유형을 정한다
  assert.equal(getExerciseType({ purpose: ["근력", "다이어트"], activity: "적당히", people: "혼자" }).name, "성실한 근육 저축러");
});

test("친구와 같이 할 운동: 3개, 순서를 바꿔도 같은 결과, 둘 중 한 명이라도 부담 제외면 제외", () => {
  const { recommendTogether } = require("../recommend.js");
  const me = { purpose: "사람 만나기", activity: "동적·땀 흠뻑", people: "함께", place: "야외", time: "1시간 이상", trendFirst: true };
  const friend = { purpose: "스트레스 해소", activity: "정적·가볍게", people: "상관없음", place: "상관없음", time: "30분", lowImpact: LOW_IMPACT_ONLY, trendFirst: false };

  const ids = (results) => results.map((r) => r.exercise.id);
  const together = recommendTogether(exercises, me, friend, trendIds);
  assert.equal(together.length, 3);
  assert.deepEqual(ids(recommendTogether(exercises, friend, me, trendIds)), ids(together));
  together.forEach((r) => assert.equal(r.exercise.lowImpact, true, r.exercise.id));
});
