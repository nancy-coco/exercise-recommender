// 주 1회 실행: newsdata.io에서 운동별 최근 한국어 뉴스 수를 세어 data/trends.json을 만든다
// 실행: node --env-file=.env scripts/update-trends.js   (GitHub Actions에서는 Secrets로 키를 넣는다)
// 호출이 하나라도 실패하면 기존 trends.json을 그대로 두고 실패로 끝낸다

const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://newsdata.io/api/1/latest";
const EXERCISES_PATH = path.join(__dirname, "..", "data", "exercises.json");
const TRENDS_PATH = path.join(__dirname, "..", "data", "trends.json");
const TOP_COUNT = 5;
const REQUEST_GAP_MS = 300;
const MAX_QUERY_LENGTH = 100; // 무료 플랜의 검색어 길이 제한

// 운동별 검색어. 다른 뜻으로 많이 쓰이는 단어는 피한다 (예: "러닝" → 머신러닝, "바레" → 바레인)
const TREND_KEYWORDS = {
  walking: ["걷기", "맨발걷기"],
  running: ["달리기", "마라톤"],
  "running-crew": ['"러닝 크루"', "러닝크루"],
  "home-training": ["홈트", "홈트레이닝"],
  tabata: ["타바타", '"인터벌 운동"'],
  stretching: ["스트레칭"],
  yoga: ["요가"],
  pilates: ["필라테스"],
  "weight-training": ['"웨이트 트레이닝"', "웨이트트레이닝"],
  crossfit: ["크로스핏"],
  climbing: ["클라이밍", "볼더링"],
  swimming: ["수영"],
  "aqua-aerobics": ["아쿠아로빅"],
  cycling: ["자전거", "라이딩"],
  "indoor-cycling": ["스피닝", '"실내 사이클"'],
  hiking: ["등산"],
  "trail-running": ['"트레일 러닝"', "트레일러닝"],
  "jump-rope": ["줄넘기"],
  badminton: ["배드민턴"],
  tennis: ["테니스"],
  pickleball: ["피클볼"],
  futsal: ["풋살"],
  basketball: ["농구"],
  boxing: ["복싱"],
  "jiu-jitsu": ["주짓수"],
  "dance-fitness": ["줌바", '"댄스 피트니스"'],
  "kpop-dance": ["커버댄스", '"댄스 챌린지"'],
  barre: ['"바레 운동"', "발레핏"],
  "foam-rolling": ["폼롤러"],
  "tai-chi": ["태극권"],
  "band-workout": ['"밴드 운동"', "탄력밴드"],
  kettlebell: ["케틀벨"],
  "stair-climbing": ['"계단 오르기"', "계단운동"],
  plogging: ["플로깅"],
  golf: ["스크린골프", "파크골프", '"골프 입문"'],
  "table-tennis": ["탁구"],
  "inline-skating": ["인라인스케이트", '"인라인 스케이트"'],
  rowing: ["로잉머신", '"로잉 머신"'],
  "outdoor-workout": ["맨몸운동", "철봉"],
  "nordic-walking": ['"노르딕 워킹"', "노르딕워킹"],
  "hot-yoga": ["핫요가"],
  "park-yoga": ['"야외 요가"', '"공원 요가"'],
  "calisthenics-routine": ["맨손체조", "국민체조"],
  "online-group-workout": ['"온라인 운동"', '"랜선 운동"', '"라이브 홈트"'],
};

function buildQuery(keywords) {
  const query = keywords.join(" OR ");
  if (query.length > MAX_QUERY_LENGTH) throw new Error(`검색어가 너무 깁니다: ${query}`);
  return query;
}

// 한국 시간 기준 날짜 (YYYY-MM-DD)
function todayInKorea(now = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

// 뉴스가 많이 나온 순으로 상위 운동을 고른다. 0건은 제외하고, 동점이면 exercises.json 순서
function rankTrends(counts, exercises, topCount = TOP_COUNT) {
  return exercises
    .map(({ id }) => ({ id, count: counts[id] ?? 0 }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, topCount)
    .map(({ id, count }) => ({ id, count, reason: `최근 뉴스 ${count}건에 등장했어요.` }));
}

async function countNews(keywords, { apiKey, fetchImpl }) {
  const params = new URLSearchParams({ apikey: apiKey, q: buildQuery(keywords), language: "ko" });
  const response = await fetchImpl(`${API_URL}?${params}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status !== "success") {
    // 에러 메시지에 키가 섞여 나오지 않도록 응답 본문의 메시지만 남긴다
    const message = body.results?.message ?? body.message ?? `HTTP ${response.status}`;
    throw new Error(`newsdata.io 요청 실패 (${keywords.join(", ")}): ${message}`);
  }
  return body.totalResults ?? 0;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function updateTrends({
  apiKey = process.env.NEWSDATA_API_KEY,
  fetchImpl = fetch,
  exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, "utf8")),
  outPath = TRENDS_PATH,
  now = new Date(),
  gapMs = REQUEST_GAP_MS,
  log = console.log,
} = {}) {
  if (!apiKey) throw new Error("NEWSDATA_API_KEY 환경변수가 없습니다. .env 또는 GitHub Secrets를 확인하세요.");

  const counts = {};
  for (const { id } of exercises) {
    const keywords = TREND_KEYWORDS[id];
    if (!keywords) throw new Error(`${id}의 검색어(TREND_KEYWORDS)가 없습니다.`);
    counts[id] = await countNews(keywords, { apiKey, fetchImpl });
    log(`${id}: ${counts[id]}건`);
    await wait(gapMs);
  }

  const trends = rankTrends(counts, exercises);
  if (trends.length === 0) throw new Error("모든 운동의 뉴스가 0건입니다. 기존 trends.json을 유지합니다.");

  const result = { updatedAt: todayInKorea(now), source: "newsdata.io", trends };
  // 전부 성공했을 때만 파일을 덮어쓴다
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  updateTrends()
    .then((result) => console.log(`trends.json 갱신 완료 (${result.updatedAt}):`, result.trends.map((t) => t.id).join(", ")))
    .catch((error) => {
      console.error(`트렌드 갱신 실패, 기존 trends.json 유지: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { TREND_KEYWORDS, buildQuery, todayInKorea, rankTrends, updateTrends };
