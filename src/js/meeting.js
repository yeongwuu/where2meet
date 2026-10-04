// ② 모임 만들기: 같이 갈 사람 고르기 + 모임 정보
import { RANK, RANK_ROLE, PURPOSE, DAY, TIME_SLOTS, PLACE, WALK, RELATIONS, ALLERGY, DIET, BUDGET_MAX, BUDGET_PRESETS } from "./labels.js";
import { KEYS, PAGES, load, save, loadData, goTo, toast, icon, setupTabBar } from "./common.js";

const profile = load(KEYS.profile);
const SELF_ID = profile?.id ?? "me";

// 처음 들어왔을 때 모임 정보 (소속 팀은 내 프로필의 팀, 목적 팀 회식)
const DEFAULT_INFO = {
  team: "",
  purpose: "purpose_team",
  budget: [0, 40000],
  day: "day_today",
  date: "",
  time: "18:30",
  place: "place_office",
  walk: "walk_10",
};

const CHIP_GROUPS = { purpose: PURPOSE, day: DAY, place: PLACE, walk: WALK };

const form = document.getElementById("meeting-form");
const teamsEl = document.getElementById("teams");
const guestsEl = document.getElementById("guests");
const searchInput = document.getElementById("people-search");
const guestSearch = document.getElementById("guest-search");
const GUEST_LIMIT = 30; // 검색 결과가 너무 많으면 이만큼만 보여 줘요
const teamPicker = document.getElementById("team-picker");
const teamOptions = document.getElementById("team-options");
const timePicker = document.getElementById("time-picker");
const timeOptions = document.getElementById("time-options");
const addGuestBtn = document.getElementById("add-guest");
const guestForm = document.getElementById("guest-form");

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
  members = [self, ...allMembers.filter((m) => m.id !== SELF_ID)];
  // 내가 추가한 비회원은 이 브라우저에만 저장돼요
  guests = [...(load(KEYS.guests) ?? []), ...allGuests];
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

function self() {
  return members[0];
}

// 팀 목록은 members.json에 나오는 순서. 내 팀은 맨 위에
function teamNames() {
  const all = [...new Set(members.slice(1).map((m) => m.team))];
  return info.team ? [info.team, ...all.filter((t) => t !== info.team)] : all;
}

// 소속 팀 고르기: 펼치면 본부별 팀 칩이 나와요 ("Assurance 3팀" → 본부 "Assurance" 아래 "3팀")
function renderTeamPicker() {
  const byDivision = {};
  [...new Set(members.slice(1).map((m) => m.team))].forEach((team) => {
    (byDivision[team.split(" ")[0]] ??= []).push(team);
  });
  teamOptions.innerHTML = Object.entries(byDivision)
    .map(
      ([division, teams]) => `
        <p class="division" id="division-${division}">${division}</p>
        <div class="chips chips-sm" role="group" aria-labelledby="division-${division}">
          ${teams
            .map((t) => `<button type="button" class="chip" data-team-option="${t}" aria-pressed="false" aria-label="${t}">${t.slice(division.length + 1)}</button>`)
            .join("")}
        </div>`,
    )
    .join("");
}

function syncTeamPicker() {
  document.getElementById("team-current").textContent = info.team || "팀을 골라 주세요";
  teamPicker.classList.toggle("is-empty", !info.team);
  teamOptions.querySelectorAll("[data-team-option]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.teamOption === info.team));
  });
}

// 펼침 패널 공통: 버튼의 aria-expanded와 패널 hidden을 함께 바꿔요
function setPanel(button, panel, open) {
  button.setAttribute("aria-expanded", String(open));
  panel.hidden = !open;
}

function openTeamPicker(open) {
  setPanel(teamPicker, teamOptions, open);
}

