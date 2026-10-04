// ② 모임 만들기: 같이 갈 사람 고르기 + 모임 정보
import { RANK, RANK_ROLE, PURPOSE, DAY, MEAL, PLACE, WALK, BUDGET_MAX, BUDGET_PRESETS } from "./labels.js";
import { KEYS, PAGES, load, save, loadData, goTo, toast, icon, setupTabBar } from "./common.js";

const profile = load(KEYS.profile);
const SELF_ID = profile?.id ?? "me";

// 처음 들어왔을 때 모임 정보 (데모 흐름: 팀 전체 체크, 목적 팀 회식)
const DEFAULT_INFO = {
  purpose: "purpose_team",
  budget: [0, 40000],
  day: "day_today",
  date: "",
  meal: "meal_dinner",
  place: "place_office",
  walk: "walk_10",
};

const CHIP_GROUPS = { purpose: PURPOSE, day: DAY, meal: MEAL, place: PLACE, walk: WALK };

const form = document.getElementById("meeting-form");
const teamsEl = document.getElementById("teams");
const guestsEl = document.getElementById("guests");
const searchInput = document.getElementById("people-search");

let members = []; // 나를 포함한 회원
let guests = [];
const selected = new Set(); // 고른 사람 id (회원·비회원)
const info = { ...DEFAULT_INFO };
const expandedTeams = new Set();

// ---------- 데이터 ----------

async function loadPeople() {
  const [allMembers, allGuests] = await Promise.all([loadData("members"), loadData("guests")]);

  // 나: 체험 계정이면 members.json의 내 행을, 직접 가입했으면 내 프로필을 팀 맨 위에
  const self = { ...(allMembers.find((m) => m.id === SELF_ID) ?? {}), ...profile, id: SELF_ID, is_member: true };
  self.team ??= allMembers[0]?.team ?? "우리 팀";
  members = [self, ...allMembers.filter((m) => m.id !== SELF_ID)];
  guests = allGuests;
}

function isSelf(person) {
  return person.id === SELF_ID;
}

// 상사·임원 배지. 회원은 직급으로, 비회원은 관계로 정해요. 나는 빼요.
function roleOf(person) {
  if (isSelf(person)) return null;
  return person.relation ?? RANK_ROLE[person.rank] ?? null;
}

function countPeople(list) {
  return {
    total: list.length,
    known: list.filter((p) => p.is_member).length,
    unknown: list.filter((p) => p.is_member === false).length,
    exec: list.filter((p) => roleOf(p) === "임원").length,
    boss: list.filter((p) => roleOf(p) === "상사").length,
  };
}

function selectedPeople() {
  return [...members, ...guests].filter((p) => selected.has(p.id));
}

// ---------- 같이 갈 사람 ----------

function teamNames() {
  return [...new Set(members.map((m) => m.team))];
}

function personRow(person) {
  const role = roleOf(person);
  const status = person.is_member
    ? `<span class="badge badge-check">${icon("check")}취향 입력 완료</span>`
    : `<span class="badge badge-caution">${icon("triangle-alert")}미입력</span>`;
  const self = isSelf(person);

  return `
    <li class="person" data-id="${person.id}" data-search="${person.nickname} ${person.team} ${RANK[person.rank] ?? ""}">
      <label>
        <input type="checkbox" class="checkbox" data-person="${person.id}" ${selected.has(person.id) ? "checked" : ""} ${self ? "disabled" : ""}>
        <span class="person-name">${person.nickname}${self ? " (나)" : ""}</span>
        <span class="person-rank">${RANK[person.rank] ?? ""}</span>
        ${role ? `<span class="badge badge-soft">${role}</span>` : ""}
        <span class="person-side">${status}</span>
      </label>
    </li>`;
}

