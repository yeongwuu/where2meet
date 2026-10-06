// ④ 추천 결과: 모임(w2m.meeting)의 사람들로 식당을 거르고 점수를 매겨 3곳을 보여 줘요. 계산은 docs/data_spec.md 4-2·4-3 기준
import { FOOD, ALLERGY, DIET, RANK_ROLE, PURPOSE, BUDGET_MAX } from "./labels.js";
import { KEYS, PAGES, load, save, loadData, goTo, toast, icon, setupTabBar, won, budgetLabel } from "./common.js";

const profile = load(KEYS.profile);
const meeting = load(KEYS.meeting);
const SELF_ID = profile?.id ?? "me";

const TOP_N = 3;
// 점수 가중치 (data_spec.md 4-3 표와 같아요). 바꾸면 표도 같이 고쳐요
// 예산·도보·술·분위기·룸 각 20점 = 최대 100점, 오늘 안 당기는 음식은 최대 −30점
const WEIGHT = {
  budget: 20, // 예산 안이면 20, 범위 밖 5천원마다 −5
  walk: 20, // 도보 시간 안이면 20, 1분 넘을 때마다 −4
  drink: 20, // 술 결론과 같으면 20, 한 단계 차이 10, 두 단계 0
  mood: 20, // 분위기 결론과 같으면 20, 상관없음 10, 반대 0
  room: 20, // 자리 여유 있으면 20, 빠듯하면 10. 룸이 필요한 모임인데 룸이 없으면 −10
  notToday: 30, // 오늘 안 당기는 사람 비율 × 30 만큼 감점
};
const BUDGET_STEP = 5000; // 예산 범위 밖 이만큼마다
const BUDGET_STEP_POINTS = 5; // 이만큼 깎아요
const WALK_MINUTE_POINTS = 4; // 도보 시간을 1분 넘을 때마다 깎는 점수

// 술: 덜 마시는 순서. 결론은 ③과 같은 방식 (같은 수면 덜 마시는 쪽)
const DRINK_ORDER = ["drink_none", "drink_light", "drink_enjoy"];
const DRINK_PLACE = { drink_none: "식사 중심", drink_light: "반주 가능", drink_enjoy: "술자리 중심" };
const DRINK_FIT = {
  drink_none: "술 없이 식사하기 좋아요",
  drink_light: "반주 정도에 맞아요",
  drink_enjoy: "술자리로 즐기기 좋아요",
};
// 술 결론과 두 단계 차이 날 때 ⚠
const DRINK_MISMATCH = {
  drink_none: "식사 중심이라 술자리로는 아쉬울 수 있어요",
  drink_enjoy: "술자리 중심이라 술을 안 마시는 분은 불편할 수 있어요",
};
const MOOD_OPPOSITE ={ mood_quiet: "mood_lively", mood_lively: "mood_quiet" };
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
// restaurants.json closed 코드 (Date.getDay() 순서)
const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// "n명이 오늘은 OO이 안 당긴대요"에 쓰는 음식 이름
const FOOD_PHRASE = { ...FOOD, food_asian: "아시안 음식" };
const ROOM_TIGHT = 3; // 최대 인원 - 모임 인원이 이 이하면 ⚠

const apply = { character: true, food: true, drink: true, ...meeting?.apply };
let people = [];
let wholeTeam = false;
let ranked = []; // 조건을 지킨 식당, 점수 높은 순
let reviews = [];
let showAll = false;
let openId = null; // 지금 펼친 카드 (한 번에 하나)

// ---------- 데이터 (③ summary.js와 같은 방식) ----------

async function loadPeople() {
  const [members, guests] = await Promise.all([loadData("members"), loadData("guests")]);
  const self = { ...(members.find((m) => m.id === SELF_ID) ?? {}), ...profile, id: SELF_ID, is_member: true };
  const all = [self, ...members.filter((m) => m.id !== SELF_ID), ...(load(KEYS.guests) ?? []), ...guests];
  const ids = new Set([SELF_ID, ...meeting.people]);
  const teammates = members.filter((m) => meeting.team && m.team === meeting.team && m.id !== SELF_ID);
  wholeTeam = teammates.length > 0 && teammates.every((m) => ids.has(m.id));
  people = all.filter((p) => ids.has(p.id) && ids.delete(p.id));
}

