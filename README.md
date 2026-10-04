# 어디서 모여? (where2meet)

**사이트:** https://where2meet-pit-stop.vercel.app

회식·모임에 같이 갈 사람들의 프로필(못 먹는 것, 음식 취향, 술·분위기)을 모아서 모두에게 맞는 식당을 추천해 주는 사내 도구.

## 문서
- [디자인 가이드 v3](docs/design.md): 디자인 토큰, 컴포넌트, 5페이지 화면 구성, 문구 원칙
- [디자인 토큰](docs/design_tokens.txt): 컬러, 타이포, 간격, 컴포넌트 값 요약 (Claude Design 첨부용)
- [데이터·추천 로직](docs/data_spec.md): 데이터 필드, 코드값, 추천 계산 방식
- [샘플 데이터](docs/data/): 가상 데이터
  - `members.json`: 회원 120명, 14팀 (Assurance 1~8팀, Tax 1~3팀, Deals 1~3팀. 닉네임, 팀, 직급, 알레르기, 식단, 좋아하는 음식, 술, 분위기)
  - `restaurants.json`: 식당 30곳 (음식 종류, 알레르기 유발 재료, 식단 대응, 룸 여부, 수용 인원, 1인 가격)
  - `guests.json`: 비회원 104명 (사내 백오피스 26명, 고객사 A사~Z사 78명)
  - `reviews.json`: 지난 모임 후기 (아직 비어 있음)
- [화면 목업](docs/mockups/): V1~V5

## 화면 구성 (5페이지)
| # | 페이지 | 목업 |
|---|---|---|
| ① | 시작하기 (가입 + 내 취향) | `V1_시작하기.png` |
| ② | 모임 만들기 | `V2_모임만들기.png` |
| ③ | 취향 종합 | `V3_취향종합.png` |
| ④ | 추천 결과 (상세·확정 포함) | `V4_추천결과.png` |
| ⑤ | 사람·기록 (후기 + 비회원 메모) | `V5_사람기록.png` |

## 폴더 구조
```
where2meet/
├── docs/
│   ├── design.md      # 디자인 가이드 v3
│   ├── design_tokens.txt  # 디자인 토큰
│   ├── data_spec.md   # 데이터·추천 로직
│   ├── data/          # 샘플 데이터 (JSON)
│   └── mockups/       # 화면 목업 V1~V5
├── index.html         # 홈 (첫 화면)
├── start.html         # ① 시작하기 (내 프로필)
├── meeting.html       # ② 모임 만들기
├── src/               # JS·CSS 소스
├── assets/            # 아이콘(icons.svg) 등 정적 파일
├── scripts/serve.py   # 로컬 미리보기 서버 (캐시 끔)
├── CLAUDE.md          # AI 도구용 프로젝트 안내
└── README.md
```

## 기술 스택
바닐라 HTML · CSS · JS (프레임워크·빌드 도구 없음).

내 컴퓨터에서 보기: 저장소 폴더에서 아래 명령을 실행하고 http://localhost:5173 을 열어요. (`index.html`을 더블클릭하면 데이터를 못 읽어요)

```bash
python3 scripts/serve.py
```

배포: `main`에 push하면 Vercel이 자동으로 다시 배포해요. 1분쯤 뒤 https://where2meet-pit-stop.vercel.app 에 반영돼요.

## 화면 진행 상황
| 화면 | 파일 | 상태 |
|---|---|---|
| 홈 | `index.html` | 완료 (식당 둘러보기·후기 남기기·우리 팀 취향 메뉴는 준비 중) |
| ① 시작하기 | `start.html` | 완료 |
| ② 모임 만들기 | `meeting.html` | 완료 |
| ③ 취향 종합 | | 예정 |
| ④ 추천 결과 | | 예정 |
| ⑤ 사람·기록 | | 예정 |

## 같이 작업하는 방법
브랜치는 만들지 않고 모두 `main`에서 작업해요.

### 처음 한 번
1. 저장소 관리자에게 GitHub 초대를 받고, 메일의 초대를 수락해요.
2. 빈 폴더를 만들고 Claude Code에서 그 폴더를 연 다음 이렇게 요청해요.
   > GitHub 저장소 https://github.com/yeongwuu/where2meet 를 이 폴더로 가져와줘. 앞으로 브랜치는 만들지 말고 main에서만 작업해줘. 첫 화면은 index.html로 저장소 맨 바깥에 두고, React와 같은 프레임워크가 아닌 바닐라 JS, HTML로 만들어줘. 로그인이 필요하면 단계별로 안내해줘.

### 매번 작업할 때
1. 시작 전: `git pull` (다른 사람이 올린 내용 받기)
2. 작업
3. 끝나면: 커밋 (Claude Code가 알아서 해요)
4. 확인이 끝나면 Claude에게 "올려줘"라고 해서 push해요. push하면 1분 안에 실제 사이트에 반영돼요.
5. push가 거절되면 `git pull`을 먼저 하고 다시 push해요. 같은 줄을 동시에 고쳤다면 충돌 표시가 생기니 정리한 뒤 올려요.

### 충돌을 줄이려면
- 화면(①~⑤)이나 파일 단위로 담당을 나눠요.
- 작게 자주 커밋하고, 확인이 끝나면 미루지 말고 올려요.
