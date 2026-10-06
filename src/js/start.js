// ① 시작하기: 기본 정보 + 내 취향 입력, 체험 계정으로 바로 시작
import { FOOD, ALLERGY, DIET, DRINK, MOOD, RANK, NONE, NOT_TODAY_MAX } from "./labels.js";
import { KEYS, TRIAL_ID, isTrial, leaveTrial, load, save, loadData, goTo, toast, setupTabBar } from "./common.js";

const INVITE_CODE = "Fit-stop"; // 사내초대코드. 처음 온 사람에게는 미리 채워 둬요

// 칩 그룹별 선택지. "해당 없어요"는 알레르기·식이 제한에만 있어요.
const OPTIONS = {
  rank: RANK,
  allergies: { ...ALLERGY, [NONE]: "해당 없어요" },
  diet: { ...DIET, [NONE]: "해당 없어요" },
  not_today: FOOD,
  drink: DRINK,
  mood: MOOD,
};

// 처음 화면에 미리 골라 두는 값
const DEFAULTS = {
  rank: ["rank_associate"],
  drink: ["drink_light"],
  mood: ["mood_any"],
};

const form = document.getElementById("profile-form");
const groups = {};

// ---------- 칩 ----------

function renderChips() {
  form.querySelectorAll("[data-group]").forEach((el) => {
    const name = el.dataset.group;
    groups[name] = el;
    el.innerHTML = "";
    for (const [value, label] of Object.entries(OPTIONS[name])) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.value = value;
      chip.setAttribute("aria-pressed", "false");
      chip.textContent = label;
      el.append(chip);
    }
  });
}

function getSelected(name) {
  return [...groups[name].querySelectorAll('[aria-pressed="true"]')].map((c) => c.dataset.value);
}

function setSelected(name, values) {
  groups[name].querySelectorAll(".chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(values.includes(chip.dataset.value)));
  });
}

function onChipClick(event) {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  const group = chip.closest("[data-group]");
  const name = group.dataset.group;
  const mode = group.dataset.mode;
  const value = chip.dataset.value;
  const wasOn = chip.getAttribute("aria-pressed") === "true";

  if (mode === "single") {
    // 하나만 고르고, 고른 것을 다시 눌러도 꺼지지 않아요
    setSelected(name, [value]);
    return;
  }

  let next = wasOn ? getSelected(name).filter((v) => v !== value) : [...getSelected(name), value];

  // 정해진 개수까지만 골라요. 넘치면 고르지 않고 안내만 해요
  if (mode === "multi-max" && !wasOn && next.length > NOT_TODAY_MAX) {
    toast(`${NOT_TODAY_MAX}개까지 고를 수 있어요. 하나를 빼고 다시 골라 주세요`);
    return;
  }

  // "해당 없어요"는 다른 항목과 같이 고를 수 없어요
  if (mode === "multi-none" && !wasOn) {
    next = value === NONE ? [NONE] : next.filter((v) => v !== NONE);
  }
  setSelected(name, next);

  if (name === "allergies" || name === "diet") clearError("avoid-error");
}

// ---------- 입력 확인 ----------

function showError(id, message, input) {
  document.getElementById(id).textContent = message;
  if (input) input.setAttribute("aria-invalid", "true");
}

function clearError(id, input) {
  document.getElementById(id).textContent = "";
  if (input) input.removeAttribute("aria-invalid");
}

function validate() {
  const code = form.inviteCode;
  const nickname = form.nickname;
  let firstInvalid = null;

  clearError("invite-code-error", code);
  clearError("nickname-error", nickname);
  clearError("avoid-error");

  if (!code.value.trim()) {
    showError("invite-code-error", "사내초대코드를 입력해 주세요", code);
    firstInvalid ??= code;
  } else if (code.value.trim().toLowerCase() !== INVITE_CODE.toLowerCase()) {
    showError("invite-code-error", "코드가 맞지 않아요. 다시 확인해 주세요", code);
    firstInvalid ??= code;
  }

  if (!nickname.value.trim()) {
    showError("nickname-error", "닉네임을 입력해 주세요", nickname);
    firstInvalid ??= nickname;
  }

  if (getSelected("allergies").length === 0 || getSelected("diet").length === 0) {
    showError("avoid-error", "알레르기와 식이 제한을 골라 주세요. 없으면 '해당 없어요'를 눌러 주세요");
    firstInvalid ??= groups.allergies.querySelector(".chip");
  }

  if (firstInvalid) {
    firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
    firstInvalid.focus({ preventScroll: true });
    return false;
  }
  return true;
}

