// 코드값 → 화면 이름. docs/data_spec.md 2장과 같은 내용이에요. 화면 이름을 바꿀 때는 둘 다 고쳐요.

export const FOOD = {
  food_korean_bbq: "고기구이",
  food_korean_stew: "한식·찌개",
  food_japanese: "일식",
  food_chinese: "중식",
  food_western: "양식",
  food_seafood: "해산물",
  food_chicken_pub: "치킨·호프",
  food_asian: "아시안",
};

export const ALLERGY = {
  allergy_crustacean: "갑각류",
  allergy_fish: "생선",
  allergy_mollusk: "조개·연체류",
  allergy_wheat: "밀",
  allergy_egg_dairy: "달걀·유제품",
  allergy_nut: "견과류",
};

export const DIET = {
  diet_vegetarian: "채식",
  diet_halal: "할랄",
};

export const DRINK = {
  drink_none: "술 안 마셔요",
  drink_light: "가볍게 한두 잔",
  drink_enjoy: "술자리 좋아요",
};

export const MOOD = {
  mood_quiet: "조용한 곳",
  mood_any: "상관없어요",
  mood_lively: "활기찬 곳",
};

export const RANK = {
  rank_associate: "사원·어소시에이트",
  rank_senior: "선임",
  rank_manager: "매니저",
  rank_director: "디렉터",
  rank_partner: "파트너·임원",
};

// 알레르기·식이 제한에서 "해당 없어요"를 뜻하는 칩 값
export const NONE = "none";
