# CLAUDE.md

## 프로젝트
어디서 모여? (where2meet): 참여자 프로필(못 먹는 것, 음식 취향, 술·분위기)을 모아 모임에 맞는 식당을 추천하는 사내 도구.

## 참고 문서
- 디자인 가이드: `docs/design.md` (토큰, 컴포넌트, 5페이지 화면 구성, 문구·용어 원칙)
- 디자인 토큰: `docs/design_tokens.txt` (색·글꼴·간격·컴포넌트 값)
- 데이터·추천 로직: `docs/data_spec.md` (필드, 코드값, 추천 계산 방식)
- 샘플 데이터: `docs/data/members.json`, `docs/data/restaurants.json`, `docs/data/guests.json`(비회원, 비어 있음), `docs/data/reviews.json`(후기, 비어 있음)
- 화면 목업: `docs/mockups/V1_시작하기.png` ~ `V5_사람기록.png`

## 구조
- `index.html` 첫 화면 (저장소 맨 바깥)
- `src/` JS·CSS 소스
- `public/` 이미지 등 정적 파일

## 작업 방식
- 브랜치를 만들지 말고 `main`에서만 작업할 것
- 작업 전 `git pull`로 최신 내용을 받고, 끝나면 커밋 후 `git push`할 것
- React 등 프레임워크 없이 바닐라 HTML·CSS·JS로 만들 것 (빌드 도구 없이 `index.html`을 바로 열어 동작해야 함)
- 로그인(GitHub 인증 등)이 필요하면 사용자에게 단계별로 안내할 것

## 규칙
- 새 화면이나 기능을 구현하기 전에 `docs/design.md`, `docs/data_spec.md`, 해당 목업을 먼저 확인할 것
- 데이터 필드, 코드값(`food_*`, `allergy_*`, `diet_*`, `drink_*`, `mood_*`), 추천 계산은 `docs/data_spec.md`를 기준으로 할 것
- 색·글꼴·간격 값은 하드코딩하지 말고 `docs/design_tokens.txt`의 토큰을 쓸 것
- 화면 문구와 용어는 `docs/design.md` 6장(톤 & 매너)을 따를 것
- 못 먹는 것(알레르기·식단)은 추천에서 반드시 제외하고, 누가 못 먹는지는 화면에 드러내지 않을 것