// ---------- 저장 · 불러오기 ----------

// 화면 입력 → members.json과 같은 모양의 프로필
// likes·dislikes는 더 이상 묻지 않아요. 이전에 저장한 값은 저장할 때 그대로 남겨요 (③·④도 이제 쓰지 않아요)
function readForm() {
  const withoutNone = (values) => values.filter((v) => v !== NONE);
  return {
    nickname: form.nickname.value.trim(),
    is_member: true,
    rank: getSelected("rank")[0] ?? null,
    allergies: withoutNone(getSelected("allergies")),
    diet: withoutNone(getSelected("diet")),
    not_today: getSelected("not_today"),
    drink: getSelected("drink")[0] ?? null,
    mood: getSelected("mood")[0] ?? null,
  };
}

function fillForm(profile, inviteCode = "") {
  clearError("invite-code-error", form.inviteCode);
  clearError("nickname-error", form.nickname);
  clearError("avoid-error");
  form.inviteCode.value = inviteCode;
  form.nickname.value = profile.nickname ?? "";
  setSelected("rank", [profile.rank ?? DEFAULTS.rank[0]]);
  setSelected("allergies", profile.allergies?.length ? profile.allergies : [NONE]);
  setSelected("diet", profile.diet?.length ? profile.diet : [NONE]);
  setSelected("not_today", (profile.not_today ?? []).slice(0, NOT_TODAY_MAX));
  setSelected("drink", profile.drink ? [profile.drink] : DEFAULTS.drink);
  setSelected("mood", profile.mood ? [profile.mood] : DEFAULTS.mood);
}

async function loadTrialProfile() {
  const members = await loadData("members");
  return members.find((m) => m.id === TRIAL_ID);
}

// ---------- 시작 ----------

let savedProfile = load(KEYS.profile);
setupTabBar();
renderChips();
fillForm(savedProfile ?? {}, INVITE_CODE);
if (!savedProfile) {
  // 처음 온 사람은 못 먹는 것을 직접 고르게 비워 둬요
  setSelected("allergies", []);
  setSelected("diet", []);
}

// 체험 계정으로 보는 중이면 안내하고, 내 프로필로 새로 입력할 수 있게 해요
const trialNotice = document.getElementById("trial-notice");
trialNotice.hidden = !isTrial(savedProfile);
document.getElementById("trial-leave").addEventListener("click", () => {
  leaveTrial();
  savedProfile = null;
  fillForm({}, INVITE_CODE);
  setSelected("allergies", []);
  setSelected("diet", []);
  trialNotice.hidden = true;
  form.nickname.focus();
  toast("체험 계정에서 나왔어요. 내 프로필을 입력해 주세요");
});

form.addEventListener("click", onChipClick);

form.inviteCode.addEventListener("input", () => clearError("invite-code-error", form.inviteCode));
form.nickname.addEventListener("input", () => clearError("nickname-error", form.nickname));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validate()) return;
  save(KEYS.profile, { ...savedProfile, ...readForm(), inviteCode: form.inviteCode.value.trim() });
  goTo("meeting");
});

document.getElementById("trial-start").addEventListener("click", async () => {
  try {
    const trial = await loadTrialProfile();
    fillForm(trial, INVITE_CODE);
    // 소속 팀은 ②에서 직접 고르게 비워 둬요
    save(KEYS.profile, { ...readForm(), id: trial.id, inviteCode: INVITE_CODE });
    goTo("meeting");
  } catch {
    toast("체험 계정을 불러오지 못했어요. 잠시 후 다시 눌러 주세요");
  }
});
