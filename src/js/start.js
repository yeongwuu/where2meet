// ① 시작하기: 기본 정보 + 내 취향 입력, 체험 계정으로 바로 시작
import { FOOD, ALLERGY, DIET, DRINK, MOOD, RANK, NONE } from "./labels.js";
import { KEYS, load, save, loadData, goTo, toast } from "./common.js";

const DEMO_INVITE_CODE = "DEMO-2026";
const TRIAL_MEMBER_ID = "p01"; // 체험 계정: 가상 동료 '하늘'

// 칩 그룹별 선택지. "해당 없어요"는 알레르기·식이 제한에만 있어요.
const OPTIONS = {
  rank: RANK,
  allergies: { ...ALLERGY, [NONE]: "해당 없어요" },
  diet: { ...DIET, [NONE]: "해당 없어요" },
  likes: FOOD,
  dislikes: FOOD,
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

  // "해당 없어요"는 다른 항목과 같이 고를 수 없어요
  if (mode === "multi-none" && !wasOn) {
    next = value === NONE ? [NONE] : next.filter((v) => v !== NONE);
  }
  setSelected(name, next);

  // 같은 음식을 좋아함과 별로에 동시에 고를 수 없어요
  if (!wasOn && (name === "likes" || name === "dislikes")) {
    const other = name === "likes" ? "dislikes" : "likes";
    setSelected(other, getSelected(other).filter((v) => v !== value));
  }

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
  } else if (code.value.trim().toUpperCase() !== DEMO_INVITE_CODE) {
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

// 화면 입력 → members.json과 같은 모양의 프로필 (rank, dislikes는 추가 필드)
function readForm() {
  const withoutNone = (values) => values.filter((v) => v !== NONE);
  return {
    nickname: form.nickname.value.trim(),
    is_member: true,
    rank: getSelected("rank")[0] ?? null,
    allergies: withoutNone(getSelected("allergies")),
    diet: withoutNone(getSelected("diet")),
    likes: getSelected("likes"),
    dislikes: getSelected("dislikes"),
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
  setSelected("likes", profile.likes ?? []);
  setSelected("dislikes", profile.dislikes ?? []);
  setSelected("drink", profile.drink ? [profile.drink] : DEFAULTS.drink);
  setSelected("mood", profile.mood ? [profile.mood] : DEFAULTS.mood);
}

async function loadTrialProfile() {
  const members = await loadData("members");
  return members.find((m) => m.id === TRIAL_MEMBER_ID);
}

// ---------- 시작 ----------

const savedProfile = load(KEYS.profile);
renderChips();
fillForm(savedProfile ?? {}, savedProfile?.inviteCode);
if (!savedProfile) {
  // 처음 온 사람은 못 먹는 것을 직접 고르게 비워 둬요
  setSelected("allergies", []);
  setSelected("diet", []);
}

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
    fillForm(trial, DEMO_INVITE_CODE);
    save(KEYS.profile, { ...readForm(), id: trial.id, team: trial.team, inviteCode: DEMO_INVITE_CODE });
    goTo("meeting");
  } catch {
    toast("체험 계정을 불러오지 못했어요. 잠시 후 다시 눌러 주세요");
  }
});
