// key는 data/exercises.json의 필드 이름과 같게 맞춘다 (3단계 점수 계산에서 그대로 비교)
const REQUIRED_QUESTIONS = [
  {
    key: "purpose",
    title: "운동하는 목적은 무엇인가요?",
    sub: "최대 3개까지 고를 수 있어요.",
    options: ["다이어트", "근력", "유연성·자세", "스트레스 해소", "사람 만나기"],
    maxSelect: 3,
  },
  {
    key: "activity",
    title: "어느 정도로 움직이고 싶나요?",
    options: ["정적·가볍게", "적당히", "동적·땀 흠뻑", "상관없음"],
  },
  {
    key: "people",
    title: "누구와 운동하고 싶나요?",
    options: ["혼자", "함께", "상관없음"],
  },
  {
    key: "place",
    title: "어디서 운동하고 싶나요?",
    options: ["집", "헬스장·스튜디오", "야외", "상관없음"],
  },
  {
    key: "time",
    title: "한 번에 얼마나 운동할 수 있나요?",
    options: ["15분 이하", "30분", "1시간 이상", "상관없음"],
  },
];

const DETAIL_QUESTIONS = [
  { key: "budget", title: "예산", options: ["무료", "장비만 구매", "월 회비 OK"] },
  { key: "level", title: "경험 수준", options: ["완전 입문", "운동 좀 해봄"] },
  { key: "mood", title: "분위기", options: ["경쟁·승부", "그냥 즐기기"] },
  { key: "lowImpact", title: "몸 부담", options: ["관절·허리 부담 적은 운동만", "상관없음"] },
  { key: "style", title: "꾸준함 스타일", options: ["같은 루틴 반복형", "매번 새로운 거 좋아하는 형"] },
];

const FINISH_STEP = REQUIRED_QUESTIONS.length;

// 여러 개 고르는 질문(목적)은 답을 배열로 둔다
const isMulti = (question) => Boolean(question.maxSelect);

function createAnswers() {
  const answers = { trendFirst: true };
  [...REQUIRED_QUESTIONS, ...DETAIL_QUESTIONS].forEach((question) => {
    answers[question.key] = isMulti(question) ? [] : null;
  });
  return answers;
}

const isAnswered = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));
const isSelected = (key, value) =>
  Array.isArray(answers[key]) ? answers[key].includes(value) : answers[key] === value;

let answers = createAnswers();
let currentStep = 0;

// fetch는 file://로 열면 막히므로 로컬 서버나 배포 주소에서 열어야 한다
async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} 불러오기 실패 (${response.status})`);
  return response.json();
}

const dataReady = Promise.all([
  loadJson("data/exercises.json"),
  // 트렌드 파일이 없거나 깨져도 추천은 되도록 빈 목록으로 대체
  loadJson("data/trends.json").catch(() => ({ trends: [] })),
]).then(([exercises, trendsFile]) => ({
  exercises,
  trendsFile,
  trendIds: new Set(trendsFile.trends.map((trend) => trend.id)),
}));

const screens = document.querySelectorAll(".screen");

function showScreen(name) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === `screen-${name}`);
  });
  window.scrollTo(0, 0);
}

function formatDate(isoDate) {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}월 ${day}일 기준`;
}

function renderTrendMessage(message) {
  const item = document.createElement("li");
  item.className = "trend-reason";
  item.textContent = message;
  document.getElementById("trend-list").replaceChildren(item);
}

// 필수 질문 선택지 앞에 붙는 이모지
const OPTION_EMOJI = {
  다이어트: "🔥",
  근력: "💪",
  "유연성·자세": "🧘",
  "스트레스 해소": "🌿",
  "사람 만나기": "🤝",
  "정적·가볍게": "🍃",
  적당히: "🚶",
  "동적·땀 흠뻑": "💦",
  혼자: "🙋",
  함께: "👯",
  상관없음: "🤷",
  집: "🏠",
  "헬스장·스튜디오": "🏢",
  야외: "🌳",
  "15분 이하": "⏱️",
  "30분": "⏰",
  "1시간 이상": "⌛",
};

const PARADE_COUNT = 5;