function roleOf(person) {
  if (person.id === SELF_ID) return null;
  return person.relation ?? RANK_ROLE[person.rank] ?? null;
}

const known = () => people.filter((p) => p.is_member === true);
const unknown = () => people.filter((p) => p.is_member === false);
const overlaps = (a = [], b = []) => a.some((x) => b.includes(x));

function countBy(list, pick) {
  const counts = {};
  list.forEach((p) => [pick(p)].flat().filter(Boolean).forEach((code) => (counts[code] = (counts[code] ?? 0) + 1)));
  return counts;
}

function topDrink(counts) {
  return DRINK_ORDER.reduce((best, code) => ((counts[code] ?? 0) > (best ? counts[best] : 0) ? code : best), null);
}

// 조용한 곳·활기찬 곳 중 하나만 가장 많을 때만 결론, 나머지는 중립
function topMood(counts) {
  const codes = ["mood_quiet", "mood_any", "mood_lively"];
  const max = Math.max(0, ...codes.map((c) => counts[c] ?? 0));
  const tops = codes.filter((c) => max > 0 && (counts[c] ?? 0) === max);
  return tops.length === 1 ? tops[0] : "mood_any";
}

// ---------- 모임 조건 ----------

function groupNeeds() {
  const list = known();
  const allergies = countBy(people, (p) => p.allergies);
  const diets = countBy(people, (p) => p.diet);
  return {
    size: people.length,
    known: list.length,
    allergies, // { allergy_*: 인원 }
    diets, // { diet_*: 인원 }
    restricted: people.filter((p) => p.allergies?.length || p.diet?.length).length,
    exec: people.filter((p) => roleOf(p) === "임원").length,
    boss: people.filter((p) => roleOf(p) === "상사").length,
    client: meeting.purpose === "purpose_client" || people.some((p) => roleOf(p) === "거래처"),
    drink: topDrink(countBy(list, (p) => p.drink)),
    mood: topMood(countBy(list, (p) => p.mood)),
  };
}

// 4-2 조건 거르기: 하나라도 어기면 빼요. 못 먹는 것과 갈 수 없는 곳(인원 초과·휴무·영업시간 밖)만 걸러요
// 예산·도보는 거르지 않고 점수로 반영해요 (4-3)
function passes(r, need) {
  if (overlaps(r.allergens, Object.keys(need.allergies))) return false;
  if (Object.keys(need.diets).some((d) => !r.diet_ok.includes(d))) return false;
  if (r.capacity < need.size) return false;
  const date = meetingDate();
  if (date && r.closed?.includes(DAY_CODES[date.getDay()])) return false;
  if (meeting.time && r.hours && !isOpenAt(r.hours, meeting.time)) return false;
  return true;
}

// walk_10 → 10
const walkLimitMin = () => Number(meeting.walk?.split("_")[1]) || null;

// "17:00-02:00"처럼 자정을 넘기는 영업시간도 처리해요
function isOpenAt(hours, time) {
  const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  const [open, close] = hours.split("-").map(toMin);
  const t = toMin(time);
  return close > open ? t >= open && t < close : t >= open || t < close;
}

// 예산 범위 밖으로 벗어난 금액 (+면 비쌈, −면 저렴함, 0이면 범위 안)
function budgetGap(r) {
  const [min, max] = meeting.budget ?? [0, BUDGET_MAX];
  if (max < BUDGET_MAX && r.price_per_person > max) return r.price_per_person - max;
  if (r.price_per_person < min) return r.price_per_person - min;
  return 0;
}

// 도보 시간을 넘은 분 (회사에서 모일 때만. 역 기준 데이터는 아직 없어요, data_spec 5장)
function walkOver(r) {
  const limit = walkLimitMin();
  if (meeting.place !== "place_office" || !limit || r.walk_min === undefined) return 0;
  return Math.max(0, r.walk_min - limit);
}

