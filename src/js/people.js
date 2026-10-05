// ⑤ 사람·기록: ④에서 확정한 모임의 후기를 올리고, 비회원 메모를 보고 고쳐요. 데이터는 docs/data_spec.md 3-3·3-4·3-7 기준
import { FOOD, ALLERGY, DIET, RANK_ROLE, PURPOSE, RELATIONS } from "./labels.js";
import { KEYS, PAGES, load, save, loadData, toast, icon, setupTabBar } from "./common.js";

const profile = load(KEYS.profile);
const meeting = load(KEYS.meeting);
const SELF_ID = profile?.id ?? "me";

// 칩 후기: 고르기만 하면 되는 짧은 문장
const REVIEW_CHIPS = [
  "룸이 넓어요",
  "조용해서 대화하기 좋아요",
  "상사분들이 좋아하셨어요",
  "가성비 좋아요",
  "메뉴 고민이 없어요",
  "알레르기·식단 요청을 잘 들어줘요",
  "주차가 편해요",
  "단체석이 넉넉해요",
  "자리가 빠듯해요",
  "시끄러워요",
];
const NEEDS = ["룸", "주차", "입식 자리"];
const AVOID = { ...ALLERGY, ...DIET };
const RATING_MAX = 5;

let members = [];
let restaurants = [];
let guests = []; // 파일 비회원 + 내가 추가한 비회원에 고친 메모까지 합친 것
let editingId = null; // 지금 고치는 메모 카드 (한 번에 하나)
const fresh = new Map(); // 방금 올린 후기에서 추가된 기록 { 비회원 id: 내용 }
let flash = false; // 후기를 올린 직후 한 번만 하이라이트를 반짝여요
const openHistory = new Set(); // 이전 기록을 펼친 카드
const draft = { rating: 0, chips: new Set() };

// ---------- 도구 ----------