function guestRow(guest) {
  return `
    <li class="person" data-id="${guest.id}" data-search="${guest.title} ${guest.relation}">
      <label>
        <input type="checkbox" class="checkbox" data-person="${guest.id}" ${selected.has(guest.id) ? "checked" : ""}>
        <span class="person-name">${guest.title}</span>
        <span class="badge badge-soft">${guest.relation}</span>
      </label>
      <button type="button" class="person-memo" data-memo="${guest.id}">내 메모</button>
    </li>`;
}

function renderPeople() {
  teamsEl.innerHTML = teamNames()
    .map((team, i) => {
      const list = members.filter((m) => m.team === team);
      const c = countPeople(list);
      const open = expandedTeams.has(team);
      const stats = [
        `취향 입력 ${c.known}`,
        c.unknown ? `<span class="is-caution">미입력 ${c.unknown}</span>` : "",
        c.exec ? `임원 ${c.exec}` : "",
        c.boss ? `상사 ${c.boss}` : "",
      ].filter(Boolean);

      return `
        <div class="team" data-team="${team}">
          <div class="team-head">
            <label class="team-check">
              <input type="checkbox" class="checkbox" data-team-check="${team}">
              <span>
                <span class="team-name">${team} · ${c.total}명 전체</span>
                <span class="team-stats">${stats.join(" · ")}</span>
              </span>
            </label>
            <button type="button" class="btn-toggle" data-toggle="${team}" aria-expanded="${open}" aria-controls="team-list-${i}">
              ${open ? "접기" : "펼치기"}${icon("chevron-down")}
            </button>
          </div>
          <ul class="person-list" id="team-list-${i}" ${open ? "" : "hidden"}>
            ${list.map(personRow).join("")}
          </ul>
        </div>`;
    })
    .join("");

  guestsEl.innerHTML = guests.map(guestRow).join("");
  syncTeamChecks();
  applySearch();
}

// 팀 전체 체크박스: 모두 고름 / 일부만 고름(중간 상태) / 아무도 안 고름
function syncTeamChecks() {
  teamsEl.querySelectorAll("[data-team-check]").forEach((box) => {
    const list = members.filter((m) => m.team === box.dataset.teamCheck && !isSelf(m));
    const n = list.filter((m) => selected.has(m.id)).length;
    box.checked = n === list.length;
    box.indeterminate = n > 0 && n < list.length;
  });
}

function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  let anyVisible = false;

  teamsEl.querySelectorAll(".team").forEach((teamEl) => {
    const list = teamEl.querySelector(".person-list");
    const toggle = teamEl.querySelector("[data-toggle]");
    let teamVisible = false;
    teamEl.querySelectorAll(".person").forEach((row) => {
      const match = !q || row.dataset.search.toLowerCase().includes(q);
      row.hidden = !match;
      teamVisible ||= match;
    });
    teamEl.hidden = !teamVisible;
    // 검색 중에는 펼쳐서 결과를 보여 줘요
    const open = q ? true : expandedTeams.has(teamEl.dataset.team);
    list.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    anyVisible ||= teamVisible;
  });

  guestsEl.querySelectorAll(".person").forEach((row) => {
    row.hidden = Boolean(q) && !row.dataset.search.toLowerCase().includes(q);
    anyVisible ||= !row.hidden;
  });

  document.getElementById("search-empty").hidden = anyVisible;
}

function onPeopleChange(event) {
  const box = event.target;
  if (box.dataset.person) {
    box.checked ? selected.add(box.dataset.person) : selected.delete(box.dataset.person);
    syncTeamChecks();
  } else if (box.dataset.teamCheck) {
    members
      .filter((m) => m.team === box.dataset.teamCheck && !isSelf(m))
      .forEach((m) => (box.checked ? selected.add(m.id) : selected.delete(m.id)));
    teamsEl
      .querySelectorAll(`.team[data-team="${box.dataset.teamCheck}"] [data-person]:not(:disabled)`)
      .forEach((b) => (b.checked = box.checked));
  } else {
    return;
  }
  onChange();
}

