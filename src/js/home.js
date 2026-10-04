// 홈: 모임 만들기(프로필이 없으면 ① 먼저) + 다른 메뉴
import { PURPOSE } from "./labels.js";
import { KEYS, load, loadData, goTo, setupTabBar } from "./common.js";

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

async function renderCounts() {
  try {
    const restaurants = await loadData("restaurants");
    document.getElementById("restaurants-sub").textContent = `식당 ${restaurants.length}곳을 음식·예산·룸·알레르기 대응으로 골라 보기`;
  } catch {
    // 숫자 없이 기본 문구 그대로
  }
  if (profile?.team) {
    document.getElementById("team-sub").textContent = `${profile.team}의 못 먹는 것과 좋아하는 음식 한눈에`;
  }
}

// 모임 만들기: 프로필이 있으면 ②, 없으면 ①부터
function startMeeting() {
  goTo(profile ? "meeting" : "start");
}

renderGreeting();
renderMeetingCard();
renderResume();
renderCounts();
setupTabBar();

document.getElementById("start-meeting").addEventListener("click", startMeeting);
document.querySelectorAll("[data-go]").forEach((card) => {
  card.addEventListener("click", () => goTo(card.dataset.go));
});