// 4-3 점수 + 4-4 근거 문장. ③에서 끈 항목은 점수와 근거에서 빼요
function scoreOf(r, need) {
  const list = known();
  // 오늘 안 당기는 사람: 식당 음식 중 하나라도 not_today에 있는 사람
  const notTodayPeople = list.filter((p) => overlaps(p.not_today, r.food)).length;
  const ok = [];
  const warn = [];
  let score = 0;

  // 못 먹는 것: 조건 거르기를 통과했으니 늘 ✓
  const allergyNames = Object.keys(ALLERGY).filter((c) => need.allergies[c]).map((c) => ALLERGY[c]);
  const dietNames = Object.keys(DIET).filter((c) => need.diets[c]).map((c) => DIET[c]);
  if (allergyNames.length) ok.push(`${josa(allergyNames.join("·"), "이", "가")} 주재료가 아니에요`);
  if (dietNames.length) {
    ok.push(`${dietNames.join("·")} 메뉴를 준비할 수 있어요`);
    warn.push(`${dietNames.join("·")} 메뉴는 예약할 때 미리 요청해 주세요`);
  }

  // 예산: 범위 안이면 20, 벗어난 5천원마다 −5
  const gap = budgetGap(r);
  const budgetFit = gap === 0;
  score += Math.max(0, WEIGHT.budget - Math.ceil(Math.abs(gap) / BUDGET_STEP) * BUDGET_STEP_POINTS);
  if (gap > 0) warn.push(`예산보다 1인 ${won(gap)} 비싸요`);
  if (gap < 0) warn.push(`예산보다 1인 ${won(-gap)} 저렴해요`);

  // 도보: 시간 안이면 20, 넘은 1분마다 −4
  const over = walkOver(r);
  const walkFit = over === 0;
  score += Math.max(0, WEIGHT.walk - over * WALK_MINUTE_POINTS);
  if (over) warn.push(`회사에서 도보 ${r.walk_min}분이라 ${over}분 더 걸려요`);

  // 오늘 안 당기는 음식: 안 당기는 사람 비율 × 30 감점. 누가 골랐는지는 드러내지 않아요
  if (apply.food && list.length) {
    score -= (WEIGHT.notToday * notTodayPeople) / list.length;
    r.food.forEach((code) => {
      const n = list.filter((p) => p.not_today?.includes(code)).length;
      if (n) warn.push(`${n}명이 오늘은 ${josa(FOOD_PHRASE[code], "이", "가")} 안 당긴대요`);
    });
  }

  let drinkFit = false;
  if (apply.drink && need.drink) {
    // 결론과 같으면 20, 한 단계 차이(예: 술자리 중심 ↔ 반주 가능)면 10, 두 단계면 0 + ⚠
    const step = Math.abs(DRINK_ORDER.indexOf(r.drink) - DRINK_ORDER.indexOf(need.drink));
    if (step === 0) {
      score += WEIGHT.drink;
      drinkFit = true;
      ok.push(DRINK_FIT[r.drink]);
    } else if (step === 1) {
      score += WEIGHT.drink / 2;
    } else {
      warn.push(DRINK_MISMATCH[r.drink]);
    }
  }

  // 분위기: 결론과 같으면 20, 어느 한쪽이 상관없음이면 10, 정반대면 0 + ⚠
  if (apply.drink && need.mood) {
    if (need.mood === "mood_any" || r.mood === "mood_any") {
      score += WEIGHT.mood / 2;
    } else if (r.mood === need.mood) {
      score += WEIGHT.mood;
      ok.push(r.mood === "mood_quiet" ? "조용해서 대화하기 좋아요" : "활기찬 분위기예요");
    } else if (r.mood === MOOD_OPPOSITE[need.mood]) {
      warn.push(r.mood === "mood_lively" ? "활기찬 곳이라 대화가 어려울 수 있어요" : "조용한 곳이라 분위기가 차분해요");
    }
  }

  // 룸·자리: 자리 여유가 있으면 20, 빠듯하면(남는 자리 3 이하) 10. 룸이 필요한 모임인데 룸이 없으면 −10
  const tight = r.capacity - need.size <= ROOM_TIGHT;
  let roomScore = tight ? WEIGHT.room / 2 : WEIGHT.room;
  if (tight) warn.push(`${r.private_room ? "룸이" : "최대"} ${r.capacity}인이라 인원이 늘면 어려워요`);
  const needsRoom = need.exec || need.boss || need.client;
  let roomFit = false;
  if (apply.character && needsRoom) {
    if (r.private_room) {
      roomFit = true;
      ok.push(`룸 ${r.capacity}인 · ${withWhom(need)} 모시기 좋아요`);
    } else {
      roomScore -= WEIGHT.room / 2;
      warn.push("룸이 없어요. 자리 배치를 미리 확인해 주세요");
    }
  } else if (r.private_room) {
    ok.push(`룸 ${r.capacity}인`);
  }
  score += Math.max(0, roomScore);

  return { r, score, notTodayPeople, ok, warn, drinkFit, roomFit, budgetFit, walkFit };
}

