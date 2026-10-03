# data_spec.md: 어디서 모여? 데이터·추천 로직

> `design.md`와 같이 쓰는 문서예요. 화면 구성은 `design.md`, 데이터 필드와 추천 계산 방식은 이 문서를 기준으로 해요.
> 모든 데이터는 시연용 가상 데이터예요. 파일 위치는 `docs/data/`예요.

---

## 1. 파일 목록
| 파일 | 내용 | 상태 |
|---|---|---|
| `members.json` | 같이 갈 사람(회원) 프로필 12명 | 데이터 있음 |
| `restaurants.json` | 식당 30곳 | 데이터 있음 |
| `guests.json` | 비회원과 비회원 메모 (⑤) | 비어 있음, 아래 3-3 필드 초안 |
| `reviews.json` | 지난 모임 후기 (④ 펼친 카드, ⑤) | 비어 있음, 아래 3-4 필드 초안 |

---

## 2. 코드값
화면에는 오른쪽 한글 이름만 보여 주고, 데이터와 코드에서는 왼쪽 코드값을 써요.

### 2-1. 음식 `food_*`
| 코드 | 화면 이름 |
|---|---|
| `food_korean_bbq` | 고기구이 |
| `food_korean_stew` | 한식·찌개 |
| `food_japanese` | 일식 |
| `food_chinese` | 중식 |
| `food_western` | 양식 |
| `food_seafood` | 해산물 |
| `food_chicken_pub` | 치킨·호프 |
| `food_asian` | 아시안 |

### 2-2. 못 먹는 것: 알레르기 `allergy_*`
| 코드 | 화면 이름 |
|---|---|
| `allergy_crustacean` | 갑각류 |
| `allergy_mollusk` | 조개·연체류 |
| `allergy_fish` | 생선 |
| `allergy_nut` | 견과류 |
| `allergy_wheat` | 밀 |
| `allergy_egg_dairy` | 달걀·유제품 |

### 2-3. 못 먹는 것: 식단 `diet_*`
| 코드 | 화면 이름 |
|---|---|
| `diet_vegetarian` | 채식 |
| `diet_halal` | 할랄 |

### 2-4. 술 `drink_*`
| 코드 | 화면 이름 (사람) | 화면 이름 (식당) |
|---|---|---|
| `drink_none` | 술 안 마셔요 | 식사 중심 |
| `drink_light` | 가볍게 한두 잔 | 반주 가능 |
| `drink_enjoy` | 술자리 좋아요 | 술자리 중심 |

### 2-5. 분위기 `mood_*`
| 코드 | 화면 이름 |
|---|---|
| `mood_quiet` | 조용한 곳 |
| `mood_lively` | 활기찬 곳 |
| `mood_any` | 상관없어요 |

### 2-6. 직급 `rank_*`
| 코드 | 화면 이름 |
|---|---|
| `rank_associate` | 사원·어소시에이트 |
| `rank_senior` | 선임 |
| `rank_manager` | 매니저 |
| `rank_director` | 디렉터 |
| `rank_partner` | 파트너·임원 |

> 화면 이름은 목업(V1) 문구 기준이에요. 코드에서는 `src/js/labels.js`에 같은 표가 있어요. 바꿀 때는 둘 다 고쳐요.
> 알레르기·식이 제한의 "해당 없어요"는 화면에서만 쓰는 선택지예요. 저장할 때는 빈 배열 `[]`이에요.

---

## 3. 파일별 필드

### 3-1. `members.json`: 같이 갈 사람
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `p01` 형식 |
| `nickname` | string | 화면에 보이는 이름. 실명 대신 닉네임 |
| `is_member` | boolean | `false`면 아직 취향을 입력하지 않은 사람. 화면에서는 "취향 모름"/"미입력" |
| `allergies` | `allergy_*`[] | 못 먹는 것 (알레르기) |
| `diet` | `diet_*`[] | 못 먹는 것 (식단) |
| `likes` | `food_*`[] | 좋아하는 음식 |
| `drink` | `drink_*` \| null | 술. 미입력이면 `null` |
| `mood` | `mood_*` \| null | 분위기. 미입력이면 `null` |

### 3-2. `restaurants.json`: 식당
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `r01` 형식 |
| `name` | string | 식당 이름 |
| `food` | `food_*`[] | 음식 종류 (썸네일의 업종명) |
| `allergens` | `allergy_*`[] | 메뉴 대부분에 들어가 피하기 어려운 재료 |
| `diet_ok` | `diet_*`[] | 대응 가능한 식단 |
| `drink` | `drink_*` | 식당 성격 (식사 중심 / 반주 가능 / 술자리 중심) |
| `mood` | `mood_*` | 분위기 |
| `private_room` | boolean | 룸 있음 |
| `capacity` | number | 최대 인원 |
| `price_per_person` | number | 1인 예상 금액 (원) |

