// 홈: 모임 만들기(프로필이 없으면 ① 먼저) + 이어서 하기 · 후기 남기기 + 진행 안내
import { PURPOSE } from "./labels.js";
import { KEYS, isTrial, leaveTrial, load, goTo, setupTabBar } from "./common.js";

const profile = load(KEYS.profile);
const draft = load(KEYS.meeting);

function renderGreeting() {
  if (!profile) return; // 처음 온 사람은 앱 소개 문구 그대로
  document.getElementById("greeting").innerHTML = `<strong>${profile.nickname}</strong> 님, 오늘은 어디서 모일까요?`;
}

function renderMeetingCard() {
  const sub = document.getElementById("meeting-sub");
  if (!profile) {
    sub.textContent = "처음이면 내 취향부터 1분 안에 입력해요";
  }
}

// 작성 중인 모임만 보여 줘요. ④에서 확정한 모임은 숨겨요 (모임 정보는 ⑤ 후기에서 쓰니까 지우지 않아요)
function renderResume() {
  if (!profile || !draft?.people?.length || draft.confirmed) return;
  const row = document.getElementById("resume");
  const team = draft.team ? `${draft.team} ` : "";
  document.getElementById("resume-label").textContent = `${team}${PURPOSE[draft.purpose] ?? "모임"} (작성 중)`;
  row.hidden = false;
  row.addEventListener("click", () => goTo("meeting"));
}

// 식당을 확정했는데 이 모임 후기를 아직 안 남겼으면 ⑤로 안내해요 (⑤ people.js와 같은 기준: confirmed_at)
function renderReviewDue() {
  const confirmed = draft?.confirmed;
  if (!profile || !confirmed) return;
  const posted = (load(KEYS.reviews) ?? []).some((v) => v.confirmed_at === confirmed.confirmedAt);
  if (posted) return;
  const row = document.getElementById("review-due");
  document.getElementById("review-due-label").textContent = confirmed.name;
  row.hidden = false;
  row.addEventListener("click", () => goTo("people"));
}

// 모임 만들기: 프로필이 있으면 ②, 없으면 ①부터
function startMeeting() {
  goTo(profile ? "meeting" : "start");
}

// 체험 계정이면 내 프로필로 바꿀 수 있게 안내해요
function renderTrialBanner() {
  if (!isTrial(profile)) return;
  document.getElementById("trial-banner").hidden = false;
  document.getElementById("trial-leave").addEventListener("click", () => {
    leaveTrial();
    goTo("start");
  });
}

renderGreeting();
renderTrialBanner();
renderMeetingCard();
renderResume();
renderReviewDue();
setupTabBar();

document.getElementById("start-meeting").addEventListener("click", startMeeting);
