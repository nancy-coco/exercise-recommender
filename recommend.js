// 추천 점수 계산 (브라우저와 Node 테스트에서 함께 사용)

// 필수 항목 2점(목적 3점), 세부항목 1점
const WEIGHTS = {
  purpose: 3,
  activity: 2,
  people: 2,
  place: 2,
  time: 2,
  budget: 1,
  level: 1,
  mood: 1,
  lowImpact: 1,
  style: 1,
};

const TREND_BONUS = 2;
const ANY = "상관없음";
const LOW_IMPACT_ONLY = "관절·허리 부담 적은 운동만";

function matchesField(exercise, key, value) {
  if (key === "lowImpact") return value === LOW_IMPACT_ONLY && exercise.lowImpact === true;
  const field = exercise[key];
  return Array.isArray(field) ? field.includes(value) : field === value;
}

function scoreExercise(exercise, answers, trendIds) {
  let score = 0;
  const matched = [];

  Object.entries(WEIGHTS).forEach(([key, weight]) => {
    const value = answers[key];
    // 답하지 않았거나 "상관없음"이면 점수 계산에서 제외
    if (!value || value === ANY) return;
    if (matchesField(exercise, key, value)) {
      score += weight;
      matched.push(key);
    }
  });

  const isTrend = trendIds.has(exercise.id);
  if (answers.trendFirst && isTrend) score += TREND_BONUS;

  return { exercise, score, matched, isTrend };
}

// 문자열을 숫자로 바꾸는 간단한 해시 (FNV-1a). 같은 문자열이면 늘 같은 값이 나온다
function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function answersSeed(answers) {
  return [...Object.keys(WEIGHTS), "trendFirst"].map((key) => answers[key] ?? "").join("|");
}

function recommend(exercises, answers, trendIds = new Set(), count = 3) {
  const seed = answersSeed(answers);
  return exercises
    // "부담 적은 운동만"이면 조건에 안 맞는 운동은 아예 제외
    .filter((exercise) => answers.lowImpact !== LOW_IMPACT_ONLY || exercise.lowImpact === true)
    .map((exercise) => ({
      ...scoreExercise(exercise, answers, trendIds),
      tieBreak: hashString(`${seed}|${exercise.id}`),
    }))
    // 동점이면 답 조합으로 정해지는 순서를 쓴다
    // 같은 답에는 늘 같은 결과가 나오고, 답이 달라지면 동점 운동이 골고루 뽑힌다
    .sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak)
    .slice(0, count);
}

// 추천 이유 문장에 쓰는 표현
const CONDITION_PHRASES = {
  people: { 혼자: "혼자", 함께: "함께" },
  place: { 집: "집에서", "헬스장·스튜디오": "헬스장·스튜디오에서", 야외: "야외에서" },
  activity: { "정적·가볍게": "가볍게", 적당히: "적당한 강도로", "동적·땀 흠뻑": "땀 흠뻑 흘리며" },
  time: { "15분 이하": "15분 안에", "30분": "30분 정도", "1시간 이상": "1시간 넘게" },
};

const PURPOSE_PHRASES = {
  다이어트: "다이어트",
  근력: "근력",
  "유연성·자세": "자세 교정",
  "스트레스 해소": "스트레스 해소",
  "사람 만나기": "모임형",
};

const DETAIL_PHRASES = {
  budget: { 무료: "돈이 들지 않아요", "장비만 구매": "장비만 사면 돼요", "월 회비 OK": "회비를 내고 제대로 배울 수 있어요" },
  level: { "완전 입문": "처음이어도 괜찮아요", "운동 좀 해봄": "운동 경험이 있으면 더 재밌어요" },
  mood: { "경쟁·승부": "승부욕을 자극해요", "그냥 즐기기": "부담 없이 즐길 수 있어요" },
  lowImpact: { [LOW_IMPACT_ONLY]: "관절·허리 부담이 적어요" },
  style: { "같은 루틴 반복형": "같은 루틴으로 꾸준히 하기 좋아요", "매번 새로운 거 좋아하는 형": "매번 새로운 재미가 있어요" },
};

// 일치한 항목만으로 추천 이유를 만든다
// 예: "혼자, 집에서, 15분 안에 할 수 있는 다이어트 운동이에요."
function buildReason({ matched, isTrend }, answers) {
  const conditions = ["people", "place", "activity", "time"]
    .filter((key) => matched.includes(key))
    .map((key) => CONDITION_PHRASES[key][answers[key]]);
  const purpose = matched.includes("purpose") ? `${PURPOSE_PHRASES[answers.purpose]} ` : "";

  let main;
  if (conditions.length > 0) {
    main = `${conditions.join(", ")} 할 수 있는 ${purpose}운동이에요.`;
  } else if (purpose) {
    main = `${purpose}목적에 잘 맞는 운동이에요.`;
  } else {
    main = "고른 조건과 가장 가까운 운동이에요.";
  }

  const extras = Object.keys(DETAIL_PHRASES)
    .filter((key) => matched.includes(key))
    .map((key) => DETAIL_PHRASES[key][answers[key]]);
  if (isTrend && answers.trendFirst) extras.push("요즘 많이 찾는 운동이에요");

  return { main, extras };
}

if (typeof module !== "undefined") {
  module.exports = { WEIGHTS, TREND_BONUS, ANY, LOW_IMPACT_ONLY, scoreExercise, recommend, buildReason };
}
