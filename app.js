// key는 data/exercises.json의 필드 이름과 같게 맞춘다 (3단계 점수 계산에서 그대로 비교)
const REQUIRED_QUESTIONS = [
  {
    key: "purpose",
    title: "운동하는 가장 큰 목적은 무엇인가요?",
    options: ["다이어트", "근력", "유연성·자세", "스트레스 해소", "사람 만나기"],
  },
  {
    key: "activity",
    title: "어느 정도로 움직이고 싶나요?",
    options: ["정적·가볍게", "적당히", "동적·땀 흠뻑"],
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
    options: ["15분 이하", "30분", "1시간 이상"],
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

function createAnswers() {
  const answers = { trendFirst: true };
  [...REQUIRED_QUESTIONS, ...DETAIL_QUESTIONS].forEach(({ key }) => {
    answers[key] = null;
  });
  return answers;
}

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

function renderTrends({ updatedAt, trends }, exercises) {
  document.getElementById("trend-date").textContent = updatedAt ? formatDate(updatedAt) : "";

  // exercises.json에 없는 id는 이름을 알 수 없으니 건너뛴다
  const namesById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const top = trends.filter((trend) => namesById.has(trend.id)).slice(0, 3);
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
    const reason = document.createElement("p");
    reason.className = "trend-reason";
    reason.textContent = trend.reason;
    body.append(name, reason);

    item.append(rank, body);
    list.append(item);
  });
}

function createOptionButton(key, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option";
  button.textContent = value;
  button.dataset.key = key;
  button.dataset.value = value;
  const selected = answers[key] === value;
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
  document.getElementById("step-question").hidden = isFinish;
  document.getElementById("step-finish").hidden = !isFinish;
  renderProgress();

  if (isFinish) return;

  const question = REQUIRED_QUESTIONS[currentStep];
  document.getElementById("question-title").textContent = question.title;
  const options = document.getElementById("question-options");
  options.replaceChildren(...question.options.map((value) => createOptionButton(question.key, value)));
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

  answers[key] = value;
  currentStep += 1;
  renderQuestionStep();
}

function createResultCard(result) {
  const { exercise, isTrend } = result;
  const { main, extras } = buildReason(result, answers);

  const card = document.createElement("li");
  card.className = "card result-card";

  const sprite = createSprite(exercise.id, `${exercise.name} 하는 픽셀 캐릭터`);

  const head = document.createElement("div");
  head.className = "result-head";
  const name = document.createElement("h3");
  name.className = "result-name";
  name.textContent = exercise.name;
  head.append(name);
  if (isTrend) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "🔥 요즘 뜨는";
    head.append(badge);
  }

  const desc = document.createElement("p");
  desc.className = "result-desc";
  desc.textContent = exercise.description;

  const reason = document.createElement("div");
  reason.className = "result-reason";
  const reasonMain = document.createElement("p");
  reasonMain.textContent = main;
  reason.append(reasonMain);
  if (extras.length > 0) {
    const reasonExtra = document.createElement("p");
    reasonExtra.className = "result-extra";
    reasonExtra.textContent = extras.join(" · ");
    reason.append(reasonExtra);
  }

  const intro = document.createElement("div");
  intro.className = "result-intro";
  const introText = document.createElement("div");
  introText.append(head, desc);
  intro.append(sprite, introText);

  card.append(intro, reason);
  return card;
}

async function showResult() {
  const list = document.getElementById("result-list");
  const error = document.getElementById("result-error");
  list.replaceChildren();
  error.hidden = true;
  document.getElementById("copy-status").textContent = "";

  try {
    const { exercises, trendIds } = await dataReady;
    const results = recommend(exercises, answers, trendIds);
    list.replaceChildren(...results.map(createResultCard));
  } catch (err) {
    console.error(err);
    error.textContent = "운동 데이터를 불러오지 못했어요. 로컬 서버나 배포 주소로 열었는지 확인해 주세요.";
    error.hidden = false;
  }
  showScreen("result");
}

// 답을 쿼리스트링에 담은 공유 링크 (링크로 들어왔을 때 결과 복원은 5단계)
function buildShareUrl() {
  const params = new URLSearchParams();
  [...REQUIRED_QUESTIONS, ...DETAIL_QUESTIONS].forEach(({ key }) => {
    if (answers[key]) params.set(key, answers[key]);
  });
  params.set("trend", answers.trendFirst ? "1" : "0");
  return `${location.origin}${location.pathname}?${params}`;
}

async function copyShareLink() {
  const status = document.getElementById("copy-status");
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = "링크를 복사했어요!";
  } catch {
    // 클립보드 권한이 없는 환경에서는 링크를 직접 보여준다
    status.textContent = `복사하지 못했어요. 아래 링크를 직접 복사해 주세요.\n${url}`;
  }
}

document.addEventListener("click", (event) => {
  const option = event.target.closest(".option");
  if (option) {
    selectOption(option);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget?.dataset.action === "start") startQuiz();
  if (actionTarget?.dataset.action === "prev") goPrev();
  if (actionTarget?.dataset.action === "show-result") showResult();
  if (actionTarget?.dataset.action === "copy-link") copyShareLink();
});

document.getElementById("trend-toggle").addEventListener("change", (event) => {
  answers.trendFirst = event.target.checked;
});

dataReady
  .then(({ trendsFile, exercises }) => renderTrends(trendsFile, exercises))
  .catch((error) => {
    console.error(error);
    renderTrendMessage("트렌드 정보를 불러오지 못했어요.");
  });
