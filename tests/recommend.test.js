// 실행: node --test tests/recommend.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { recommend, buildReason, LOW_IMPACT_ONLY } = require("../recommend.js");
const exercises = require("../data/exercises.json");
const trendsFile = require("../data/trends.json");

const trendIds = new Set(trendsFile.trends.map((trend) => trend.id));

const REQUIRED = {
  purpose: ["다이어트", "근력", "유연성·자세", "스트레스 해소", "사람 만나기"],
  activity: ["정적·가볍게", "적당히", "동적·땀 흠뻑"],
  people: ["혼자", "함께", "상관없음"],
  place: ["집", "헬스장·스튜디오", "야외", "상관없음"],
  time: ["15분 이하", "30분", "1시간 이상"],
};

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

test("모든 답 조합에서 결과 3개가 겹치지 않고, 점수순이며, 이유 문장이 정상이다", () => {
  let checked = 0;
  for (const required of combinations(REQUIRED)) {
    for (const detail of combinations(DETAIL)) {
      for (const trendFirst of [true, false]) {
        const answers = answersOf(required, detail, trendFirst);
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
          assert.ok(!/undefined|null/.test(text), `${label} → ${text}`);
        });
        checked += 1;
      }
    }
  }
  assert.equal(checked, 540 * 324 * 2);
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
