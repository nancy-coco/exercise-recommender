// 실행: node --test tests/update-trends.test.js  (실제 API는 부르지 않는다)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  TREND_KEYWORDS,
  buildQuery,
  todayInKorea,
  rankTrends,
  isLeisureArticle,
  mentionsKeyword,
  estimateLeisureCount,
  updateTrends,
} = require("../scripts/update-trends.js");
const exercises = require("../data/exercises.json");

// 가짜 기사: 생활 운동 기사 / 프로 경기 기사 / 검색어가 없는 엉뚱한 기사
const leisure = (n, word) => Array.from({ length: n }, (_, i) => ({ title: `동네 ${word} 동호회 인기 ${i}`, description: "" }));
const pro = (n, word) => Array.from({ length: n }, (_, i) => ({ title: `${word} 국가대표 결승 진출 ${i}`, description: "" }));
const offTopic = (n) => Array.from({ length: n }, (_, i) => ({ title: `교황 퇴원 소식 ${i}`, description: "" }));

const okResponse = (body) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ status: "success", ...body }) });

// 운동 id별로 { total, articles }를 돌려주는 가짜 API (10개씩 페이지를 나눈다)
function fakeFetch(dataById, { failOn } = {}) {
  return async (url) => {
    const params = new URL(url).searchParams;
    const id = Object.keys(TREND_KEYWORDS).find((key) => buildQuery(TREND_KEYWORDS[key]) === params.get("q"));
    if (id === failOn) {
      return { ok: false, status: 500, headers: new Headers(), json: async () => ({ status: "error", results: { message: "server error" } }) };
    }
    const { total = 0, articles = [] } = dataById[id] ?? {};
    const start = Number(params.get("page") ?? 0);
    const results = articles.slice(start, start + 10);
    const nextPage = start + 10 < articles.length ? String(start + 10) : null;
    return okResponse({ totalResults: total, results, nextPage });
  };
}

function tempTrendsFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trends-"));
  const file = path.join(dir, "trends.json");
  fs.writeFileSync(file, '{"updatedAt":"2026-01-01","trends":[{"id":"yoga","reason":"기존"}]}');
  return file;
}

const options = (overrides) => ({ apiKey: "test-key", exercises, gapMs: 0, log: () => {}, ...overrides });

test("모든 운동에 검색어가 있고, 무료 플랜 길이 제한(100자) 안에 든다", () => {
  exercises.forEach(({ id }) => {
    assert.ok(TREND_KEYWORDS[id], `${id} 검색어 없음`);
    assert.doesNotThrow(() => buildQuery(TREND_KEYWORDS[id]));
  });
});

test("한국 시간 기준으로 날짜를 만든다", () => {
  // UTC 10월 18일 20시 = 한국 10월 19일 새벽 5시
  assert.equal(todayInKorea(new Date("2026-10-18T20:00:00Z")), "2026-10-19");
});

test("프로·국가대표 경기 기사는 빼고, 생활 운동 기사는 남긴다", () => {
  assert.equal(isLeisureArticle({ title: "'43연승' 안세영, 덴마크 오픈 결승 진출" }), false);
  assert.equal(isLeisureArticle({ title: "제107회 전국체전에 경북선수단 2077명 참가" }), false);
  assert.equal(isLeisureArticle({ title: "대한체육회, AG 우수선수 시상식 개최" }), false);
  assert.equal(isLeisureArticle({ title: "경주 마라톤 대회 참가자 1만 명 몰려" }), true);
  assert.equal(isLeisureArticle({ title: "동네 배드민턴장 오픈, 퇴근 후 운동 인기" }), true);
  assert.equal(isLeisureArticle({ title: "러닝크루 프로그램 신청 폭주", description: null }), true);
});

test("제목·요약에 검색어가 있는 기사만 센다 (따옴표 구문 포함)", () => {
  assert.equal(mentionsKeyword({ title: "교황, 폐 수술 5일 만에 퇴원" }, ["테니스"]), false);
  assert.equal(mentionsKeyword({ title: "주말 러닝 크루 모집" }, ["\"러닝 크루\"", "러닝크루"]), true);
  assert.equal(mentionsKeyword({ title: "가을 운동", description: "생존수영 교육 확대" }, ["수영장", "생존수영"]), true);
});

test("표본의 생활 운동 비율을 전체 기사 수에 곱해 추정한다", () => {
  assert.equal(estimateLeisureCount({ total: 40, sampled: 20, leisure: 5 }), 10);
  assert.equal(estimateLeisureCount({ total: 6, sampled: 6, leisure: 6 }), 6);
  assert.equal(estimateLeisureCount({ total: 0, sampled: 0, leisure: 0 }), 0);
});

test("뉴스 수 순으로 상위 5개, 0건은 제외", () => {
  const counts = { yoga: 3, pilates: 10, golf: 0, tennis: 7, hiking: 1, boxing: 2, walking: 5 };
  const ids = rankTrends(counts, exercises).map((trend) => trend.id);
  assert.deepEqual(ids, ["pilates", "tennis", "walking", "yoga", "boxing"]);
});

test("경기 기사가 많은 종목보다 생활 운동 기사가 많은 종목이 위로 간다", async () => {
  const outPath = tempTrendsFile();
  await updateTrends(
    options({
      outPath,
      fetchImpl: fakeFetch({
        badminton: { total: 40, articles: [...pro(18, "배드민턴"), ...leisure(2, "배드민턴")] }, // 표본 20개 중 2개 → 약 4건
        running: { total: 30, articles: [...leisure(15, "마라톤"), ...pro(3, "마라톤"), ...offTopic(2)] }, // 표본 20개 중 15개 → 약 23건
        climbing: { total: 5, articles: leisure(5, "클라이밍") }, // 5건
      }),
    })
  );
  const saved = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.deepEqual(
    saved.trends.map((trend) => [trend.id, trend.count]),
    [
      ["running", 23],
      ["climbing", 5],
      ["badminton", 4],
    ]
  );
});

test("전부 성공하면 trends.json을 새로 쓴다", async () => {
  const outPath = tempTrendsFile();
  const fetchImpl = fakeFetch({ climbing: { total: 9, articles: leisure(9, "볼더링") }, futsal: { total: 4, articles: leisure(4, "풋살") } });
  await updateTrends(options({ outPath, fetchImpl, now: new Date("2026-10-19T00:00:00Z") }));
  const saved = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(saved.updatedAt, "2026-10-19");
  assert.deepEqual(saved.trends.map((trend) => trend.id), ["climbing", "futsal"]);
});

test("요청이 하나라도 실패하면 기존 trends.json을 그대로 둔다", async () => {
  const outPath = tempTrendsFile();
  const before = fs.readFileSync(outPath, "utf8");
  const fetchImpl = fakeFetch({ yoga: { total: 5, articles: leisure(5, "요가") } }, { failOn: "golf" });
  await assert.rejects(updateTrends(options({ outPath, fetchImpl })), /server error/);
  assert.equal(fs.readFileSync(outPath, "utf8"), before);
});

test("모든 운동이 0건이면 기존 trends.json을 그대로 둔다", async () => {
  const outPath = tempTrendsFile();
  const before = fs.readFileSync(outPath, "utf8");
  await assert.rejects(updateTrends(options({ outPath, fetchImpl: fakeFetch({}) })), /0건/);
  assert.equal(fs.readFileSync(outPath, "utf8"), before);
});

test("API 키가 없으면 요청 없이 실패한다", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
  };
  await assert.rejects(updateTrends(options({ apiKey: "", fetchImpl, outPath: tempTrendsFile() })), /NEWSDATA_API_KEY/);
  assert.equal(called, false);
});