function onPeopleClick(event) {
  const toggle = event.target.closest("[data-toggle]");
  if (toggle) {
    const team = toggle.dataset.toggle;
    expandedTeams.has(team) ? expandedTeams.delete(team) : expandedTeams.add(team);
    const open = expandedTeams.has(team);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.firstChild.textContent = open ? "접기" : "펼치기";
    document.getElementById(toggle.getAttribute("aria-controls")).hidden = !open;
    return;
  }
  if (event.target.closest("[data-memo]")) goTo("people");
}

// ---------- 모임 정보 ----------

function renderChips() {
  form.querySelectorAll("[data-group]").forEach((el) => {
    const name = el.dataset.group;
    el.innerHTML = Object.entries(CHIP_GROUPS[name])
      .map(([value, label]) => `<button type="button" class="chip" data-value="${value}" aria-pressed="false">${label}</button>`)
      .join("");
  });
}

function syncChips() {
  form.querySelectorAll("[data-group]").forEach((el) => {
    el.querySelectorAll(".chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(info[el.dataset.group] === chip.dataset.value));
    });
  });
  const dateInput = document.getElementById("date");
  dateInput.hidden = info.day !== "day_pick";
  dateInput.value = info.date;
  const pick = form.querySelector('[data-value="day_pick"]');
  pick.textContent = info.day === "day_pick" && info.date ? formatDate(info.date) : DAY.day_pick;
}

