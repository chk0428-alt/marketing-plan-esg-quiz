/*
 * Marketing Plan 퀴즈 (애터미 수당체계 학습) — 관리자용 문제 관리 CMS (3단계)
 *
 * Supabase의 questions 테이블에 대해 등록/수정/삭제를 수행한다.
 * RLS 정책(questions_insert_admin 등)이 실제 권한을 강제하므로, 이 파일은
 * 관리자가 아닌 사용자가 열어도 서버가 요청을 거부해 안전하다 — 다만 UX상
 * "문제 관리" 진입 버튼 자체는 auth.js가 관리자에게만 보이도록 처리한다.
 *
 * app.js와의 접점: window.QuizApp.getDomains()/getCategoriesForDomain()/setScreen(),
 * 그리고 CRUD 완료 후 화면에 즉시 반영하기 위한 window.QuizCloudSync.refreshQuestions().
 * 이 파일이 없거나 Supabase가 설정되지 않았으면 앱은 그대로 동작한다.
 */

(function () {
  "use strict";

  var QUESTIONS_TABLE = "questions";
  var TYPE_LABELS = { mc: "4지선다", ox: "OX", fill: "빈칸채우기", calc: "계산", order: "순서배열", match: "매칭" };

  var DOMAIN_PREFIX = { marketing_plan: "q", esg: "e" };

  var elList = document.getElementById("admin-question-list");
  var elDomainFilter = document.getElementById("admin-domain-filter");
  var elCategoryFilter = document.getElementById("admin-category-filter");
  var elReportYearFilter = document.getElementById("admin-report-year-filter");
  var elActiveFilter = document.getElementById("admin-active-filter");
  var elBtnNew = document.getElementById("btn-admin-new");

  var elFormTitle = document.getElementById("admin-form-title");
  var elFieldId = document.getElementById("admin-field-id");
  var elFieldDomain = document.getElementById("admin-field-domain");
  var elFieldCategory = document.getElementById("admin-field-category");
  var elFieldReportYear = document.getElementById("admin-field-report-year");
  var elFieldActive = document.getElementById("admin-field-active");
  var elFieldDifficulty = document.getElementById("admin-field-difficulty");
  var elFieldType = document.getElementById("admin-field-type");
  var elFieldTags = document.getElementById("admin-field-tags");
  var elFieldQuestion = document.getElementById("admin-field-question");
  var elFieldExplanation = document.getElementById("admin-field-explanation");
  var elTypeFields = document.getElementById("admin-type-fields");
  var elFormMessage = document.getElementById("admin-form-message");
  var elBtnSave = document.getElementById("btn-admin-form-save");
  var elBtnDelete = document.getElementById("btn-admin-form-delete");

  if (!elList || !elFormTitle) {
    return; // 구버전 index.html(관리자 화면 마크업 없음)에서는 아무 것도 하지 않는다.
  }

  if (!window.QuizSupabaseClient) {
    return; // Supabase 미설정 — auth.js가 이미 관리자 진입 버튼을 숨겨두므로 화면 자체에 도달하지 않는다.
  }

  var client = window.QuizSupabaseClient;
  var editingId = null; // null이면 "새 문제 추가" 모드
  var cachedRows = [];

  function describeError(err) {
    if (!err) return "알 수 없는 오류가 발생했습니다.";
    return err.message || String(err);
  }

  function escapeHtmlLocal(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function setFormMessage(text, isError) {
    elFormMessage.textContent = text || "";
    elFormMessage.className = "account-message" + (isError ? " is-error" : "");
  }

  // --- 도메인/카테고리 셀렉트 채우기 (4-1단계: 도메인 구분 관리) --------------------

  function getDomains() {
    return (window.QuizApp && window.QuizApp.getDomains()) || [{ id: "marketing_plan", label: "Marketing Plan" }];
  }

  function getCategoriesForDomain(domainId) {
    return (window.QuizApp && window.QuizApp.getCategoriesForDomain(domainId)) || [];
  }

  function populateDomainSelects() {
    var domains = getDomains();

    elDomainFilter.innerHTML = '<option value="">전체 영역</option>';
    domains.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.label;
      elDomainFilter.appendChild(opt);
    });

    elFieldDomain.innerHTML = "";
    domains.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.label;
      elFieldDomain.appendChild(opt);
    });
  }

  // 목록 화면의 카테고리 필터: 카테고리는 도메인에 종속된 값이라(서로 다른 도메인에
  // 같은 이름의 카테고리가 있을 수 있음), 도메인을 먼저 선택해야만 카테고리별로
  // 좁혀볼 수 있다. "전체 영역"일 때는 도메인 간 카테고리명이 섞이지 않도록
  // 카테고리 옵션을 아예 제공하지 않는다.
  function populateCategoryFilterOptions() {
    var domainValue = elDomainFilter.value;
    var categories = domainValue ? getCategoriesForDomain(domainValue) : [];

    var previous = elCategoryFilter.value;
    elCategoryFilter.innerHTML = '<option value="">전체 카테고리</option>';
    categories.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      elCategoryFilter.appendChild(opt);
    });
    elCategoryFilter.value = categories.indexOf(previous) !== -1 ? previous : "";
  }

  // 등록/수정 폼의 카테고리 드롭다운: 폼에서 선택된 도메인에 속한 카테고리만 보여준다.
  function populateFieldCategoryOptions(domainId) {
    var categories = getCategoriesForDomain(domainId);
    elFieldCategory.innerHTML = "";
    categories.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      elFieldCategory.appendChild(opt);
    });
  }

  // --- 목록 ------------------------------------------------------------------

  function fetchQuestionList() {
    elList.innerHTML = '<p class="dashboard-empty">불러오는 중...</p>';
    return client
      .from(QUESTIONS_TABLE)
      .select("*")
      .order("id")
      .then(function (res) {
        if (res.error) {
          elList.innerHTML = '<p class="dashboard-empty">문제 목록을 불러오지 못했습니다: ' +
            escapeHtmlLocal(describeError(res.error)) + "</p>";
          return;
        }
        cachedRows = res.data || [];
        populateReportYearFilterOptions();
        renderQuestionList();
      });
  }

  // 실제 데이터에 등장하는 리포트 연도만 옵션으로 제공한다(ESG처럼 report_year가 있는
  // 문항에만 해당 — 마케팅플랜 문항은 report_year가 없어 옵션에 나타나지 않는다).
  function populateReportYearFilterOptions() {
    var years = Array.from(new Set(
      cachedRows.map(function (r) { return r.report_year; }).filter(function (y) { return y !== null && y !== undefined; })
    )).sort(function (a, b) { return b - a; });

    var previous = elReportYearFilter.value;
    elReportYearFilter.innerHTML = '<option value="">전체 연도</option>';
    years.forEach(function (y) {
      var opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = y + "년";
      elReportYearFilter.appendChild(opt);
    });
    elReportYearFilter.value = years.map(String).indexOf(previous) !== -1 ? previous : "";
  }

  function renderQuestionList() {
    var domainValue = elDomainFilter.value;
    var categoryValue = elCategoryFilter.value;
    var reportYearValue = elReportYearFilter.value;
    var activeValue = elActiveFilter.value;
    var rows = cachedRows.filter(function (r) {
      var rowDomain = r.domain || "marketing_plan";
      var rowActive = r.is_active !== false;
      if (domainValue && rowDomain !== domainValue) {
        return false;
      }
      if (categoryValue && r.category !== categoryValue) {
        return false;
      }
      if (reportYearValue && String(r.report_year) !== reportYearValue) {
        return false;
      }
      if (activeValue === "active" && !rowActive) {
        return false;
      }
      if (activeValue === "inactive" && rowActive) {
        return false;
      }
      return true;
    });

    if (rows.length === 0) {
      elList.innerHTML = '<p class="dashboard-empty">표시할 문제가 없습니다.</p>';
      return;
    }

    elList.innerHTML = "";
    rows.forEach(function (row) {
      var isActive = row.is_active !== false;
      var div = document.createElement("div");
      div.className = "admin-question-row" + (isActive ? "" : " admin-question-row--inactive");
      div.innerHTML =
        '<div class="admin-question-row__main">' +
        '<span class="admin-question-row__id">' + escapeHtmlLocal(row.id) + "</span>" +
        '<span class="admin-question-row__type">' + escapeHtmlLocal(TYPE_LABELS[row.type] || row.type) + "</span>" +
        (isActive ? "" : '<span class="admin-question-row__badge">비활성</span>') +
        (row.report_year ? '<span class="admin-question-row__badge">' + row.report_year + "년</span>" : "") +
        '<span class="admin-question-row__text">' + escapeHtmlLocal(row.question) + "</span>" +
        "</div>" +
        '<div class="admin-question-row__actions">' +
        '<button type="button" class="btn btn-ghost" data-action="edit">수정</button>' +
        '<button type="button" class="btn btn-ghost" data-action="delete">삭제</button>' +
        "</div>";

      div.querySelector('[data-action="edit"]').addEventListener("click", function () {
        openEditForm(row);
      });
      div.querySelector('[data-action="delete"]').addEventListener("click", function () {
        deleteQuestion(row.id);
      });

      elList.appendChild(div);
    });
  }

  elDomainFilter.addEventListener("change", function () {
    populateCategoryFilterOptions();
    renderQuestionList();
  });
  elCategoryFilter.addEventListener("change", renderQuestionList);
  elReportYearFilter.addEventListener("change", renderQuestionList);
  elActiveFilter.addEventListener("change", renderQuestionList);

  function deleteQuestion(id) {
    if (!confirm(id + " 문제를 삭제할까요? 되돌릴 수 없습니다.")) {
      return;
    }
    client
      .from(QUESTIONS_TABLE)
      .delete()
      .eq("id", id)
      .select("id")
      .then(function (res) {
        if (res.error) {
          alert("삭제 실패: " + describeError(res.error));
          return;
        }
        if (!res.data || res.data.length === 0) {
          alert(
            "삭제되지 않았습니다: 서버가 요청을 거부했습니다(관리자 권한이 없거나 이미 삭제된 문제입니다). " +
            "관리자 계정으로 로그인되어 있는지 확인해 주세요."
          );
          fetchQuestionList();
          return;
        }
        fetchQuestionList();
        if (window.QuizCloudSync && window.QuizCloudSync.refreshQuestions) {
          window.QuizCloudSync.refreshQuestions();
        }
      })
      .catch(function (err) {
        alert("삭제 실패(네트워크 오류): " + describeError(err));
      });
  }

  // --- 유형별 동적 입력 필드 ---------------------------------------------------

  function clearTypeFields() {
    elTypeFields.innerHTML = "";
  }

  function buildLabeledInput(labelText, value) {
    var wrapper = document.createElement("label");
    wrapper.className = "admin-form__label";
    wrapper.appendChild(document.createTextNode(labelText));
    var input = document.createElement("input");
    input.type = "text";
    input.className = "account-panel__input";
    input.value = value || "";
    wrapper.appendChild(input);
    return { wrapper: wrapper, input: input };
  }

  function buildSubrow(fields, onRemove) {
    var row = document.createElement("div");
    row.className = "admin-subrow";
    fields.forEach(function (input) {
      row.appendChild(input);
    });
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "admin-subrow__remove";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", "삭제");
    removeBtn.addEventListener("click", function () {
      row.remove();
    });
    row.appendChild(removeBtn);
    return row;
  }

  function makeSubInput(placeholder, value) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "account-panel__input";
    input.placeholder = placeholder || "";
    input.value = value || "";
    return input;
  }

  // 유형에 맞는 입력 UI를 그린다. existingPayload가 있으면 값을 채워 "수정" 상태로 만든다.
  function renderTypeFields(type, existingPayload) {
    clearTypeFields();
    var payload = existingPayload || {};

    if (type === "mc") {
      var choices = payload.choices || ["", "", "", ""];
      var choiceInputs = choices.map(function (c, i) {
        var l = buildLabeledInput("보기 " + (i + 1), c);
        l.wrapper.dataset.role = "mc-choice-" + i;
        elTypeFields.appendChild(l.wrapper);
        return l.input;
      });
      var answerLabel = document.createElement("label");
      answerLabel.className = "admin-form__label";
      answerLabel.appendChild(document.createTextNode("정답 번호"));
      var answerSelect = document.createElement("select");
      answerSelect.className = "admin-toolbar__select";
      answerSelect.dataset.role = "mc-answer-index";
      [0, 1, 2, 3].forEach(function (i) {
        var opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = (i + 1) + "번";
        if (payload.answerIndex === i) opt.selected = true;
        answerSelect.appendChild(opt);
      });
      answerLabel.appendChild(answerSelect);
      elTypeFields.appendChild(answerLabel);
      elTypeFields._mcChoiceInputs = choiceInputs;
      elTypeFields._mcAnswerSelect = answerSelect;
    } else if (type === "ox") {
      var oxLabel = document.createElement("label");
      oxLabel.className = "admin-form__label";
      oxLabel.appendChild(document.createTextNode("정답"));
      var oxSelect = document.createElement("select");
      oxSelect.className = "admin-toolbar__select";
      oxSelect.dataset.role = "ox-answer";
      [{ v: "true", t: "O (참)" }, { v: "false", t: "X (거짓)" }].forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt.v;
        o.textContent = opt.t;
        if (String(payload.answer) === opt.v) o.selected = true;
        oxSelect.appendChild(o);
      });
      oxLabel.appendChild(oxSelect);
      elTypeFields.appendChild(oxLabel);
      elTypeFields._oxSelect = oxSelect;
    } else if (type === "fill") {
      var fillAnswer = buildLabeledInput("정답", payload.answer);
      fillAnswer.wrapper.dataset.role = "fill-answer";
      elTypeFields.appendChild(fillAnswer.wrapper);
      var fillAlt = buildLabeledInput("추가로 인정할 정답 (쉼표로 구분, 선택)", (payload.acceptableAnswers || []).join(", "));
      fillAlt.wrapper.dataset.role = "fill-acceptable";
      elTypeFields.appendChild(fillAlt.wrapper);
      elTypeFields._fillAnswerInput = fillAnswer.input;
      elTypeFields._fillAcceptableInput = fillAlt.input;
    } else if (type === "calc") {
      var calcAnswer = buildLabeledInput("정답 (숫자만)", payload.answer);
      elTypeFields.appendChild(calcAnswer.wrapper);
      var calcUnit = buildLabeledInput("단위 (예: 원, 일 — 선택)", payload.unit);
      elTypeFields.appendChild(calcUnit.wrapper);
      elTypeFields._calcAnswerInput = calcAnswer.input;
      elTypeFields._calcUnitInput = calcUnit.input;
    } else if (type === "order") {
      var itemsContainer = document.createElement("div");
      itemsContainer.dataset.role = "order-items";
      elTypeFields.appendChild(itemsContainer);

      function addOrderRow(value) {
        var input = makeSubInput("보기 항목", value);
        var row = buildSubrow([input]);
        itemsContainer.appendChild(row);
      }

      (payload.items && payload.items.length ? payload.items : ["", ""]).forEach(addOrderRow);

      var addOrderBtn = document.createElement("button");
      addOrderBtn.type = "button";
      addOrderBtn.className = "btn btn-ghost admin-subrow__add";
      addOrderBtn.textContent = "+ 항목 추가";
      addOrderBtn.addEventListener("click", function () { addOrderRow(""); });
      elTypeFields.appendChild(addOrderBtn);

      elTypeFields._orderContainer = itemsContainer;
    } else if (type === "match") {
      var pairsContainer = document.createElement("div");
      pairsContainer.dataset.role = "match-pairs";
      elTypeFields.appendChild(pairsContainer);

      function addMatchRow(left, right) {
        var leftInput = makeSubInput("왼쪽(문제)", left);
        var rightInput = makeSubInput("오른쪽(정답 짝)", right);
        var row = buildSubrow([leftInput, rightInput]);
        pairsContainer.appendChild(row);
      }

      var initialPairs = (payload.pairs && payload.pairs.length) ? payload.pairs : [{ left: "", right: "" }, { left: "", right: "" }];
      initialPairs.forEach(function (p) { addMatchRow(p.left, p.right); });

      var addMatchBtn = document.createElement("button");
      addMatchBtn.type = "button";
      addMatchBtn.className = "btn btn-ghost admin-subrow__add";
      addMatchBtn.textContent = "+ 짝 추가";
      addMatchBtn.addEventListener("click", function () { addMatchRow("", ""); });
      elTypeFields.appendChild(addMatchBtn);

      elTypeFields._matchContainer = pairsContainer;
    }
  }

  elFieldType.addEventListener("change", function () {
    renderTypeFields(elFieldType.value, null);
  });

  elFieldDomain.addEventListener("change", function () {
    populateFieldCategoryOptions(elFieldDomain.value);
    if (!editingId) {
      elFieldId.value = suggestNewId();
    }
  });

  // --- 폼 열기/닫기 ------------------------------------------------------------

  // 도메인별로 ID 프리픽스가 다르므로(마케팅플랜 q, ESG e), 같은 도메인의 문항
  // 중에서만 번호를 세어 다음 번호를 제안한다.
  function suggestNewId() {
    var domain = elFieldDomain.value || "marketing_plan";
    var prefix = DOMAIN_PREFIX[domain] || "q";
    var pattern = new RegExp("^" + prefix + "(\\d+)$");
    var maxNum = 0;
    cachedRows.forEach(function (r) {
      if ((r.domain || "marketing_plan") !== domain) {
        return;
      }
      var m = pattern.exec(r.id);
      if (m) {
        maxNum = Math.max(maxNum, parseInt(m[1], 10));
      }
    });
    var next = maxNum + 1;
    return prefix + String(next).padStart(3, "0");
  }

  function resetFormFields() {
    elFieldDomain.value = elFieldDomain.options.length > 0 ? elFieldDomain.options[0].value : "marketing_plan";
    populateFieldCategoryOptions(elFieldDomain.value);
    elFieldId.value = suggestNewId();
    elFieldId.disabled = false;
    elFieldCategory.selectedIndex = 0;
    elFieldReportYear.value = "";
    elFieldActive.checked = true;
    elFieldDifficulty.value = "중급";
    elFieldType.value = "mc";
    elFieldTags.value = "";
    elFieldQuestion.value = "";
    elFieldExplanation.value = "";
    renderTypeFields("mc", null);
    setFormMessage("");
  }

  function openNewForm() {
    editingId = null;
    elFormTitle.textContent = "문제 추가";
    elBtnDelete.hidden = true;
    resetFormFields();
    window.QuizApp.setScreen("admin-form");
  }

  function openEditForm(row) {
    editingId = row.id;
    elFormTitle.textContent = "문제 수정 (" + row.id + ")";
    elBtnDelete.hidden = false;
    elFieldId.value = row.id;
    elFieldId.disabled = true; // 등록된 문제의 id는 변경하지 않는다(변경 시 다른 항목으로 오인될 위험)
    elFieldDomain.value = row.domain || "marketing_plan";
    populateFieldCategoryOptions(elFieldDomain.value);
    elFieldCategory.value = row.category;
    elFieldReportYear.value = row.report_year || "";
    elFieldActive.checked = row.is_active !== false;
    elFieldDifficulty.value = row.difficulty;
    elFieldType.value = row.type;
    elFieldTags.value = (row.tags || []).join(", ");
    elFieldQuestion.value = row.question;
    elFieldExplanation.value = row.explanation;
    renderTypeFields(row.type, row.payload || {});
    setFormMessage("");
    window.QuizApp.setScreen("admin-form");
  }

  elBtnNew.addEventListener("click", openNewForm);

  // --- 저장 ------------------------------------------------------------------

  function collectPayload(type) {
    if (type === "mc") {
      var choices = elTypeFields._mcChoiceInputs.map(function (i) { return i.value.trim(); });
      if (choices.some(function (c) { return !c; })) {
        throw new Error("4지선다 보기 4개를 모두 입력해주세요.");
      }
      return { choices: choices, answerIndex: Number(elTypeFields._mcAnswerSelect.value) };
    }
    if (type === "ox") {
      return { answer: elTypeFields._oxSelect.value === "true" };
    }
    if (type === "fill") {
      var answer = elTypeFields._fillAnswerInput.value.trim();
      if (!answer) throw new Error("정답을 입력해주세요.");
      var acceptable = elTypeFields._fillAcceptableInput.value
        .split(",")
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s; });
      return { answer: answer, acceptableAnswers: acceptable };
    }
    if (type === "calc") {
      var calcAnswer = elTypeFields._calcAnswerInput.value.trim();
      if (!calcAnswer || isNaN(Number(calcAnswer.replace(/[^0-9.\-]/g, "")))) {
        throw new Error("계산 문제의 정답은 숫자여야 합니다.");
      }
      return { answer: calcAnswer, unit: elTypeFields._calcUnitInput.value.trim() };
    }
    if (type === "order") {
      var items = Array.from(elTypeFields._orderContainer.querySelectorAll("input"))
        .map(function (i) { return i.value.trim(); })
        .filter(function (v) { return v; });
      if (items.length < 2) throw new Error("순서배열 항목을 2개 이상 입력해주세요.");
      return { items: items };
    }
    if (type === "match") {
      var rows = Array.from(elTypeFields._matchContainer.querySelectorAll(".admin-subrow"));
      var pairs = rows.map(function (row) {
        var inputs = row.querySelectorAll("input");
        return { left: inputs[0].value.trim(), right: inputs[1].value.trim() };
      }).filter(function (p) { return p.left && p.right; });
      if (pairs.length < 2) throw new Error("매칭 짝을 2개 이상 입력해주세요.");
      return { pairs: pairs };
    }
    throw new Error("알 수 없는 문제 유형입니다.");
  }

  elBtnSave.addEventListener("click", function () {
    var id = elFieldId.value.trim();
    var domain = elFieldDomain.value;
    var category = elFieldCategory.value;
    var reportYear = elFieldReportYear.value.trim() ? parseInt(elFieldReportYear.value, 10) : null;
    var isActive = elFieldActive.checked;
    var difficulty = elFieldDifficulty.value;
    var type = elFieldType.value;
    var tags = elFieldTags.value.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    var question = elFieldQuestion.value.trim();
    var explanation = elFieldExplanation.value.trim();

    if (!id || !category || !question || !explanation) {
      setFormMessage("문제 ID, 카테고리, 문제 내용, 해설은 필수입니다.", true);
      return;
    }

    var payload;
    try {
      payload = collectPayload(type);
    } catch (e) {
      setFormMessage(e.message, true);
      return;
    }

    elBtnSave.disabled = true;
    setFormMessage("저장 중입니다...");

    client
      .from(QUESTIONS_TABLE)
      .upsert({
        id: id,
        domain: domain,
        category: category,
        report_year: reportYear,
        is_active: isActive,
        type: type,
        difficulty: difficulty,
        tags: tags,
        question: question,
        explanation: explanation,
        payload: payload
      }, { onConflict: "id" })
      .then(function (res) {
        elBtnSave.disabled = false;
        if (res.error) {
          setFormMessage("저장 실패: " + describeError(res.error), true);
          return;
        }
        if (window.QuizCloudSync && window.QuizCloudSync.refreshQuestions) {
          window.QuizCloudSync.refreshQuestions();
        }
        fetchQuestionList();
        window.QuizApp.setScreen("admin");
      });
  });

  elBtnDelete.addEventListener("click", function () {
    if (!editingId) {
      return;
    }
    deleteQuestion(editingId);
    window.QuizApp.setScreen("admin");
  });

  // --- 초기화: 관리자 화면 진입 버튼을 누를 때마다 목록을 새로고침한다 ----------

  var elOpenAdminBtn = document.getElementById("btn-open-admin");
  if (elOpenAdminBtn) {
    elOpenAdminBtn.addEventListener("click", function () {
      populateDomainSelects();
      populateCategoryFilterOptions();
      fetchQuestionList();
    });
  }

  // ============================================================
  // 조직 통계 대시보드 (관리자 전용)
  // ============================================================

  var elStatsTotalUsers = document.getElementById("admin-stats-total-users");
  var elStatsActiveUsers = document.getElementById("admin-stats-active-users");
  var elStatsParticipationRate = document.getElementById("admin-stats-participation-rate");
  var elStatsTotalAttempts = document.getElementById("admin-stats-total-attempts");
  var elStatsOverallAccuracy = document.getElementById("admin-stats-overall-accuracy");
  var elStatsDailyParticipants = document.getElementById("admin-stats-daily-participants");
  var elStatsDailyAccuracy = document.getElementById("admin-stats-daily-accuracy");
  var elStatsDailyParticipationRate = document.getElementById("admin-stats-daily-participation-rate");
  var elStatsCategoryTable = document.getElementById("admin-stats-category-table");
  var elStatsUserTable = document.getElementById("admin-stats-user-table");
  var elOpenAdminStatsBtn = document.getElementById("btn-open-admin-stats");
  var elStatsDomainTabs = document.getElementById("admin-stats-domain-tabs");

  var adminStatsDomain = "all";

  // app.js의 오늘의 퀴즈가 쓰는 것과 동일한 방식(사용자 로컬 날짜)으로 "오늘"을 계산한다.
  // 서버 now()의 시간대에 의존하면 자정 근처에 날짜가 어긋날 수 있어 클라이언트 기준으로 통일한다.
  function todayKeyLocal() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function renderStatRows(container, rows, buildLabel) {
    if (!rows || rows.length === 0) {
      container.innerHTML = '<p class="dashboard-empty">아직 데이터가 없습니다.</p>';
      return;
    }
    container.innerHTML = "";
    rows.forEach(function (row) {
      var div = document.createElement("div");
      div.className = "result-category-row";
      div.innerHTML = buildLabel(row);
      container.appendChild(div);
    });
  }

  function fetchAdminStats() {
    elStatsCategoryTable.innerHTML = '<p class="dashboard-empty">불러오는 중...</p>';
    elStatsUserTable.innerHTML = '<p class="dashboard-empty">불러오는 중...</p>';

    Promise.all([
      client.rpc("get_admin_overview", { p_domain: adminStatsDomain }),
      client.rpc("get_admin_category_stats", { p_domain: adminStatsDomain }),
      client.rpc("get_admin_user_stats", { limit_count: 50, p_domain: adminStatsDomain }),
      client.rpc("get_admin_daily_quiz_stats", { target_date: todayKeyLocal(), p_domain: adminStatsDomain })
    ]).then(function (results) {
      var overviewRes = results[0], categoryRes = results[1], userRes = results[2];
      var dailyRes = results[3];

      var overview = overviewRes.data && overviewRes.data[0];
      if (overviewRes.error || !overview) {
        var msg = overviewRes.error
          ? "불러오지 못했습니다: " + escapeHtmlLocal(describeError(overviewRes.error))
          : "관리자 권한이 필요합니다.";
        elStatsCategoryTable.innerHTML = '<p class="dashboard-empty">' + msg + "</p>";
        elStatsUserTable.innerHTML = "";
        return;
      }

      elStatsTotalUsers.textContent = overview.total_users;
      elStatsActiveUsers.textContent = overview.active_users;
      elStatsParticipationRate.textContent = overview.total_users > 0
        ? Math.round((overview.active_users / overview.total_users) * 100) + "%"
        : "-";
      elStatsTotalAttempts.textContent = overview.total_attempts;
      elStatsOverallAccuracy.textContent = overview.total_attempts > 0 ? overview.overall_accuracy + "%" : "-";

      var daily = dailyRes && !dailyRes.error && dailyRes.data && dailyRes.data[0];
      if (daily) {
        elStatsDailyParticipants.textContent = daily.today_participants;
        elStatsDailyAccuracy.textContent = daily.today_participants > 0 ? daily.today_avg_accuracy + "%" : "-";
        elStatsDailyParticipationRate.textContent = overview.total_users > 0
          ? Math.round((daily.today_participants / overview.total_users) * 100) + "%"
          : "-";
      } else {
        elStatsDailyParticipants.textContent = "-";
        elStatsDailyAccuracy.textContent = "-";
        elStatsDailyParticipationRate.textContent = "-";
      }

      renderStatRows(elStatsCategoryTable, categoryRes.data, function (row) {
        return '<span class="result-category-row__name">' + escapeHtmlLocal(row.category) + "</span>" +
          '<span class="result-category-row__bar"><span class="result-category-row__bar-fill" style="width:' + row.accuracy + '%"></span></span>' +
          '<span class="result-category-row__score">' + row.total_correct + "/" + row.total_attempts + " (" + row.accuracy + "%)</span>";
      });

      renderStatRows(elStatsUserTable, userRes.data, function (row) {
        return '<span class="result-category-row__name">' + escapeHtmlLocal(row.nickname) + "</span>" +
          '<span class="result-category-row__bar"><span class="result-category-row__bar-fill" style="width:' + row.accuracy + '%"></span></span>' +
          '<span class="result-category-row__score">' + row.total_correct + "/" + row.total_attempts + " (" + row.accuracy + "%)</span>";
      });
    });
  }

  if (elOpenAdminStatsBtn) {
    elOpenAdminStatsBtn.addEventListener("click", fetchAdminStats);
  }

  if (elStatsDomainTabs) {
    elStatsDomainTabs.querySelectorAll(".domain-tabs__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.domain === adminStatsDomain) {
          return;
        }
        adminStatsDomain = btn.dataset.domain;
        elStatsDomainTabs.querySelectorAll(".domain-tabs__btn").forEach(function (b) {
          var isActive = b === btn;
          b.classList.toggle("is-active", isActive);
          b.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        fetchAdminStats();
      });
    });
  }
})();
