// ④ 추천 검증: 여러 모임 조건에서 추천이 3곳 이상 나오는지 확인해요.
//
// 실행: node scripts/check_recommend.mjs        (저장소 맨 바깥에서)
//       node scripts/check_recommend.mjs --all  (3곳 이상인 조합까지 모두 출력)
//
// 추천 계산은 새로 만들지 않고 src/js/result.js를 그대로 실행해요.
// 브라우저 대신 가짜 저장소(localStorage)·화면(document)·fetch를 붙이고,
// result.js가 화면에 쓴 "조건을 모두 지키는 곳은 n곳이에요"와 추천 카드 id를 읽어요.
// "빠진 이유"는 이 스크립트가 data_spec.md 4-2 기준으로 따로 세요. 이 결과가 result.js의 개수와
// 하나라도 다르면 규칙이 바뀐 것이니 오류를 내고 멈춰요 (그때는 아래 REASONS를 4-2에 맞게 고쳐요).

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOW_ALL = process.argv.includes("--all");
const MIN_COUNT = 3;

const readJson = (name) => JSON.parse(readFileSync(join(ROOT, "docs/data", `${name}.json`), "utf8"));
const members = readJson("members");
const restaurants = readJson("restaurants");
const { BUDGET_PRESETS, PURPOSE } = await import(pathToFileURL(join(ROOT, "src/js/labels.js")));

// ---------- 조합 ----------

const TRIAL_ID = "p01"; // 체험 계정 하늘
const TEAMS = [...new Set(members.map((m) => m.team))];
const PURPOSES = Object.keys(PURPOSE);
const BUDGETS = Object.entries(BUDGET_PRESETS);
// 요일은 날짜로 정해요 (result.js가 날짜에서 요일을 읽어요)
const DAYS = [
  ["수(평일)", "2026-10-14"],
  ["일", "2026-10-11"],
  ["월", "2026-10-12"],
];
const TIMES = ["18:30", "12:00"];
const FIXED = { place: "place_office", walk: "walk_10" };

// ---------- 브라우저 흉내 ----------

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.fetch = async (url) => {
  const name = String(url).match(/docs\/data\/(\w+)\.json$/)?.[1];
  return { ok: Boolean(name), status: name ? 200 : 404, json: async () => readJson(name) };
};
globalThis.location = { href: "", replace() {} };