// 전체 운동 중 무작위로 몇 개를 고른다 (Fisher–Yates 섞기)
function pickRandom(list, count) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// 메인 캐릭터 줄: 방문할 때마다 무작위 5개. 마우스를 올리거나(PC) 탭하면(모바일) 운동 이름 말풍선이 뜬다
function renderParade(namesById) {
  const parade = document.getElementById("hero-parade");
  parade.replaceChildren(
    ...pickRandom([...namesById.keys()], PARADE_COUNT).map((id, index) => {
      const name = namesById.get(id) ?? "";
      const item = document.createElement("span");
      item.className = "parade-item";
      item.style.setProperty("--i", index);
      item.dataset.label = name;
      item.tabIndex = 0;
      item.setAttribute("role", "img");
      item.setAttribute("aria-label", `${name} 하는 픽셀 캐릭터`);
      const sprite = createSprite(id, "");
      sprite.removeAttribute("role");
      sprite.setAttribute("aria-hidden", "true");
      item.append(sprite);
      return item;
    })
  );
}

let tipTimer;
function showParadeTip(item) {
  document.querySelectorAll(".parade-item.is-tip-open").forEach((open) => open.classList.remove("is-tip-open"));
  item.classList.add("is-tip-open");
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => item.classList.remove("is-tip-open"), 1800);
}

// 큰 글씨 모드: 선택은 이 브라우저에만 저장한다 (저장이 막힌 환경이면 이번 방문에만 적용)
const TEXT_SIZE_KEY = "largeText";

function applyTextSize(large) {
  document.documentElement.classList.toggle("large-text", large);
  document.querySelector("[data-action='toggle-text-size']").setAttribute("aria-pressed", String(large));
}

function toggleTextSize() {
  const large = !document.documentElement.classList.contains("large-text");
  applyTextSize(large);
  try {
    localStorage.setItem(TEXT_SIZE_KEY, large ? "1" : "0");
  } catch {
    // 저장 불가 환경은 무시
  }
}

function restoreTextSize() {
  try {
    applyTextSize(localStorage.getItem(TEXT_SIZE_KEY) === "1");
  } catch {
    applyTextSize(false);
  }
}

// 같은 요소에 등장 애니메이션을 다시 재생한다
function replayAnimation(element) {
  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "";
}

function renderTrends({ updatedAt, trends }, exercises) {
  document.getElementById("trend-date").textContent = updatedAt ? formatDate(updatedAt) : "";

  // exercises.json에 없는 id는 이름을 알 수 없으니 건너뛴다
  const namesById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const top = trends.filter((trend) => namesById.has(trend.id)).slice(0, 5);
  if (top.length === 0) {
    renderTrendMessage("이번 주 트렌드를 준비 중이에요.");
    return;
  }

  const list = document.getElementById("trend-list");
  list.innerHTML = "";
  top.forEach((trend, index) => {
    const item = document.createElement("li");
    item.className = "trend-item";

    const rank = document.createElement("span");
    rank.className = "trend-rank";
    rank.textContent = index + 1;

    const body = document.createElement("div");
    const name = document.createElement("p");
    name.className = "trend-name";
    name.textContent = namesById.get(trend.id);
    // 지난주보다 늘어난 운동에는 증가율 배지를 붙인다 (지난 기록이 없으면 previous가 없다)
    if (typeof trend.previous === "number" && trend.count > trend.previous) {
      const rise = document.createElement("span");
      rise.className = "rise";
      rise.textContent =
        trend.previous === 0 ? "NEW" : `📈 +${Math.round(((trend.count - trend.previous) / trend.previous) * 100)}%`;
      name.append(" ", rise);
    }
    const reason = document.createElement("p");
    reason.className = "trend-reason";
    reason.textContent = trend.reason;
    body.append(name, reason);

    item.append(rank, createSprite(trend.id, `${namesById.get(trend.id)} 하는 픽셀 캐릭터`), body);
    list.append(item);
  });
}