function withWhom(need) {
  if (need.client) return "손님";
  return [need.exec && "임원", need.boss && "상사"].filter(Boolean).join("·");
}

const foodName = (r) => r.food.map((c) => FOOD[c]).join("·");

// 받침에 따라 조사 고르기: josa("생선", "이", "가") → "생선이"
function josa(word, withBatchim, without) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const batchim = code >= 0 && code <= 11171 ? code % 28 : 0;
  // "으로/로"는 ㄹ 받침(8)도 "로"
  const useFirst = withBatchim === "으로" ? batchim !== 0 && batchim !== 8 : batchim !== 0;
  return word + (useFirst ? withBatchim : without);
}

// "3팀 전원 회식" / "팀 회식"
function meetingName() {
  const purpose = PURPOSE[meeting.purpose] ?? "모임";
  const teamShort = meeting.team?.split(" ").slice(1).join(" ");
  return wholeTeam ? `${teamShort} 전원 ${purpose.replace("팀 회식", "회식")}` : purpose;
}

// 모임 날짜. 날짜를 아직 안 골랐으면 null
function meetingDate() {
  if (meeting.day === "day_pick") return meeting.date ? new Date(`${meeting.date}T00:00`) : null;
  if (meeting.day !== "day_today" && meeting.day !== "day_tomorrow") return null;
  const date = new Date();
  if (meeting.day === "day_tomorrow") date.setDate(date.getDate() + 1);
  return date;
}

// "10월 6일(월) 18:30"
function meetingWhen() {
  const date = meetingDate();
  const day = date ? `${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAY[date.getDay()]})` : "";
  return [day, meeting.time].filter(Boolean).join(" ");
}

// 영업시간 · 휴무 · 주차 · 정보 확인일 한 줄. 없는 값은 빼요
function infoLine(r) {
  const closed = r.closed?.length ? `휴무 ${r.closed.map((c) => WEEKDAY[DAY_CODES.indexOf(c)]).join("·")}요일` : r.closed && "휴무 없음";
  const parking = r.parking === undefined ? null : r.parking ? `주차 ${r.parking}대` : "주차 안 돼요";
  const checked = r.info_checked && `정보 확인일 ${r.info_checked.replaceAll("-", ".")}`;
  const parts = [r.hours?.replace("-", "~"), closed, parking, checked].filter(Boolean);
  return parts.length ? parts.join(" · ") : "영업시간 · 주차는 정보 준비 중이에요";
}

// 30000 → "약 3만원"
const price = (n) => `약 ${won(n)}`;

// ---------- AI 요약 ----------