### 3-3. `guests.json`: 비회원 (초안)
⑤ 비회원 메모 카드 기준이에요. 데이터를 채울 때 이 필드로 맞춰 주세요.

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `g01` 형식 |
| `title` | string | 호칭 (예: "상무님"). 실명 쓰지 않음 |
| `relation` | string | 관계 배지: `상사` / `임원` / `거래처` |
| `allergies` | `allergy_*`[] | 아는 범위의 못 먹는 것 |
| `diet` | `diet_*`[] | |
| `likes` | `food_*`[] | 좋아함 |
| `dislikes` | `food_*`[] | 별로 |
| `needs` | string[] | 꼭 필요 (예: "룸", "주차") |
| `memo` | string | 메모 본문. 나만 보기 |
| `history` | `{date, text, from_review_id}`[] | 기록 줄. 후기를 올리면 여기에 추가돼요 |

### 3-4. `reviews.json`: 후기 (초안)
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `v01` 형식 |
| `restaurant_id` | string | `restaurants.json`의 `id` |
| `meeting_title` | string | 모임명 |
| `date` | string | `YYYY-MM-DD` |
| `purpose` | string | 목적 (예: 팀 회식) |
| `with` | string | 동석 (예: 임원 동석) |
| `headcount` | number | 인원 |
| `rating` | number | 별점 1~5 |
| `chips` | string[] | 칩 후기 (예: "룸이 조용해요") |
| `comment` | string | 한마디 |
| `guest_notes` | `{guest_id, text}`[] | "OO님에 대해 알게 된 것" → 해당 비회원 `history`에 추가 |

---

## 4. 추천 로직
②에서 고른 사람과 모임 정보 → ③ 취향 종합 → ④ 추천 3곳 순서로 계산해요.

### 4-1. 취향 종합 (③)
- **취향 입력한 사람**: `is_member: true`인 사람만 집계해요. 나머지는 "취향 모름 n명"으로 따로 보여 줘요.
- **반드시 피할 것**: 고른 사람 전체의 `allergies`, `diet`를 합쳐요. 이름 없이 "갑각류 1명"처럼 인원만 보여 줘요. 스위치로 끌 수 없어요.
- **다 같이 좋아하는 음식**: `food_*`마다 `likes`에 들어 있는 사람 수를 세어 많은 순으로 막대를 그려요.
- **술·분위기**: `drink`, `mood` 비율을 막대로 보여 주고, 가장 많은 값으로 결론 한 줄을 만들어요. (예: "반주 정도의 식사 중심")

### 4-2. 조건 거르기 (꼭 지켜야 하는 것)
아래 중 하나라도 어기면 추천에서 빼요.
1. 식당 `allergens`와 고른 사람들의 `allergies`가 하나라도 겹침
2. 고른 사람 중 `diet`가 있는데 식당 `diet_ok`에 그 식단이 없음
3. `capacity` < 인원
4. `price_per_person`이 예산 범위를 벗어남

남은 식당 수를 ④ "조건을 지키는 곳 n곳"에 보여 줘요.

### 4-3. 점수 (순위 정하기)
남은 식당마다 점수를 매겨 높은 순으로 3곳을 보여 줘요. ③에서 스위치를 끈 항목은 점수에서 빼요.

| 항목 | 계산 | 화면 근거 |
|---|---|---|
| 음식 | 식당 `food`를 좋아하는 사람 수 ÷ 취향 입력한 사람 수 | ✓ "10명 중 7명이 좋아하는 음식" |
| 술 | 식당 `drink`가 결론과 같으면 가점 | ✓ "반주 정도에 맞아요" |
| 분위기 | `mood_any`는 중립, 결론과 같으면 가점, 반대면 감점 | ✓ / ⚠ |
| 룸 | 상사·임원 동석이면 `private_room: true`에 가점 | ✓ "룸 있음" / ⚠ "룸 없음" |

> 가중치(음식 50 · 술 20 · 분위기 15 · 룸 15 등)는 구현하면서 정하고 이 표에 적어 주세요.

### 4-4. 근거 문장 (④ 카드)
- ✓ 맞춘 조건: 점수를 얻은 항목을 문장으로
- ⚠ 확인할 점: 감점 항목, 취향 모름 인원, "알레르기는 예약할 때 한 번 더 확인해 주세요"

---

## 5. 아직 정하지 않은 것
- `members.json`에 **직급(`rank`)·팀** 필드가 없어요. ① 화면은 `rank`를 저장하지만 샘플 데이터에는 아직 없어요. ②의 팀 그룹과 배지, 4-3의 룸 가점에 필요해요.
- `members.json`에 **별로(`dislikes`)** 필드가 없어요. ① 화면은 저장하지만 샘플 데이터에는 아직 없어요. ③ 취향 막대의 "별로 n"에 필요해요.
- 식당의 영업시간·주차·확인일(④ 펼친 카드)과 위치(② "어디서") 필드가 없어요.
