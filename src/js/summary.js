// ③ 취향 종합: ②에서 저장한 모임(w2m.meeting)의 사람들 취향을 모아 보여 줘요. 계산은 docs/data_spec.md 4-1 기준
import { FOOD, ALLERGY, DIET, RANK_ROLE, PURPOSE, DAY, PLACE } from "./labels.js";
import { KEYS, PAGES, load, save, loadData, goTo, toast, budgetLabel } from "./common.js";

const profile = load(KEYS.profile);
const meeting = load(KEYS.meeting);
const SELF_ID = profile?.id ?? "me";

// 스위치로 끌 수 있는 항목 (반드시 피할 것은 끌 수 없어요). ④에서 꺼진 항목은 점수에서 빼요
const DEFAULT_APPLY = { character: true, food: true, drink: true };
const FOOD_LIMIT = 6; // 좋아하는 음식 막대는 많은 순으로 이만큼만

// 비율 막대: 왼쪽부터 primary-soft → primary-mid → primary 순서
const DRINK_PARTS = [
  ["drink_none", "안 마심"],
  ["drink_light", "가볍게"],
  ["drink_enjoy", "즐김"],
];
const MOOD_PARTS = [
  ["mood_quiet", "조용한 곳"],
  ["mood_any", "상관없음"],
  ["mood_lively", "활기찬 곳"],
];
// 가장 많은 술 성향 → 결론 한 줄 (식당 이름: 식사 중심 / 반주 가능 / 술자리 중심)
const DRINK_CONCLUSION = {
  drink_none: "술 없이 식사 중심",
  drink_light: "반주 정도의 식사 중심",
  drink_enjoy: "술자리 중심",
};
// 가장 많은 분위기 → 결론 앞부분 ("조용한 곳에서 …"). 상관없어요는 붙이지 않아요
const MOOD_CONCLUSION = {
  mood_quiet: "조용한 곳",
  mood_lively: "활기찬 곳",
};

let people = [];
let wholeTeam = false; // 소속 팀 사람을 모두 골랐는지 ("3팀 전원")
const apply = { ...DEFAULT_APPLY, ...meeting?.apply };

// ---------- 데이터 ----------

async function loadPeople() {
  const [members, guests] = await Promise.all([loadData("members"), loadData("guests")]);
  // 나: 체험 계정이면 members.json의 내 행에 프로필을 덮어써요 (②와 같은 방식)
  const self = { ...(members.find((m) => m.id === SELF_ID) ?? {}), ...profile, id: SELF_ID, is_member: true };
  const all = [self, ...members.filter((m) => m.id !== SELF_ID), ...(load(KEYS.guests) ?? []), ...guests];
  const ids = new Set([SELF_ID, ...meeting.people]);
  const teammates = members.filter((m) => meeting.team && m.team === meeting.team && m.id !== SELF_ID);
  wholeTeam = teammates.length > 0 && teammates.every((m) => ids.has(m.id));
  people = all.filter((p) => ids.has(p.id) && ids.delete(p.id)); // 같은 id는 한 번만
}

function roleOf(person) {
  if (person.id === SELF_ID) return null;
  return person.relation ?? RANK_ROLE[person.rank] ?? null;
}

// 취향 집계는 취향을 입력한 회원만. 비회원은 못 먹는 것만 반영해요
const known = () => people.filter((p) => p.is_member === true);
const unknown = () => people.filter((p) => p.is_member === false);

function countBy(list, pick) {
  const counts = {};
  list.forEach((p) => [pick(p)].flat().filter(Boolean).forEach((code) => (counts[code] = (counts[code] ?? 0) + 1)));
  return counts;
}

// ---------- 헤더 · 통계 ----------