function createOptionButton(key, value, { rich = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option";
  if (rich) {
    // 필수 질문은 이모지 + 글자 + 체크 표시가 있는 카드 형태
    const emoji = document.createElement("span");
    emoji.className = "option-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = OPTION_EMOJI[value] ?? "•";
    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = value;
    const check = document.createElement("span");
    check.className = "option-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    button.append(emoji, label, check);
  } else {
    button.textContent = value;
  }
  button.dataset.key = key;
  button.dataset.value = value;
  const selected = isSelected(key, value);
  button.classList.toggle("is-selected", selected);
  button.setAttribute("aria-pressed", String(selected));
  return button;
}

function renderProgress() {
  const total = REQUIRED_QUESTIONS.length;
  const shown = Math.min(currentStep + 1, total);
  document.getElementById("progress-text").textContent = `${shown} / ${total}`;
  document.getElementById("progress-fill").style.width = `${(shown / total) * 100}%`;
  document.getElementById("progress").setAttribute("aria-valuenow", shown);
}

function renderQuestionStep() {
  const isFinish = currentStep === FINISH_STEP;
  const questionStep = document.getElementById("step-question");
  const finishStep = document.getElementById("step-finish");
  questionStep.hidden = isFinish;
  finishStep.hidden = !isFinish;
  replayAnimation(isFinish ? finishStep : questionStep);
  renderProgress();

  if (isFinish) return;

  const question = REQUIRED_QUESTIONS[currentStep];
  document.getElementById("step-label").textContent = `Q${currentStep + 1}`;
  document.getElementById("question-title").textContent = question.title;
  const sub = document.getElementById("question-sub");
  sub.hidden = !question.sub;
  sub.textContent = question.sub ?? "";
  renderQuestionOptions();
}

// 선택지만 다시 그린다 (여러 개 고르는 질문은 화면 이동 없이 선택 상태만 바뀐다)
function renderQuestionOptions() {
  const question = REQUIRED_QUESTIONS[currentStep];
  const options = document.getElementById("question-options");
  options.replaceChildren(...question.options.map((value) => createOptionButton(question.key, value, { rich: true })));

  const next = document.getElementById("question-next");
  next.hidden = !isMulti(question);
  next.disabled = !isAnswered(answers[question.key]);
  if (isMulti(question)) {
    const count = answers[question.key].length;
    next.textContent = count > 0 ? `${count}개 선택 · 다음 →` : "다음 →";
  }
}

function goNext() {
  if (!isAnswered(answers[REQUIRED_QUESTIONS[currentStep]?.key])) return;
  currentStep += 1;
  renderQuestionStep();
}

function renderDetailQuestions() {
  const container = document.getElementById("detail-questions");
  container.replaceChildren(
    ...DETAIL_QUESTIONS.map((question) => {
      const group = document.createElement("div");
      group.className = "detail-group";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", question.title);

      const title = document.createElement("p");
      title.className = "detail-title";
      title.textContent = question.title;

      const options = document.createElement("div");
      options.className = "options options-inline";
      options.append(...question.options.map((value) => createOptionButton(question.key, value)));

      group.append(title, options);
      return group;
    })
  );
}

function startQuiz() {
  // 공유 링크로 들어왔다가 다시 하면 주소의 답도 지운다 (친구 초대 정보는 friendAnswers에 남아 있다)
  if (location.search) history.replaceState(null, "", location.pathname);
  document.getElementById("result-sub").textContent = RESULT_SUB_DEFAULT;
  answers = createAnswers();
  currentStep = 0;
  document.getElementById("detail-box").open = false;
  document.getElementById("trend-toggle").checked = answers.trendFirst;
  renderDetailQuestions();
  renderQuestionStep();
  showScreen("question");
}

function goPrev() {
  if (currentStep === 0) {
    showScreen("main");
    return;
  }
  currentStep -= 1;
  renderQuestionStep();
}

function selectOption(button) {
  const { key, value } = button.dataset;
  const isDetail = DETAIL_QUESTIONS.some((question) => question.key === key);

  if (isDetail) {
    // 세부항목은 선택 사항이라 한 번 더 누르면 선택 해제
    answers[key] = answers[key] === value ? null : value;
    renderDetailQuestions();
    return;
  }

  const question = REQUIRED_QUESTIONS.find((item) => item.key === key);
  if (isMulti(question)) {
    // 다시 누르면 해제, 최대 개수를 넘으면 가장 먼저 고른 것을 빼고 새로 고른 것을 넣는다
    const selected = answers[key];
    if (selected.includes(value)) {
      answers[key] = selected.filter((item) => item !== value);
    } else {
      answers[key] = [...selected, value].slice(-question.maxSelect);
    }
    renderQuestionOptions();
    return;
  }

  answers[key] = value;
  goNext();
}

function createResultCard(result, index) {
  const { exercise, isTrend } = result;
  const { main, extras } = buildReason(result, answers);

  const card = document.createElement("li");
  card.className = "card result-card";
  card.classList.toggle("is-best", index === 0);
  card.style.setProperty("--i", index);

  const sprite = createSprite(exercise.id, `${exercise.name} 하는 픽셀 캐릭터`);

  const meta = document.createElement("div");
  meta.className = "result-meta";
  const rank = document.createElement("span");
  rank.className = "rank";
  rank.textContent = index === 0 ? "BEST" : `${index + 1}위`;
  meta.append(rank);
  if (isTrend) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "🔥 요즘 뜨는";
    meta.append(badge);
  }

  const name = document.createElement("h3");
  name.className = "result-name";
  name.textContent = exercise.name;

  const desc = document.createElement("p");
  desc.className = "result-desc";
  desc.textContent = exercise.description;

  const reason = document.createElement("div");
  reason.className = "result-reason";
  const reasonMain = document.createElement("p");
  reasonMain.textContent = main;
  reason.append(reasonMain);
  if (extras.length > 0) {
    const tags = document.createElement("div");
    tags.className = "tags";
    tags.append(
      ...extras.map((text) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = text;
        return tag;
      })
    );
    reason.append(tags);
  }

  const intro = document.createElement("div");
  intro.className = "result-intro";
  const introText = document.createElement("div");
  introText.append(meta, name, desc);
  intro.append(sprite, introText);

  card.append(intro, reason);
  return card;
}


