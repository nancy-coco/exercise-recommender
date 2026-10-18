// 실행: node --test tests/update-trends.test.js  (실제 API는 부르지 않는다)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TREND_KEYWORDS, buildQuery, todayInKorea, rankTrends, updateTrends } = require("../scripts/update-trends.js");
const exercises = require("../data/exercises.json");

function fakeFetch(countsById, { failOn } = {}) {
  return async (url) => {
    const query = new URL(url).searchParams.get("q");
    const id = Object.keys(TREND_KEYWORDS).find((key) => buildQuery(TREND_KEYWORDS[key]) === query);
    if (id === failOn) {
      return { ok: false, status: 429, json: async () => ({ status: "error", results: { message: "rate limit" } }) };
    }
    return { ok: true, status: 200, json: async () => ({ status: "success", totalResults: countsById[id] ?? 0 }) };
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

test("뉴스 수 순으로 상위 5개, 0건은 제외", () => {
  const counts = { yoga: 3, pilates: 10, golf: 0, tennis: 7, hiking: 1, boxing: 2, walking: 5 };
  const ids = rankTrends(counts, exercises).map((trend) => trend.id);
  assert.deepEqual(ids, ["pilates", "tennis", "walking", "yoga", "boxing"]);
});

test("전부 성공하면 trends.json을 새로 쓴다", async () => {
  const outPath = tempTrendsFile();
  await updateTrends(options({ outPath, fetchImpl: fakeFetch({ climbing: 9, futsal: 4 }), now: new Date("2026-10-19T00:00:00Z") }));
  const saved = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(saved.updatedAt, "2026-10-19");
  assert.deepEqual(saved.trends.map((trend) => trend.id), ["climbing", "futsal"]);
});

test("요청이 하나라도 실패하면 기존 trends.json을 그대로 둔다", async () => {
  const outPath = tempTrendsFile();
  const before = fs.readFileSync(outPath, "utf8");
  await assert.rejects(updateTrends(options({ outPath, fetchImpl: fakeFetch({ yoga: 5 }, { failOn: "golf" }) })), /rate limit/);
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
