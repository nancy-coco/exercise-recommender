// 주 1회 실행: newsdata.io에서 운동별 최근 한국어 뉴스를 모아, 생활 운동 기사 수로 data/trends.json을 만든다
// 프로·국가대표 경기 기사(예: 국제대회 결승, 전국체전)는 "사람들이 요즘 하는 운동"과 달라서 뺀다
// 실행: node --env-file=.env scripts/update-trends.js   (GitHub Actions에서는 Secrets로 키를 넣는다)
// 운동별 뉴스 수는 data/trend-history.json에 매주 쌓고, 지난주보다 늘어난 운동에 가산점을 준다
// 호출이 하나라도 실패하면 기존 trends.json·trend-history.json을 그대로 두고 실패로 끝낸다

const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://newsdata.io/api/1/latest";
const EXERCISES_PATH = path.join(__dirname, "..", "data", "exercises.json");
const TRENDS_PATH = path.join(__dirname, "..", "data", "trends.json");
const HISTORY_PATH = path.join(__dirname, "..", "data", "trend-history.json");
const TOP_COUNT = 5;
const HISTORY_SIZE = 8; // 최근 8번(약 2달) 기록만 보관
const MIN_COMPARE_DAYS = 5; // 이만큼 지난 기록과만 비교한다 (같은 주에 다시 실행해도 엉뚱하게 비교하지 않게)
const GROWTH_SMOOTHING = 5; // 1건 → 3건 같은 작은 숫자의 증가율이 과하게 커지지 않도록 더하는 값
const REQUEST_GAP_MS = 300;
const MAX_QUERY_LENGTH = 100; // 무료 플랜의 검색어 길이 제한
const MAX_PAGES = 2; // 운동당 최대 20개 기사를 표본으로 본다 (무료 플랜은 한 번에 10개)
const MAX_RATE_LIMIT_WAIT_MS = 16 * 60 * 1000;

// 제목·요약에 이런 말이 있으면 프로·엘리트 경기 기사로 보고 뺀다
// "대회", "오픈", "프로", "시즌"처럼 생활 운동 기사에도 흔한 말은 넣지 않는다 (예: 마라톤 대회, 헬스장 오픈, 프로그램)
const PRO_SPORTS_TERMS = [
  "국가대표", "대표팀", "대표선수", "선수단", "결승", "준결승", "4강", "8강", "16강", "우승", "준우승",
  "연승", "연패", "금메달", "은메달", "동메달", "메달", "세계선수권", "선수권", "올림픽", "아시안게임",
  "전국체전", "체전", "월드컵", "그랜드슬램", "리그", "KBL", "WKBL", "KBO", "NBA",
  "프로팀", "프로농구", "프로배구", "프로축구", "구단", "감독", "이적", "드래프트", "세계랭킹",
  "득점", "시상식", "MVP", "우수선수",
];

const articleText = ({ title, description }) => `${title ?? ""} ${description ?? ""}`;

function isLeisureArticle(article) {
  const text = articleText(article);
  return !PRO_SPORTS_TERMS.some((term) => text.includes(term));
}

// 검색은 기사 본문 전체에서 이뤄져서 운동과 상관없는 기사도 섞인다. 제목·요약에 검색어가 있어야 센다
function mentionsKeyword(article, keywords) {
  const text = articleText(article);
  return keywords.some((keyword) => text.includes(keyword.replaceAll('"', "")));
}

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
  swimming: ["수영장", '"수영 강습"', "생존수영"], // "수영"만 쓰면 같은 이름의 연예인 기사가 섞인다
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

// 증가 배율: (이번 주 + 보정값) / (지난번 + 보정값). 지난 기록이 없으면 1
function growthRatio(count, previous) {
  if (previous === null) return 1;
  return (count + GROWTH_SMOOTHING) / (previous + GROWTH_SMOOTHING);
}

function trendReason(count, previous) {
  if (previous === null || count <= previous) return `최근 생활 운동 뉴스 약 ${count}건에 등장했어요.`;
  if (previous === 0) return `이번 주 생활 운동 뉴스에 새로 등장했어요. (약 ${count}건)`;
  const percent = Math.round(((count - previous) / previous) * 100);
  return `지난주보다 뉴스가 ${percent}% 늘었어요. (${previous}건 → ${count}건)`;
}

// 순위 점수 = 이번 주 뉴스 수 × 증가 배율. 많이 나오면서 늘어나는 운동이 위로 간다
// previousCounts가 없으면(첫 실행) 뉴스 수 순서와 같다. 0건은 제외하고, 동점이면 뉴스 수, 그다음 exercises.json 순서
function rankTrends(counts, exercises, previousCounts = null, topCount = TOP_COUNT) {
  return exercises
    .map(({ id }) => {
      const count = counts[id] ?? 0;
      const previous = previousCounts ? (previousCounts[id] ?? 0) : null;
      return { id, count, previous, score: count * growthRatio(count, previous) };
    })
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, topCount)
    .map(({ id, count, previous }) => ({
      id,
      count,
      ...(previous === null ? {} : { previous }),
      reason: trendReason(count, previous),
    }));
}

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// 오늘보다 MIN_COMPARE_DAYS일 이상 앞선 가장 최근 기록
function findPreviousSnapshot(history, today) {
  return (
    [...history.snapshots]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((snapshot) => daysBetween(snapshot.date, today) >= MIN_COMPARE_DAYS) ?? null
  );
}

