// 홈: 모임 만들기(프로필이 없으면 ① 먼저) + 이어서 하기
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

function renderResume() {
  if (!profile || !draft?.people?.length) return;
  const row = document.getElementById("resume");
  const team = draft.team ? `${draft.team} ` : "";
  document.getElementById("resume-label").textContent = `${team}${PURPOSE[draft.purpose] ?? "모임"} (작성 중)`;
  row.hidden = false;
  row.addEventListener("click", () => goTo("meeting"));
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
setupTabBar();

document.getElementById("start-meeting").addEventListener("click", startMeeting);
