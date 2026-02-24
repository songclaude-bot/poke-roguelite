# Poke Roguelite — 개발 룰 & 규칙

## 에이전트 구분
- **이 저장소는 1호기(로그라이트)의 프로젝트입니다**
- 1호기: 포켓몬 미스터리 던전 로그라이트 (`songclaude-bot/poke-roguelite`)
- 2호기: 뱀서류 게임 (별도 저장소) — **이 저장소를 수정하지 말 것**

## 프로젝트 개요
- 비상업적 팬메이드 포켓몬 미스터리 던전 로그라이트 웹게임
- 모바일 세로(360×640), Phaser 3 + rot.js + TypeScript + Vite
- GitHub repo: `songclaude-bot/poke-roguelite`
- Dev server: port 3001

## 절대 규칙

### 리소스 출처
- **자체 제작 금지**: 사운드(SFX/BGM), 이펙트 스프라이트 등을 직접 합성하거나 생성하지 않는다
- **PokeAutoChess 리소스 사용**: pokemonAutoChess 프로젝트에서 사용하는 에셋(스프라이트, SFX, BGM)을 참조/활용한다
- **포켓몬 스프라이트**: PMDCollab 스프라이트 (Walk-Anim.png, Idle-Anim.png) — 이건 기존 그대로
- **타일셋**: DTEF 형식 — 이미 사용 중

### 배포 규칙
- **퍼블릭 공개 금지 (미완성 상태)**: 다 만들고 → 탬플릿 설명페이지 만들고 → 거기서 연동하는 순서
- 현재 이미 퍼블릭 상태이므로 내릴 필요는 없지만, 앞으로 마음대로 공개하지 않는다
- songclaude-bot.github.io 허브에 별 추가는 최종 완성 후

### GitHub
- repo 삭제 절대 금지
- git user: songclaude-bot
- credential: ~/.git-credentials (store)

## UI/UX 규칙

### 컨트롤 레이아웃
- **좌측 하단**: 가상 8방향 패드 (D-Pad)
- **우측 하단**: 4개 기술 버튼
- 기술 방향 = 플레이어가 바라보는 방향 (패드로 방향 조작 후 기술 사용)
- **가방/저장 등**: 아이콘 버튼으로 깔끔하게 스타일링 (텍스트 [가방] 형태 X)

### 로그 표시
- 로그 텍스트에 반드시 반투명 배경 박스를 넣어서 가독성 확보

### 포스트 클리어 컨텐츠
- 마을에 스타터 포켓몬 교체 기능 필요
- 해금 시스템 (던전 클리어 → 새 포켓몬/던전 해금)
- 업그레이드 외에도 마을에서 할 수 있는 것들

## 동료 AI 규칙
- **길 막힘 방지**: 동료가 플레이어 경로를 막으면 반드시 비켜야 함
- **올바른 길찾기**: A* 또는 BFS 기반 경로 탐색
- **유한상태머신(FSM)**: Follow → Chase → Attack → Evade 등 상태 기반 행동
- 리쉬 범위 밖이면 무조건 플레이어에게 복귀

## 기술적 참고
- t3.micro EC2 (914MB RAM) — Playwright/Chrome 동시 실행 시 메모리 부족 주의
- `npx tsc` 대신 `node node_modules/.bin/tsc --noEmit` 사용
- package-lock.json은 커밋해야 함 (CI용)