function renderSummary(need) {
  const restrictedKinds = [
    Object.keys(need.allergies).length && "알레르기",
    ...Object.keys(DIET).filter((c) => need.diets[c]).map((c) => DIET[c]),
  ].filter(Boolean);
  const first = need.restricted
    ? `${need.size}명 중 <strong>${josa(restrictedKinds.join("·"), "이", "가")}</strong> 있는 ${need.restricted}명도 모두 먹을 수 있고`
    : `${need.size}명이 모두 먹을 수 있고`;

  // 1순위가 실제로 맞춘 것만 말해요 (지키지 못한 걸 "위주로 골랐다"고 하지 않게)
  const best = ranked[0];
  const focus = [];
  if (best.roomFit) focus.push(`${josa(withWhom(need), "이", "가")} 함께해도 편한 룸이 있는 곳`);
  if (apply.food && need.known && !best.notTodayPeople) focus.push(`오늘 모두 괜찮은 ${foodName(best.r)}`);
  if (best.budgetFit && best.walkFit) focus.push("예산과 거리에 맞는 곳");
  if (best.drinkFit) focus.push(`${DRINK_PLACE[need.drink]} 자리`);

  const sentences = [focus.length ? `${first}, ${focus.join(" · ")} 위주로 골랐어요.` : `${first}, 조건을 지키는 곳 중에서 골랐어요.`];
  const off = [!apply.character && "모임 성격", !apply.food && "음식 취향", !apply.drink && "술·분위기"].filter(Boolean);
  // 1·2위가 동점이면 순서를 가격으로 정했다는 걸 알려 줘요 (순서·강조는 그대로)
  const second = ranked[1];
  if (second && Math.abs(best.score - second.score) < 1e-9) {
    const pair = `${josa(best.r.name, "과", "와")} ${josa(second.r.name, "은", "는")} 똑같이 잘 맞아요.`;
    sentences.push(best.r.price_per_person < second.r.price_per_person ? `${pair} 1인 금액이 낮은 곳을 먼저 보여 드려요.` : pair);
  }
  if (off.length) sentences.push(`꺼 둔 ${josa(off.join("·"), "은", "는")} 순위에 넣지 않았어요.`);
  if (unknown().length) sentences.push(`취향 모름 ${unknown().length}명은 계산에서 빠졌어요.`);

  document.getElementById("ai-text").innerHTML = sentences.join(" ");
  document.getElementById("ai-box").hidden = false;
}

// ---------- 추천 카드 ----------

function reviewsOf(r) {
  return reviews.filter((v) => v.restaurant_id === r.id);
}

function cardHtml(item, rank, need) {
  const { r, notTodayPeople, ok, warn } = item;
  const isTop = rank === 0;
  const open = openId === r.id;
  const mine = reviewsOf(r);
  const rating = mine.length ? (mine.reduce((s, v) => s + v.rating, 0) / mine.length).toFixed(1) : null;
  const confirmed = meeting.confirmed?.restaurant_id === r.id;

  // 목업: "회사에서 도보 9분 · ★ 4.5 · 1인 약 3만원"
  const meta = [
    r.walk_min !== undefined && `회사에서 도보 ${r.walk_min}분`,
    rating && `<span class="star">${icon("star", "icon-sm")}${rating}</span>`,
    `1인 ${price(r.price_per_person)}`,
  ].filter(Boolean).join(" · ");

  const likeBox = !need.known
    ? "취향을 입력한 사람이 없어요"
    : notTodayPeople
      ? `취향 입력한 ${need.known}명 중 ${need.known - notTodayPeople}명이 오늘 괜찮은 음식`
      : `취향 입력한 ${need.known}명 모두 오늘 괜찮은 음식`;

  const reasons = [
    ...ok.map((t) => `<li class="reason">${icon("check")}<span>${t}</span></li>`),
    ...warn.map((t) => `<li class="reason is-warn">${icon("triangle-alert")}<span>${t}</span></li>`),
  ].join("");

  return `
    <li class="card rec-card${isTop ? " is-top" : ""}" data-id="${r.id}">
      <div class="rec-head">
        <div class="thumb" aria-hidden="true">${icon("utensils")}<span>${FOOD[r.food[0]]}</span></div>
        <div class="rec-info">
          <h3 class="rec-name">${r.name}${isTop ? `<span class="badge badge-top">가장 잘 맞아요</span>` : ""}</h3>
          <p class="rec-meta">${meta}</p>
        </div>
      </div>
      <p class="like-box">${likeBox}</p>
      <ul class="reasons">${reasons}</ul>
      <div class="rec-detail" id="detail-${r.id}" ${open ? "" : "hidden"}>
        ${detailHtml(r, need, mine, confirmed)}
      </div>
      <button type="button" class="link-btn rec-toggle" aria-expanded="${open}" aria-controls="detail-${r.id}">
        ${open ? "접기" : "자세히 보고 확정하기"}${icon("chevron-down")}
      </button>
    </li>`;
}