let elements;
let onDone;
function element(id) {
  const el = {
    id, hidden: true, textContent: "", innerHTML: "", attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
      if (id === "result-body" && name === "aria-busy" && value === "false") onDone?.();
    },
    getAttribute(name) { return this.attrs[name]; },
    addEventListener() {}, append() {}, classList: { add() {}, remove() {}, toggle() {} },
  };
  return el;
}
globalThis.document = {
  getElementById: (id) => elements.get(id) ?? elements.set(id, element(id)).get(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => element("created"),
  body: { append() {} },
};

// result.js를 한 번 실행하고, 계산이 끝나면 결과를 돌려줘요
let run = 0;
async function runResult(meeting) {
  store.clear();
  store.set("w2m.profile", JSON.stringify({ id: TRIAL_ID }));
  store.set("w2m.meeting", JSON.stringify(meeting));
  elements = new Map();
  const done = new Promise((resolve) => (onDone = resolve));
  // ?run=n을 붙여 매번 새로 실행해요 (모듈은 한 번만 실행되기 때문)
  await import(`${pathToFileURL(join(ROOT, "src/js/result.js"))}?run=${run++}`);
  await done;
  const countText = document.getElementById("count-text").textContent;
  const count = Number(countText.match(/(\d+)곳/)?.[1] ?? 0);
  const top = [...document.getElementById("rec-list").innerHTML.matchAll(/data-id="(r\d+)"/g)].map((m) => m[1]);
  return { count, top };
}

// ---------- 빠진 이유 (data_spec.md 4-2) ----------

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
function isOpenAt(hours, time) {
  const [open, close] = hours.split("-").map(toMin);
  const t = toMin(time);
  return close > open ? t >= open && t < close : t >= open || t < close;
}

const REASONS = {
  알레르기: (r, g) => r.allergens.some((a) => g.allergies.has(a)),
  식단: (r, g) => [...g.diets].some((d) => !r.diet_ok.includes(d)),
  인원: (r, g) => r.capacity < g.size,
  예산초과: (r, g, m) => m.budget[1] < 100000 && r.price_per_person - m.budget[1] >= 15000,
  휴무: (r, g, m) => r.closed?.includes(DAY_CODES[new Date(`${m.date}T00:00`).getDay()]),
  영업시간: (r, g, m) => Boolean(r.hours) && !isOpenAt(r.hours, m.time),
};

function groupOf(meeting) {
  const ids = new Set(meeting.people);
  const people = members.filter((m) => ids.has(m.id));
  return {
    size: people.length,
    allergies: new Set(people.flatMap((p) => p.allergies ?? [])),
    diets: new Set(people.flatMap((p) => p.diet ?? [])),
  };
}

// ---------- 실행 ----------

const rows = [];
for (const team of TEAMS) {
  const people = [TRIAL_ID, ...members.filter((m) => m.team === team && m.id !== TRIAL_ID).map((m) => m.id)];
  for (const purpose of PURPOSES) {
    for (const [budgetLabel, budget] of BUDGETS) {
      for (const [dayLabel, date] of DAYS) {
        for (const time of TIMES) {
          const meeting = { people, team, purpose, budget, day: "day_pick", date, time, ...FIXED };
          const { count, top } = await runResult(meeting);
          const g = groupOf(meeting);
          const hit = {}; // 이유별 걸린 식당 수 (여러 이유에 걸릴 수 있어요)
          const only = {}; // 이 이유 하나만 아니면 통과하는 식당 수
          let passed = 0;
          for (const r of restaurants) {
            const failed = Object.keys(REASONS).filter((k) => REASONS[k](r, g, meeting));
            failed.forEach((k) => (hit[k] = (hit[k] ?? 0) + 1));
            if (failed.length === 1) only[failed[0]] = (only[failed[0]] ?? 0) + 1;
            if (!failed.length) passed++;
          }
          if (passed !== count) {
            throw new Error(`result.js(${count}곳)와 4-2 이유 계산(${passed}곳)이 달라요: ${team} ${purpose} ${budgetLabel} ${dayLabel} ${time}. REASONS를 data_spec.md 4-2에 맞게 고쳐 주세요`);
          }
          rows.push({ team, purpose: PURPOSE[purpose], budget: budgetLabel, day: dayLabel, time, size: g.size, count, top, hit, only });
        }
      }
    }
  }
}

// ---------- 출력 ----------

const fmt = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "-";
const short = rows.filter((r) => r.count < MIN_COUNT);
const meetings = TEAMS.length * PURPOSES.length * BUDGETS.length;

console.log(`식당 ${restaurants.length}곳 · 모임 조합 ${meetings}가지(14팀 × 목적 3 × 예산 5) × 요일 ${DAYS.length} × 시간 ${TIMES.length} = ${rows.length}번 계산`);
console.log(`고정: 회사 · 도보 10분 · 팀 전원 + 체험 계정(하늘)`);
console.log(`3곳 미만: ${short.length}번 / 최소 ${Math.min(...rows.map((r) => r.count))}곳 · 최대 ${Math.max(...rows.map((r) => r.count))}곳\n`);

const list = SHOW_ALL ? rows : short;
if (list.length) {
  console.log("| 팀 | 목적 | 예산 | 요일 | 시간 | 인원 | 추천 수 | 1~3순위 | 걸린 이유(식당 수) | 이 이유만 아니면 통과 |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of list) {
    console.log(`| ${r.team} | ${r.purpose} | ${r.budget} | ${r.day} | ${r.time} | ${r.size} | ${r.count} | ${r.top.join(" ")} | ${fmt(r.hit)} | ${fmt(r.only)} |`);
  }
}

// 팀별 가장 적게 나온 경우 (한눈에 보기)
console.log("\n| 팀 | 인원 | 가장 적을 때 | 그 조건 |");
console.log("|---|---|---|---|");
for (const team of TEAMS) {
  const worst = rows.filter((r) => r.team === team).sort((a, b) => a.count - b.count)[0];
  console.log(`| ${team} | ${worst.size} | ${worst.count}곳 | ${worst.purpose} · ${worst.budget} · ${worst.day} ${worst.time} |`);
}

process.exitCode = short.length ? 1 : 0;