// 친구 초대 링크로 들어온 경우, 초대한 친구의 답
let friendAnswers = null;
// 이미지 저장에 쓰는 마지막 추천 결과
let lastResults = [];

function renderTypeCard() {
  const type = getExerciseType(answers);
  document.getElementById("type-card").hidden = !type;
  if (!type) return;
  document.getElementById("type-emoji").textContent = type.emoji;
  document.getElementById("type-title").textContent = type.title;
  document.getElementById("type-desc").textContent = type.desc;
}

function createTogetherItem(result) {
  const { exercise, canDoTogether, mineMatched, friendMatched } = result;
  const item = document.createElement("li");
  item.className = "together-item";

  const body = document.createElement("div");
  const name = document.createElement("p");
  name.className = "trend-name";
  name.textContent = exercise.name;
  const reason = document.createElement("p");
  reason.className = "trend-reason";
  const together = canDoTogether ? "같이 할 수 있어요 · " : "";
  reason.textContent = `${together}나와 맞는 조건 ${mineMatched.length}개, 친구와 맞는 조건 ${friendMatched.length}개`;
  body.append(name, reason);

  item.append(createSprite(exercise.id, `${exercise.name} 하는 픽셀 캐릭터`), body);
  return item;
}

function renderTogether(exercises, trendIds) {
  const section = document.getElementById("together");
  section.hidden = !friendAnswers;
  if (!friendAnswers) return;

  const mine = getExerciseType(answers);
  const friend = getExerciseType(friendAnswers);
  document.getElementById("together-types").textContent = `나 ${mine.emoji} ${mine.name}  ×  친구 ${friend.emoji} ${friend.name}`;
  const results = recommendTogether(exercises, answers, friendAnswers, trendIds);
  document.getElementById("together-list").replaceChildren(...results.map(createTogetherItem));
}

async function showResult() {
  const list = document.getElementById("result-list");
  const error = document.getElementById("result-error");
  list.replaceChildren();
  error.hidden = true;
  setStatus("");
  renderTypeCard();

  try {
    const { exercises, trendIds } = await dataReady;
    lastResults = recommend(exercises, answers, trendIds);
    list.replaceChildren(...lastResults.map(createResultCard));
    renderTogether(exercises, trendIds);
  } catch (err) {
    console.error(err);
    error.textContent = "운동 데이터를 불러오지 못했어요. 로컬 서버나 배포 주소로 열었는지 확인해 주세요.";
    error.hidden = false;
  }
  showScreen("result");
}

function answersToParams(source) {
  const params = new URLSearchParams();
  [...REQUIRED_QUESTIONS, ...DETAIL_QUESTIONS].forEach(({ key }) => {
    // 여러 개 답은 쉼표로 이어 붙인다 (선택지 이름에는 쉼표가 없다)
    if (isAnswered(source[key])) params.set(key, [].concat(source[key]).join(","));
  });
  params.set("trend", source.trendFirst ? "1" : "0");
  return params;
}

const pageUrl = () => `${location.origin}${location.pathname}`;

// 답을 쿼리스트링에 담은 공유 링크. 친구와 함께 본 결과면 친구 답도 같이 담는다
function buildShareUrl() {
  const params = answersToParams(answers);
  if (friendAnswers) params.set("friend", answersToParams(friendAnswers).toString());
  return `${pageUrl()}?${params}`;
}

function buildInviteUrl() {
  const params = new URLSearchParams({ invite: answersToParams(answers).toString() });
  return `${pageUrl()}?${params}`;
}