// 오늘 기록을 추가한다 (같은 날 다시 실행하면 덮어쓰기), 최근 HISTORY_SIZE개만 남긴다
function addSnapshot(history, snapshot) {
  const snapshots = history.snapshots.filter((item) => item.date !== snapshot.date);
  snapshots.push(snapshot);
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  return { snapshots: snapshots.slice(-HISTORY_SIZE) };
}

function readHistory(historyPath) {
  try {
    const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    return Array.isArray(history.snapshots) ? history : { snapshots: [] };
  } catch {
    return { snapshots: [] };
  }
}

// 표본 기사 중 생활 운동 기사 비율을 전체 기사 수에 곱해 추정한다
function estimateLeisureCount({ total, sampled, leisure }) {
  if (sampled === 0) return 0;
  return Math.round((leisure / sampled) * total);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(keywords, page, { apiKey, fetchImpl, waitImpl = wait }) {
  const params = new URLSearchParams({ apikey: apiKey, q: buildQuery(keywords), language: "ko" });
  if (page) params.set("page", page);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(`${API_URL}?${params}`);
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.status === "success") return body;

    // 요청 한도(짧은 시간 안 요청 수)에 걸리면 초기화 시각까지 기다렸다가 한 번만 다시 시도한다
    const resetAt = Number(response.headers?.get?.("x-ratelimit-reset"));
    if (response.status === 429 && attempt === 0 && resetAt) {
      const waitMs = Math.min(Math.max(resetAt * 1000 - Date.now(), 0) + 1000, MAX_RATE_LIMIT_WAIT_MS);
      console.log(`요청 한도 도달, ${Math.ceil(waitMs / 1000)}초 기다립니다.`);
      await waitImpl(waitMs);
      continue;
    }
    // 에러 메시지에 키가 섞여 나오지 않도록 응답 본문의 메시지만 남긴다
    const message = body.results?.message ?? body.message ?? `HTTP ${response.status}`;
    throw new Error(`newsdata.io 요청 실패 (${keywords.join(", ")}): ${message}`);
  }
  throw new Error(`newsdata.io 요청 실패 (${keywords.join(", ")}): 요청 한도`);
}

async function countNews(keywords, options) {
  let total = 0;
  const articles = [];
  let page;
  for (let i = 0; i < (options.maxPages ?? MAX_PAGES); i += 1) {
    const body = await fetchPage(keywords, page, options);
    total = body.totalResults ?? 0;
    articles.push(...(body.results ?? []));
    page = body.nextPage;
    if (!page || articles.length >= total) break;
    await wait(options.gapMs ?? REQUEST_GAP_MS);
  }
  const leisure = articles.filter((article) => mentionsKeyword(article, keywords) && isLeisureArticle(article)).length;
  return { total, sampled: articles.length, leisure, count: estimateLeisureCount({ total, sampled: articles.length, leisure }) };
}

async function updateTrends({
  apiKey = process.env.NEWSDATA_API_KEY,
  fetchImpl = fetch,
  exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, "utf8")),
  outPath = TRENDS_PATH,
  historyPath = HISTORY_PATH,
  now = new Date(),
  gapMs = REQUEST_GAP_MS,
  maxPages = MAX_PAGES,
  log = console.log,
} = {}) {
  if (!apiKey) throw new Error("NEWSDATA_API_KEY 환경변수가 없습니다. .env 또는 GitHub Secrets를 확인하세요.");

  const counts = {};
  for (const { id } of exercises) {
    const keywords = TREND_KEYWORDS[id];
    if (!keywords) throw new Error(`${id}의 검색어(TREND_KEYWORDS)가 없습니다.`);
    const result = await countNews(keywords, { apiKey, fetchImpl, gapMs, maxPages });
    counts[id] = result.count;
    log(`${id}: 전체 ${result.total}건, 표본 ${result.sampled}건 중 생활 운동 ${result.leisure}건 → 약 ${result.count}건`);
    await wait(gapMs);
  }

  const today = todayInKorea(now);
  const history = readHistory(historyPath);
  const previous = findPreviousSnapshot(history, today);
  const trends = rankTrends(counts, exercises, previous?.counts ?? null);
  if (trends.length === 0) throw new Error("모든 운동의 뉴스가 0건입니다. 기존 trends.json을 유지합니다.");
  log(previous ? `${previous.date} 기록과 비교했어요.` : "비교할 지난 기록이 없어 뉴스 수로만 순위를 정했어요.");

  const result = {
    updatedAt: today,
    source: "newsdata.io",
    ...(previous ? { comparedWith: previous.date } : {}),
    trends,
  };
  // 전부 성공했을 때만 파일을 덮어쓴다
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(historyPath, `${JSON.stringify(addSnapshot(history, { date: today, counts }), null, 2)}\n`);
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

module.exports = {
  TREND_KEYWORDS,
  buildQuery,
  todayInKorea,
  rankTrends,
  findPreviousSnapshot,
  addSnapshot,
  isLeisureArticle,
  mentionsKeyword,
  estimateLeisureCount,
  updateTrends,
};
