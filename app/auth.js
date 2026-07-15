/*
 * Marketing Plan 퀴즈 (애터미 수당체계 학습) — 계정/로그인 + 학습이력 서버 동기화 (3단계, 1차)
 *
 * Supabase Auth(이메일/비밀번호)로 로그인하고, 로그인 상태에서는 학습 이력을
 * (LocalStorage뿐 아니라) Supabase의 quiz_progress 테이블에도 동기화한다.
 *
 * app.js와의 접점은 window.QuizApp(getStoreSnapshot/applyRemoteStore)과
 * window.QuizCloudSync.onLocalChange 뿐이다. 이 파일이 없거나 Supabase 설정이
 * 비어 있으면 앱은 2단계와 완전히 동일하게(LocalStorage 전용) 동작한다.
 */

(function () {
  "use strict";

  var PROGRESS_TABLE = "quiz_progress";
  var QUESTIONS_TABLE = "questions";
  var PUSH_DEBOUNCE_MS = 800;

  function isConfigured() {
    return typeof SUPABASE_URL === "string" && typeof SUPABASE_ANON_KEY === "string" &&
      SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1 &&
      SUPABASE_ANON_KEY.indexOf("YOUR-ANON-PUBLIC-KEY") === -1 &&
      typeof window.supabase !== "undefined" &&
      typeof window.supabase.createClient === "function";
  }

  var widget = document.getElementById("account-widget");
  if (!widget) {
    return; // index.html에 계정 위젯이 없는 구버전이면 아무 것도 하지 않는다.
  }

  var elStatusText = document.getElementById("account-status-text");
  var elToggleBtn = document.getElementById("btn-account-toggle");
  var elPanel = document.getElementById("account-panel");
  var elEmailInput = document.getElementById("account-email-input");
  var elPasswordInput = document.getElementById("account-password-input");
  var elMessage = document.getElementById("account-message");
  var elLoginBtn = document.getElementById("btn-account-login");
  var elSignupBtn = document.getElementById("btn-account-signup");
  var elLogoutBtn = document.getElementById("btn-account-logout");
  var elCloseBtn = document.getElementById("btn-account-close");

  var elForgotBtn = document.getElementById("btn-account-forgot");
  var elResetPanel = document.getElementById("account-reset-panel");
  var elResetNewPasswordInput = document.getElementById("account-reset-newpassword-input");
  var elResetConfirmBtn = document.getElementById("btn-account-reset-confirm");
  var elResetCancelBtn = document.getElementById("btn-account-reset-cancel");

  // Supabase의 재설정 링크는 이 GitHub Pages 페이지로 먼저 열리고, 그 페이지가
  // 다시 atomyquiz://reset-callback 커스텀 스킴으로 앱을 연다(PC 등 앱이 없는
  // 환경에서는 안내 문구를 보여준다). app/reset-redirect.html 참고.
  var RESET_REDIRECT_URL = "https://chk0428-alt.github.io/marketing-plan-esg-quiz/reset-redirect.html";

  // 가입 확인 메일 링크를 눌렀을 때 돌아올 주소. 지정하지 않으면 Supabase 대시보드의
  // 기본 Site URL로 리다이렉트되는데, 그 값이 이 앱 주소와 다르면 404가 난다.
  // 이 페이지는 로드 즉시 atomyquiz://signup-callback 커스텀 스킴으로 앱을 열어본다
  // (앱이 없는 환경에서는 웹에서 바로 로그인 상태로 이어짐). app/signup-redirect.html 참고.
  var SIGNUP_CONFIRM_REDIRECT_URL = "https://chk0428-alt.github.io/marketing-plan-esg-quiz/signup-redirect.html";

  var elNicknameRow = document.getElementById("account-nickname-row");
  var elNicknameInput = document.getElementById("account-nickname-input");
  var elSaveNicknameBtn = document.getElementById("btn-account-save-nickname");

  var elOpenLeaderboardBtn = document.getElementById("btn-open-leaderboard");
  var elResultLeaderboardBtn = document.getElementById("btn-result-leaderboard");
  var elLeaderboardTable = document.getElementById("leaderboard-table");
  var elLeaderboardDomainTabs = document.getElementById("leaderboard-domain-tabs");

  var elOpenAdminBtn = document.getElementById("btn-open-admin");
  var elOpenAdminStatsBtn = document.getElementById("btn-open-admin-stats");

  if (!isConfigured()) {
    // Supabase 프로젝트가 아직 연결되지 않은 상태: 위젯을 "설정 필요" 상태로만 표시하고
    // 어떤 네트워크 호출도 시도하지 않는다. 나머지 앱 기능(2단계까지)은 그대로 동작한다.
    elStatusText.textContent = "계정 기능 설정 전";
    elToggleBtn.disabled = true;
    elToggleBtn.title = "supabase-config.js에 Supabase 프로젝트 정보를 입력하면 사용할 수 있습니다.";
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var currentUser = null;
  var pushTimer = null;

  // admin.js 등 다른 파일이 같은 Supabase 클라이언트를 재사용할 수 있도록 전역에 노출한다.
  window.QuizSupabaseClient = client;

  // --- 문제 데이터: 서버(questions 테이블)가 있으면 정적 questions.js보다 우선한다 ---
  // (관리자 CMS로 등록/수정/삭제한 내용이 즉시 반영되도록. 실패하면 조용히 questions.js를 계속 사용)
  //
  // 4-1단계: questions 테이블에 domain 컬럼이 추가되었다. 아직 마이그레이션 전이라
  // row.domain이 없는 행은 마케팅플랜으로 간주해 하위 호환을 유지한다.
  function loadQuestionsFromServer() {
    return client
      .from(QUESTIONS_TABLE)
      .select("*")
      .then(function (res) {
        if (res.error || !res.data || res.data.length === 0) {
          if (res.error) {
            console.warn("서버 문제 데이터를 불러오지 못해 로컬 questions.js를 계속 사용합니다:", describeAuthError(res.error));
          }
          return;
        }
        var fallbackOrder = (window.CATEGORIES_BY_DOMAIN && window.CATEGORIES_BY_DOMAIN.marketing_plan) || window.CATEGORIES || [];
        var seenCategory = {};
        var categoriesByDomain = {};
        var questions = res.data.map(function (row) {
          var domain = row.domain || "marketing_plan";
          var seenKey = domain + "::" + row.category;
          if (!seenCategory[seenKey]) {
            seenCategory[seenKey] = true;
            if (!categoriesByDomain[domain]) {
              categoriesByDomain[domain] = [];
            }
            categoriesByDomain[domain].push(row.category);
          }
          return Object.assign(
            {
              id: row.id,
              domain: domain,
              category: row.category,
              type: row.type,
              difficulty: row.difficulty,
              tags: row.tags || [],
              question: row.question,
              explanation: row.explanation,
              voiceExplanationUrl: row.voice_explanation_url || null,
              reportYear: row.report_year || null,
              active: row.is_active !== false
            },
            row.payload || {}
          );
        });
        if (categoriesByDomain.marketing_plan) {
          categoriesByDomain.marketing_plan.sort(function (a, b) {
            var ia = fallbackOrder.indexOf(a);
            var ib = fallbackOrder.indexOf(b);
            if (ia === -1) ia = 999;
            if (ib === -1) ib = 999;
            return ia - ib;
          });
        }
        window.QuizApp.setQuestions(categoriesByDomain, questions);
      });
  }

  loadQuestionsFromServer();

  function setMessage(text, isError) {
    elMessage.textContent = text || "";
    elMessage.className = "account-message" + (isError ? " is-error" : "");
  }

  function setBusy(busy) {
    [elLoginBtn, elSignupBtn, elLogoutBtn, elSaveNicknameBtn, elForgotBtn, elResetConfirmBtn, elResetCancelBtn].forEach(function (btn) {
      if (btn) {
        btn.disabled = busy;
      }
    });
  }

  function closeResetPanel() {
    elResetPanel.hidden = true;
    elResetNewPasswordInput.value = "";
  }

  function escapeHtmlLocal(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function openPanel() {
    elPanel.hidden = false;
  }

  function closePanel() {
    elPanel.hidden = true;
    setMessage("");
    closeResetPanel();
  }

  function updateUiForUser(user) {
    currentUser = user;
    if (user) {
      elStatusText.textContent = user.email;
      elLoginBtn.hidden = true;
      elSignupBtn.hidden = true;
      elLogoutBtn.hidden = false;
      elEmailInput.hidden = true;
      elPasswordInput.hidden = true;
      elNicknameRow.hidden = false;
      elForgotBtn.hidden = true;
    } else {
      elStatusText.textContent = "로그인";
      elLoginBtn.hidden = false;
      elSignupBtn.hidden = false;
      elLogoutBtn.hidden = true;
      elEmailInput.hidden = false;
      elPasswordInput.hidden = false;
      elNicknameRow.hidden = true;
      elNicknameInput.value = "";
      elForgotBtn.hidden = false;
    }
  }

  function describeAuthError(err) {
    if (!err) {
      return "알 수 없는 오류가 발생했습니다.";
    }
    return err.message || String(err);
  }

  // --- 서버 ↔ 로컬 동기화 -------------------------------------------------

  function pullRemoteProgress(userId) {
    return client
      .from(PROGRESS_TABLE)
      .select("history, wrong_ids, nickname, daily_quiz")
      .eq("user_id", userId)
      .maybeSingle()
      .then(function (res) {
        if (res.error) {
          throw res.error;
        }
        if (res.data) {
          window.QuizApp.applyRemoteStore({
            history: res.data.history,
            wrongIds: res.data.wrong_ids,
            dailyQuiz: res.data.daily_quiz
          });
          elNicknameInput.value = res.data.nickname || "";
        } else {
          // 서버에 아직 이력이 없다면(첫 로그인) 지금까지의 로컬(오프라인) 학습 이력을 업로드한다.
          return pushLocalProgress(userId, window.QuizApp.getStoreSnapshot());
        }
      });
  }

  function pushLocalProgress(userId, store) {
    return client
      .from(PROGRESS_TABLE)
      .upsert({
        user_id: userId,
        history: store.history,
        wrong_ids: store.wrongIds,
        daily_quiz: store.dailyQuiz
      }, { onConflict: "user_id" })
      .then(function (res) {
        if (res.error) {
          throw res.error;
        }
      });
  }

  window.QuizCloudSync = {
    onLocalChange: function (store) {
      if (!currentUser) {
        return;
      }
      // 문제를 풀 때마다 즉시 네트워크 요청을 보내지 않도록 짧게 모아서(디바운스) 전송한다.
      if (pushTimer) {
        clearTimeout(pushTimer);
      }
      var snapshot = { history: store.history, wrongIds: store.wrongIds, dailyQuiz: store.dailyQuiz };
      pushTimer = setTimeout(function () {
        pushTimer = null;
        pushLocalProgress(currentUser.id, snapshot).catch(function (err) {
          console.error("학습 이력 서버 동기화 실패:", describeAuthError(err));
        });
      }, PUSH_DEBOUNCE_MS);
    },
    // admin.js가 문제를 등록/수정/삭제한 뒤 화면에 즉시 반영되도록 다시 불러온다.
    refreshQuestions: loadQuestionsFromServer,
    // app.js 등 다른 파일이 로그인 여부/사용자 id를 확인할 때 사용한다.
    getCurrentUser: function () {
      return currentUser;
    },
    // app.js가 "로그인이 필요합니다" 상황에서 계정 패널을 직접 열 때 사용한다.
    openLoginPanel: openPanel
  };

  // --- 로그인 / 회원가입 / 로그아웃 --------------------------------------

  elToggleBtn.addEventListener("click", function () {
    if (elPanel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });

  elCloseBtn.addEventListener("click", closePanel);

  elLoginBtn.addEventListener("click", function () {
    var email = elEmailInput.value.trim();
    var password = elPasswordInput.value;
    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.", true);
      return;
    }
    setBusy(true);
    setMessage("로그인 중입니다...");
    client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      setBusy(false);
      if (res.error) {
        setMessage(describeAuthError(res.error), true);
        return;
      }
      setMessage("로그인되었습니다.");
      elPasswordInput.value = "";
    });
  });

  elSignupBtn.addEventListener("click", function () {
    var email = elEmailInput.value.trim();
    var password = elPasswordInput.value;
    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.", true);
      return;
    }
    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.", true);
      return;
    }
    setBusy(true);
    setMessage("가입 처리 중입니다...");
    client.auth.signUp({ email: email, password: password, options: { emailRedirectTo: SIGNUP_CONFIRM_REDIRECT_URL } }).then(function (res) {
      setBusy(false);
      if (res.error) {
        setMessage(describeAuthError(res.error), true);
        return;
      }
      if (res.data && res.data.session) {
        setMessage("가입 및 로그인이 완료되었습니다.");
        elPasswordInput.value = "";
      } else {
        setMessage("가입 확인 이메일을 보냈습니다. 이메일을 확인한 뒤 로그인해주세요.");
      }
    });
  });

  elLogoutBtn.addEventListener("click", function () {
    setBusy(true);
    client.auth.signOut().then(function () {
      setBusy(false);
      setMessage("로그아웃되었습니다. 이후 학습 내용은 이 기기에만 저장됩니다.");
    });
  });

  // --- 비밀번호 재설정 (앱 딥링크 방식, GitHub Pages 중계) -------------------
  // 이메일의 기본 "재설정 링크"를 그대로 쓰되, redirectTo를 GitHub Pages의
  // reset-redirect.html로 지정한다. 그 페이지는 로드 즉시 커스텀 URL 스킴
  // (atomyquiz://reset-callback)으로 재이동을 시도해 앱을 연다(PC 등 앱이 없는
  // 환경에서는 안내 문구를 보여줌). 앱이 열리면 MainActivity(안드로이드 네이티브)가
  // URL 조각(#access_token=...)을 파싱해 window.__atomyQuizApplyRecovery(payload)를
  // 호출해준다 — 아래 정의 참고.

  elForgotBtn.addEventListener("click", function () {
    var email = elEmailInput.value.trim();
    if (!email) {
      setMessage("이메일을 먼저 입력해주세요.", true);
      return;
    }
    setBusy(true);
    setMessage("재설정 링크를 이메일로 보내는 중입니다...");
    client.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT_URL }).then(function (res) {
      setBusy(false);
      if (res.error) {
        setMessage(describeAuthError(res.error), true);
        return;
      }
      setMessage("이메일로 재설정 링크를 보냈습니다. 메일함에서 링크를 눌러 앱으로 돌아와주세요.");
    });
  });

  elResetConfirmBtn.addEventListener("click", function () {
    var newPassword = elResetNewPasswordInput.value;
    if (!newPassword || newPassword.length < 6) {
      setMessage("새 비밀번호는 6자 이상이어야 합니다.", true);
      return;
    }
    setBusy(true);
    setMessage("비밀번호를 변경하는 중입니다...");
    client.auth.updateUser({ password: newPassword }).then(function (res) {
      setBusy(false);
      if (res.error) {
        setMessage(describeAuthError(res.error), true);
        return;
      }
      setMessage("비밀번호가 변경되었습니다.");
      closeResetPanel();
    });
  });

  elResetCancelBtn.addEventListener("click", function () {
    closeResetPanel();
    setMessage("");
    client.auth.signOut();
  });

  // 네이티브(MainActivity)가 재설정 딥링크를 가로챘을 때 호출하는 진입점.
  // 네이티브 코드가 auth.js보다 먼저 실행될 수도 있으므로, 대기 중인 값이 있으면
  // 즉시 처리하고(아래), 이후 도착하는 호출은 이 함수가 바로 처리한다.
  window.__atomyQuizApplyRecovery = function (payload) {
    if (!payload || !payload.access_token || !payload.refresh_token) {
      return;
    }
    openPanel();
    elResetPanel.hidden = false;
    setMessage("이메일 링크로 확인되었습니다. 새 비밀번호를 입력해주세요.");
    client.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token }).then(function (res) {
      if (res.error) {
        setMessage(describeAuthError(res.error), true);
        elResetPanel.hidden = true;
      }
    });
  };
  if (window.__atomyQuizRecovery) {
    window.__atomyQuizApplyRecovery(window.__atomyQuizRecovery);
    window.__atomyQuizRecovery = null;
  }

  // 네이티브(MainActivity)가 가입 확인 딥링크(atomyquiz://signup-callback)를
  // 가로챘을 때 호출하는 진입점. 비밀번호 재설정과 달리 새 비밀번호 입력 없이
  // 그대로 로그인 상태로 이어간다.
  window.__atomyQuizApplySignupConfirm = function (payload) {
    if (!payload || !payload.access_token || !payload.refresh_token) {
      return;
    }
    openPanel();
    setMessage("이메일 인증이 완료되어 로그인되었습니다.");
    client.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token }).then(function (res) {
      if (res.error) {
        setMessage(describeAuthError(res.error), true);
      }
    });
  };
  if (window.__atomyQuizSignupConfirm) {
    window.__atomyQuizApplySignupConfirm(window.__atomyQuizSignupConfirm);
    window.__atomyQuizSignupConfirm = null;
  }

  // --- 닉네임 (랭킹에 표시되는 이름) ---------------------------------------

  elSaveNicknameBtn.addEventListener("click", function () {
    if (!currentUser) {
      return;
    }
    var nickname = elNicknameInput.value.trim();
    if (nickname.length > 20) {
      setMessage("닉네임은 20자 이하로 입력해주세요.", true);
      return;
    }
    setBusy(true);
    client
      .from(PROGRESS_TABLE)
      .upsert({ user_id: currentUser.id, nickname: nickname }, { onConflict: "user_id" })
      .then(function (res) {
        setBusy(false);
        if (res.error) {
          setMessage(describeAuthError(res.error), true);
          return;
        }
        setMessage(nickname ? "닉네임이 저장되었습니다." : "닉네임을 비웠습니다. 랭킹에는 '익명 학습자'로 표시됩니다.");
      });
  });

  // --- 랭킹 (4-3단계: 통합/마케팅플랜/ESG 3종) --------------------------------

  var leaderboardDomain = "all";

  function fetchLeaderboard() {
    elLeaderboardTable.innerHTML = '<p class="dashboard-empty">랭킹을 불러오는 중입니다...</p>';
    client.rpc("get_leaderboard", { limit_count: 20, p_domain: leaderboardDomain }).then(function (res) {
      if (res.error) {
        elLeaderboardTable.innerHTML =
          '<p class="dashboard-empty">랭킹을 불러오지 못했습니다: ' + escapeHtmlLocal(describeAuthError(res.error)) + "</p>";
        return;
      }
      renderLeaderboard(res.data || []);
    });
  }

  if (elLeaderboardDomainTabs) {
    elLeaderboardDomainTabs.querySelectorAll(".domain-tabs__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.domain === leaderboardDomain) {
          return;
        }
        leaderboardDomain = btn.dataset.domain;
        elLeaderboardDomainTabs.querySelectorAll(".domain-tabs__btn").forEach(function (b) {
          var isActive = b === btn;
          b.classList.toggle("is-active", isActive);
          b.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        fetchLeaderboard();
      });
    });
  }

  function renderLeaderboard(rows) {
    if (!rows.length) {
      elLeaderboardTable.innerHTML =
        '<p class="dashboard-empty">아직 랭킹에 표시할 만큼(5문제 이상) 학습한 사용자가 없습니다.</p>';
      return;
    }
    elLeaderboardTable.innerHTML = "";
    rows.forEach(function (row, i) {
      var div = document.createElement("div");
      div.className = "result-category-row";
      div.innerHTML =
        '<span class="result-category-row__name">' + (i + 1) + "위 " + escapeHtmlLocal(row.nickname) + "</span>" +
        '<span class="result-category-row__bar"><span class="result-category-row__bar-fill" style="width:' + row.accuracy + '%"></span></span>' +
        '<span class="result-category-row__score">' + row.total_correct + "/" + row.total_attempts + " (" + row.accuracy + "%)</span>";
      elLeaderboardTable.appendChild(div);
    });
  }

  if (elOpenLeaderboardBtn) {
    elOpenLeaderboardBtn.addEventListener("click", fetchLeaderboard);
  }
  if (elResultLeaderboardBtn) {
    elResultLeaderboardBtn.addEventListener("click", fetchLeaderboard);
  }

  // --- 세션 상태 반영 ------------------------------------------------------

  // 같은 사용자에 대해 pullRemoteProgress가 중복 실행되는 것을 막기 위한 가드.
  // (onAuthStateChange의 초기 발동과 getSession() 콜백이 겹칠 수 있어 안전망으로 둘 다 걸어둔다)
  var lastPulledUserId = null;
  function setAdminButtonsHidden(hidden) {
    if (elOpenAdminBtn) {
      elOpenAdminBtn.hidden = hidden;
    }
    if (elOpenAdminStatsBtn) {
      elOpenAdminStatsBtn.hidden = hidden;
    }
  }

  function updateAdminButtonVisibility(user) {
    if (!elOpenAdminBtn && !elOpenAdminStatsBtn) {
      return;
    }
    if (!user) {
      setAdminButtonsHidden(true);
      return;
    }
    client.rpc("am_i_admin").then(function (res) {
      setAdminButtonsHidden(!(res.data === true));
    }).catch(function () {
      setAdminButtonsHidden(true);
    });
  }

  function handleUser(user) {
    updateUiForUser(user);
    updateAdminButtonVisibility(user);
    if (user && user.id !== lastPulledUserId) {
      lastPulledUserId = user.id;
      pullRemoteProgress(user.id).catch(function (err) {
        console.error("학습 이력 서버 조회 실패:", describeAuthError(err));
        setMessage("학습 이력을 불러오지 못했습니다: " + describeAuthError(err), true);
      });
      // 5-1단계: 로그인 시점에도 컬렉션을 한 번 판정해둔다(다른 사용자의 활동으로 TOP20
      // 순위가 바뀌었거나, 과거 학습 이력만으로 이미 조건을 채운 경우를 놓치지 않기 위함).
      // pullRemoteProgress와 같은 lastPulledUserId 가드 안에 둬서, onAuthStateChange와
      // getSession()이 같은 사용자에 대해 handleUser를 중복 호출해도 딱 한 번만 실행되게 한다.
      //
      // 콜드 스타트 타이밍 문제(2026-07-05, 안드로이드 딥링크 JS 주입에서 같은 종류의
      // 버그를 겪음 -- MEMORY 참고): 세션이 로컬에 이미 있으면(새로고침 등) 뒤에 오는
      // <script src="collections.js">가 아직 로드되기 전에 이 콜백이 실행될 수 있어,
      // 한 번만 지연시키는 것으로는 타이밍이 흔들릴 때마다 조용히 무시되곤 했다(새로고침마다
      // NEW 표시가 들쭉날쭉했던 원인). onLogin()은 매번 서버에서 다시 조회해 화면을 그
      // 시점의 정확한 상태로 맞추는 멱등 동작이라, 여러 지연 간격으로 반복 시도해도
      // 안전하다 -- 그중 한 번이라도 성공하면 최종적으로 항상 정확한 상태로 안정된다.
      [0, 300, 800, 1500].forEach(function (delay) {
        setTimeout(function () {
          if (window.QuizCollections && typeof window.QuizCollections.onLogin === "function") {
            window.QuizCollections.onLogin();
          }
        }, delay);
      });
    }
    if (!user) {
      // 로그인해 있다가 로그아웃(또는 세션 만료)한 경우, 서버에서 받아와 화면/로컬에
      // 남아있던 학습 이력을 즉시 지워 "로그인 안 한 상태 = 항상 새로 시작" 정책을 지킨다.
      if (lastPulledUserId !== null) {
        window.QuizApp.applyRemoteStore(null);
      }
      lastPulledUserId = null;
    }
  }

  client.auth.onAuthStateChange(function (event, session) {
    handleUser(session ? session.user : null);
  });

  updateUiForUser(null);
  client.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (session) {
      handleUser(session.user);
    }
  });
})();