// 공유 링크의 쿼리스트링을 답 객체로 되돌린다. 필수 답이 빠졌거나 없는 선택지면 null
function answersFromUrl(search) {
  const params = new URLSearchParams(search);
  const restored = createAnswers();
  for (const question of [...REQUIRED_QUESTIONS, ...DETAIL_QUESTIONS]) {
    const { key, options } = question;
    const value = params.get(key);
    if (value === null) continue;
    if (isMulti(question)) {
      const values = [...new Set(value.split(","))];
      if (values.length > question.maxSelect || !values.every((item) => options.includes(item))) return null;
      restored[key] = values;
      continue;
    }
    if (!options.includes(value)) return null;
    restored[key] = value;
  }
  if (REQUIRED_QUESTIONS.some(({ key }) => !isAnswered(restored[key]))) return null;
  restored.trendFirst = params.get("trend") !== "0";
  return restored;
}

function setStatus(message) {
  document.getElementById("copy-status").textContent = message;
}

// 휴대폰 공유창(카톡·문자 등)을 열고, 지원하지 않으면 링크를 복사한다
async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return; // 사용자가 공유창을 닫음
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus("링크를 복사했어요! 카톡이나 메신저에 붙여넣어 공유해 보세요.");
  } catch {
    // 클립보드 권한이 없는 환경에서는 링크를 직접 보여준다
    setStatus(`복사하지 못했어요. 아래 링크를 직접 복사해 주세요.\n${url}`);
  }
}

function shareResult() {
  const type = getExerciseType(answers);
  shareOrCopy({
    title: "내 운동 찾기",
    text: `나는 '${type.title}' ${type.emoji}\n나에게 딱 맞는 운동 TOP 3 보러 가기!`,
    url: buildShareUrl(),
  });
}

function inviteFriend() {
  shareOrCopy({
    title: "내 운동 찾기 · 친구 초대",
    text: "나랑 같이 할 운동 찾아보자! 👫 질문 5개만 답하면 둘에게 맞는 운동을 알려줘.",
    url: buildInviteUrl(),
  });
}

// ---- 결과 이미지 저장 (인스타 스토리·단톡방용 1080x1350) ----

const IMAGE_FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  text.split(" ").forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 0 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

async function drawResultImage() {
  const width = 1080;
  const height = 1350;
  const pad = 80;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  try {
    await Promise.all([document.fonts.load(`800 76px ${IMAGE_FONT}`), document.fonts.load(`600 30px ${IMAGE_FONT}`)]);
  } catch {
    // 글꼴을 못 불러와도 기본 글꼴로 그린다
  }

  // 배경 + 은은한 빛번짐
  ctx.fillStyle = "#f5f4ef";
  ctx.fillRect(0, 0, width, height);
  const glow = (x, y, radius, color) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(245, 244, 239, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };
  glow(0, 0, 700, "rgba(214, 255, 79, 0.55)");
  glow(width, 0, 650, "rgba(75, 78, 247, 0.18)");

  const type = getExerciseType(answers);
  ctx.textBaseline = "top";
  let y = 110;

  ctx.fillStyle = "#4b4ef7";
  ctx.font = `800 32px ${IMAGE_FONT}`;
  ctx.fillText("나의 운동 유형", pad, y);
  y += 60;

  const modifier = type.title.slice(0, type.title.length - type.name.length).trim();
  ctx.fillStyle = "#6b6f7a";
  ctx.font = `700 40px ${IMAGE_FONT}`;
  ctx.fillText(modifier, pad, y);
  y += 58;

  ctx.fillStyle = "#15171c";
  ctx.font = `800 76px ${IMAGE_FONT}`;
  ctx.fillText(`${type.emoji} ${type.name}`, pad, y);
  y += 108;

  ctx.fillStyle = "#6b6f7a";
  ctx.font = `600 34px ${IMAGE_FONT}`;
  wrapText(ctx, type.desc, width - pad * 2).forEach((line) => {
    ctx.fillText(line, pad, y);
    y += 50;
  });
  y += 36;

  ctx.fillStyle = "#15171c";
  ctx.font = `800 40px ${IMAGE_FONT}`;
  ctx.fillText("나에게 맞는 운동 TOP 3", pad, y);
  y += 72;

  const cardHeight = 196;
  const spriteSize = 144; // 16의 배수라 픽셀이 선명하다
  lastResults.forEach(({ exercise }, index) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = index === 0 ? "#4b4ef7" : "#e5e3dc";
    ctx.lineWidth = index === 0 ? 5 : 2;
    ctx.beginPath();
    ctx.roundRect(pad, y, width - pad * 2, cardHeight, 32);
    ctx.fill();
    ctx.stroke();

    const spriteX = pad + 26;
    const spriteY = y + (cardHeight - spriteSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(spriteX, spriteY, spriteSize, spriteSize, 22);
    ctx.clip();
    drawSprite(ctx, exercise.id, spriteX, spriteY, spriteSize);
    ctx.restore();
    ctx.strokeStyle = "#15171c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(spriteX, spriteY, spriteSize, spriteSize, 22);
    ctx.stroke();

    const textX = spriteX + spriteSize + 36;
    const textWidth = width - pad - 32 - textX;
    ctx.fillStyle = index === 0 ? "#4b4ef7" : "#6b6f7a";
    ctx.font = `800 28px ${IMAGE_FONT}`;
    ctx.fillText(index === 0 ? "BEST" : `${index + 1}위`, textX, y + 34);
    ctx.fillStyle = "#15171c";
    ctx.font = `800 50px ${IMAGE_FONT}`;
    ctx.fillText(fitText(ctx, exercise.name, textWidth), textX, y + 72);
    ctx.fillStyle = "#6b6f7a";
    ctx.font = `600 28px ${IMAGE_FONT}`;
    ctx.fillText(fitText(ctx, exercise.description, textWidth), textX, y + 138);

    y += cardHeight + 24;
  });

  ctx.fillStyle = "#6b6f7a";
  ctx.font = `700 30px ${IMAGE_FONT}`;
  ctx.textAlign = "center";
  const site = `${location.host}${location.pathname.replace(/index\.html$/, "")}`;
  ctx.fillText(`나도 해보기 → ${site}`, width / 2, height - 90);

  return canvas;
}