// 예: "3팀 전원 회식 · 오늘 저녁 · 회사 10분 · 1인 ~ 4만원"
function meetingLine() {
  const purpose = PURPOSE[meeting.purpose] ?? "모임";
  // "Assurance 3팀" → "3팀 전원 회식"
  const teamShort = meeting.team?.split(" ").slice(1).join(" ");
  const who = wholeTeam ? `${teamShort} 전원 ${purpose.replace("팀 회식", "회식")}` : purpose;

  const day = meeting.day === "day_pick" && meeting.date ? formatDate(meeting.date) : DAY[meeting.day] ?? "";
  const slot = meeting.time ? (Number(meeting.time.slice(0, 2)) < 15 ? "점심" : "저녁") : "";
  const walk = meeting.walk ? `${meeting.walk.split("_")[1]}분` : "";
  return [who, [day, slot].filter(Boolean).join(" "), [PLACE[meeting.place], walk].filter(Boolean).join(" "), `1인 ${budgetLabel(meeting.budget ?? [0, 0])}`]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function renderStats() {
  const exec = people.filter((p) => roleOf(p) === "임원").length;
  const boss = people.filter((p) => roleOf(p) === "상사").length;
  document.getElementById("stat-total").textContent = `${people.length}명`;
  document.getElementById("stat-role").textContent = `${exec} · ${boss}명`;
  const unknownEl = document.getElementById("stat-unknown");
  unknownEl.textContent = `${unknown().length}명`;
  unknownEl.classList.toggle("is-caution", unknown().length > 0);
}

// ---------- 반드시 피할 것 ----------

function renderAvoid() {
  const allergies = countBy(people, (p) => p.allergies);
  const diets = countBy(people, (p) => p.diet);
  const rows = [
    ...Object.keys(ALLERGY).filter((c) => allergies[c]).map((c) => [`${ALLERGY[c]} 알레르기`, allergies[c]]),
    ...Object.keys(DIET).filter((c) => diets[c]).map((c) => [DIET[c], diets[c]]),
  ];
  document.getElementById("avoid-list").innerHTML = rows.length
    ? rows.map(([label, n]) => `<li><span>${label}</span><strong>${n}명</strong></li>`).join("")
    : `<li class="avoid-empty">알려진 못 먹는 것이 없어요</li>`;
}

// ---------- 모임 성격 ----------

function renderCharacter() {
  const n = people.length;
  const exec = people.filter((p) => roleOf(p) === "임원").length;
  const boss = people.filter((p) => roleOf(p) === "상사").length;
  const lines = [n >= 6 ? `${n}명 → <strong>룸이나 단체석</strong> 우선` : `${n}명 → <strong>일반 테이블</strong>도 괜찮아요`];
  if (exec || boss) {
    const with_ = [exec && `임원 ${exec}명`, boss && `상사 ${boss}명`].filter(Boolean).join("·");
    lines.push(`${with_} 동석 → <strong>대화하기 편한 곳</strong> 우선`);
  }
  if (meeting.purpose === "purpose_client") lines.push(`접대 자리 → <strong>조용한 룸</strong> 우선`);
  document.getElementById("character-lines").innerHTML = lines.map((l) => `<li>${l}</li>`).join("");
}

// ---------- 다 같이 좋아하는 음식 ----------

function renderFood() {
  const list = known();
  const likes = countBy(list, (p) => p.likes);
  const dislikes = countBy(list, (p) => p.dislikes);
  const foods = Object.keys(FOOD)
    .filter((c) => likes[c])
    .sort((a, b) => likes[b] - likes[a] || (dislikes[a] ?? 0) - (dislikes[b] ?? 0))
    .slice(0, FOOD_LIMIT);

  document.getElementById("food-bars").innerHTML = foods.length
    ? foods
        .map((c) => {
          const pct = Math.round((likes[c] / list.length) * 100);
          const bad = dislikes[c] ? ` · <span class="is-caution">별로 ${dislikes[c]}</span>` : "";
          return `
            <li class="food-row">
              <span class="food-name">${FOOD[c]}</span>
              <span class="bar" role="img" aria-label="${list.length}명 중 ${likes[c]}명이 좋아함"><span class="bar-fill" style="width:${pct}%"></span></span>
              <span class="food-count">좋아함 ${likes[c]}${bad}</span>
            </li>`;
        })
        .join("")
    : `<li class="empty">아직 좋아하는 음식을 입력한 사람이 없어요</li>`;

  // 별로가 많은 음식은 점수에서 빼요 (data_spec 5장: 샘플 데이터에는 아직 dislikes가 없어요)
  const disliked = Object.keys(FOOD)
    .filter((c) => dislikes[c])
    .sort((a, b) => dislikes[b] - dislikes[a])
    .map((c) => `${FOOD[c]} ${dislikes[c]}명`);
  document.getElementById("food-note").textContent =
    `취향을 입력한 ${list.length}명 기준` + (disliked.length ? ` · 별로: ${disliked.join(", ")}은 점수에서 빼요` : "");
}

// ---------- 술·분위기 ----------

function ratioBar(title, parts, counts) {
  const total = parts.reduce((sum, [code]) => sum + (counts[code] ?? 0), 0);
  const legend = parts.map(([code, label]) => `${label} ${counts[code] ?? 0}`);
  const segments = parts
    .map(([code], i) => (counts[code] ? `<span class="seg seg-${i}" style="flex-grow:${counts[code]}"></span>` : ""))
    .join("");
  return `
    <p class="ratio-title">${title}</p>
    <div class="ratio" role="img" aria-label="${title}: ${legend.join(", ")}">${total ? segments : ""}</div>
    <p class="ratio-legend" aria-hidden="true">${parts
      .map(([code, label], i) => `<span><i class="swatch seg-${i}"></i>${label} ${counts[code] ?? 0}</span>`)
      .join("")}</p>`;
}

function renderDrink() {
  const list = known();
  const drinks = countBy(list, (p) => p.drink);
  const moods = countBy(list, (p) => p.mood);
  document.getElementById("ratio-drink").innerHTML = ratioBar("술", DRINK_PARTS, drinks);
  document.getElementById("ratio-mood").innerHTML = ratioBar("분위기", MOOD_PARTS, moods);

  const drink = topDrink(drinks);
  const mood = topMood(moods);
  const place = mood === "mood_any" ? "" : `${MOOD_CONCLUSION[mood]}에서 `;
  document.getElementById("drink-conclusion").innerHTML = drink
    ? `→ <strong>${place}${DRINK_CONCLUSION[drink]}</strong> 자리를 추천할게요`
    : "술·분위기를 입력한 사람이 없어서 결론을 내지 않았어요";
}

// 가장 많은 술 성향. 같으면 술을 덜 마시는 쪽으로 (부담 덜어주기). 아무도 없으면 null
function topDrink(counts) {
  // DRINK_PARTS가 덜 마시는 순서라, 더 많을 때만 바꾸면 같을 때 앞쪽이 남아요
  return DRINK_PARTS.reduce((best, [code]) => ((counts[code] ?? 0) > (best ? counts[best] : 0) ? code : best), null);
}

// 가장 많은 분위기. 조용한 곳·활기찬 곳이 같거나 상관없어요와 같으면 상관없어요(중립)
function topMood(counts) {
  const max = Math.max(0, ...MOOD_PARTS.map(([code]) => counts[code] ?? 0));
  const tops = MOOD_PARTS.map(([code]) => code).filter((code) => max > 0 && (counts[code] ?? 0) === max);
  return tops.length === 1 ? tops[0] : "mood_any";
}

// ---------- 취향 모름 ----------

function renderUnknown() {
  const list = unknown();
  const card = document.getElementById("unknown-card");
  card.hidden = list.length === 0;
  if (!list.length) return;
  document.getElementById("sec-unknown").textContent = `취향 모름 ${list.length}명`;
  document.getElementById("unknown-desc").textContent =
    `${list.map((p) => `${p.nickname} 님`).join(", ")}은 취향을 아직 입력하지 않아서 계산에서 빠졌어요`;
  syncRequestButton();
}

function syncRequestButton() {
  const requests = load(KEYS.requests) ?? {};
  const done = unknown().every((p) => requests[p.id]);
  const button = document.getElementById("request-all");
  button.textContent = done ? "요청함" : "입력 요청 보내기";
  button.setAttribute("aria-disabled", String(done));
}

function requestAll() {
  const requests = load(KEYS.requests) ?? {};
  const targets = unknown().filter((p) => !requests[p.id]);
  if (!targets.length) {
    toast("이미 부탁했어요. 입력하면 바로 반영돼요");
    return;
  }
  const now = new Date().toISOString();
  targets.forEach((p) => (requests[p.id] = now));
  save(KEYS.requests, requests);
  syncRequestButton();
  toast(`${targets.length}명에게 취향 입력을 부탁했어요`);
}

// ---------- 스위치 ----------

function syncSwitches() {
  document.querySelectorAll("[data-apply]").forEach((sw) => {
    const on = apply[sw.dataset.apply];
    sw.setAttribute("aria-checked", String(on));
    sw.closest(".card").classList.toggle("is-off", !on);
  });
}

function onSwitch(event) {
  const sw = event.target.closest("[data-apply]");
  if (!sw) return;
  apply[sw.dataset.apply] = !apply[sw.dataset.apply];
  save(KEYS.meeting, { ...load(KEYS.meeting), apply: { ...apply } });
  syncSwitches();
}

// ---------- 시작 ----------

async function init() {
  try {
    await loadPeople();
  } catch {
    toast("모임 정보를 불러오지 못했어요. 새로고침해 주세요");
    return;
  }

  document.getElementById("meeting-sub").textContent = meetingLine();
  renderStats();
  renderAvoid();
  renderCharacter();
  renderFood();
  renderDrink();
  renderUnknown();
  syncSwitches();
  document.getElementById("summary-body").setAttribute("aria-busy", "false");

  document.getElementById("summary-body").addEventListener("click", onSwitch);
  document.getElementById("request-all").addEventListener("click", requestAll);
  document.getElementById("recommend").addEventListener("click", () => goTo("result"));
}

if (!profile) {
  location.replace(PAGES.start); // 내 프로필이 없으면 ① 시작하기부터
} else if (!meeting?.people) {
  location.replace(PAGES.meeting); // 모임을 아직 안 만들었으면 ②로
} else {
  init();
}
