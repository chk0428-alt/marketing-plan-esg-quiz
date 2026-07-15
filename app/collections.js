/*
 * Marketing Plan 퀴즈 (애터미 수당체계 학습) — 기념 컬렉션 (5-1단계 발급 로직 + 5-2단계 카드 디자인)
 *
 * PRD_5단계_기념카드.md 9절의 5-1단계 범위: 신규 데이터 없이(기존 quiz_progress.history +
 * questions 테이블만으로) 판정 가능한 13종(마케팅플랜 6 + ESG 6 + 애터미 퍼펙트 1)만 다룬다.
 * 학습 스트릭 6종은 날짜별 참여 이력이라는 신규 데이터가 필요해 5-3단계로 남겨둔다.
 *
 * 카드 디자인은 별점을 희귀도(★1=커먼~★3=에픽~★4=레전더리~★5=크로스도메인 레전더리)로
 * 매핑한 시안 디자인을 그대로 이식했다. 도메인(마케팅플랜=그린/ESG=블루)은 색으로,
 * 희귀도는 배경 화려함·글로우·애니메이션 단계로 구분한다.
 *
 * app.js와의 접점: window.QuizApp.setScreen(), 그리고 이 파일이 노출하는
 * window.QuizCollections.onQuizCompleted()/onLogin()을 app.js(결과 화면 직후)와
 * auth.js(로그인 직후)가 호출해준다.
 */