// 직접 입력한 글을 innerHTML에 넣을 때 써요
function esc(text = "") {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function ymd(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dotDate = (s) => s.replaceAll("-", "."); // 2026-09-10 → 2026.09.10

// ---------- 데이터 ----------

function mergeGuests(fileGuests) {
  const memos = load(KEYS.guestMemos) ?? {};
  return [...(load(KEYS.guests) ?? []), ...fileGuests].map((g) => ({ ...g, ...memos[g.id] }));
}

const guestById = (id) => guests.find((g) => g.id === id);

// 고친 필드만 w2m.guestMemos에 덮어써요 (파일은 그대로)
function saveMemo(id, fields) {
  const memos = load(KEYS.guestMemos) ?? {};
  memos[id] = { ...memos[id], ...fields };
  save(KEYS.guestMemos, memos);
  Object.assign(guestById(id), fields);
}

const myReviews = () => load(KEYS.reviews) ?? [];

// 이번에 확정한 모임에 대해 올린 후기
const postedReview = () =>
  meeting?.confirmed && myReviews().find((v) => v.confirmed_at === meeting.confirmed.confirmedAt);

// 모임에 같이 간 비회원 (나 빼고)
const meetingGuests = () => (meeting?.people ?? []).map(guestById).filter(Boolean);

function roleOf(id) {
  if (id === SELF_ID) return null;
  const member = members.find((m) => m.id === id);
  return member ? RANK_ROLE[member.rank] ?? null : guestById(id)?.relation ?? null;
}

// ④ result.js의 모임 이름과 같은 방식: "3팀 전원 회식" / "팀 회식"
function meetingName() {
  const purpose = PURPOSE[meeting.purpose] ?? "모임";
  const ids = new Set(meeting.people);
  const teammates = members.filter((m) => meeting.team && m.team === meeting.team && m.id !== SELF_ID);
  const wholeTeam = teammates.length > 0 && teammates.every((m) => ids.has(m.id));
  const teamShort = meeting.team?.split(" ").slice(1).join(" ");
  return wholeTeam ? `${teamShort} 전원 ${purpose.replace("팀 회식", "회식")}` : purpose;
}

// 모임 날짜: 날짜를 골랐으면 그날, 오늘·내일은 확정한 날 기준
function meetingDate() {
  if (meeting.day === "day_pick" && meeting.date) return new Date(`${meeting.date}T00:00`);
  const date = new Date(meeting.confirmed.confirmedAt);
  if (meeting.day === "day_tomorrow") date.setDate(date.getDate() + 1);
  return date;
}

// reviews.json의 with 값: 임원 > 거래처 > 상사 순으로 하나만
function withLabel() {
  const roles = new Set(meeting.people.map(roleOf));
  const role = ["임원", "거래처", "상사"].find((r) => roles.has(r));
  return role ? `${role} 동석` : "";
}

// ---------- 지난 모임 후기 ----------

const reviewSlot = document.getElementById("review-slot");

function renderReview() {
  if (!meeting?.confirmed) {
    reviewSlot.innerHTML = `
      <div class="empty-state">
        <p>후기를 남길 모임이 없어요.<br>추천 결과에서 식당을 확정하면 여기에 떠요</p>
        <a class="btn-primary btn-sm" href="${PAGES.meeting}">모임 만들기</a>
      </div>`;
    return;
  }
  const posted = postedReview();
  if (posted) {
    reviewSlot.innerHTML = doneHtml(posted.guest_notes.length > 0);
    return;
  }

  const r = restaurants.find((x) => x.id === meeting.confirmed.restaurant_id);
  const date = meetingDate();
  const meta = [meetingName(), r?.name ?? meeting.confirmed.name, `${date.getMonth() + 1}.${date.getDate()}`].join(" · ");
  reviewSlot.innerHTML = `
    <form class="card review-card" id="review-form" novalidate>
      <div class="review-head">
        <h3 class="heading">지난 모임 후기</h3>
        <span class="badge badge-soft">1건 남음</span>
      </div>
      <p class="review-meta">${esc(meta)}</p>

      <div class="stars" role="group" aria-label="별점" aria-describedby="rating-error">
        ${Array.from({ length: RATING_MAX }, (_, i) => `
          <button type="button" class="star-btn" data-rating="${i + 1}" aria-label="별점 ${i + 1}점" aria-pressed="false">${icon("star")}</button>`).join("")}
      </div>
      <p class="field-error" id="rating-error" role="alert"></p>

      <div class="chips chips-sm review-chips" role="group" aria-label="칩 후기">
        ${REVIEW_CHIPS.map((c) => `<button type="button" class="chip" data-chip="${c}" aria-pressed="false">${c}</button>`).join("")}
      </div>

      <label class="sr-only" for="review-comment">한마디</label>
      <input class="input review-comment" id="review-comment" maxlength="100" autocomplete="off" placeholder="한마디 남겨 주세요 (선택)">

      ${meetingGuests().map(noteBoxHtml).join("")}

      <button type="submit" class="btn-primary review-submit">후기 올리기</button>
    </form>`;
}

// "OO님에 대해 알게 된 것": 모임에 같이 간 비회원마다 하나씩
function noteBoxHtml(g) {
  return `
    <div class="note-box">
      <div class="note-box-head">
        <label class="note-box-title" for="note-${g.id}">${esc(g.title)}에 대해 알게 된 것</label>
        <span class="badge badge-white">나만 보기</span>
      </div>
      <input class="input input-sub" id="note-${g.id}" data-guest="${g.id}" maxlength="60" autocomplete="off" placeholder="예: 맵지 않은 메뉴 위주로 드심">
      <p class="note-box-hint">건강·개인사처럼 민감한 내용은 적지 말아 주세요</p>
    </div>`;
}

function doneHtml(withNotes) {
  return `
    <p class="card review-done" id="review-done" tabindex="-1">
      ${icon("check")}${withNotes ? "후기를 올렸어요. 메모에도 반영했어요" : "후기를 올렸어요"}
    </p>`;
}

function syncDraft() {
  reviewSlot.querySelectorAll("[data-rating]").forEach((b) => {
    const on = Number(b.dataset.rating) <= draft.rating;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(Number(b.dataset.rating) === draft.rating));
  });
  reviewSlot.querySelectorAll("[data-chip]").forEach((c) => c.setAttribute("aria-pressed", String(draft.chips.has(c.dataset.chip))));
}

function onReviewClick(event) {
  const star = event.target.closest("[data-rating]");
  const chip = event.target.closest("[data-chip]");
  if (star) {
    draft.rating = Number(star.dataset.rating);
    document.getElementById("rating-error").textContent = "";
  } else if (chip) {
    const c = chip.dataset.chip;
    draft.chips.has(c) ? draft.chips.delete(c) : draft.chips.add(c);
  } else {
    return;
  }
  syncDraft();
}

function postReview(event) {
  event.preventDefault();
  if (!draft.rating) {
    document.getElementById("rating-error").textContent = "별점을 골라 주세요";
    reviewSlot.querySelector("[data-rating]").focus();
    return;
  }

  const id = `vm${Date.now()}`;
  const notes = [...reviewSlot.querySelectorAll("[data-guest]")]
    .map((input) => ({ guest_id: input.dataset.guest, text: input.value.trim() }))
    .filter((n) => n.text);
  const review = {
    id,
    restaurant_id: meeting.confirmed.restaurant_id,
    meeting_title: meetingName(),
    date: ymd(meetingDate()),
    purpose: PURPOSE[meeting.purpose] ?? "",
    with: withLabel(),
    headcount: new Set([SELF_ID, ...meeting.people]).size,
    rating: draft.rating,
    chips: [...draft.chips],
    comment: document.getElementById("review-comment").value.trim(),
    guest_notes: notes,
    confirmed_at: meeting.confirmed.confirmedAt,
  };
  save(KEYS.reviews, [review, ...myReviews()]);

  // 알게 된 것 → 그 비회원 메모의 기록 줄에 쌓여요
  const today = ymd(new Date());
  notes.forEach((n) => {
    const g = guestById(n.guest_id);
    saveMemo(g.id, { history: [...(g.history ?? []), { date: today, text: n.text, from_review_id: id }] });
    fresh.set(g.id, n.text);
  });

  reviewSlot.innerHTML = doneHtml(notes.length > 0);
  flash = true;
  renderMemos();
  flash = false;
  document.getElementById("review-done").focus();
  const first = notes[0] && document.querySelector(`.memo-card[data-id="${notes[0].guest_id}"]`);
  first?.scrollIntoView({ block: "center", behavior: "smooth" });
}

// ---------- 비회원 메모 ----------

const memoList = document.getElementById("memo-list");

const hasMemo = (g) =>
  g.mine || g.memo || [g.history, g.likes, g.dislikes, g.needs, g.allergies, g.diet].some((list) => list?.length);

const lastHistory = (g) => g.history?.at(-1);

// 이번 모임에 간 사람 먼저, 그다음 최근 기록 순
function shownGuests() {
  const inMeeting = new Set(meeting?.people ?? []);
  const list = guests.filter((g) => inMeeting.has(g.id) || hasMemo(g) || g.id === editingId);
  return list.sort(
    (a, b) =>
      inMeeting.has(b.id) - inMeeting.has(a.id) ||
      (lastHistory(b)?.date ?? "").localeCompare(lastHistory(a)?.date ?? ""),
  );
}

function renderMemos() {
  const list = shownGuests();
  memoList.innerHTML = list.map((g) => (g.id === editingId ? editHtml(g) : memoHtml(g))).join("");
  document.getElementById("memo-empty").hidden = list.length > 0;
}

const relationBadge = (g) =>
  `<span class="badge ${g.relation === "사내" ? "badge-subtle" : "badge-soft"}">${esc(g.relation)}</span>`;

const tags = (codes, extra = "") =>
  codes?.length ? codes.map((c) => `<span class="tag ${extra}">${FOOD[c] ?? c}</span>`).join("") : `<span class="unknown">아직 몰라요</span>`;

function memoHtml(g) {
  const avoid = [...(g.allergies ?? []), ...(g.diet ?? [])].map((c) => AVOID[c]);
  const needs = g.needs?.length ? g.needs.map((n) => `${esc(n)} 필요`).join(" · ") : "없음";
  return `
    <li class="card memo-card" data-id="${g.id}">
      <div class="memo-head">
        <h3 class="memo-title">${esc(g.title)}</h3>
        ${relationBadge(g)}
        <button type="button" class="link-btn memo-edit" data-action="edit" aria-label="${esc(g.title)} 메모 수정">수정</button>
      </div>
      <dl class="memo-grid">
        <dt>못 먹는 것</dt>
        <dd class="${avoid.length ? "is-caution" : "is-strong"}">${avoid.length ? avoid.join(", ") : "없음"}</dd>
        <dt>좋아함</dt>
        <dd class="tags">${tags(g.likes)}</dd>
        <dt>별로</dt>
        <dd class="tags">${tags(g.dislikes, "tag-line")}</dd>
        <dt>꼭 필요</dt>
        <dd class="is-strong">${needs}</dd>
      </dl>
      ${g.memo ? `<p class="memo-body">${esc(g.memo)}</p>` : ""}
      ${historyHtml(g)}
    </li>`;
}

function historyText(h) {
  const text = h.from_review_id ? `후기에서 추가 · ${h.text}` : h.text;
  return `${dotDate(h.date)} ${esc(text)}`;
}

// 기록 줄: 최근 한 줄만 보이고, 이전 기록은 "기록 n개 더 보기"로 최신순 펼침
function historyHtml(g) {
  const history = g.history ?? [];
  const older = history.slice(0, -1).reverse();
  const open = openHistory.has(g.id);
  const toggle = older.length
    ? `<button type="button" class="history-toggle" data-action="history" aria-expanded="${open}" aria-controls="history-${g.id}">
        <span>${open ? "접기" : `기록 ${older.length}개 더 보기`}</span>${icon("chevron-down", "icon-sm")}
      </button>`
    : "";
  let line;
  if (fresh.has(g.id)) line = `${icon("sparkles", "icon-sm")}<span class="history-text">방금 후기에서 추가 · ${esc(fresh.get(g.id))}</span>`;
  else if (history.length) line = `<span class="history-text">${historyText(history.at(-1))}</span>`;
  else line = `<span class="history-text">아직 기록이 없어요</span>`;

  return `
    <p class="memo-history${fresh.has(g.id) ? " is-fresh" : ""}${flash && fresh.has(g.id) ? " is-flash" : ""}">${line}${toggle}</p>
    ${older.length ? `<ul class="history-list" id="history-${g.id}" aria-label="이전 기록" ${open ? "" : "hidden"}>${older.map((h) => `<li>${historyText(h)}</li>`).join("")}</ul>` : ""}`;
}

// 다른 카드를 고치는 중일 수 있어서 목록을 다시 그리지 않고 그 자리에서만 펼쳐요
function toggleHistory(card, button) {
  const id = card.dataset.id;
  const open = !openHistory.has(id);
  open ? openHistory.add(id) : openHistory.delete(id);
  const count = (guestById(id).history?.length ?? 1) - 1;
  button.setAttribute("aria-expanded", String(open));
  button.querySelector("span").textContent = open ? "접기" : `기록 ${count}개 더 보기`;
  card.querySelector(".history-list").hidden = !open;
}

// ---------- 메모 고치기 ----------

const editDraft = { avoid: new Set(), likes: new Set(), dislikes: new Set(), needs: new Set() };

function chipGroup(group, label, options) {
  const id = `edit-${group}`;
  return `
    <div class="field">
      <span class="field-label" id="${id}">${label}</span>
      <div class="chips chips-sm" role="group" aria-labelledby="${id}">
        ${Object.entries(options).map(([code, name]) => `
          <button type="button" class="chip" data-group="${group}" data-code="${esc(code)}" aria-pressed="${editDraft[group].has(code)}">${esc(name)}</button>`).join("")}
      </div>
    </div>`;
}

function editHtml(g) {
  return `
    <li class="card memo-card is-editing" data-id="${g.id}">
      <div class="memo-head">
        <h3 class="memo-title">${esc(g.title)}</h3>
        ${relationBadge(g)}
      </div>
      ${chipGroup("avoid", "못 먹는 것<span class=\"hint\">아는 것만</span>", AVOID)}
      ${chipGroup("likes", "좋아함", FOOD)}
      ${chipGroup("dislikes", "별로", FOOD)}
      ${chipGroup("needs", "꼭 필요", Object.fromEntries(NEEDS.map((n) => [n, n])))}
      <div class="field">
        <label class="field-label" for="edit-memo">메모</label>
        <textarea class="input textarea" id="edit-memo" maxlength="200" rows="3" placeholder="예: 자차로 이동하셔서 주차 필요">${esc(g.memo ?? "")}</textarea>
        <p class="note-box-hint">건강·개인사처럼 민감한 내용은 적지 말아 주세요</p>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" data-action="cancel">취소</button>
        <button type="button" class="btn-primary btn-sm" data-action="save">저장</button>
      </div>
    </li>`;
}

function startEdit(g) {
  editingId = g.id;
  editDraft.avoid = new Set([...(g.allergies ?? []), ...(g.diet ?? [])]);
  editDraft.likes = new Set(g.likes ?? []);
  editDraft.dislikes = new Set(g.dislikes ?? []);
  editDraft.needs = new Set(g.needs ?? []);
  renderMemos();
  const card = memoList.querySelector(`[data-id="${g.id}"]`);
  card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  card.querySelector(".chip").focus({ preventScroll: true });
}

function stopEdit(id) {
  editingId = null;
  renderMemos();
  memoList.querySelector(`[data-id="${id}"] [data-action="edit"]`)?.focus();
}

function toggleEditChip(chip) {
  const { group, code } = chip.dataset;
  const set = editDraft[group];
  set.has(code) ? set.delete(code) : set.add(code);
  // 같은 음식을 좋아함·별로에 동시에 둘 수 없어요
  const other = { likes: "dislikes", dislikes: "likes" }[group];
  if (other && set.has(code)) editDraft[other].delete(code);
  chip.closest(".memo-card").querySelectorAll("[data-group]").forEach((c) =>
    c.setAttribute("aria-pressed", String(editDraft[c.dataset.group].has(c.dataset.code))),
  );
}

function saveEdit(g) {
  const fields = {
    allergies: [...editDraft.avoid].filter((c) => c.startsWith("allergy_")),
    diet: [...editDraft.avoid].filter((c) => c.startsWith("diet_")),
    likes: [...editDraft.likes],
    dislikes: [...editDraft.dislikes],
    needs: NEEDS.filter((n) => editDraft.needs.has(n)),
    memo: document.getElementById("edit-memo").value.trim(),
  };
  const changed = Object.keys(fields).some((k) => JSON.stringify(fields[k]) !== JSON.stringify(g[k] ?? (k === "memo" ? "" : [])));
  if (changed) {
    // 적어 둔 내용이 하나도 없던 비회원일 때만 "처음 작성"
    const first = !g.memo && ![g.history, g.likes, g.dislikes, g.needs, g.allergies, g.diet].some((list) => list?.length);
    fields.history = [...(g.history ?? []), { date: ymd(new Date()), text: first ? "메모 처음 작성" : "메모 수정", from_review_id: null }];
    saveMemo(g.id, fields);
    fresh.delete(g.id);
    toast("메모를 저장했어요");
  }
  stopEdit(g.id);
}

function onMemoClick(event) {
  const card = event.target.closest(".memo-card");
  if (!card) return;
  const g = guestById(card.dataset.id);
  const chip = event.target.closest("[data-group]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (chip) toggleEditChip(chip);
  else if (action === "edit") {
    if (editingId) toast("고치던 메모를 먼저 저장하거나 취소해 주세요");
    else startEdit(g);
  } else if (action === "save") saveEdit(g);
  else if (action === "cancel") stopEdit(g.id);
  else if (action === "history") toggleHistory(card, event.target.closest("[data-action]"));
}

// ---------- 비회원 추가 ----------

const dialog = document.getElementById("guest-dialog");
const guestTitle = document.getElementById("guest-title");
const guestOrg = document.getElementById("guest-org");
const guestError = document.getElementById("guest-title-error");
let guestRelation = "거래처";

function syncRelation() {
  dialog.querySelectorAll("[data-relation]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.relation === guestRelation)));
}

function openGuestDialog() {
  if (editingId) {
    toast("고치던 메모를 먼저 저장하거나 취소해 주세요");
    return;
  }
  guestTitle.value = "";
  guestOrg.value = "";
  guestRelation = "거래처";
  guestError.textContent = "";
  guestTitle.removeAttribute("aria-invalid");
  syncRelation();
  dialog.showModal();
  guestTitle.focus();
}

function saveGuest() {
  const title = guestTitle.value.trim();
  const fail = (message) => {
    guestError.textContent = message;
    guestTitle.setAttribute("aria-invalid", "true");
    guestTitle.focus();
  };
  if (!title) return fail("호칭을 입력해 주세요");
  // 이미 있는 비회원(파일의 104명 포함)이면 새로 만들지 않고 그 메모를 열어요
  const same = guests.find((g) => g.title === title);
  if (same) {
    dialog.close();
    toast("이미 있는 비회원이에요. 메모를 열었어요");
    startEdit(same);
    return;
  }

  // ② meeting.js와 같은 모양으로 w2m.guests에 저장해요
  const guest = {
    id: `gm${Date.now()}`,
    title,
    org: guestOrg.value.trim(),
    group: guestRelation === "거래처" ? "고객사" : "사내",
    relation: guestRelation,
    allergies: [],
    diet: [],
    likes: [],
    dislikes: [],
    needs: [],
    memo: "",
    history: [],
    mine: true,
  };
  save(KEYS.guests, [guest, ...(load(KEYS.guests) ?? [])]);
  guests.unshift(guest);
  dialog.close();
  toast("비회원을 추가했어요. 아는 취향을 적어 주세요");
  startEdit(guest);
}

function setupGuestDialog() {
  document.getElementById("guest-relation").innerHTML = RELATIONS.map(
    (r) => `<button type="button" class="chip" data-relation="${r}" aria-pressed="false">${r}</button>`,
  ).join("");
  document.getElementById("add-guest").addEventListener("click", openGuestDialog);
  document.getElementById("guest-cancel").addEventListener("click", () => dialog.close());
  document.getElementById("guest-save").addEventListener("click", saveGuest);
  guestTitle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) saveGuest();
  });
  dialog.addEventListener("click", (event) => {
    const relation = event.target.closest("[data-relation]");
    if (relation) {
      guestRelation = relation.dataset.relation;
      syncRelation();
    }
  });
}

// ---------- 시작 ----------

async function init() {
  let fileGuests;
  try {
    [members, restaurants, fileGuests] = await Promise.all([loadData("members"), loadData("restaurants"), loadData("guests")]);
  } catch {
    toast("기록을 불러오지 못했어요. 새로고침해 주세요");
    return;
  }
  guests = mergeGuests(fileGuests);

  renderReview();
  renderMemos();
  document.getElementById("people-body").setAttribute("aria-busy", "false");

  reviewSlot.addEventListener("click", onReviewClick);
  reviewSlot.addEventListener("submit", postReview);
  // 입력칸에서 Enter(한글 입력 마무리 포함)를 눌러도 후기가 바로 올라가지 않게, 올리기는 버튼으로만
  reviewSlot.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input")) event.preventDefault();
  });
  memoList.addEventListener("click", onMemoClick);
  setupGuestDialog();
}

setupTabBar();
if (!profile) {
  location.replace(PAGES.start); // 내 프로필이 없으면 ① 시작하기부터
} else {
  init();
}
