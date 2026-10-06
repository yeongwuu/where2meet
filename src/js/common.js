// 여러 화면이 같이 쓰는 도구: 저장, 데이터 불러오기, 안내 문구, 화면 이동
import { BUDGET_MAX } from "./labels.js";

// 브라우저 저장소 키
export const KEYS = {
  profile: "w2m.profile", // ① 내 프로필
  meeting: "w2m.meeting", // ② 작성 중인 모임
  guests: "w2m.guests", // ② 내가 추가한 비회원
  requests: "w2m.requests", // ② 취향 입력을 부탁한 사람 { id: 보낸 시각 }
  reviews: "w2m.reviews", // ⑤ 내가 올린 후기
  guestMemos: "w2m.guestMemos", // ⑤ 고친 비회원 메모 { 비회원 id: 바뀐 필드 }
  reviewLater: "w2m.reviewLater", // ⑤ "다음에 하기"를 누른 후기 (확정 시각 confirmedAt 목록). 홈 알림에서 빼요
};

// 체험 계정: 가상 동료 '하늘'(members.json p01)
export const TRIAL_ID = "p01";

export function isTrial(profile) {
  return profile?.id === TRIAL_ID;
}

// 체험 계정에서 나가기: 하늘 프로필과 하늘로 작성하던 모임·요청 기록을 지워요 (직접 추가한 비회원은 남겨요)
export function leaveTrial() {
  try {
    [KEYS.profile, KEYS.meeting, KEYS.requests].forEach((key) => localStorage.removeItem(key));
  } catch {
    // 저장소를 못 쓰는 환경이면 지울 것도 없어요
  }
}

export function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 시크릿 창 등에서 저장이 막혀도 화면 진행은 계속해요
  }
}

// docs/data/의 JSON 읽기. 예: await loadData("members")
export async function loadData(name) {
  const res = await fetch(`docs/data/${name}.json`);
  if (!res.ok) throw new Error(`${name}.json ${res.status}`);
  return res.json();
}

// 화면 파일. 아직 없는 화면은 null이고, 만들면 파일 이름을 채워요.
export const PAGES = {
  home: "index.html", // 홈 (첫 화면, 왼쪽 위 홈 버튼)
  start: "start.html", // ① 시작하기 (= 내 취향 탭)
  meeting: "meeting.html", // ② 모임 만들기 (= 모임 탭)
  summary: "summary.html", // ③ 취향 종합
  result: "result.html", // ④ 추천 결과
  people: "people.html", // ⑤ 사람·기록 (= 사람 탭)
};

export function goTo(page) {
  if (PAGES[page]) {
    location.href = PAGES[page];
  } else {
    toast("이 화면은 준비 중이에요");
  }
}

let toastTimer;
export function toast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

// 금액 표시: 5000 → "5천원", 40000 → "4만원"
export function won(n) {
  if (n >= 10000) return `${n / 10000}만원`;
  return n === 0 ? "0원" : `${n / 1000}천원`;
}

// 1인 예산 [최소, 최대] → "~ 4만원", "2만원 ~ 4만원" 등 (②·③에서 같이 써요)
export function budgetLabel([min, max]) {
  if (min === 0 && max === BUDGET_MAX) return "상관없음";
  if (min === max) return won(min);
  if (max === BUDGET_MAX) return `${won(min)} 이상`;
  if (min === 0) return `~ ${won(max)}`;
  return `${won(min)} ~ ${won(max)}`;
}

// <svg class="icon"><use …/></svg> 문자열. JS로 그리는 화면에서 써요.
export function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="assets/icons.svg#i-${name}"/></svg>`;
}

// 하단 탭: data-tab 링크 중 아직 없는 화면은 안내만 띄워요
export function setupTabBar() {
  document.querySelectorAll(".tab-bar [data-tab]").forEach((tab) => {
    const page = PAGES[tab.dataset.tab];
    if (page) {
      tab.href = page;
    } else {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        toast("이 화면은 준비 중이에요");
      });
    }
  });
}