function detailHtml(r, need, mine, confirmed) {
  const allergyCodes = Object.keys(ALLERGY).filter((c) => need.allergies[c]);
  const allergyPeople = people.filter((p) => p.allergies?.length).length;
  const dietNames = Object.keys(DIET).filter((c) => need.diets[c]).map((c) => DIET[c]);
  const walkLimit = walkLimitMin();
  // 오른쪽 근거는 인원만 보여 줘요. 누가 못 먹는지는 드러내지 않아요
  const rows = [
    allergyCodes.length
      ? [`${allergyCodes.map((c) => ALLERGY[c]).join("·")} 없음`, `알레르기 ${allergyPeople}명`]
      : ["알려진 알레르기 없음", "해당 없음"],
    dietNames.length && [`${dietNames.join("·")} 대응`, "예약 때 미리 요청"],
    [r.private_room ? `룸 ${r.capacity}인` : `최대 ${r.capacity}명`, `${need.size}명`],
    [`1인 ${price(r.price_per_person)}`, `예산 ${budgetLabel(meeting.budget ?? [0, BUDGET_MAX])}`, budgetGap(r) !== 0],
    meeting.place === "place_office" && r.walk_min !== undefined && [`회사에서 도보 ${r.walk_min}분`, walkLimit ? `${walkLimit}분 이내` : "", walkOver(r) > 0],
  ].filter(Boolean);

  const reviewBlock = mine.length
    ? `<h4 class="detail-title">후기 ${mine.length}</h4>
       <ul class="reviews">${mine.slice(0, 2).map(reviewHtml).join("")}</ul>`
    : "";

  return `
    <h4 class="detail-title">${meetingName()} 기준 체크</h4>
    <ul class="check-list">
      ${rows
        .map(([label, basis, off]) =>
          off
            ? `<li class="is-warn">${icon("triangle-alert")}<span class="check-label">${label}</span><span class="check-basis">${basis}</span></li>`
            : `<li>${icon("check")}<span class="check-label">${label}</span><span class="check-basis">${basis}</span></li>`,
        )
        .join("")}
    </ul>
    <p class="info-line">${infoLine(r)}</p>
    ${reviewBlock}
    <div class="rec-actions">
      <button type="button" class="btn-secondary" data-action="copy">${icon("copy", "icon-sm")}공지 문구 복사</button>
      <button type="button" class="btn-primary btn-sm" data-action="confirm">${confirmed ? "확정했어요" : "이 식당으로 확정"}</button>
    </div>`;
}

function reviewHtml(v) {
  const situation = [v.purpose, v.with, v.headcount && `${v.headcount}명`].filter(Boolean).join(" · ");
  return `
    <li class="review">
      <p class="review-head"><span class="star">${icon("star", "icon-sm")}${v.rating}</span> · ${situation}</p>
      ${v.comment ? `<p class="review-body">${v.comment}</p>` : ""}
    </li>`;
}

function renderCards(need) {
  const shown = showAll ? ranked : ranked.slice(0, TOP_N);
  document.getElementById("rec-list").innerHTML = shown.map((item, i) => cardHtml(item, i, need)).join("");

  // "조건을 모두 지키는 곳은 4곳이에요 · 1곳 더 보기" → 누르면 나머지 카드가 이어서 나와요
  const extra = ranked.length - TOP_N;
  document.getElementById("count-text").textContent =
    `조건을 모두 지키는 곳은 ${ranked.length}곳이에요` + (extra > 0 ? " ·" : "");
  const more = document.getElementById("more");
  more.hidden = extra <= 0;
  more.textContent = showAll ? "처음 3곳만 보기" : `${extra}곳 더 보기`;
  more.setAttribute("aria-expanded", String(showAll));
}