async function saveImage() {
  setStatus("이미지를 만드는 중이에요…");
  const canvas = await drawResultImage();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const fileName = "내-운동-유형.png";
  const file = new File([blob], fileName, { type: "image/png" });

  // 휴대폰에서는 공유창(사진 저장·인스타·카톡)을, PC에서는 파일 다운로드를 쓴다
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "내 운동 유형" });
      setStatus("");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("");
        return;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("이미지를 저장했어요!");
}

function restart() {
  friendAnswers = null;
  document.getElementById("invite-banner").hidden = true;
  startQuiz();
}

document.addEventListener("click", (event) => {
  const option = event.target.closest(".option");
  if (option) {
    selectOption(option);
    return;
  }

  const paradeItem = event.target.closest(".parade-item");
  if (paradeItem) showParadeTip(paradeItem);

  const actions = {
    start: startQuiz,
    restart,
    prev: goPrev,
    next: goNext,
    "show-result": showResult,
    share: shareResult,
    invite: inviteFriend,
    "save-image": saveImage,
    "toggle-text-size": toggleTextSize,
  };
  const action = event.target.closest("[data-action]")?.dataset.action;
  actions[action]?.();
});

document.getElementById("trend-toggle").addEventListener("change", (event) => {
  answers.trendFirst = event.target.checked;
});

restoreTextSize();

const RESULT_SUB_DEFAULT = document.getElementById("result-sub").textContent;
const urlParams = new URLSearchParams(location.search);
const sharedAnswers = answersFromUrl(location.search);
const answersFromParam = (name) => (urlParams.get(name) ? answersFromUrl(urlParams.get(name)) : null);

if (sharedAnswers) {
  // 공유받은 결과 링크: 같은 결과를 바로 보여준다
  answers = sharedAnswers;
  friendAnswers = answersFromParam("friend");
  document.getElementById("result-sub").textContent = "공유받은 결과예요. 나도 해 보려면 아래 '처음부터 다시 하기'를 눌러요.";
  showResult();
} else if (answersFromParam("invite")) {
  // 친구 초대 링크: 메인에 초대 안내를 띄우고, 내가 답하면 같이 할 운동도 보여준다
  friendAnswers = answersFromParam("invite");
  document.getElementById("invite-banner").hidden = false;
}

dataReady
  .then(({ trendsFile, exercises }) => {
    document.getElementById("stat-count").textContent = exercises.length;
    renderParade(new Map(exercises.map((exercise) => [exercise.id, exercise.name])));
    renderTrends(trendsFile, exercises);
  })
  .catch((error) => {
    console.error(error);
    renderParade(new Map());
    renderTrendMessage("트렌드 정보를 불러오지 못했어요.");
  });