// 소속 팀 바꾸기: 나를 그 팀에 넣고, 그 팀 사람을 모두 고른 상태로 (비회원 선택은 그대로)
function setTeam(team) {
  info.team = team;
  self().team = team || null;
  syncTeamPicker();
  members.slice(1).forEach((m) => selected.delete(m.id));
  members.filter((m) => team && m.team === team).forEach((m) => selected.add(m.id));
  selected.add(SELF_ID);
  save(KEYS.profile, { ...load(KEYS.profile), team: team || undefined });
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
    <li class="person" data-id="${guest.id}">
      <label>
        <input type="checkbox" class="checkbox" data-person="${guest.id}" ${selected.has(guest.id) ? "checked" : ""}>
        <span class="person-name">${guest.title}</span>
        <span class="badge badge-soft">${guest.relation}</span>
      </label>
      <button type="button" class="person-memo" data-memo="${guest.id}">내 메모</button>
    </li>`;
}

function teamBlock(team, i) {
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
}

let othersOpen = false;

function renderPeople() {
  const teams = teamNames();
  if (info.team) {
    // 내 팀은 바로 보이고, 다른 팀은 한 번에 접어 둬요
    const others = teams.slice(1);
    teamsEl.innerHTML = `
      ${teamBlock(teams[0], 0)}
      <div class="others-head">
        <h3 class="other-teams">다른 팀 ${others.length}개</h3>
        <button type="button" class="btn-toggle" id="others-toggle" aria-expanded="${othersOpen}" aria-controls="other-teams">
          ${othersOpen ? "접기" : "펼치기"}${icon("chevron-down")}
        </button>
      </div>
      <div id="other-teams" ${othersOpen ? "" : "hidden"}>
        ${others.map((team, i) => teamBlock(team, i + 1)).join("")}
      </div>`;
  } else {
    teamsEl.innerHTML = teams.map(teamBlock).join("");
  }

  renderGuests();
  syncTeamChecks();
  applySearch();
}

function setToggle(button, open) {
  button.setAttribute("aria-expanded", String(open));
  button.firstChild.textContent = open ? "접기" : "펼치기";
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
    setToggle(toggle, open);
    anyVisible ||= teamVisible;
  });

  const othersEl = document.getElementById("other-teams");
  if (othersEl) {
    const open = Boolean(q) || othersOpen;
    othersEl.hidden = !open;
    setToggle(document.getElementById("others-toggle"), open);
    document.querySelector(".others-head").hidden = Boolean(q) && !othersEl.querySelector(".team:not([hidden])");
  }

  document.getElementById("search-empty").hidden = anyVisible;
}

// 비회원: 평소에는 고른 사람만, 검색하면 결과를 보여 줘요
function renderGuests() {
  const q = guestSearch.value.trim().toLowerCase();
  const hint = document.getElementById("guest-hint");
  const matches = (g) => `${g.title} ${g.org} ${g.group} ${g.relation}`.toLowerCase().includes(q);
  const picked = guests.filter((g) => selected.has(g.id));
  const found = q ? guests.filter(matches) : [];
  // 고른 사람을 위에, 검색 결과를 그 아래에
  const list = q ? [...found.filter((g) => selected.has(g.id)), ...found.filter((g) => !selected.has(g.id))] : picked;

  guestsEl.innerHTML = list.slice(0, GUEST_LIMIT).map(guestRow).join("");

  if (q && found.length === 0) hint.textContent = "찾는 비회원이 없어요";
  else if (list.length > GUEST_LIMIT) hint.textContent = `${list.length}명 중 ${GUEST_LIMIT}명만 보여요. 더 자세히 검색해 주세요`;
  else if (!q && picked.length === 0) hint.textContent = "같이 갈 비회원을 호칭·회사·부서로 찾아서 더해요";
  else hint.textContent = "";
  hint.hidden = !hint.textContent;
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
  const othersToggle = event.target.closest("#others-toggle");
  if (othersToggle) {
    othersOpen = !othersOpen;
    setToggle(othersToggle, othersOpen);
    document.getElementById("other-teams").hidden = !othersOpen;
    return;
  }
  const toggle = event.target.closest("[data-toggle]");
  if (toggle) {
    const team = toggle.dataset.toggle;
    expandedTeams.has(team) ? expandedTeams.delete(team) : expandedTeams.add(team);
    const open = expandedTeams.has(team);
    setToggle(toggle, open);
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
  syncTimePicker();
}

// ---------- 시간 ----------

function renderTimeOptions() {
  timeOptions.innerHTML = Object.entries(TIME_SLOTS)
    .map(
      ([slot, times]) => `
        <p class="division" id="slot-${slot}">${slot}</p>
        <div class="chips chips-sm" role="group" aria-labelledby="slot-${slot}">
          ${times.map((t) => `<button type="button" class="chip" data-time="${t}" aria-pressed="false">${t}</button>`).join("")}
        </div>`,
    )
    .join("");
}

function syncTimePicker() {
  document.getElementById("time-current").textContent = info.time || "시간 선택";
  timePicker.classList.toggle("is-selected", Boolean(info.time));
  timePicker.setAttribute("aria-label", info.time ? `시간 ${info.time}, 바꾸기` : "시간 선택");
  timeOptions.querySelectorAll("[data-time]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.time === info.time));
  });
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

// ---------- 비회원 추가 ----------

const guestTitle = document.getElementById("guest-title");
const guestOrg = document.getElementById("guest-org");
const AVOID = { ...ALLERGY, ...DIET };
let guestRelation = "거래처";
const guestAvoid = new Set();

function renderGuestFormChips() {
  document.getElementById("guest-relation").innerHTML = RELATIONS.map(
    (r) => `<button type="button" class="chip" data-relation="${r}" aria-pressed="false">${r}</button>`,
  ).join("");
  document.getElementById("guest-avoid").innerHTML = Object.entries(AVOID)
    .map(([code, label]) => `<button type="button" class="chip" data-avoid="${code}" aria-pressed="false">${label}</button>`)
    .join("");
}

function syncGuestForm() {
  guestForm.querySelectorAll("[data-relation]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.relation === guestRelation)));
  guestForm.querySelectorAll("[data-avoid]").forEach((c) => c.setAttribute("aria-pressed", String(guestAvoid.has(c.dataset.avoid))));
}

function openGuestForm(open) {
  setPanel(addGuestBtn, guestForm, open);
  if (open) {
    guestTitle.value = guestSearch.value.trim(); // 검색하다 없어서 추가하는 경우 그대로 이어 쓰기
    guestOrg.value = "";
    guestRelation = "거래처";
    guestAvoid.clear();
    clearGuestError();
    syncGuestForm();
    guestTitle.focus();
  } else {
    addGuestBtn.focus();
  }
}

function clearGuestError() {
  document.getElementById("guest-title-error").textContent = "";
  guestTitle.removeAttribute("aria-invalid");
}

function saveGuest() {
  const title = guestTitle.value.trim();
  const errorEl = document.getElementById("guest-title-error");
  if (!title) {
    errorEl.textContent = "호칭을 입력해 주세요";
    guestTitle.setAttribute("aria-invalid", "true");
    guestTitle.focus();
    return;
  }
  const same = guests.find((g) => g.title === title);
  if (same) {
    errorEl.textContent = "이미 있는 비회원이에요. 아래 목록에서 골라 줬어요";
    selected.add(same.id);
    guestSearch.value = "";
    renderGuests();
    onChange();
    return;
  }

  const guest = {
    id: `gm${Date.now()}`,
    title,
    org: guestOrg.value.trim(),
    group: guestRelation === "거래처" ? "고객사" : "사내",
    relation: guestRelation,
    allergies: [...guestAvoid].filter((c) => c.startsWith("allergy_")),
    diet: [...guestAvoid].filter((c) => c.startsWith("diet_")),
    likes: [],
    dislikes: [],
    needs: [],
    memo: "",
    history: [],
    mine: true,
  };
  save(KEYS.guests, [guest, ...(load(KEYS.guests) ?? [])]);
  guests.unshift(guest);
  selected.add(guest.id);
  guestSearch.value = "";
  openGuestForm(false);
  renderGuests();
  onChange();
  toast(`비회원을 추가하고 골랐어요 · ${title}`);
}

function onGuestFormClick(event) {
  const relation = event.target.closest("[data-relation]");
  const avoid = event.target.closest("[data-avoid]");
  if (relation) guestRelation = relation.dataset.relation;
  if (avoid) guestAvoid.has(avoid.dataset.avoid) ? guestAvoid.delete(avoid.dataset.avoid) : guestAvoid.add(avoid.dataset.avoid);
  if (relation || avoid) syncGuestForm();
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

// 화면을 다시 그리고, 사용자가 바꾼 경우에만 "작성 중"으로 저장해요
function onChange({ persist = true } = {}) {
  syncChips();
  syncBudget();
  renderSummary();
  if (persist) save(KEYS.meeting, currentMeeting());
}

function applyMeeting(meeting) {
  setTeam(meeting.team ?? "");
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

  // 기본: 내 프로필의 팀 전체를 고른 상태. 팀을 모르면 직접 고르게 비워 둬요
  renderTeamPicker();
  setTeam(profile.team ?? "");
  renderPeople();
  onChange({ persist: false });
  setupResume(draft);

  teamsEl.addEventListener("change", onPeopleChange);
  guestsEl.addEventListener("change", onPeopleChange);
  teamsEl.addEventListener("click", onPeopleClick);
  guestsEl.addEventListener("click", onPeopleClick);
  searchInput.addEventListener("input", applySearch);
  guestSearch.addEventListener("input", renderGuests);
  teamPicker.addEventListener("click", () => openTeamPicker(teamOptions.hidden));
  teamOptions.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-team-option]");
    if (!chip) return;
    setTeam(chip.dataset.teamOption);
    openTeamPicker(false);
    teamPicker.focus();
    renderPeople();
    onChange();
  });
  // 바깥을 누르거나 Esc를 누르면 접어요
  document.addEventListener("click", (event) => {
    if (!teamOptions.hidden && !event.target.closest(".team-field")) openTeamPicker(false);
  });
  teamOptions.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      openTeamPicker(false);
      teamPicker.focus();
    }
  });
  // 시간
  renderTimeOptions();
  syncTimePicker();
  timePicker.addEventListener("click", () => setPanel(timePicker, timeOptions, timeOptions.hidden));
  timeOptions.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-time]");
    if (!chip) return;
    info.time = chip.dataset.time;
    setPanel(timePicker, timeOptions, false);
    timePicker.focus();
    onChange();
  });

  // 비회원 추가
  renderGuestFormChips();
  addGuestBtn.addEventListener("click", () => openGuestForm(guestForm.hidden));
  guestForm.addEventListener("click", onGuestFormClick);
  document.getElementById("guest-cancel").addEventListener("click", () => openGuestForm(false));
  document.getElementById("guest-save").addEventListener("click", saveGuest);
  guestTitle.addEventListener("input", clearGuestError);
  guestForm.addEventListener("keydown", (event) => {
    // 입력칸에서 Enter를 눌러도 모임 전체가 제출되지 않게
    if (event.key === "Enter" && event.target.tagName === "INPUT") {
      event.preventDefault();
      saveGuest();
    }
    if (event.key === "Escape") openGuestForm(false);
  });

  // 시간 패널도 바깥을 누르거나 Esc로 접어요
  document.addEventListener("click", (event) => {
    if (!timeOptions.hidden && !event.target.closest("#time-picker, #time-options")) setPanel(timePicker, timeOptions, false);
  });
  timeOptions.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setPanel(timePicker, timeOptions, false);
      timePicker.focus();
    }
  });

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