function toggleMore() {
  showAll = !showAll;
  // 접을 때 펼쳐 둔 카드가 숨으면 1순위를 다시 펼쳐요
  if (!showAll && ranked.findIndex((x) => x.r.id === openId) >= TOP_N) openId = ranked[0].r.id;
  renderCards(currentNeed);
  if (showAll) document.querySelectorAll(".rec-card")[TOP_N]?.scrollIntoView({ block: "start", behavior: "smooth" });
}

// ---------- 동작 ----------

function toggle(id) {
  openId = openId === id ? null : id; // 다른 카드를 펼치면 앞 카드는 접혀요
  renderCards(currentNeed);
  if (openId) document.querySelector(`[data-id="${openId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function noticeText(r) {
  return [
    `[${meetingName()} 안내]`,
    meetingWhen() && `일시: ${meetingWhen()}`,
    `장소: ${r.name} (${foodName(r)})`,
    `인원: ${people.length}명 · 1인 ${price(r.price_per_person)}`,
    "못 먹는 음식이 있으면 미리 알려 주세요.",
  ].filter(Boolean).join("\n");
}

async function copyNotice(r) {
  const text = noticeText(r);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 클립보드 권한이 없는 환경(http 등)에서는 예전 방식으로 복사해요
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    if (!done) {
      toast("복사하지 못했어요. 다시 눌러 주세요");
      return;
    }
  }
  toast("공지 문구를 복사했어요");
}

function confirmRestaurant(r) {
  meeting.confirmed = { restaurant_id: r.id, name: r.name, confirmedAt: new Date().toISOString() };
  save(KEYS.meeting, { ...load(KEYS.meeting), confirmed: meeting.confirmed });
  renderCards(currentNeed);
  if (PAGES.people) {
    goTo("people");
  } else {
    toast(`${josa(r.name, "으로", "로")} 확정했어요. 사람·기록 화면은 준비 중이에요`);
  }
}

function onListClick(event) {
  const card = event.target.closest(".rec-card");
  if (!card) return;
  const item = ranked.find((x) => x.r.id === card.dataset.id);
  if (event.target.closest(".rec-toggle")) toggle(item.r.id);
  else if (event.target.closest('[data-action="copy"]')) copyNotice(item.r);
  else if (event.target.closest('[data-action="confirm"]')) confirmRestaurant(item.r);
}

// ---------- 시작 ----------

let currentNeed;

async function init() {
  let restaurants;
  try {
    [restaurants, reviews] = await Promise.all([loadData("restaurants"), loadData("reviews"), loadPeople()]);
  } catch {
    toast("추천을 불러오지 못했어요. 새로고침해 주세요");
    return;
  }
  reviews = Array.isArray(reviews) ? reviews : [];

  currentNeed = groupNeeds();
  ranked = restaurants
    .filter((r) => passes(r, currentNeed))
    .map((r) => scoreOf(r, currentNeed))
    .sort((a, b) => b.score - a.score || a.r.price_per_person - b.r.price_per_person);

  document.getElementById("result-body").setAttribute("aria-busy", "false");
  if (!ranked.length) {
    document.getElementById("no-result").hidden = false;
    return;
  }

  // 확정한 식당이 있으면 그 카드를, 없으면 1순위를 펼쳐 둬요
  const confirmedIndex = ranked.findIndex((x) => x.r.id === meeting.confirmed?.restaurant_id);
  showAll = confirmedIndex >= TOP_N;
  openId = ranked[Math.max(confirmedIndex, 0)].r.id;

  renderSummary(currentNeed);
  renderCards(currentNeed);
  document.getElementById("count-box").hidden = false;
  document.getElementById("recheck").hidden = false;

  document.getElementById("rec-list").addEventListener("click", onListClick);
  document.getElementById("more").addEventListener("click", toggleMore);
}

setupTabBar();
if (!profile) {
  location.replace(PAGES.start); // 내 프로필이 없으면 ① 시작하기부터
} else if (!meeting?.people) {
  document.getElementById("no-meeting").hidden = false; // 모임이 없으면 ②로 안내
  document.getElementById("edit-link").hidden = true;
  document.getElementById("result-body").setAttribute("aria-busy", "false");
} else {
  init();
}