(function () {
  "use strict";

  if (!window.QuizSupabaseClient) {
    return; // Supabase가 설정되지 않은 환경에서는 컬렉션 기능 자체를 노출하지 않는다.
  }
  var client = window.QuizSupabaseClient;

  // 2.2~2.3절 표와 동일한 13종. domain(mp/esg/cross)은 카드 색 팔레트를,
  // stars(별점)는 희귀도 등급(★1=커먼~★5=크로스도메인 레전더리)을 결정한다.
  var BADGES = [
    { code: "mp_beginner_master", domain: "mp", domainLabel: "마케팅플랜 · 초급", stars: 1, title: "초급 마스터 컬렉션", desc: "마케팅플랜 초급 난이도 문제를 전부 정답 처리한 학습자에게 드려요." },
    { code: "mp_intermediate_master", domain: "mp", domainLabel: "마케팅플랜 · 중급", stars: 1, title: "중급 마스터 컬렉션", desc: "마케팅플랜 중급 난이도 문제를 전부 정답 처리한 학습자에게 드려요." },
    { code: "mp_advanced_master", domain: "mp", domainLabel: "마케팅플랜 · 고급", stars: 2, title: "고급 마스터 컬렉션", desc: "마케팅플랜 고급 난이도 문제를 전부 정답 처리한 학습자에게 드려요." },
    { code: "mp_category5", domain: "mp", domainLabel: "마케팅플랜 · 카테고리 5/9", stars: 3, title: "카테고리 5 클리어 컬렉션", desc: "마케팅플랜 9개 카테고리 중 5개 카테고리를 골라 전부 정답 처리한 학습자에게 드려요." },
    { code: "mp_top20", domain: "mp", domainLabel: "마케팅플랜 랭킹 TOP 20", stars: 3, title: "마케팅플랜 TOP 20 컬렉션", desc: "마케팅플랜 랭킹 TOP 20에 든 학습자에게 주어지는 경쟁의 증표예요." },
    { code: "mp_perfect", domain: "mp", domainLabel: "마케팅플랜 전체", stars: 4, title: "마케팅플랜 퍼펙트 컬렉션", desc: "마케팅플랜 전체 문제를 빠짐없이 전부 정답 처리한, 이 도메인의 최고 등급이에요." },
    { code: "esg_beginner_master", domain: "esg", domainLabel: "ESG · 초급", stars: 1, title: "초급 마스터 컬렉션", desc: "ESG 초급 난이도 문제를 전부 정답 처리한 학습자에게 드려요." },
    { code: "esg_intermediate_master", domain: "esg", domainLabel: "ESG · 중급", stars: 1, title: "중급 마스터 컬렉션", desc: "ESG 중급 난이도 문제를 전부 정답 처리한 학습자에게 드려요." },
    { code: "esg_advanced_master", domain: "esg", domainLabel: "ESG · 고급", stars: 2, title: "고급 마스터 컬렉션", desc: "ESG 고급 난이도 문제를 전부 정답 처리한 학습자에게 드려요." },
    { code: "esg_category5", domain: "esg", domainLabel: "ESG · 카테고리 5/9", stars: 3, title: "카테고리 5 클리어 컬렉션", desc: "ESG 9개 카테고리 중 5개 카테고리를 골라 전부 정답 처리한 학습자에게 드려요." },
    { code: "esg_top20", domain: "esg", domainLabel: "ESG 랭킹 TOP 20", stars: 3, title: "ESG TOP 20 컬렉션", desc: "ESG 랭킹 TOP 20에 든 학습자에게 주어지는 경쟁의 증표예요." },
    { code: "esg_perfect", domain: "esg", domainLabel: "ESG 전체", stars: 4, title: "ESG 퍼펙트 컬렉션", desc: "ESG 전체 문제를 빠짐없이 전부 정답 처리한, 이 도메인의 최고 등급이에요." },
    { code: "atomy_perfect", domain: "cross", domainLabel: "마케팅플랜 × ESG 전체", stars: 5, title: "애터미 퍼펙트 컬렉션", desc: "마케팅플랜과 ESG 전체 문제를 모두 정답 처리한, 이 앱 최고의 영예예요." },
    // 5-3단계: 학습/오늘의 퀴즈 스트릭 6종(신규 study_streak/daily_quiz_streak 데이터 기반)
    { code: "study_streak_3", domain: "sun", domainLabel: "3일 연속 학습", stars: 1, title: "3일 연속 학습 컬렉션", desc: "3일 연속으로 학습에 참여한 첫 불씨예요." },
    { code: "study_streak_7", domain: "sun", domainLabel: "7일 연속 학습", stars: 2, title: "7일 연속 학습 컬렉션", desc: "7일 연속으로 학습에 참여했어요, 습관이 붙기 시작했네요." },
    { code: "study_streak_10", domain: "sun", domainLabel: "10일 연속 학습", stars: 3, title: "10일 연속 학습 컬렉션", desc: "10일 연속으로 학습에 참여한 꾸준함의 증표예요." },
    { code: "daily_quiz_streak_3", domain: "mint", domainLabel: "오늘의 퀴즈 3일 연속 참여(정답 무관)", stars: 1, title: "3일 연속 오늘의 퀴즈 컬렉션", desc: "정답 여부와 무관하게, 오늘의 퀴즈에 3일 연속 참여했어요." },
    { code: "daily_quiz_streak_7", domain: "mint", domainLabel: "오늘의 퀴즈 7일 연속 참여(정답 무관)", stars: 2, title: "7일 연속 오늘의 퀴즈 컬렉션", desc: "정답 여부와 무관하게, 오늘의 퀴즈에 7일 연속 참여했어요." },
    { code: "daily_quiz_streak_10", domain: "mint", domainLabel: "오늘의 퀴즈 10일 연속 참여(정답 무관)", stars: 3, title: "10일 연속 오늘의 퀴즈 컬렉션", desc: "정답 여부와 무관하게, 오늘의 퀴즈에 10일 연속 참여했어요." },
    // 신규: 마케팅플랜+ESG를 합산한 통합 랭킹(랭킹 화면 "통합" 탭과 동일 기준) TOP 20
    { code: "total_top20", domain: "rank", domainLabel: "마케팅플랜 × ESG 통합 랭킹 TOP 20", stars: 3, title: "통합 TOP 20 컬렉션", desc: "마케팅플랜과 ESG를 합산한 통합 랭킹 TOP 20에 든 학습자에게 주어지는 경쟁의 증표예요." }
  ];
  var BADGE_BY_CODE = {};
  BADGES.forEach(function (b) { BADGE_BY_CODE[b.code] = b; });

  var TIER_LABELS = { common: "COMMON", rare: "RARE", epic: "EPIC", legendary: "LEGENDARY", "legendary-cross": "LEGENDARY" };

  function tierOf(b) {
    if (b.stars >= 5) { return "legendary-cross"; }
    if (b.stars === 4) { return "legendary"; }
    if (b.stars === 3) { return "epic"; }
    if (b.stars === 2) { return "rare"; }
    return "common";
  }

  function domainClassOf(b) {
    if (b.domain === "mp" || b.domain === "esg" || b.domain === "sun" || b.domain === "mint" || b.domain === "rank") {
      return "dom-" + b.domain;
    }
    return "";
  }

  // 애터미 실제 상품을 캐릭터화한 마스코트(회장님 제외 별점별 상품): 헤모힘(★4)/
  // 앱솔루트(★3)/노니(★2)/애터미 칫솔(★1). PRD_5단계_카드디자인_시안_v2.html에서
  // 검증한 것과 동일한 SVG를 그대로 재사용한다.
  function cuteLimbs(armColor, footColor) {
    return '<ellipse cx="14" cy="38" rx="4.4" ry="6.2" fill="' + armColor + '" transform="rotate(20 14 38)"/>' +
      '<ellipse cx="44" cy="38" rx="4.4" ry="6.2" fill="' + armColor + '" transform="rotate(-20 44 38)"/>' +
      '<ellipse cx="19" cy="51" rx="5.2" ry="3.8" fill="' + footColor + '"/>' +
      '<ellipse cx="39" cy="51" rx="5.2" ry="3.8" fill="' + footColor + '"/>';
  }
  function cuteFace(cx, eyeY, blushY, mouthY, spread, dark) {
    var lx = cx - spread, rx = cx + spread;
    return '<ellipse cx="' + (lx - 2) + '" cy="' + blushY + '" rx="3.4" ry="2.4" fill="#ff9eb0" opacity="0.6"/>' +
      '<ellipse cx="' + (rx + 2) + '" cy="' + blushY + '" rx="3.4" ry="2.4" fill="#ff9eb0" opacity="0.6"/>' +
      '<circle cx="' + lx + '" cy="' + eyeY + '" r="4.1" fill="#fff"/>' +
      '<circle cx="' + rx + '" cy="' + eyeY + '" r="4.1" fill="#fff"/>' +
      '<circle cx="' + (lx + 1.1) + '" cy="' + (eyeY + 1.3) + '" r="2.3" fill="' + dark + '"/>' +
      '<circle cx="' + (rx + 1.1) + '" cy="' + (eyeY + 1.3) + '" r="2.3" fill="' + dark + '"/>' +
      '<circle cx="' + (lx + 2.1) + '" cy="' + (eyeY - 0.5) + '" r="0.85" fill="#fff"/>' +
      '<circle cx="' + (rx + 2.1) + '" cy="' + (eyeY - 0.5) + '" r="0.85" fill="#fff"/>' +
      '<path d="M' + (cx - 4.5) + " " + mouthY + 'q4.5 3.2 9 0" stroke="' + dark + '" stroke-width="1.8" stroke-linecap="round" fill="none"/>';
  }
  function cuteShine(cx, cy, rx, ry, rot) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#ffffff" opacity="0.4" transform="rotate(' + rot + " " + cx + " " + cy + ')"/>';
  }

  var MASCOTS = {
    hemohim: function () {
      var body = "#7a2035", dark = "#3d0f1a", gold = "#e8bd4e", cream = "#fff8ea";
      return cuteLimbs(body, dark) +
        '<rect x="24" y="4" width="10" height="6" rx="2" fill="' + gold + '" stroke="' + dark + '" stroke-width="1.4"/>' +
        '<rect x="25" y="9" width="8" height="7" fill="' + body + '" stroke="' + dark + '" stroke-width="1.2"/>' +
        '<path d="M18 50 Q17 20 21 15 Q24 12 29 12 Q34 12 37 15 Q41 20 40 50 Q40 55 33 55 L25 55 Q18 55 18 50Z" fill="' + body + '" stroke="' + dark + '" stroke-width="2.4"/>' +
        '<rect x="18.5" y="25" width="21" height="18" rx="3" fill="' + cream + '" stroke="' + dark + '" stroke-width="1.6"/>' +
        '<rect x="18.5" y="45" width="21" height="2.4" fill="' + gold + '" opacity="0.85"/>' +
        cuteFace(29, 33, 39.5, 41.5, 6, dark) +
        cuteShine(21, 19, 3.6, 2, -25);
    },
    absolute: function () {
      var body = "#fdfbf6", dark = "#8a6a1e", gold = "#e9c869";
      return cuteLimbs("#f3e9d2", dark) +
        '<rect x="24" y="3" width="10" height="9" rx="2" fill="' + gold + '" stroke="' + dark + '" stroke-width="1.4"/>' +
        '<path d="M29 5.5l0.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" fill="#fff" opacity="0.85"/>' +
        '<rect x="16" y="14" width="26" height="6" rx="2" fill="' + gold + '" stroke="' + dark + '" stroke-width="1.4"/>' +
        '<rect x="15.5" y="19" width="27" height="35" rx="8" fill="' + body + '" stroke="' + dark + '" stroke-width="2.2"/>' +
        '<path d="M22 46.5q3.5 2.6 7 0t7 0" stroke="' + gold + '" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.85"/>' +
        cuteFace(29, 31, 37.5, 39.5, 6, dark) +
        cuteShine(21, 26, 4, 2.4, -20);
    },
    noni: function () {
      var bodyColor = "#6b7a2e", dark = "#33400f", cap = "#8a5a2a", label = "#f4ecd2", leaf = "#4f9a52";
      return cuteLimbs(bodyColor, dark) +
        '<rect x="26" y="5" width="6" height="8" fill="' + cap + '" stroke="' + dark + '" stroke-width="1.3"/>' +
        '<path d="M29 13c-6 0-8 2-8 6 0 4 3 5 8 5s8-1 8-5c0-4-2-6-8-6Z" fill="' + bodyColor + '" stroke="' + dark + '" stroke-width="2"/>' +
        '<path d="M20 24Q18 24 18 34 L18 47Q18 55 26 55 L32 55Q40 55 40 47L40 34Q40 24 38 24Z" fill="' + bodyColor + '" stroke="' + dark + '" stroke-width="2.2"/>' +
        '<path d="M25 9c-3-3-7-3-8-1 1 3 5 4 8 1Z" fill="' + leaf + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<rect x="19.5" y="28" width="19" height="16" rx="3" fill="' + label + '" stroke="' + dark + '" stroke-width="1.6"/>' +
        cuteFace(29, 34, 40, 42, 5.5, dark) +
        cuteShine(21, 20, 3.4, 2, -25);
    },
    toothbrush: function () {
      var mintLight = "#eafff5", mint = "#3ecf9a", mintDark = "#0f8f66", blue = "#4fc3e0";
      return cuteLimbs(mint, mintDark) +
        '<rect x="19" y="7" width="3.2" height="11" rx="1.6" fill="#fff" stroke="' + mintDark + '" stroke-width="1"/>' +
        '<rect x="24.5" y="5.5" width="3.2" height="12.5" rx="1.6" fill="' + blue + '" stroke="' + mintDark + '" stroke-width="1"/>' +
        '<rect x="30" y="5.5" width="3.2" height="12.5" rx="1.6" fill="#fff" stroke="' + mintDark + '" stroke-width="1"/>' +
        '<rect x="35.5" y="7" width="3.2" height="11" rx="1.6" fill="' + blue + '" stroke="' + mintDark + '" stroke-width="1"/>' +
        '<rect x="24" y="27" width="10" height="27" rx="5" fill="' + mint + '" stroke="' + mintDark + '" stroke-width="2.2"/>' +
        '<rect x="16.5" y="16" width="25" height="17" rx="7" fill="' + mintLight + '" stroke="' + mintDark + '" stroke-width="2.2"/>' +
        cuteFace(29, 22.5, 29, 31, 5.6, mintDark) +
        cuteShine(20, 20, 3.6, 2, -22);
    },
    // 회장님 캐릭터(★5, 애터미 퍼펙트) -- 실제 얼굴을 사실적으로 재현하지 않고,
    // 시그니처 룩(정장·페도라·안경·팔짱 포즈)만 상징적으로 차용한 챠비 캐리커처
    chairman: function () {
      return '<ellipse cx="24" cy="55" rx="5" ry="3.4" fill="#101b33"/>' +
        '<ellipse cx="38" cy="55" rx="5" ry="3.4" fill="#101b33"/>' +
        '<path d="M15 45q8 9 16 6q8 3 16-6" stroke="#101b33" stroke-width="6.6" stroke-linecap="round" fill="none"/>' +
        '<path d="M15 45q8 9 16 6q8 3 16-6" stroke="#22345c" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<ellipse cx="31" cy="41" rx="18" ry="16" fill="#1b2c50" stroke="#0a0f1f" stroke-width="2"/>' +
        '<path d="M20 27l-3 27M27.5 26l-1.6 30M35.5 26l1.6 30M42 27l3 27" stroke="#5b7bb0" stroke-width="0.8" opacity="0.4"/>' +
        '<path d="M31 33l-4.5 7 4.5 15 4.5-15Z" fill="#c62b3a"/>' +
        '<circle cx="30" cy="39" r="1" fill="#fff"/><circle cx="33" cy="43" r="1" fill="#fff"/><circle cx="30" cy="47" r="1" fill="#fff"/>' +
        '<path d="M18.5 37l6.5-3 1 6.5-7.5 1Z" fill="#fff"/>' +
        '<ellipse cx="31" cy="23" rx="10.5" ry="10" fill="#f4c99a" stroke="#8a5a34" stroke-width="1.5"/>' +
        '<path d="M20 13 Q31 0 42 13Z" fill="#101b33"/>' +
        '<ellipse cx="31" cy="13.5" rx="16.5" ry="3" fill="#101b33"/>' +
        '<rect x="18.5" y="11" width="25" height="3" fill="#c62b3a"/>' +
        '<circle cx="21" cy="27" r="2.3" fill="#ff9eb0" opacity="0.55"/><circle cx="41" cy="27" r="2.3" fill="#ff9eb0" opacity="0.55"/>' +
        '<circle cx="25.5" cy="24" r="3.6" fill="none" stroke="#3a2a1a" stroke-width="1.5"/>' +
        '<circle cx="36.5" cy="24" r="3.6" fill="none" stroke="#3a2a1a" stroke-width="1.5"/>' +
        '<path d="M29 24h3" stroke="#3a2a1a" stroke-width="1.5"/>' +
        '<circle cx="25.5" cy="24" r="1.1" fill="#2a1c10"/><circle cx="36.5" cy="24" r="1.1" fill="#2a1c10"/>' +
        '<path d="M25.5 30q5.5 3 11 0" stroke="#4a3320" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
        '<path d="M24.5 32.5q6.5 5 13 0" stroke="#7a3a2a" stroke-width="1.8" stroke-linecap="round" fill="none"/>';
    }
  };

  function buildMascot(b) {
    if (b.code === "atomy_perfect") {
      return MASCOTS.chairman();
    }
    if (b.stars === 4) { return MASCOTS.hemohim(); }
    if (b.stars === 3) { return MASCOTS.absolute(); }
    if (b.stars === 2) { return MASCOTS.noni(); }
    return MASCOTS.toothbrush();
  }

  // 별점별 상품명 라벨(회장님 카드는 제외)
  var PRODUCTS = {
    4: { name: "헤모힘", color: "#7a2035" },
    3: { name: "앱솔루트", color: "#8a6a1e" },
    2: { name: "노니", color: "#33400f" },
    1: { name: "애터미 칫솔", color: "#0f8f66" }
  };
  function productTagHtml(b) {
    if (b.code === "atomy_perfect") {
      return "";
    }
    var product = PRODUCTS[b.stars];
    if (!product) {
      return "";
    }
    return '<div class="product-tag" style="color:' + product.color + ";border-color:" + product.color + ';">' + product.name + "</div>";
  }

  // 애터미 정품 인증 도장(로고 씰) -- 카드 우상단에 고정 배치
  var SEAL_HTML = '<span class="seal"><img class="seal-img" src="atomy-logo.png" alt="atomy" /></span>';

  var SPARKLE_SLOTS = [
    { top: "8%", left: "82%", size: 5 },
    { top: "52%", left: "6%", size: 4 },
    { top: "78%", left: "78%", size: 3 },
    { top: "28%", left: "14%", size: 3 },
    { top: "18%", left: "60%", size: 4 }
  ];

  function buildSparkles(count) {
    var out = "";
    for (var i = 0; i < count && i < SPARKLE_SLOTS.length; i++) {
      var s = SPARKLE_SLOTS[i];
      out += '<div class="badge-sparkle" style="width:' + s.size + "px;height:" + s.size + "px;top:" + s.top +
        ";left:" + s.left + ";animation-delay:" + (i * 0.5) + 's;"></div>';
    }
    return out;
  }

  function buildCardHtml(b, owned, idx, unseen) {
    var tier = tierOf(b);
    var domClass = domainClassOf(b);
    var starHtml = starText(b.stars);
    var mascotSvg = buildMascot(b);
    var sparkleCount = tier === "common" ? 2 : (tier === "rare" ? 3 : (tier === "epic" ? 3 : 5));
    var lockClass = owned ? "is-owned" : "is-locked";
    var unseenClass = owned && unseen ? " is-unseen" : "";
    var tierClass = "tier-" + tier;
    var dataAttrs = ' data-index="' + idx + '" data-owned="' + (owned ? "1" : "0") + '"';

    var faceHtml =
      '<div class="badge-card__face">' +
      (tier !== "common" ? '<div class="badge-card__sheen"></div>' : "") +
      SEAL_HTML +
      (owned && unseen ? '<span class="badge-card__new-flag">새로운 카드 획득!</span>' : "") +
      '<span class="badge-card__badge">' + starHtml + " " + TIER_LABELS[tier] + "</span>" +
      '<div class="badge-card__domain">' + escapeHtmlLocal(b.domainLabel) + "</div>" +
      '<div class="badge-card__icon"><div class="badge-icon-glow"></div><svg class="badge-mascot-svg" viewBox="0 0 58 58" fill="none">' + mascotSvg + "</svg></div>" +
      productTagHtml(b) +
      '<div class="badge-card__title">' + escapeHtmlLocal(b.title) + "</div>" +
      buildSparkles(sparkleCount) +
      '<div class="badge-card__desc">' + escapeHtmlLocal(b.desc) + "</div>" +
      '<div class="badge-card__status">' + (owned ? (unseen ? "✨ 눌러서 확인하기" : "✅ 보유 중") : "🔒 미보유") + "</div>" +
      "</div>";

    if (tier === "legendary" || tier === "legendary-cross") {
      return '<div class="badge-card-outer ' + tierClass + " " + domClass + " " + lockClass + unseenClass + '"' + dataAttrs + '>' +
        '<div class="badge-card ' + tierClass + " " + domClass + " " + lockClass + unseenClass + '">' + faceHtml + "</div>" +
        "</div>";
    }
    return '<div class="badge-card ' + tierClass + " " + domClass + " " + lockClass + unseenClass + '"' + dataAttrs + '>' + faceHtml + "</div>";
  }

  var elOpenBtn = document.getElementById("btn-open-collections");
  var elResultBtn = document.getElementById("btn-result-collections");
  var elHomeBtn = document.getElementById("btn-collections-home");
  var elSigninNotice = document.getElementById("collections-signin-notice");
  var elSummary = document.getElementById("collections-summary");
  var elGrid = document.getElementById("collections-grid");
  var elResultBadgeNotice = document.getElementById("result-badge-notice");
  var elNavDots = [
    document.getElementById("collections-new-dot-start"),
    document.getElementById("collections-new-dot-result")
  ].filter(Boolean);

  // 서버에서 받아온 마지막 보유 목록(코드 -> row) — 카드 클릭 시 로컬에서 seen을
  // 낙관적으로 갱신해 재요청 없이 바로 "NEW" 표시를 지우기 위해 들고 있는다.
  var lastOwnedByCode = {};

  function updateNavDots(rows) {
    var hasUnseen = (rows || []).some(function (r) { return !r.seen; });
    elNavDots.forEach(function (dot) { dot.hidden = !hasUnseen; });
  }

  function escapeHtmlLocal(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function starText(n) {
    var out = "";
    for (var i = 0; i < n; i++) {
      out += "★";
    }
    return out;
  }

  function describeError(err) {
    return (err && err.message) || String(err);
  }

  // 서버에 새로 발급 요청 + 보유 목록을 함께 받아온다. 로그인하지 않은 상태에서는
  // 호출하지 않는다(evaluate_and_award_badges()가 서버에서 예외를 던진다).
  function fetchBadges() {
    return client.rpc("evaluate_and_award_badges").then(function (res) {
      if (res.error) {
        throw res.error;
      }
      return res.data || [];
    });
  }

  function renderGrid(rows) {
    lastOwnedByCode = {};
    (rows || []).forEach(function (r) { lastOwnedByCode[r.code] = r; });

    elSummary.hidden = false;
    elSummary.textContent = "보유 " + Object.keys(lastOwnedByCode).length + " / " + BADGES.length + "종";

    elGrid.innerHTML = BADGES.map(function (b, idx) {
      var row = lastOwnedByCode[b.code];
      return buildCardHtml(b, !!row, idx, !!(row && !row.seen));
    }).join("");

    updateNavDots(rows);
  }

  // ===========================================================
  // 보유 카드 클릭 시 전체화면 리빌(3D 카드 플립 + 폭죽) — PRD_5단계_카드디자인_시안_v2.html에서
  // 검증한 연출을 그대로 이식한다. 미보유 카드는 클릭해도 아무 일도 일어나지 않는다.
  // ===========================================================
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var RECIPES = {
    common: { colors: ["#8be89a", "#22b56a", "#eaffb0", "#ffffff"], shapes: ["circle"], count: 20, spread: 110, sizeMin: 8, sizeMax: 15, duration: 850 },
    candy: { colors: ["#fff3b0", "#ffb56b", "#ff6f61", "#ff3d81"], shapes: ["circle", "star"], count: 34, spread: 165, sizeMin: 9, sizeMax: 18, duration: 1050 },
    epicburst: { colors: ["#22b56a", "#1e9fe0", "#ffe9a8", "#ffffff"], shapes: ["streak", "circle"], count: 42, spread: 210, sizeMin: 10, sizeMax: 24, duration: 1200, rings: 3, ringDelay: 230 },
    legendary: { colors: ["#ffd9a8", "#ffc2de", "#d8ccff", "#ffffff", "#f0c419"], shapes: ["circle", "star", "streak"], count: 56, spread: 260, sizeMin: 10, sizeMax: 26, duration: 1450, rings: 5, ringDelay: 200 }
  };

  // ★1~2=1연발(common/candy), ★3~4=3연발(epicburst), ★5=5연발(legendary)
  function fireworkRecipeFor(b) {
    if (b.stars >= 5) { return "legendary"; }
    if (b.stars >= 3) { return "epicburst"; }
    if (b.stars === 2) { return "candy"; }
    return "common";
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function spawnParticle(slot, recipe) {
    var el = document.createElement("div");
    el.className = "firework-particle";
    var angle = rand(0, 360);
    var dist = recipe.spread * rand(0.55, 1.05);
    var size = rand(recipe.sizeMin, recipe.sizeMax);
    var color = recipe.colors[Math.floor(Math.random() * recipe.colors.length)];
    var shape = recipe.shapes[Math.floor(Math.random() * recipe.shapes.length)];
    var duration = recipe.duration * rand(0.85, 1.15);

    el.style.setProperty("--rot", angle + "deg");
    el.style.setProperty("--dist", dist + "px");
    el.style.setProperty("--dur", duration + "ms");
    el.style.setProperty("--endscale", shape === "streak" ? "0.15" : "0.35");

    if (shape === "star") {
      el.textContent = "★";
      el.style.background = "transparent";
      el.style.color = color;
      el.style.fontSize = (size * 2.1) + "px";
      el.style.lineHeight = "1";
      el.style.width = "auto";
      el.style.height = "auto";
    } else if (shape === "streak") {
      el.style.setProperty("--radius", "2px");
      el.style.width = (size * 3.0) + "px";
      el.style.height = Math.max(2, size * 0.3) + "px";
      el.style.background = "linear-gradient(90deg, " + color + ", rgba(255,255,255,0))";
      el.style.transformOrigin = "left center";
      el.style.left = "50%";
    } else {
      el.style.setProperty("--size", size + "px");
      el.style.setProperty("--color", color);
    }

    slot.appendChild(el);
    el.addEventListener("animationend", function () { el.remove(); }, { once: true });
    setTimeout(function () { if (el.parentNode) { el.remove(); } }, duration + 400);
  }

  function burst(slot, recipeName) {
    var recipe = RECIPES[recipeName] || RECIPES.common;
    var rings = recipe.rings || 1;
    for (var ring = 0; ring < rings; ring++) {
      setTimeout(function () {
        for (var i = 0; i < recipe.count; i++) {
          spawnParticle(slot, recipe);
        }
      }, ring * (recipe.ringDelay || 0));
    }
  }

  function renderRevealFront(b) {
    var tier = tierOf(b);
    var domClass = domainClassOf(b);
    var starHtml = starText(b.stars);
    var mascotSvg = buildMascot(b);
    return '<div class="reveal-face reveal-front badge-card tier-' + tier + " " + domClass + ' is-owned">' +
      '<div class="reveal-art badge-card__face">' +
      (tier !== "common" ? '<div class="badge-card__sheen"></div>' : "") +
      '<div class="reveal-glow"></div>' +
      SEAL_HTML +
      '<span class="badge-card__badge">' + starHtml + " " + TIER_LABELS[tier] + "</span>" +
      '<div class="badge-card__domain">' + escapeHtmlLocal(b.domainLabel) + "</div>" +
      '<div class="badge-card__icon"><div class="badge-icon-glow"></div><svg class="badge-mascot-svg" viewBox="0 0 58 58" fill="none">' + mascotSvg + "</svg></div>" +
      productTagHtml(b) +
      '<div class="badge-card__title">' + escapeHtmlLocal(b.title) + "</div>" +
      buildSparkles(5) +
      '<div class="badge-card__desc">' + escapeHtmlLocal(b.desc) + "</div>" +
      "</div>" +
      "</div>";
  }

  function renderRevealBack(b) {
    return '<div class="reveal-face reveal-back">애터미 기념컬렉션<br/>' + escapeHtmlLocal(b.title) + "<br/>© Atomy</div>";
  }

  var elRevealOverlay = document.getElementById("revealOverlay");
  var elRevealStage = document.getElementById("revealStage");
  var elRevealClose = document.getElementById("revealClose");

  function openReveal(b) {
    if (!elRevealOverlay || !elRevealStage) {
      return;
    }
    elRevealStage.innerHTML = '<div class="reveal-flip">' + renderRevealFront(b) + renderRevealBack(b) + "</div>";
    elRevealOverlay.classList.add("is-open");
    if (!reduceMotion) {
      setTimeout(function () {
        var flip = elRevealStage.querySelector(".reveal-flip");
        if (flip) { burst(flip, fireworkRecipeFor(b)); }
      }, 900);
    }
  }

  function closeReveal() {
    if (!elRevealOverlay) {
      return;
    }
    elRevealOverlay.classList.remove("is-open");
    setTimeout(function () { elRevealStage.innerHTML = ""; }, 350);
  }

  if (elRevealClose) {
    elRevealClose.addEventListener("click", closeReveal);
  }
  if (elRevealOverlay) {
    // 배경뿐 아니라 카드(리빌 스테이지) 자체를 클릭해도 닫히게 한다 -- 닫기 버튼 클릭도
    // 여기까지 버블링되어 closeReveal()이 한 번 더 불리지만 멱등이라 문제없다.
    elRevealOverlay.addEventListener("click", function () {
      closeReveal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeReveal(); }
  });

  // 그리드 클릭 위임 -- elGrid.innerHTML은 매번 새로 그려지지만 elGrid 자체는 그대로라
  // 리스너를 한 번만 걸어두면 재렌더링 후에도 계속 동작한다. 미보유 카드는 무시한다.
  elGrid.addEventListener("click", function (e) {
    var slot = e.target.closest("[data-index]");
    if (!slot || !elGrid.contains(slot)) {
      return;
    }
    if (slot.getAttribute("data-owned") !== "1") {
      return;
    }
    var idx = parseInt(slot.getAttribute("data-index"), 10);
    var b = BADGES[idx];
    if (!b) {
      return;
    }
    openReveal(b);

    // "새로운 카드 획득" 표시를 클릭한 순간 지운다(낙관적 갱신 + 서버에도 반영).
    var row = lastOwnedByCode[b.code];
    if (row && !row.seen) {
      row.seen = true;
      renderGrid(Object.keys(lastOwnedByCode).map(function (code) { return lastOwnedByCode[code]; }));
      // rpc()는 서버(SQL) 에러가 나도 프라미스를 reject하지 않고 res.error로 돌려주므로
      // .catch()만으로는 잡히지 않는다 — 명시적으로 확인해서 콘솔에 남긴다.
      client.rpc("mark_badge_seen", { p_code: b.code }).then(function (res) {
        if (res.error) {
          console.error("카드 확인 처리 실패(서버):", describeError(res.error));
        }
      }).catch(function (err) {
        console.error("카드 확인 처리 실패(네트워크):", describeError(err));
      });
    }
  });

  function renderSignedOut() {
    elSigninNotice.hidden = false;
    elSummary.hidden = true;
    elGrid.innerHTML = "";
  }

  function isLoggedIn() {
    return !!(window.QuizCloudSync && window.QuizCloudSync.getCurrentUser && window.QuizCloudSync.getCurrentUser());
  }

  function openCollectionsScreen() {
    if (!isLoggedIn()) {
      renderSignedOut();
      window.QuizApp.setScreen("collections");
      return;
    }
    elSigninNotice.hidden = true;
    window.QuizApp.setScreen("collections");
    fetchBadges().then(renderGrid).catch(function (err) {
      elSummary.hidden = true;
      elGrid.innerHTML = '<p class="dashboard-empty">컬렉션을 불러오지 못했습니다: ' + escapeHtmlLocal(describeError(err)) + "</p>";
    });
  }

  if (elOpenBtn) {
    elOpenBtn.addEventListener("click", openCollectionsScreen);
  }
  if (elResultBtn) {
    elResultBtn.addEventListener("click", openCollectionsScreen);
  }
  if (elHomeBtn) {
    elHomeBtn.addEventListener("click", function () {
      window.QuizApp.setScreen("start");
    });
  }

  // 결과 화면에 "새로 획득한 컬렉션" 한 줄 안내를 띄운다. 화면 이동 없이 조용히 판정만
  // 하고, 실제 카드 확인은 "내 컬렉션 보기" 버튼(위 openCollectionsScreen)에서 이뤄진다.
  function announceNewBadges(rows) {
    if (!elResultBadgeNotice) {
      return;
    }
    var newTitles = (rows || [])
      .filter(function (r) { return r.is_new; })
      .map(function (r) { return (BADGE_BY_CODE[r.code] || {}).title || r.code; });
    if (newTitles.length === 0) {
      elResultBadgeNotice.hidden = true;
      return;
    }
    elResultBadgeNotice.hidden = false;
    elResultBadgeNotice.textContent = "🎉 새 컬렉션 획득: " + newTitles.join(", ");
  }

  // 5-3단계: 학습/오늘의 퀴즈 스트릭 기록. app.js의 todayKey()와 동일한 형식(로컬 날짜
  // 문자열)을 서버에 그대로 전달한다 — 시간대가 다른 사용자마다 자정 근처에서 어긋나지
  // 않도록, daily_quiz 컬럼과 동일하게 서버 now()가 아니라 클라이언트 로컬 날짜를 쓴다.
  function todayKeyLocal() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  // 같은 날 여러 번 호출돼도 서버 RPC는 멱등이지만, 문제 하나 풀 때마다 매번 네트워크
  // 요청을 보내지 않도록 클라이언트에서도 하루 한 번으로 줄인다.
  var lastRecorded = { study: null, daily_quiz: null };
  function recordActivity(kind) {
    if (!isLoggedIn()) {
      return;
    }
    var today = todayKeyLocal();
    if (lastRecorded[kind] === today) {
      return;
    }
    lastRecorded[kind] = today;
    client.rpc("record_activity", { p_kind: kind, p_today: today }).then(function (res) {
      if (res.error) {
        console.error("활동 기록 실패(서버):", describeError(res.error));
        lastRecorded[kind] = null; // 실패했으니 같은 날 다시 시도할 수 있게 되돌린다
      }
    }).catch(function (err) {
      console.error("활동 기록 실패(네트워크):", describeError(err));
      lastRecorded[kind] = null;
    });
  }

  window.QuizCollections = {
    onQuizCompleted: function () {
      if (!isLoggedIn()) {
        return;
      }
      fetchBadges().then(function (rows) {
        updateNavDots(rows);
        announceNewBadges(rows);
      }).catch(function (err) {
        console.error("컬렉션 판정 실패:", describeError(err));
      });
    },
    onLogin: function () {
      fetchBadges().then(updateNavDots).catch(function (err) {
        console.error("컬렉션 판정 실패:", describeError(err));
      });
    },
    // app.js가 문제를 1개 이상 채점했을 때(정답 여부 무관) 호출한다 — "학습" 스트릭.
    recordStudyActivity: function () {
      recordActivity("study");
    },
    // app.js가 "오늘의 퀴즈" 결과를 표시할 때 호출한다(정답 여부 무관) — 오늘의 퀴즈 스트릭.
    recordDailyQuizActivity: function () {
      recordActivity("daily_quiz");
    }
  };
})();