function formatDate(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function onInfoClick(event) {
  const chip = event.target.closest("[data-group] .chip");
  if (!chip) return;
  const name = chip.closest("[data-group]").dataset.group;
  info[name] = chip.dataset.value;
  if (name === "day" && chip.dataset.value === "day_pick") {
    syncChips();
    const dateInput = document.getElementById("date");
    dateInput.focus();
    try {
      dateInput.showPicker?.();
    } catch {
      // 달력을 바로 못 띄우는 브라우저는 입력칸만 보여 줘요
    }
  }
  onChange();
}

// 예산 슬라이더
const budgetMin = document.getElementById("budget-min");
const budgetMax = document.getElementById("budget-max");

function won(n) {
  if (n >= 10000) return `${n / 10000}만원`;
  return n === 0 ? "0원" : `${n / 1000}천원`;
}

function budgetLabel([min, max]) {
  if (min === 0 && max === BUDGET_MAX) return "상관없음";
  if (min === max) return won(min);
  if (max === BUDGET_MAX) return `${won(min)} 이상`;
  if (min === 0) return `~ ${won(max)}`;
  return `${won(min)} ~ ${won(max)}`;
}

function renderBudgetPresets() {
  document.getElementById("budget-presets").innerHTML = Object.keys(BUDGET_PRESETS)
    .map((label) => `<button type="button" class="chip" data-preset="${label}" aria-pressed="false">${label}</button>`)
    .join("");
}

function syncBudget() {
  const [min, max] = info.budget;
  budgetMin.value = min;
  budgetMax.value = max;
  budgetMin.setAttribute("aria-valuetext", won(min));
  budgetMax.setAttribute("aria-valuetext", max === BUDGET_MAX ? "10만원 이상" : won(max));
  const fill = document.getElementById("budget-fill");
  fill.style.left = `${(min / BUDGET_MAX) * 100}%`;
  fill.style.right = `${100 - (max / BUDGET_MAX) * 100}%`;
  document.getElementById("budget-value").textContent = budgetLabel(info.budget);
  document.querySelectorAll("[data-preset]").forEach((chip) => {
    const [a, b] = BUDGET_PRESETS[chip.dataset.preset];
    chip.setAttribute("aria-pressed", String(a === min && b === max));
  });
}

function onBudgetInput(event) {
  let min = Number(budgetMin.value);
  let max = Number(budgetMax.value);
  // 손잡이가 서로 넘어가지 않게
  if (min > max) {
    if (event.target === budgetMin) min = max;
    else max = min;
  }
  info.budget = [min, max];
  onChange();
}

// ---------- 요약 · 저장 ----------

function renderSummary() {
  const people = selectedPeople();
  const c = countPeople(people);
  const others = people.filter((p) => !isSelf(p)).length;
  const parts = [`<strong>총 ${c.total}명</strong>`];
  if (c.exec) parts.push(`임원 ${c.exec}`);
  if (c.boss) parts.push(`상사 ${c.boss}`);
  if (c.unknown) parts.push(`<span class="is-caution">취향 모름 ${c.unknown}</span>`);

  document.getElementById("summary").innerHTML = others
    ? parts.join(" · ")
    : `<span class="is-caution">같이 갈 사람을 골라 주세요</span>`;
  document.getElementById("submit").disabled = others === 0;
}

function currentMeeting() {
  return {
    people: [...selected],
    ...info,
    budget: [...info.budget],
    updatedAt: new Date().toISOString(),
  };
}

function onChange() {
  syncChips();
  syncBudget();
  renderSummary();
  save(KEYS.meeting, currentMeeting());
}

function applyMeeting(meeting) {
  selected.clear();
  selected.add(SELF_ID);
  meeting.people.forEach((id) => selected.add(id));
  Object.keys(DEFAULT_INFO).forEach((key) => {
    if (meeting[key] !== undefined) info[key] = meeting[key];
  });
  renderPeople();
  onChange();
}

function sameMeeting(a, b) {
  const strip = ({ updatedAt, ...rest }) => ({ ...rest, people: [...rest.people].sort() });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function setupResume(draft) {
  // 작성 중인 모임이 없거나, 처음 상태와 같으면 보여 주지 않아요
  if (!draft?.people?.length || sameMeeting(draft, currentMeeting())) return;
  const row = document.getElementById("resume");
  const n = new Set([SELF_ID, ...draft.people]).size;
  document.getElementById("resume-label").textContent = `${PURPOSE[draft.purpose] ?? "모임"} ${n}명 (작성 중)`;
  row.hidden = false;
  row.addEventListener("click", () => {
    applyMeeting(draft);
    row.hidden = true;
    toast("작성하던 모임을 불러왔어요");
  });
}

// ---------- 시작 ----------

async function init() {
  document.getElementById("greeting").textContent = `${profile.nickname} 님, 안녕하세요`;
  setupTabBar();
  renderChips();
  renderBudgetPresets();

  try {
    await loadPeople();
  } catch {
    toast("사람 목록을 불러오지 못했어요. 새로고침해 주세요");
    return;
  }

  const draft = load(KEYS.meeting);

  // 기본: 나와 팀 전체를 고른 상태
  selected.add(SELF_ID);
  members.forEach((m) => selected.add(m.id));
  renderPeople();
  onChange();
  setupResume(draft);

  teamsEl.addEventListener("change", onPeopleChange);
  guestsEl.addEventListener("change", onPeopleChange);
  teamsEl.addEventListener("click", onPeopleClick);
  guestsEl.addEventListener("click", onPeopleClick);
  searchInput.addEventListener("input", applySearch);
  document.getElementById("add-guest").addEventListener("click", () => goTo("people"));

  form.addEventListener("click", onInfoClick);
  budgetMin.addEventListener("input", onBudgetInput);
  budgetMax.addEventListener("input", onBudgetInput);
  document.getElementById("budget-presets").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-preset]");
    if (!chip) return;
    info.budget = [...BUDGET_PRESETS[chip.dataset.preset]];
    onChange();
  });
  document.getElementById("date").addEventListener("change", (event) => {
    info.date = event.target.value;
    onChange();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    save(KEYS.meeting, currentMeeting());
    goTo("summary");
  });
}

if (profile) {
  init();
} else {
  // 내 프로필이 없으면 ① 시작하기부터
  location.replace(PAGES.start);
}
