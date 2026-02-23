# Poke Roguelite — Pokemon Mystery Dungeon Web Game

> **비상업적 팬메이드 프로젝트** | [Play Now](https://songclaude-bot.github.io/poke-roguelite/)

Pokemon Mystery Dungeon 시리즈에서 영감을 받은 턴제 로그라이트 웹 게임입니다.
모바일 세로모드(360x640)에 최적화되어 있으며, 터치로 플레이합니다.

## 게임 소개

해변동굴, 번개파동동굴, 작은숲 — 3개의 던전을 탐험하며
적 포켓몬을 처치하고, 동료로 리크루트하고, 보스를 물리치세요.

### 핵심 시스템

| 시스템 | 설명 |
|--------|------|
| **턴제 전투** | 이동/공격/스킬이 모두 1턴 소비. 플레이어 → 동료 → 적 순서 |
| **8방향 이동** | 터치/탭으로 8방향 타일 이동. 대각선 이동 지원 |
| **4슬롯 스킬** | 포켓몬별 고유 기술 4개. PP 소모, 이동 시 PP 회복 |
| **타입 상성** | 10가지 타입, 2배/0.5배 상성. 물/불/풀/전기/비행/독/땅/바위/벌레/노말 |
| **아이템** | 열매, 씨앗, 오브 9종. 바닥 드롭 & 가방 시스템 |
| **동료 리크루트** | 적 처치 시 확률로 동료 가입 (최대 2명). 동료 AI가 자동 전투 |
| **보스 전투** | 각 던전 최종 층에 보스 등장. 2~3배 스탯, 처치 시 5배 EXP |
| **메타 진행** | 골드 → 영구 업그레이드 (HP/ATK/DEF/시작아이템) |
| **세이브** | localStorage 기반 중간 저장 + 메타 데이터 저장 |

### 던전 목록

| 던전 | 층수 | 적 포켓몬 | 보스 | 난이도 |
|------|------|-----------|------|--------|
| Beach Cave | B1F~B5F | Zubat, Shellos, Corsola, Geodude | Giant Corsola (x2.5) | ★☆☆ |
| Tiny Woods | B1F~B4F | Caterpie, Pidgey | Fierce Pidgey (x2.0) | ★☆☆ |
| Thunderwave Cave | B1F~B6F | Voltorb, Magnemite, Pikachu | Alpha Pikachu (x3.0) | ★★☆ |

### 조작법

- **이동**: 화면 터치/탭 — 캐릭터 기준 8방향
- **기본 공격**: 적이 있는 방향으로 이동 시 자동 공격
- **스킬**: 하단 스킬 버튼 탭 → 방향 탭
- **아이템**: [가방] → 아이템 [Use]
- **줍기**: 아이템 위에서 [줍기] 버튼
- **대기**: [대기] 버튼으로 턴 패스
- **저장**: [저장] 버튼

## 기술 스택

- **Phaser 3** (v3.90.0) — WebGL 게임 엔진
- **rot.js** (v2.2.1) — 던전 생성 (ROT.Map.Uniform)
- **TypeScript** (v5.9.3) — 전체 코드 타입 안전
- **Vite** (v7.3.1) — 번들러 + 개발 서버
- **Web Audio API** — 합성 8비트 효과음 + BGM (외부 파일 불필요)
- **GitHub Pages** — 자동 배포 (GitHub Actions CI/CD)
- **PWA** — 설치형 웹앱 지원

## 아키텍처

```
src/
├── config.ts              # 게임 설정 (해상도, 타일 크기)
├── main.ts                # Phaser 게임 인스턴스 생성
├── core/
│   ├── dungeon-generator.ts  # rot.js 기반 던전 생성
│   ├── autotiler.ts          # DTEF 47-state 오토타일링
│   ├── direction.ts          # 8방향 enum + delta
│   ├── entity.ts             # Entity 인터페이스 + 이동/거리 계산
│   ├── turn-manager.ts       # 턴 실행 큐
│   ├── enemy-ai.ts           # 적 AI (추적, 공격)
│   ├── ally-ai.ts            # 동료 AI (팔로우, 공격, 리크루트)
│   ├── skill.ts              # 스킬 정의 + DB (20종+)
│   ├── skill-targeting.ts    # 스킬 범위 계산 (6종 범위)
│   ├── type-chart.ts         # 10타입 상성 테이블
│   ├── pokemon-data.ts       # 10종 포켓몬 스펙 (스탯, 스프라이트, 스킬)
│   ├── dungeon-data.ts       # 3개 던전 정의 (적, 보스, 타일셋)
│   ├── item.ts               # 9종 아이템 정의 + 드롭 테이블
│   ├── leveling.ts           # EXP 계산 + 레벨업
│   ├── save-system.ts        # localStorage 세이브/로드
│   └── sound-manager.ts      # Web Audio API 합성 효과음/BGM
├── scenes/
│   ├── BootScene.ts          # 타이틀 화면
│   ├── HubScene.ts           # Pokemon Square 허브 마을
│   ├── UpgradeScene.ts       # 영구 업그레이드 상점
│   └── DungeonScene.ts       # 메인 게임 씬 (전투, UI, HUD)
```

### 주요 설계 결정

- **데이터 드리븐**: 포켓몬, 던전, 스킬, 아이템 모두 데이터 정의로 관리. 새 콘텐츠 추가가 쉬움
- **턴 기반 큐**: `TurnManager`가 플레이어/동료/적 행동을 순차 실행
- **프렌들리파이어 방지**: 스킬 타겟팅에서 팀 소속(플레이어+동료 vs 적) 체크
- **동료 직렬화**: 층 전환 시 `AllyData` 인터페이스로 동료 정보를 직렬화/역직렬화
- **합성 사운드**: 외부 오디오 파일 없이 Web Audio API 오실레이터로 8비트 스타일 효과음 생성

## 로컬 실행

```bash
git clone https://github.com/songclaude-bot/poke-roguelite.git
cd poke-roguelite
npm install
npm run dev    # http://localhost:3001
```

## 빌드 & 배포

```bash
npm run build  # dist/ 폴더에 빌드
```

GitHub Actions가 `master` 브랜치 push 시 자동으로 GitHub Pages에 배포합니다.

## 개발 일지

자세한 개발 과정은 [devlog/README.md](./devlog/README.md)를 참조하세요.

## 크레딧

자세한 크레딧은 [CREDITS.md](./CREDITS.md)를 참조하세요.

- **Pokemon IP**: The Pokemon Company / Nintendo / Game Freak / Creatures Inc.
- **스프라이트**: [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (CC BY-NC 4.0)
- **타일셋**: PMD 커뮤니티 (DTEF 포맷)
- **게임 엔진**: Phaser 3 (MIT), rot.js (BSD-3)

> 비상업적 팬메이드 프로젝트입니다. 모든 포켓몬 관련 지적재산권은 원 저작권자에게 있습니다.
