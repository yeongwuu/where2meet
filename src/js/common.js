// 여러 화면이 같이 쓰는 도구: 저장, 데이터 불러오기, 안내 문구, 화면 이동

// 브라우저 저장소 키
export const KEYS = {
  profile: "w2m.profile", // ① 내 프로필
  meeting: "w2m.meeting", // ② 작성 중인 모임
  guests: "w2m.guests", // ② 내가 추가한 비회원
  requests: "w2m.requests", // ② 취향 입력을 부탁한 사람 { id: 보낸 시각 }
};

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
  summary: null, // ③ 취향 종합
  result: null, // ④ 추천 결과
  people: null, // ⑤ 사람·기록 (= 사람 탭)
  restaurants: null, // 식당 둘러보기
  review: null, // 후기 남기기
  teamTaste: null, // 우리 팀 취향
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
