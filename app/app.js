/*
 * Marketing Plan 퀴즈 (애터미 수당체계 학습) — 앱 로직 (2단계 학습 강화)
 * 순수 HTML/CSS/JS, 빌드 도구 없이 file:// 에서 바로 동작.
 * 문제 데이터는 questions.js 에서 전역 변수(CATEGORIES, QUESTIONS)로 제공됨.
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------
   * 0. 안전장치: 문제 데이터 로드 확인
   * ------------------------------------------------------------ */
  if (typeof window.QUESTIONS === "undefined" || typeof window.CATEGORIES === "undefined") {
    document.body.innerHTML =
      '<p style="padding:40px;font-size:1.1rem;color:#c0263e;">' +
      "문제 데이터(questions.js)를 불러오지 못했습니다. index.html과 questions.js가 같은 폴더에 있는지 확인하세요." +
      "</p>";
    return;
  }

  // questions.js가 제공하는 값을 초기값(오프라인 폴백)으로 복사해 지역 변수로 관리한다.
  // 3단계에서 Supabase가 설정되어 있으면 auth.js가 서버 최신 데이터로
  // window.QuizApp.setQuestions()를 호출해 이 값을 교체한다(관리자 CMS 반영).
  //
  // 4-1단계: 도메인(과목) 인프라. questionsAll/categoriesByDomain은 모든 도메인의
  // 원본 데이터를 담고, CATEGORIES/QUESTIONS는 그중 "현재 선택된 도메인"의 뷰만
  // 담도록 applyDomain()이 매번 다시 채운다 — 이렇게 하면 기존에 CATEGORIES/QUESTIONS를
  // 직접 참조하던 코드(카테고리 목록, 맞춤 퀴즈, 오늘의 퀴즈, 대시보드 등)를 전혀
  // 건드리지 않고도 도메인별로 자동 분리된다.
  var DOMAINS = window.DOMAINS ? window.DOMAINS.slice() : [{ id: "marketing_plan", label: "Marketing Plan" }];
  var categoriesByDomain = window.CATEGORIES_BY_DOMAIN || { marketing_plan: window.CATEGORIES.slice() };
  var questionsAll = window.QUESTIONS.slice();
  var currentDomain = DOMAINS[0].id;
  var QUESTIONS = [];
  var CATEGORIES = [];

  /* ------------------------------------------------------------
   * 1. DOM 참조
   * ------------------------------------------------------------ */
  var screenStart = document.getElementById("screen-start");
  var screenQuiz = document.getElementById("screen-quiz");
  var screenResult = document.getElementById("screen-result");
  var screenDashboard = document.getElementById("screen-dashboard");
  var screenLeaderboard = document.getElementById("screen-leaderboard");
  var screenAdmin = document.getElementById("screen-admin");
  var screenAdminForm = document.getElementById("screen-admin-form");
  var screenAdminStats = document.getElementById("screen-admin-stats");
  var screenCollections = document.getElementById("screen-collections");

  var domainSwitcherEl = document.getElementById("domain-switcher");
  var domainEmptyNoticeEl = document.getElementById("domain-empty-notice");
  var domainQuizActionsEl = document.getElementById("domain-quiz-actions");
  var dashboardDomainSwitcherEl = document.getElementById("dashboard-domain-switcher");
  var startHeroImgEl = document.getElementById("start-hero-img");

  var btnOpenCustomQuiz = document.getElementById("btn-open-custom-quiz");
  var customQuizPanel = document.getElementById("custom-quiz-panel");
  var btnCloseCustomQuiz = document.getElementById("btn-close-custom-quiz");
  var btnOpenDailyQuiz = document.getElementById("btn-open-daily-quiz");
  var btnOpenNotebook = document.getElementById("btn-open-notebook");
  var notebookCountEl = document.getElementById("notebook-count");
  var btnOpenDashboard = document.getElementById("btn-open-dashboard");
  var btnOpenLeaderboard = document.getElementById("btn-open-leaderboard");
  var btnOpenAdmin = document.getElementById("btn-open-admin");
  var btnOpenAdminStats = document.getElementById("btn-open-admin-stats");

  var filterDifficultyEl = document.getElementById("filter-difficulty");
  var filterTypeEl = document.getElementById("filter-type");
  var btnResetFilters = document.getElementById("btn-reset-filters");
  var filterSummaryBadgeEl = document.getElementById("filter-summary-badge");

  var categoryListEl = document.getElementById("category-list");
  var btnRandomAll = document.getElementById("btn-random-all");
  var btnStartSelectedCategories = document.getElementById("btn-start-selected-categories");
  var btnCountMinus = document.getElementById("btn-count-minus");
  var btnCountPlus = document.getElementById("btn-count-plus");
  var btnCountMax = document.getElementById("btn-count-max");
  var quizCountValueEl = document.getElementById("quiz-count-value");
  var btnQuit = document.getElementById("btn-quit");

  var quizProgressText = document.getElementById("quiz-progress-text");
  var progressBarFill = document.getElementById("progress-bar-fill");
  var quizScoreLive = document.getElementById("quiz-score-live");
  var quizCategoryTag = document.getElementById("quiz-category-tag");
  var quizDifficultyTag = document.getElementById("quiz-difficulty-tag");
  var quizQuestionEl = document.getElementById("quiz-question");

  var quizChoicesEl = document.getElementById("quiz-choices");
  var quizInputArea = document.getElementById("quiz-input-area");
  var quizTextInput = document.getElementById("quiz-text-input");
  var quizOrderArea = document.getElementById("quiz-order-area");
  var orderAnswerList = document.getElementById("order-answer-list");
  var orderPoolList = document.getElementById("order-pool-list");
  var btnOrderReset = document.getElementById("btn-order-reset");
  var quizMatchArea = document.getElementById("quiz-match-area");
  var btnSubmitAnswer = document.getElementById("btn-submit-answer");

  var quizFeedbackEl = document.getElementById("quiz-feedback");
  var quizFeedbackResultEl = document.getElementById("quiz-feedback-result");
  var quizFeedbackAnswerEl = document.getElementById("quiz-feedback-answer");
  var quizFeedbackExplanationLabelEl = document.getElementById("quiz-feedback-explanation-label");
  var quizFeedbackExplanationEl = document.getElementById("quiz-feedback-explanation");
  var btnVoiceExplanation = document.getElementById("btn-voice-explanation");
  var voiceExplanationAudio = document.getElementById("voice-explanation-audio");
  var btnNext = document.getElementById("btn-next");

  var resultScoreNum = document.getElementById("result-score-num");
  var resultScorePercent = document.getElementById("result-score-percent");
  var resultMessage = document.getElementById("result-message");
  var resultCategoryTable = document.getElementById("result-category-table");
  var btnRetry = document.getElementById("btn-retry");
  var btnHome = document.getElementById("btn-home");
  var btnResultNotebook = document.getElementById("btn-result-notebook");
  var btnResultDashboard = document.getElementById("btn-result-dashboard");
  var btnResultLeaderboard = document.getElementById("btn-result-leaderboard");

  var dashboardDailyQuizStatus = document.getElementById("dashboard-daily-quiz-status");
  var btnDashboardDailyQuiz = document.getElementById("btn-dashboard-daily-quiz");
  var dashboardTotalAttempts = document.getElementById("dashboard-total-attempts");
  var dashboardTotalAccuracy = document.getElementById("dashboard-total-accuracy");
  var dashboardNotebookCount = document.getElementById("dashboard-notebook-count");
  var dashboardCategoryTable = document.getElementById("dashboard-category-table");
  var dashboardWeakTags = document.getElementById("dashboard-weak-tags");
  var btnDashboardHome = document.getElementById("btn-dashboard-home");

  var btnLeaderboardHome = document.getElementById("btn-leaderboard-home");
  var btnAdminHome = document.getElementById("btn-admin-home");
  var btnAdminFormCancel = document.getElementById("btn-admin-form-cancel");
  var btnAdminStatsHome = document.getElementById("btn-admin-stats-home");

  /* ------------------------------------------------------------
   * 2. 학습 이력 저장소 (LocalStorage)
   * ------------------------------------------------------------ */
  var STORAGE_KEY = "atomyQuizProgressV2";

  // skipCloudSync: applyRemoteStore()가 서버 → 로컬로 반영할 때 그 결과를 다시
  // 서버로 되돌려 쏘는 무한 루프를 막기 위해 true로 호출한다. 그 외 모든 로컬 변경
  // (문제 풀이, 오답노트 갱신 등)에서는 인자 없이 호출해 서버 동기화 훅도 함께 탄다.
  function persistStore(skipCloudSync) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      // LocalStorage를 사용할 수 없는 환경(프라이빗 모드 등)에서는 이력 저장을 건너뛴다.
    }
    // 3단계: 로그인 상태에서 auth.js가 등록한 서버 동기화 훅이 있으면 함께 호출한다.
    // (auth.js가 로드되지 않았거나 로그인 전이면 아무 일도 하지 않는다 — 2단계 동작과 동일)
    if (!skipCloudSync && window.QuizCloudSync && typeof window.QuizCloudSync.onLocalChange === "function") {
      window.QuizCloudSync.onLocalChange(store);
    }
  }

  // 페이지를 열 때마다 이전 로컬 학습 이력은 항상 초기화한다(로그인 여부와 무관하게
  // 이전 방문의 데이터가 남아 보이지 않도록). 로그인된 사용자라면 잠시 후 auth.js가
  // 서버(quiz_progress)에서 실제 이력을 받아와 applyRemoteStore()로 채워 넣는다.
  // dailyQuiz는 4-3단계부터 도메인별 슬롯 구조로 기록한다: { marketing_plan: {date,correct,total}, esg: {...} }
  var store = { history: {}, wrongIds: [], dailyQuiz: {} };
  persistStore(true);
  var wrongIdSet = new Set(store.wrongIds);

  // 4-1단계 방식(평면 구조 + domain 태그: {date,correct,total,domain})으로 저장된
  // 구버전 값을 만나면 도메인별 슬롯 구조로 이전해 하위 호환을 유지한다.
  function normalizeDailyQuiz(raw) {
    if (!raw || typeof raw !== "object") {
      return {};
    }
    if (raw.date) {
      var copy = {};
      copy[raw.domain || "marketing_plan"] = { date: raw.date, correct: raw.correct, total: raw.total };
      return copy;
    }
    return raw;
  }

  // auth.js(3단계, 선택적으로 로드됨)가 로그인/로그아웃 시 학습 이력을 읽고 쓸 수 있도록
  // 최소한의 접점만 전역에 노출한다. app.js의 내부 채점/렌더링 로직은 이 훅과 무관하게
  // 기존과 동일하게 동작한다(auth.js가 없어도 2단계와 100% 동일하게 동작).
  window.QuizApp = {
    getStoreSnapshot: function () {
      return JSON.parse(JSON.stringify(store));
    },
    // 서버에서 받아온 이력으로 로컬 상태를 교체한다 (로그인 시 / 다른 기기 이력 반영 시 사용).
    applyRemoteStore: function (remote) {
      store.history = (remote && typeof remote.history === "object" && remote.history) || {};
      store.wrongIds = (remote && Array.isArray(remote.wrongIds)) ? remote.wrongIds : [];
      store.dailyQuiz = normalizeDailyQuiz(remote && remote.dailyQuiz);
      pruneStaleIds(store);
      wrongIdSet = new Set(store.wrongIds);
      persistStore(true);
      updateNotebookCountUI();
      if (screenDashboard && screenDashboard.hidden === false) {
        renderDashboard();
      }
    },
    // 3단계 CMS: 서버(questions 테이블)에서 최신 문제 데이터를 받아왔을 때
    // 정적 questions.js 대신 이 데이터로 교체한다. 진행 중인 퀴즈(state.quizQuestions)는
    // 이미 별도로 복사된 스냅샷이라 영향을 받지 않는다.
    // 4-1단계: categoriesByDomainArg는 { marketing_plan: [...], esg: [...] } 형태,
    // questions는 각 항목에 domain 필드가 있는 전체 도메인 통합 배열이다.
    setQuestions: function (categoriesByDomainArg, questions) {
      categoriesByDomain = categoriesByDomainArg || categoriesByDomain;
      questionsAll = questions.slice();
      applyDomain(currentDomain);
    },
    getCategories: function () {
      return CATEGORIES.slice();
    },
    // admin.js가 도메인별 카테고리 드롭다운을 채울 때 사용한다.
    getDomains: function () {
      return DOMAINS.slice();
    },
    getCategoriesForDomain: function (domainId) {
      return (categoriesByDomain[domainId] || []).slice();
    },
    // admin.js가 관리자 화면들 사이를 전환할 때 사용한다(app.js가 화면 표시를 전담).
    setScreen: function (name) {
      setScreen(name);
    }
  };

  // 문제 은행에서 삭제/변경되어 더 이상 존재하지 않는 id의 이력·오답노트 기록을 정리한다.
  // (누적 통계와 오답노트 배지 수가 실제 문항 수와 어긋나는 것을 방지)
  function pruneStaleIds(s) {
    // 도메인 필터링 이전의 전체 문제 은행 기준으로 검증한다 — 현재 선택된 도메인과
    // 무관하게, 다른 도메인의 이력까지 "존재하지 않는 문제"로 오인해 지우면 안 된다.
    var validIds = new Set(questionsAll.map(function (q) { return q.id; }));
    Object.keys(s.history).forEach(function (id) {
      if (!validIds.has(id)) {
        delete s.history[id];
      }
    });
    s.wrongIds = s.wrongIds.filter(function (id) { return validIds.has(id); });
  }

  function recordAnswerHistory(q, isCorrect) {
    var h = store.history[q.id];
    if (!h) {
      h = { attempts: 0, correct: 0 };
      store.history[q.id] = h;
    }
    h.attempts++;
    if (isCorrect) {
      h.correct++;
      wrongIdSet.delete(q.id);
    } else {
      wrongIdSet.add(q.id);
    }
    store.wrongIds = Array.from(wrongIdSet);
    persistStore();
    updateNotebookCountUI();

    // 5-3단계: 문제를 1개 이상 채점한 날을 "학습 참여일"로 기록한다(정답 여부 무관).
    if (window.QuizCollections && typeof window.QuizCollections.recordStudyActivity === "function") {
      window.QuizCollections.recordStudyActivity();
    }
  }

  function updateNotebookCountUI() {
    // 오답노트는 현재 도메인 문제만 다시 풀 수 있으므로, 배지 수도 다른 도메인의
    // 오답까지 섞이지 않도록 현재 도메인 기준으로만 센다.
    var count = QUESTIONS.filter(function (q) { return wrongIdSet.has(q.id); }).length;
    notebookCountEl.textContent = String(count);
    btnOpenNotebook.disabled = count === 0;
  }

  /* ------------------------------------------------------------
   * 3. 필터 상태 (난이도 / 문제 유형)
   * ------------------------------------------------------------ */
  var DIFFICULTIES = ["초급", "중급", "고급"];
  var TYPE_LABELS = { mc: "4지선다", ox: "OX", fill: "빈칸채우기", order: "순서배열", calc: "계산", match: "매칭" };
  var TYPE_KEYS = Object.keys(TYPE_LABELS);

  var activeDifficulties = new Set();
  var activeTypes = new Set();

  function matchesFilters(q) {
    if (activeDifficulties.size > 0 && !activeDifficulties.has(q.difficulty)) {
      return false;
    }
    if (activeTypes.size > 0 && !activeTypes.has(q.type)) {
      return false;
    }
    return true;
  }

  function getFilteredPool(category) {
    return QUESTIONS.filter(function (q) {
      if (category && q.category !== category) {
        return false;
      }
      return matchesFilters(q);
    });
  }

  // 카테고리 복수 선택용: categories가 비어있거나 없으면 전체 카테고리 대상.
  function getFilteredPoolMulti(categories) {
    return QUESTIONS.filter(function (q) {
      if (categories && categories.size > 0 && !categories.has(q.category)) {
        return false;
      }
      return matchesFilters(q);
    });
  }

  /* ------------------------------------------------------------
   * 3-1. 문항 수 선택 (5문제 단위, 2단계)
   * 문항 수는 필터(1단계)만 반영한다 — 카테고리(3단계)는 문항 수를 정한 "다음"에
   * 고르는 것이라 문항 수 선택 시점에는 아직 반영할 대상이 아니다. 실제 출제 시
   * 선택한 카테고리의 문제 풀이 이보다 작으면 조용히 그 크기로 줄어든다.
   * ------------------------------------------------------------ */
  var selectedCategories = new Set();
  var desiredCount = 10; // 사용자가 원하는 문항 수(5 단위). 실제 출제 수는 문제 풀 크기로 clamp된다.

  function updateCountPickerUI() {
    var poolSize = getFilteredPool(null).length;
    var effectiveCount = poolSize === 0 ? 0 : Math.min(desiredCount, poolSize);

    quizCountValueEl.textContent = String(effectiveCount);

    btnCountMinus.disabled = poolSize === 0 || desiredCount <= 5;
    btnCountPlus.disabled = poolSize === 0 || effectiveCount >= poolSize;
    btnCountMax.disabled = poolSize === 0;
  }

  btnCountMinus.addEventListener("click", function () {
    desiredCount = Math.max(5, desiredCount - 5);
    updateCountPickerUI();
  });

  btnCountPlus.addEventListener("click", function () {
    var poolSize = getFilteredPool(null).length;
    desiredCount = Math.min(poolSize, desiredCount + 5);
    updateCountPickerUI();
  });

  btnCountMax.addEventListener("click", function () {
    desiredCount = getFilteredPool(null).length;
    updateCountPickerUI();
  });

  function updateStartSelectedCategoriesButton() {
    var n = selectedCategories.size;
    if (n === 0) {
      btnStartSelectedCategories.disabled = true;
      btnStartSelectedCategories.textContent = "카테고리를 선택해 주세요";
    } else {
      var poolSize = getFilteredPoolMulti(selectedCategories).length;
      btnStartSelectedCategories.disabled = poolSize === 0;
      btnStartSelectedCategories.textContent = "선택한 카테고리로 풀기 (" + n + "개 선택)";
    }
  }

  function buildFilterChip(label, value, targetSet, onChange) {
    var id = "filter-chip-" + value;
    var wrapper = document.createElement("label");
    wrapper.className = "filter-chip";
    wrapper.setAttribute("for", id);

    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = targetSet.has(value);
    input.addEventListener("change", function () {
      if (input.checked) {
        targetSet.add(value);
      } else {
        targetSet.delete(value);
      }
      wrapper.classList.toggle("is-active", input.checked);
      onChange();
    });

    wrapper.classList.toggle("is-active", input.checked);
    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode(label));
    return wrapper;
  }

  function renderFilterPanel() {
    filterDifficultyEl.innerHTML = "";
    DIFFICULTIES.forEach(function (d) {
      filterDifficultyEl.appendChild(buildFilterChip(d, d, activeDifficulties, renderCategoryList));
    });

    filterTypeEl.innerHTML = "";
    TYPE_KEYS.forEach(function (t) {
      filterTypeEl.appendChild(buildFilterChip(TYPE_LABELS[t], t, activeTypes, renderCategoryList));
    });
  }

  btnResetFilters.addEventListener("click", function () {
    activeDifficulties.clear();
    activeTypes.clear();
    renderFilterPanel();
    renderCategoryList();
  });

  /* ------------------------------------------------------------
   * 4. 유틸리티
   * ------------------------------------------------------------ */

  // Fisher-Yates shuffle (원본 배열을 변경하지 않고 새 배열 반환)
  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  // 오늘의 퀴즈: 날짜만으로 시드를 만들어, 같은 날에는 항상 같은 10문제가 뽑히게 한다.
  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return hash;
  }

  function todayKey() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  // mulberry32: 시드가 같으면 항상 같은 순서를 내는 결정론적 PRNG
  function seededRandom(seed) {
    var state = seed | 0;
    return function () {
      state = (state + 0x6d2b79f5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleSeeded(arr, rng) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  // 카테고리/필터와 무관하게 전체 문제 은행에서 오늘 날짜 기준으로 고정된 count개를 뽑는다.
  function getDailyQuizQuestions(count) {
    var rng = seededRandom(hashString(todayKey()));
    return shuffleSeeded(QUESTIONS, rng).slice(0, Math.min(count, QUESTIONS.length));
  }

  // 순서가 원본과 완전히 동일하게 섞이는 경우를 줄이기 위한 재시도 셔플
  function shuffleDistinct(arr) {
    if (arr.length <= 1) {
      return arr.slice();
    }
    var copy = shuffle(arr);
    var tries = 0;
    while (tries < 5 && arr.every(function (v, i) { return v === copy[i]; })) {
      copy = shuffle(arr);
      tries++;
    }
    return copy;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeText(str) {
    return String(str).trim().toLowerCase().replace(/[,\s]/g, "");
  }

  // 빈칸채우기 채점 시 사용자가 문제 문장에 이미 나온 단위(%, 원, 만원, 억원 등)를
  // 답에 그대로 포함해 입력해도 오답 처리되지 않도록 끝에 붙은 단위 표기를 제거한다.
  var FILL_UNIT_SUFFIXES = ["%p", "억원", "만원", "%", "원", "억"];
  function stripUnits(str) {
    var s = String(str).trim();
    for (var i = 0; i < FILL_UNIT_SUFFIXES.length; i++) {
      var suffix = FILL_UNIT_SUFFIXES[i];
      if (s.length > suffix.length && s.slice(-suffix.length) === suffix) {
        return s.slice(0, -suffix.length);
      }
    }
    return s;
  }

  function toNumber(str) {
    var cleaned = String(str).replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-") {
      return NaN;
    }
    return Number(cleaned);
  }

  function difficultyClass(d) {
    if (d === "초급") return "easy";
    if (d === "중급") return "mid";
    return "hard";
  }

  // 웹 브라우저 뒤로가기 지원: 시작화면을 벗어날 때 더미 history 항목을 하나
  // 쌓아두고(hasBackGuard), 뒤로가기로 그 항목을 지나오면(popstate) 시작화면으로
  // 되돌린다. 시작화면에서는 더미 항목이 없어야 뒤로가기 한 번에 실제 이전
  // 페이지로 이동하므로, 시작화면으로 돌아올 때는 항목을 소비/정리해 둔다.
  var currentScreenName = "start";
  var hasBackGuard = false;

  function pushBackGuard() {
    try {
      history.pushState({ atomyQuizBackGuard: true }, "", location.href);
      hasBackGuard = true;
    } catch (e) {
      /* history API를 쓸 수 없는 환경(예: file://)에서는 조용히 무시 */
    }
  }

  function setScreen(name) {
    screenStart.hidden = name !== "start";
    screenQuiz.hidden = name !== "quiz";
    screenResult.hidden = name !== "result";
    screenDashboard.hidden = name !== "dashboard";
    screenLeaderboard.hidden = name !== "leaderboard";
    screenAdmin.hidden = name !== "admin";
    screenAdminForm.hidden = name !== "admin-form";
    screenAdminStats.hidden = name !== "admin-stats";
    if (screenCollections) {
      screenCollections.hidden = name !== "collections";
    }
    window.scrollTo(0, 0);

    if (currentScreenName === "start" && name !== "start") {
      pushBackGuard();
    } else if (name === "start" && hasBackGuard) {
      // 뒤로가기가 아니라 버튼 클릭 등으로 시작화면에 돌아온 경우, 남아있는
      // 더미 항목을 지나가서 정리해둔다(다음 popstate는 이미 시작화면이라 무시됨).
      hasBackGuard = false;
      history.back();
    }
    currentScreenName = name;
  }

  window.addEventListener("popstate", function () {
    hasBackGuard = false;
    if (!screenQuiz.hidden) {
      if (confirm("퀴즈를 종료하고 처음 화면으로 돌아갈까요? 진행 상황은 저장되지 않습니다.")) {
        setScreen("start");
        renderCategoryList();
      } else {
        pushBackGuard();
      }
    } else if (screenStart.hidden) {
      setScreen("start");
    }
  });

  /* ------------------------------------------------------------
   * 4-1. 도메인(과목) 전환
   * ------------------------------------------------------------ */
  // 시작화면 설명문(#screen-start-desc)은 마케팅플랜+ESG를 함께 소개하는 고정 문구를
  // index.html에 정적으로 두고, 도메인 전환과 무관하게 유지한다(더 이상 도메인별로
  // 바꿔치지 않는다 — 히어로 이미지만 도메인별로 바뀐다).
  var HERO_IMAGES = {
    marketing_plan: "main_image_marketing_plan.png",
    esg: "main_image_esg_report.png"
  };

  function updateDomainSwitcherUI() {
    [domainSwitcherEl, dashboardDomainSwitcherEl].forEach(function (el) {
      if (!el) {
        return;
      }
      el.querySelectorAll(".domain-switcher__btn").forEach(function (btn) {
        var isActive = btn.dataset.domain === currentDomain;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    });
    if (startHeroImgEl && HERO_IMAGES[currentDomain]) {
      startHeroImgEl.src = HERO_IMAGES[currentDomain];
    }
  }

  // ESG처럼 아직 활성 문항이 없는 도메인을 선택했을 때, 카테고리 0개짜리 빈 화면
  // 대신 "준비 중" 안내로 대체한다(4-2단계에서 문항이 채워지면 자동으로 사라진다).
  function updateDomainEmptyState() {
    var isEmpty = CATEGORIES.length === 0;
    if (domainEmptyNoticeEl) {
      domainEmptyNoticeEl.hidden = !isEmpty;
    }
    if (domainQuizActionsEl) {
      domainQuizActionsEl.hidden = isEmpty;
    }
  }

  function applyDomain(domainId) {
    // setQuestions()(로그인 시 서버 이력 동기화, 관리자 CMS 저장 후 새로고침 등)도
    // 같은 도메인을 다시 적용시키기 위해 이 함수를 호출한다. 그런 경우까지 사용자가
    // 시작 화면에서 골라둔 카테고리 선택을 지우면 안 되므로, 실제 도메인이 바뀔 때만
    // 초기화한다(같은 도메인 내 데이터 갱신 시 사라진 카테고리는 renderCategoryList가
    // 이미 자동으로 선택 해제한다).
    var isDomainChange = domainId !== currentDomain;
    currentDomain = domainId;
    CATEGORIES = (categoriesByDomain[domainId] || []).slice();
    QUESTIONS = questionsAll.filter(function (q) {
      return q.domain === domainId && q.active !== false;
    });
    if (isDomainChange) {
      selectedCategories.clear();
    }

    updateDomainSwitcherUI();
    updateDomainEmptyState();
    renderFilterPanel();
    renderCategoryList();
    updateNotebookCountUI();
  }

  if (domainSwitcherEl) {
    domainSwitcherEl.querySelectorAll(".domain-switcher__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.domain !== currentDomain) {
          applyDomain(btn.dataset.domain);
        }
      });
    });
  }

  // 대시보드 화면에서도 화면 이동 없이 바로 다른 도메인의 학습 진도를 볼 수 있게 한다.
  if (dashboardDomainSwitcherEl) {
    dashboardDomainSwitcherEl.querySelectorAll(".domain-switcher__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.domain !== currentDomain) {
          applyDomain(btn.dataset.domain);
          renderDashboard();
        }
      });
    });
  }

  /* ------------------------------------------------------------
   * 5. 앱 상태
   * ------------------------------------------------------------ */
  var state = {
    lastMode: null,       // { type: "custom", categories: Set|null, count } / { type: "wrong" } / { type: "daily", count } (구 "all"/"category" 유지)
    quizQuestions: [],    // 이번 회차에 출제될 문제(유형별 사본) 배열
    currentIndex: 0,
    correctCount: 0,
    answered: false,      // 현재 문제에 답변했는지
    categoryStats: {},    // { 카테고리명: { correct, total } }
    orderPool: [],         // order 유형: 아직 배치하지 않은 보기
    orderAnswer: [],       // order 유형: 사용자가 배치한 순서
    matchSelections: []    // match 유형: 각 left 항목에 대한 선택값
  };

  /* ------------------------------------------------------------
   * 6. 시작 화면: 카테고리 버튼 렌더링
   * ------------------------------------------------------------ */
  function renderCategoryList() {
    // 필터 변경으로 카테고리 문항 수가 0이 되면 선택에서 자동으로 제외한다.
    CATEGORIES.forEach(function (category) {
      if (selectedCategories.has(category) && getFilteredPool(category).length === 0) {
        selectedCategories.delete(category);
      }
    });

    categoryListEl.innerHTML = "";
    CATEGORIES.forEach(function (category) {
      var count = getFilteredPool(category).length;
      var isSelected = selectedCategories.has(category);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-btn" + (isSelected ? " is-selected" : "");
      btn.disabled = count === 0;
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
      btn.innerHTML =
        '<span class="category-btn__name">' + escapeHtml(category) + "</span>" +
        '<span class="category-btn__check" aria-hidden="true"></span>';
      btn.addEventListener("click", function () {
        if (selectedCategories.has(category)) {
          selectedCategories.delete(category);
        } else {
          selectedCategories.add(category);
        }
        renderCategoryList();
        updateStartSelectedCategoriesButton();
      });
      categoryListEl.appendChild(btn);
    });

    var totalCount = getFilteredPool(null).length;
    btnRandomAll.disabled = totalCount === 0;

    // 필터 아코디언이 접혀 있어도 "필터가 적용 중"이라는 사실이 보이도록 배지를 표시한다.
    var activeFilterCount = activeDifficulties.size + activeTypes.size;
    if (filterSummaryBadgeEl) {
      if (activeFilterCount > 0) {
        filterSummaryBadgeEl.textContent = "필터 " + activeFilterCount + "개 적용 중";
        filterSummaryBadgeEl.hidden = false;
      } else {
        filterSummaryBadgeEl.hidden = true;
      }
    }

    updateCountPickerUI();
    updateStartSelectedCategoriesButton();
  }

  /* ------------------------------------------------------------
   * 7. 퀴즈 시작
   * ------------------------------------------------------------ */
  function prepareQuestion(original) {
    if (original.type === "mc") {
      var order = shuffle([0, 1, 2, 3]);
      var shuffledChoices = order.map(function (origIdx) {
        return original.choices[origIdx];
      });
      var newAnswerIndex = order.indexOf(original.answerIndex);
      return Object.assign({}, original, { choices: shuffledChoices, answerIndex: newAnswerIndex });
    }
    if (original.type === "order") {
      return Object.assign({}, original, { displayItems: shuffleDistinct(original.items) });
    }
    if (original.type === "match") {
      var rightOptions = shuffleDistinct(original.pairs.map(function (p) { return p.right; }));
      return Object.assign({}, original, { rightOptions: rightOptions });
    }
    return Object.assign({}, original);
  }

  // 문제 풀이는 로그인한 사용자만 가능하다(학습 이력을 서버에 귀속시키기 위함).
  function isLoggedIn() {
    return !!(window.QuizCloudSync && window.QuizCloudSync.getCurrentUser && window.QuizCloudSync.getCurrentUser());
  }

  function requireLoginOrPrompt() {
    if (isLoggedIn()) {
      return true;
    }
    if (window.QuizCloudSync && window.QuizCloudSync.openLoginPanel) {
      window.QuizCloudSync.openLoginPanel();
      alert("문제를 풀려면 먼저 로그인해주세요.");
    } else {
      alert("문제를 풀려면 로그인이 필요합니다. 계정 기능을 사용할 수 없는 환경입니다.");
    }
    return false;
  }

  function startQuiz(mode) {
    if (!requireLoginOrPrompt()) {
      return;
    }
    var pool;
    if (mode.type === "all") {
      pool = getFilteredPool(null);
    } else if (mode.type === "category") {
      pool = getFilteredPool(mode.category);
    } else if (mode.type === "custom") {
      pool = getFilteredPoolMulti(mode.categories);
    } else if (mode.type === "wrong") {
      pool = QUESTIONS.filter(function (q) { return wrongIdSet.has(q.id); });
    } else if (mode.type === "daily") {
      pool = getDailyQuizQuestions(mode.count || 10);
    } else {
      pool = [];
    }

    if (pool.length === 0) {
      alert("해당 조건에 출제할 문제가 없습니다.");
      return;
    }

    var shuffledPool = shuffle(pool);
    if (mode.count && mode.count > 0 && mode.count < shuffledPool.length) {
      shuffledPool = shuffledPool.slice(0, mode.count);
    }

    state.lastMode = mode;
    state.quizQuestions = shuffledPool.map(prepareQuestion);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.categoryStats = {};
    CATEGORIES.forEach(function (c) {
      state.categoryStats[c] = { correct: 0, total: 0 };
    });

    setScreen("quiz");
    renderQuestion();
  }

  /* ------------------------------------------------------------
   * 8. 퀴즈 화면: 문제 렌더링
   * ------------------------------------------------------------ */
  function renderQuestion() {
    state.answered = false;
    state.orderPool = [];
    state.orderAnswer = [];
    state.matchSelections = [];

    var total = state.quizQuestions.length;
    var idx = state.currentIndex;
    var q = state.quizQuestions[idx];

    quizProgressText.textContent = (idx + 1) + " / " + total;
    progressBarFill.style.width = Math.round((idx / total) * 100) + "%";
    quizScoreLive.textContent = state.correctCount + "점";

    quizCategoryTag.textContent = q.category;
    quizDifficultyTag.textContent = q.difficulty;
    quizDifficultyTag.className = "difficulty-tag difficulty-tag--" + difficultyClass(q.difficulty);
    quizQuestionEl.textContent = q.question;

    // 모든 유형별 입력 영역 초기화
    quizChoicesEl.hidden = true;
    quizChoicesEl.innerHTML = "";
    quizInputArea.hidden = true;
    quizTextInput.value = "";
    quizTextInput.disabled = false;
    quizOrderArea.hidden = true;
    orderAnswerList.innerHTML = "";
    orderPoolList.innerHTML = "";
    btnOrderReset.disabled = false;
    quizMatchArea.hidden = true;
    quizMatchArea.innerHTML = "";
    btnSubmitAnswer.hidden = true;
    btnSubmitAnswer.disabled = true;

    quizFeedbackEl.hidden = true;
    quizFeedbackAnswerEl.hidden = true;
    btnNext.disabled = true;
    btnNext.textContent = (idx === total - 1) ? "결과 보기" : "다음 문제";

    if (q.type === "mc") {
      renderMcChoices(q);
    } else if (q.type === "ox") {
      renderOxChoices(q);
    } else if (q.type === "fill" || q.type === "calc") {
      renderInputArea(q);
    } else if (q.type === "order") {
      renderOrderArea(q);
    } else if (q.type === "match") {
      renderMatchArea(q);
    }
  }

  function renderMcChoices(q) {
    quizChoicesEl.hidden = false;
    var markers = ["①", "②", "③", "④"];
    q.choices.forEach(function (choiceText, choiceIdx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.innerHTML =
        '<span class="choice-btn__marker">' + markers[choiceIdx] + "</span>" +
        "<span>" + escapeHtml(choiceText) + "</span>";
      btn.addEventListener("click", function () {
        handleAnswer(choiceIdx);
      });
      quizChoicesEl.appendChild(btn);
    });
  }

  function renderOxChoices(q) {
    quizChoicesEl.hidden = false;
    var options = [
      { label: "⭕ O (맞다)", value: true },
      { label: "❌ X (아니다)", value: false }
    ];
    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn choice-btn--ox";
      btn.textContent = opt.label;
      btn.addEventListener("click", function () {
        handleAnswer(opt.value);
      });
      quizChoicesEl.appendChild(btn);
    });
  }

  function renderInputArea(q) {
    quizInputArea.hidden = false;
    quizTextInput.placeholder = q.type === "calc" ? "숫자만 입력하세요" : "정답을 입력하세요";
    btnSubmitAnswer.hidden = false;
    btnSubmitAnswer.disabled = false;
    quizTextInput.focus();
  }

  // state.orderPool / state.orderAnswer는 항목 텍스트가 아니라 q.displayItems의
  // 인덱스를 보관한다. 텍스트(값) 기준으로 pool에서 제거하면, 동일한 문구가 두 번
  // 이상 등장하는 순서배열 문제가 추가될 경우 하나만 클릭해도 같은 값이 전부
  // 사라져 정답을 완성할 수 없게 되는 문제가 있어 인덱스 기준으로 관리한다.
  function renderOrderLists(q) {
    orderAnswerList.innerHTML = "";
    state.orderAnswer.forEach(function (idx, i) {
      var chip = document.createElement("div");
      chip.className = "order-chip order-chip--selected";
      chip.textContent = (i + 1) + ". " + q.displayItems[idx];
      orderAnswerList.appendChild(chip);
    });

    orderPoolList.innerHTML = "";
    state.orderPool.forEach(function (idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "order-chip order-chip--pool";
      btn.textContent = q.displayItems[idx];
      btn.addEventListener("click", function () {
        if (state.answered) {
          return;
        }
        state.orderAnswer.push(idx);
        state.orderPool = state.orderPool.filter(function (v) { return v !== idx; });
        renderOrderLists(q);
        btnSubmitAnswer.disabled = state.orderAnswer.length !== q.items.length;
      });
      orderPoolList.appendChild(btn);
    });
  }

  function renderOrderArea(q) {
    quizOrderArea.hidden = false;
    state.orderPool = q.displayItems.map(function (_, idx) { return idx; });
    state.orderAnswer = [];
    renderOrderLists(q);
    btnSubmitAnswer.hidden = false;
    btnSubmitAnswer.disabled = true;
  }

  function getOrderAnswerTexts(q) {
    return state.orderAnswer.map(function (idx) { return q.displayItems[idx]; });
  }

  function renderMatchArea(q) {
    quizMatchArea.hidden = false;
    quizMatchArea.innerHTML = "";
    state.matchSelections = q.pairs.map(function () { return ""; });

    q.pairs.forEach(function (pair, i) {
      var row = document.createElement("div");
      row.className = "match-row";

      var label = document.createElement("span");
      label.className = "match-row__label";
      label.textContent = pair.left;

      var select = document.createElement("select");
      select.className = "match-row__select";

      var emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "선택하세요";
      select.appendChild(emptyOpt);

      q.rightOptions.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      });

      select.addEventListener("change", function () {
        state.matchSelections[i] = select.value;
        var complete = state.matchSelections.every(function (v) { return v; });
        btnSubmitAnswer.disabled = !complete;
      });

      row.appendChild(label);
      row.appendChild(select);
      quizMatchArea.appendChild(row);
    });

    btnSubmitAnswer.hidden = false;
    btnSubmitAnswer.disabled = true;
  }

  /* ------------------------------------------------------------
   * 9. 채점
   * ------------------------------------------------------------ */
  function checkAnswer(q, userAnswer) {
    switch (q.type) {
      case "mc":
        return userAnswer === q.answerIndex;
      case "ox":
        return userAnswer === q.answer;
      case "fill": {
        var accepted = [q.answer].concat(q.acceptableAnswers || [])
          .map(function (a) { return normalizeText(stripUnits(a)); });
        return accepted.indexOf(normalizeText(stripUnits(userAnswer))) !== -1;
      }
      case "calc": {
        var a = toNumber(userAnswer);
        var b = toNumber(q.answer);
        return !isNaN(a) && a === b;
      }
      case "order":
        return Array.isArray(userAnswer) &&
          userAnswer.length === q.items.length &&
          userAnswer.every(function (v, i) { return v === q.items[i]; });
      case "match":
        return Array.isArray(userAnswer) &&
          userAnswer.length === q.pairs.length &&
          userAnswer.every(function (v, i) { return v === q.pairs[i].right; });
      default:
        return false;
    }
  }

  function formatCorrectAnswer(q) {
    if (q.type === "fill") return q.answer;
    if (q.type === "calc") return q.answer + (q.unit ? q.unit : "");
    if (q.type === "order") return q.items.join(" → ");
    if (q.type === "match") return q.pairs.map(function (p) { return p.left + " - " + p.right; }).join(", ");
    return "";
  }

  function highlightMcButtons(q, selectedIdx) {
    var buttons = quizChoicesEl.querySelectorAll(".choice-btn");
    buttons.forEach(function (btn, i) {
      btn.disabled = true;
      if (i === q.answerIndex) {
        btn.classList.add("is-correct");
      } else if (i === selectedIdx) {
        btn.classList.add("is-incorrect");
      } else {
        btn.classList.add("is-disabled-muted");
      }
    });
  }

  function highlightOxButtons(q, selectedValue) {
    var buttons = quizChoicesEl.querySelectorAll(".choice-btn");
    var values = [true, false];
    buttons.forEach(function (btn, i) {
      btn.disabled = true;
      if (values[i] === q.answer) {
        btn.classList.add("is-correct");
      } else if (values[i] === selectedValue) {
        btn.classList.add("is-incorrect");
      } else {
        btn.classList.add("is-disabled-muted");
      }
    });
  }

  function markOrderResult(q) {
    var userTexts = getOrderAnswerTexts(q);
    var chips = orderAnswerList.querySelectorAll(".order-chip");
    chips.forEach(function (chip, i) {
      if (userTexts[i] === q.items[i]) {
        chip.classList.add("is-correct");
      } else {
        chip.classList.add("is-incorrect");
      }
    });
    btnOrderReset.disabled = true;
  }

  function markMatchResult(q) {
    var rows = quizMatchArea.querySelectorAll(".match-row");
    rows.forEach(function (row, i) {
      var select = row.querySelector("select");
      select.disabled = true;
      if (state.matchSelections[i] === q.pairs[i].right) {
        row.classList.add("is-correct");
      } else {
        row.classList.add("is-incorrect");
      }
    });
  }

  function renderFeedbackUI(q, userAnswer, isCorrect) {
    if (q.type === "mc") {
      highlightMcButtons(q, userAnswer);
    } else if (q.type === "ox") {
      highlightOxButtons(q, userAnswer);
    } else if (q.type === "fill" || q.type === "calc") {
      quizTextInput.disabled = true;
    } else if (q.type === "order") {
      markOrderResult(q);
    } else if (q.type === "match") {
      markMatchResult(q);
    }

    quizFeedbackResultEl.textContent = isCorrect ? "정답입니다!" : "오답입니다.";
    quizFeedbackResultEl.className =
      "quiz-feedback__result " + (isCorrect ? "is-correct" : "is-incorrect");

    if (q.type === "mc" || q.type === "ox") {
      quizFeedbackAnswerEl.hidden = true;
    } else {
      quizFeedbackAnswerEl.hidden = false;
      quizFeedbackAnswerEl.textContent = "정답: " + formatCorrectAnswer(q);
    }

    quizFeedbackExplanationEl.textContent = q.explanation;
    quizFeedbackExplanationEl.classList.toggle("is-detailed", !isCorrect);
    quizFeedbackExplanationLabelEl.hidden = isCorrect;

    if (!isCorrect && q.voiceExplanationUrl) {
      btnVoiceExplanation.hidden = false;
      voiceExplanationAudio.src = q.voiceExplanationUrl;
    } else {
      btnVoiceExplanation.hidden = true;
      voiceExplanationAudio.removeAttribute("src");
    }

    quizFeedbackEl.hidden = false;
  }

  function handleAnswer(userAnswer) {
    if (state.answered) {
      return; // 이미 답변한 문제는 재선택 불가 (채점 정확도 보장)
    }
    state.answered = true;

    var q = state.quizQuestions[state.currentIndex];
    var isCorrect = checkAnswer(q, userAnswer);

    if (isCorrect) {
      state.correctCount++;
    }
    state.categoryStats[q.category].total++;
    if (isCorrect) {
      state.categoryStats[q.category].correct++;
    }

    recordAnswerHistory(q, isCorrect);
    renderFeedbackUI(q, userAnswer, isCorrect);

    quizScoreLive.textContent = state.correctCount + "점";
    progressBarFill.style.width = Math.round(((state.currentIndex + 1) / state.quizQuestions.length) * 100) + "%";

    btnSubmitAnswer.hidden = true;
    btnNext.disabled = false;
  }

  function submitCurrentAnswer() {
    var q = state.quizQuestions[state.currentIndex];
    if (state.answered) {
      return;
    }
    if (q.type === "fill" || q.type === "calc") {
      var val = quizTextInput.value.trim();
      if (!val) {
        quizTextInput.focus();
        return;
      }
      handleAnswer(val);
    } else if (q.type === "order") {
      if (state.orderAnswer.length !== q.items.length) {
        return;
      }
      handleAnswer(getOrderAnswerTexts(q));
    } else if (q.type === "match") {
      var complete = state.matchSelections.length === q.pairs.length &&
        state.matchSelections.every(function (v) { return v; });
      if (!complete) {
        return;
      }
      handleAnswer(state.matchSelections.slice());
    }
  }

  function goNext() {
    if (!state.answered) {
      return; // 답변 전에는 다음으로 넘어갈 수 없음
    }
    if (state.currentIndex < state.quizQuestions.length - 1) {
      state.currentIndex++;
      renderQuestion();
    } else {
      showResult();
    }
  }

  /* ------------------------------------------------------------
   * 10. 결과 화면
   * ------------------------------------------------------------ */
  function showResult() {
    var total = state.quizQuestions.length;
    var correct = state.correctCount;
    var percent = total > 0 ? Math.round((correct / total) * 100) : 0;

    if (state.lastMode && state.lastMode.type === "daily") {
      // 도메인별 슬롯에 독립적으로 기록해 마케팅플랜/ESG 오늘의 퀴즈를 각각 1회씩 운영한다.
      store.dailyQuiz[currentDomain] = { date: todayKey(), correct: correct, total: total };
      persistStore();
      // 5-3단계: 오늘의 퀴즈 스트릭(정답 여부 무관, 참여 자체를 기록)
      if (window.QuizCollections && typeof window.QuizCollections.recordDailyQuizActivity === "function") {
        window.QuizCollections.recordDailyQuizActivity();
      }
    }

    resultScoreNum.textContent = correct + " / " + total;
    resultScorePercent.textContent = percent + "%";
    resultMessage.textContent = buildResultMessage(percent);

    resultCategoryTable.innerHTML = "";
    CATEGORIES.forEach(function (category) {
      var stat = state.categoryStats[category];
      if (!stat || stat.total === 0) {
        return; // 이번 회차에 출제되지 않은 카테고리는 표시하지 않음
      }
      var pct = Math.round((stat.correct / stat.total) * 100);

      var row = document.createElement("div");
      row.className = "result-category-row";
      row.innerHTML =
        '<span class="result-category-row__name">' + escapeHtml(category) + "</span>" +
        '<span class="result-category-row__bar"><span class="result-category-row__bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="result-category-row__score">' + stat.correct + "/" + stat.total + " (" + pct + "%)</span>";
      resultCategoryTable.appendChild(row);
    });

    setScreen("result");

    // 5-1단계: 퀴즈 제출 직후 컬렉션 발급 여부를 판정한다(로그인 상태가 아니면 아무 일도 안 함).
    if (window.QuizCollections && typeof window.QuizCollections.onQuizCompleted === "function") {
      window.QuizCollections.onQuizCompleted();
    }
  }

  function buildResultMessage(percent) {
    if (percent === 100) return "완벽합니다! 애터미 수당체계를 정확히 이해하고 있습니다.";
    if (percent >= 80) return "훌륭합니다! 조금만 더 다지면 완벽해집니다.";
    if (percent >= 60) return "잘 하고 있습니다. 틀린 부분의 해설을 다시 확인해 보세요.";
    if (percent >= 40) return "기본은 갖췄습니다. 오답 부분을 위주로 다시 학습해 보세요.";
    return "괜찮습니다, 처음이니까요. 해설을 꼼꼼히 읽고 다시 도전해 보세요.";
  }

  /* ------------------------------------------------------------
   * 11. 학습 진도 대시보드
   * ------------------------------------------------------------ */
  function computeCategoryStats() {
    var stats = {};
    CATEGORIES.forEach(function (c) { stats[c] = { attempts: 0, correct: 0 }; });
    QUESTIONS.forEach(function (q) {
      var h = store.history[q.id];
      if (!h || h.attempts === 0) {
        return;
      }
      stats[q.category].attempts += h.attempts;
      stats[q.category].correct += h.correct;
    });
    return stats;
  }

  function computeTagStats() {
    var stats = {};
    QUESTIONS.forEach(function (q) {
      var h = store.history[q.id];
      if (!h || h.attempts === 0) {
        return;
      }
      (q.tags || []).forEach(function (tag) {
        if (!stats[tag]) {
          stats[tag] = { attempts: 0, correct: 0 };
        }
        stats[tag].attempts += h.attempts;
        stats[tag].correct += h.correct;
      });
    });
    return stats;
  }

  function renderDashboard() {
    if (dashboardDailyQuizStatus) {
      var daily = store.dailyQuiz[currentDomain];
      if (daily && daily.date === todayKey()) {
        var dailyPct = daily.total > 0 ? Math.round((daily.correct / daily.total) * 100) : 0;
        dashboardDailyQuizStatus.textContent = "오늘 완료: " + daily.correct + " / " + daily.total + " (" + dailyPct + "%)";
        dashboardDailyQuizStatus.className = "dashboard-daily-quiz__status is-done";
        btnDashboardDailyQuiz.textContent = "오늘의 퀴즈 다시 풀기";
      } else {
        dashboardDailyQuizStatus.textContent = "아직 오늘의 퀴즈를 풀지 않았어요";
        dashboardDailyQuizStatus.className = "dashboard-daily-quiz__status";
        btnDashboardDailyQuiz.textContent = "오늘의 퀴즈 풀기";
      }
    }

    // 다른 도메인의 학습 기록이 섞이지 않도록 store.history 전체가 아니라
    // 현재 도메인 문제(QUESTIONS)에 해당하는 이력만 합산한다.
    var totalAttempts = 0;
    var totalCorrect = 0;
    var domainWrongCount = 0;
    QUESTIONS.forEach(function (q) {
      var h = store.history[q.id];
      if (h) {
        totalAttempts += h.attempts;
        totalCorrect += h.correct;
      }
      if (wrongIdSet.has(q.id)) {
        domainWrongCount++;
      }
    });
    dashboardTotalAttempts.textContent = String(totalAttempts);
    dashboardTotalAccuracy.textContent = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) + "%" : "-";
    dashboardNotebookCount.textContent = String(domainWrongCount);

    var catStats = computeCategoryStats();
    dashboardCategoryTable.innerHTML = "";
    CATEGORIES.forEach(function (category) {
      var s = catStats[category];
      var row = document.createElement("div");
      row.className = "result-category-row";

      if (s.attempts === 0) {
        row.innerHTML =
          '<span class="result-category-row__name">' + escapeHtml(category) + "</span>" +
          '<span class="result-category-row__score">아직 학습 기록 없음</span>';
        dashboardCategoryTable.appendChild(row);
        return;
      }

      var pct = Math.round((s.correct / s.attempts) * 100);
      var weak = pct < 60;
      if (weak) {
        row.className += " result-category-row--weak";
      }
      row.innerHTML =
        '<span class="result-category-row__name">' + escapeHtml(category) +
        (weak ? ' <span class="weak-badge">취약</span>' : "") + "</span>" +
        '<span class="result-category-row__bar"><span class="result-category-row__bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="result-category-row__score">' + s.correct + "/" + s.attempts + " (" + pct + "%)</span>";
      dashboardCategoryTable.appendChild(row);
    });

    var tagStats = computeTagStats();
    var tagEntries = Object.keys(tagStats)
      .map(function (tag) {
        var s = tagStats[tag];
        return { tag: tag, attempts: s.attempts, correct: s.correct, pct: Math.round((s.correct / s.attempts) * 100) };
      })
      .filter(function (e) { return e.attempts >= 2; })
      .sort(function (a, b) { return a.pct - b.pct; })
      .slice(0, 5);

    dashboardWeakTags.innerHTML = "";
    if (tagEntries.length === 0) {
      var empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "아직 충분한 학습 기록이 없습니다. 문제를 더 풀어보세요.";
      dashboardWeakTags.appendChild(empty);
    } else {
      tagEntries.forEach(function (e) {
        var row = document.createElement("div");
        row.className = "result-category-row";
        row.innerHTML =
          '<span class="result-category-row__name">#' + escapeHtml(e.tag) + "</span>" +
          '<span class="result-category-row__bar"><span class="result-category-row__bar-fill" style="width:' + e.pct + '%"></span></span>' +
          '<span class="result-category-row__score">' + e.correct + "/" + e.attempts + " (" + e.pct + "%)</span>";
        dashboardWeakTags.appendChild(row);
      });
    }
  }

  /* ------------------------------------------------------------
   * 12. 이벤트 바인딩
   * ------------------------------------------------------------ */
  btnRandomAll.addEventListener("click", function () {
    var poolSize = getFilteredPool(null).length;
    startQuiz({ type: "custom", categories: null, count: Math.min(desiredCount, poolSize) });
  });

  btnStartSelectedCategories.addEventListener("click", function () {
    if (selectedCategories.size === 0) {
      return;
    }
    var categoriesSnapshot = new Set(selectedCategories);
    var poolSize = getFilteredPoolMulti(categoriesSnapshot).length;
    startQuiz({ type: "custom", categories: categoriesSnapshot, count: Math.min(desiredCount, poolSize) });
  });

  function openCustomQuizPanel() {
    customQuizPanel.hidden = false;
    customQuizPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeCustomQuizPanel() {
    customQuizPanel.hidden = true;
  }

  btnOpenCustomQuiz.addEventListener("click", function () {
    if (customQuizPanel.hidden) {
      openCustomQuizPanel();
    } else {
      closeCustomQuizPanel();
    }
  });

  btnCloseCustomQuiz.addEventListener("click", closeCustomQuizPanel);

  btnOpenDailyQuiz.addEventListener("click", function () {
    startQuiz({ type: "daily", count: 10 });
  });

  btnOpenNotebook.addEventListener("click", function () {
    startQuiz({ type: "wrong" });
  });

  btnOpenDashboard.addEventListener("click", function () {
    renderDashboard();
    setScreen("dashboard");
  });

  // 랭킹 데이터 조회는 Supabase가 설정된 경우에만 auth.js가 별도로 이 버튼에
  // 리스너를 추가해 처리한다. app.js는 화면 전환만 담당한다(Supabase 비의존).
  btnOpenLeaderboard.addEventListener("click", function () {
    setScreen("leaderboard");
  });

  // 관리자 문제 관리 화면 진입 버튼(#btn-open-admin)은 관리자에게만 보이도록
  // auth.js가 로그인/권한 확인 후 hidden 속성을 제어한다. 화면 전환 자체는
  // 여기서 처리하고, 목록/폼 렌더링은 admin.js가 담당한다.
  if (btnOpenAdmin) {
    btnOpenAdmin.addEventListener("click", function () {
      setScreen("admin");
    });
  }

  if (btnOpenAdminStats) {
    btnOpenAdminStats.addEventListener("click", function () {
      setScreen("admin-stats");
    });
  }

  if (btnAdminStatsHome) {
    btnAdminStatsHome.addEventListener("click", function () {
      setScreen("start");
    });
  }

  if (btnAdminHome) {
    btnAdminHome.addEventListener("click", function () {
      setScreen("start");
    });
  }

  var btnHeaderHome = document.getElementById("btn-header-home");
  if (btnHeaderHome) {
    btnHeaderHome.addEventListener("click", function () {
      if (!screenQuiz.hidden) {
        quitQuizToStart();
        return;
      }
      setScreen("start");
    });
  }

  if (btnAdminFormCancel) {
    btnAdminFormCancel.addEventListener("click", function () {
      setScreen("admin");
    });
  }

  btnSubmitAnswer.addEventListener("click", submitCurrentAnswer);

  quizTextInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCurrentAnswer();
    }
  });

  btnOrderReset.addEventListener("click", function () {
    if (state.answered) {
      return;
    }
    var q = state.quizQuestions[state.currentIndex];
    state.orderPool = q.displayItems.map(function (_, idx) { return idx; });
    state.orderAnswer = [];
    renderOrderLists(q);
    btnSubmitAnswer.disabled = true;
  });

  btnNext.addEventListener("click", goNext);

  btnVoiceExplanation.addEventListener("click", function () {
    if (!voiceExplanationAudio.src) {
      return;
    }
    voiceExplanationAudio.currentTime = 0;
    voiceExplanationAudio.play();
  });

  function quitQuizToStart() {
    if (confirm("퀴즈를 종료하고 처음 화면으로 돌아갈까요? 진행 상황은 저장되지 않습니다.")) {
      setScreen("start");
      renderCategoryList();
    }
  }

  btnQuit.addEventListener("click", quitQuizToStart);

  btnRetry.addEventListener("click", function () {
    if (state.lastMode) {
      startQuiz(state.lastMode);
    }
  });

  btnHome.addEventListener("click", function () {
    renderCategoryList();
    setScreen("start");
  });

  btnResultNotebook.addEventListener("click", function () {
    startQuiz({ type: "wrong" });
  });

  btnResultDashboard.addEventListener("click", function () {
    renderDashboard();
    setScreen("dashboard");
  });

  btnDashboardHome.addEventListener("click", function () {
    renderCategoryList();
    setScreen("start");
  });

  btnDashboardDailyQuiz.addEventListener("click", function () {
    startQuiz({ type: "daily", count: 10 });
  });

  btnResultLeaderboard.addEventListener("click", function () {
    setScreen("leaderboard");
  });

  btnLeaderboardHome.addEventListener("click", function () {
    renderCategoryList();
    setScreen("start");
  });

  /* ------------------------------------------------------------
   * 13. 초기화
   * ------------------------------------------------------------ */
  applyDomain(currentDomain);
  setScreen("start");
})();
