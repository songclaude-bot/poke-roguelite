# Poke Roguelite — Pokemon Mystery Dungeon Web Game

> **비상업적 팬메이드 프로젝트** | [Play Now](https://songclaude-bot.github.io/poke-roguelite/)

Pokemon Mystery Dungeon 시리즈에서 영감을 받은 턴제 로그라이트 웹 게임입니다.
모바일 세로모드(360×640)에 최적화, 터치 & 마우스로 플레이합니다.

---

## 게임 규모 (v5.4.0)

| 항목 | 수치 |
|------|------|
| 포켓몬 | 540종+ (스프라이트 애니메이션 포함) |
| 스킬 | 465종 (타입별 기술 + 상태이상) |
| 스타터 | 421종 선택 가능 |
| 던전 | 217개 (18타입 × 12티어 + 특수 던전) |
| 아이템 | 24종 소비 + 13종 지닌 아이템 + 12종 합성 레시피 |
| 파티 | 최대 1(플레이어) + 4(동료) |

---

## 핵심 시스템

### 전투 & 이동

| 시스템 | 설명 |
|--------|------|
| **턴제 전투** | 이동/공격/스킬이 1턴 소비. 플레이어 → 동료 → 적 순서 |
| **8방향 D-Pad** | 화면 하단 방향 패드로 8방향 이동 (좌/우 배치 전환 가능) |
| **4슬롯 스킬** | PP 소모, 이동 시 PP 1 회복. 스킬 프리뷰 + 범위 하이라이트 |
| **타입 상성** | 18타입 풀 상성 테이블. 효과적 1.5×, 반감 0.5× |
| **스킬 콤보** | 특정 기술 연속 사용 시 보너스 효과 (2× 데미지, 확정 크리 등) |
| **상태이상** | 독/마비/수면/화상/빙결/혼란/저주 — HUD 아이콘 + 지속턴 표시 |

### 던전 시스템

| 시스템 | 설명 |
|--------|------|
| **날씨** | 비/모래폭풍/우박/맑음 등 — 타입별 데미지 보정 + 시각 이펙트 |
| **배고픔** | 벨리 게이지. 0이 되면 턴당 HP 감소. 음식 아이템으로 회복 |
| **함정** | 가시/스텔스록/전기마비/텔레포트 등 8종. 발견 전 보이지 않음 |
| **몬스터 하우스** | Standard/Treasure/Ambush 3종. 방 진입 시 대량 적 출현 |
| **퍼즐 룸** | 5종 퍼즐 — 해결 시 보상 (골드, EXP, 아이템) |
| **비밀 방** | 벽 반짝임 → 발견 시 특수 보상 + 워프 허브 |
| **이벤트 룸** | NPC 조우, 아이템 선물, 스토리 이벤트 10종 |
| **제단** | 축복/저주 부여. 능력 강화 or 디버프 |
| **상점** | 켈리몬 상점 — 아이템 구매/판매. 훔치면 추적당함! |

### 진행 & 메타

| 시스템 | 설명 |
|--------|------|
| **영구 업그레이드** | HP/ATK/DEF/가방/벨리/리크루트율/시작아이템 (골드 구매) |
| **지닌 아이템** | 13종 패시브 장비 + 인챈트 (일반~전설 4등급) |
| **제련소** | 지닌 아이템 강화 (골드 투자, 레벨업) |
| **기술 교관** | 스타터 기술 교체 & 새 기술 학습 |
| **능력 도장** | 고유 능력 5단계 업그레이드 |
| **합성** | 아이템 조합으로 상위 아이템 생성 + 등급 합성 |
| **탤런트 트리** | 공격/방어/유틸/탐험 4분야 영구 보너스 |
| **NG+** | 클리어 횟수 기반 강화 회차 시스템 |
| **패시브 수입** | 오프라인 시간 기반 골드 축적 |

---

## 던전 구성

### 12단계 티어 시스템

| 티어 | 이름 | 층수 | 난이도 | 보상 배율 |
|------|------|------|--------|-----------|
| T1 | Beginner | 4~5F | 1.0 | 1× |
| T2 | Novice | 5~6F | 1.5 | 2× |
| T3 | Intermediate | 6~8F | 2.0 | 3× |
| T4 | Advanced | 8~10F | 2.5 | 5× |
| T5 | Expert | 10~12F | 3.0 | 7× |
| T6 | Master | 12~15F | 3.5 | 10× |
| T7 | Champion | 15~18F | 4.5 | 12× |
| T8 | Elite | 18~20F | 5.0 | 15× |
| T9 | Legendary | 20~25F | 5.5 | 18× |
| T10 | Mythical | 25~28F | 6.0 | 20× |
| T11 | GodLike | 28~32F | 7.0 | 25× |
| T12 | FINAL | 35F | 8.0 | 60× |

각 티어에 18타입 던전이 있어 **총 216개 + 특수 던전**.

### 특수 던전

| 던전 | 해금 조건 | 설명 |
|------|-----------|------|
| **Daily Dungeon** | 5클리어 | 매일 시드가 바뀌는 일일 던전. 리더보드 경쟁 |
| **Endless Abyss** | 10클리어 | 무한 층수. 얼마나 깊이 갈 수 있는지 도전 |
| **Boss Rush** | 30클리어 | 10연속 보스전. 강화 보스만 등장 |
| **Destiny Tower** | 50클리어 | 최고난도 특수 던전 |

### 챌린지 모드 (5클리어 해금)

| 모드 | 제한 | 보상 배율 |
|------|------|-----------|
| **Speedrun** | 제한 턴 내 클리어 | 골드 2× |
| **No Items** | 아이템 사용 불가 | 골드 1.5× |
| **Solo** | 동료 리크루트 불가 | 골드 1.5× |

### 난이도 (4단계)

| 난이도 | 특징 |
|--------|------|
| **Easy** | 적 약화, 아이템 증가, 경험치 1.5× |
| **Normal** | 기본값 |
| **Hard** | 적 강화, 아이템 감소, 함정 증가 |
| **Nightmare** | 극한 난이도. 리더보드 별도 표기 |

---

## 화면별 가이드

### Boot Screen (시작 화면)
- 타이틀 표시 + "Tap to Start"
- 세이브 데이터 있으면 "Saved run found!" 표시
- 탭 시 오디오 초기화 후 HubScene으로 전환

### Hub — Pokemon Square (메인 허브)

하단 네비게이션 4탭 구조:

#### Home 탭
- **스타터 카드**: 현재 스타터 스프라이트(애니메이션) + 이름/타입/기본스탯
- **Change**: 421종 중 스타터 변경
- **Presets**: 파티 프리셋 저장/불러오기 (최대 5개)
- **골드 & 통계**: 보유 골드, 수입률(/hr), 총 런/클리어/최고층
- **Town NPCs**: 6명의 NPC 스프라이트 (대화 가능)
- **Quick Actions**: 이어하기, 빠른 재입장, 던전 입장
- **Settings / Help**: 설정 & 도움말 바로가기

#### Dungeon 탭
- **진행도**: 전체 던전 클리어 현황
- **특수 던전**: Daily / Endless / Boss Rush (조건부 해금)
- **챌린지 모드**: Speedrun / No Items / Solo
- **티어 리스트**: 12티어 스크롤 가능 목록, 각 던전 잠금/클리어 상태

#### Prepare 탭
- **업그레이드 상점**: 7종 영구 스탯 업그레이드
- **지닌 아이템**: 장비 구매/장착/인챈트
- **제련소**: 장비 레벨 강화
- **기술 교관**: 스킬셋 커스터마이즈
- **능력 도장**: 능력 업그레이드
- **아이템 제작**: 합성 & 등급 업그레이드
- **탤런트 트리**: 영구 보너스 투자

#### Info 탭
- **포켓덱스**: 540종+ 도감 (필터: 전체/발견/사용)
- **기록 & 업적**: 통계 대시보드 + 21개 업적
- **퀘스트 보드**: 일일 3개 + 챌린지 퀘스트
- **명예의 전당**: 리더보드 (던전별/전체/최근)
- **던전 일지**: 탐험 기록 & 도전 통계

### Dungeon Preview (던전 프리뷰)
- 던전 정보: 이름, 층수, 난이도 별점, 타입
- 등장 포켓몬 목록 & 보스 정보 (위험도 게이지)
- 내 팀 정보: 스타터 스탯, 능력, 지닌 아이템
- 날씨 예보 (층별)
- Enter Dungeon / Back 버튼

### In-Dungeon (던전 플레이)

**HUD 요소:**
- 상단 좌: HP바 + 포트레이트, 층수(BxF), 턴 수, 타이머
- 상단 우: 미니맵 (안개/적/아이템 표시) + MAP 전체보기 버튼
- 하단 좌: 8방향 D-Pad
- 하단 우: 스킬 4버튼 (이름/PP 표시) + Pickup/QuickSlot/Team 버튼
- 중앙 하단: 전투 로그 패널
- 상태 아이콘: 독/마비/수면 등 + 남은 턴 수

**인게임 메뉴 (햄버거):**
- 가방 (아이템 사용/버리기)
- 팀 관리 (동료 커맨드)
- 오토 탐색 (BFS 자동 이동)
- 세이브
- D-Pad 좌/우 전환
- 설정

**게임오버 화면:**
- 사망 층수, 수집 골드, 플레이 시간
- 성적 등급 (S/A/B/C/D)
- 스코어 체인 보너스
- Return to Town / Quick Retry 버튼

**던전 클리어 화면:**
- 클리어 축하, 보상 골드, 시간
- 성적 등급 + 스코어
- 아이템 회수 요약
- Return to Town 버튼

### Settings (설정)
- 난이도 선택 (Easy/Normal/Hard/Nightmare) + 모디파이어 표시
- BGM / SFX ON/OFF
- 진행 초기화 (확인 모달)

### Other Scenes
- **Upgrade Shop**: 7종 영구 업그레이드 (레벨/맥스/비용 표시)
- **Held Items**: 장비 구매/장착 + 인챈트 적용
- **Forge**: 장비 레벨업 (별점 표시, 보너스 %)
- **Move Tutor**: 기술 목록 스크롤, 비용 확인 후 학습
- **Ability Dojo**: 능력 5단계 별점 + 업그레이드
- **Crafting**: 레시피 탭 + 합성 탭
- **Talent Tree**: 공격/방어/유틸/탐험 4분야 그리드
- **Pokedex**: 가상 스크롤 540종+ 목록, 상세 패널
- **Achievements**: 업적 탭 + 통계 탭 (7카테고리)
- **Quest Board**: 일일 / 챌린지 탭, 뱃지 카운트, 보상 수령
- **Leaderboard**: 던전별 / 전체 / 최근 탭
- **Journal**: 던전별 탐험 기록 카드
- **Help**: 12섹션 게임 가이드

---

## 아키텍처

```
src/
├── config.ts                # 게임 설정 (360×640, 타일 48px)
├── main.ts                  # Phaser 인스턴스 + 18개 씬 등록
│
├── scenes/                  # 18개 씬
│   ├── BootScene.ts             # 타이틀 (47줄)
│   ├── HubScene.ts              # 메인 허브 4탭 (1,801줄)
│   ├── DungeonScene.ts          # 메인 게임플레이 (5,392줄)
│   ├── DungeonPreviewScene.ts   # 던전 프리뷰 (572줄)
│   ├── UpgradeScene.ts          # 업그레이드 상점
│   ├── HeldItemScene.ts         # 지닌 아이템
│   ├── ForgeScene.ts            # 제련소
│   ├── MoveTutorScene.ts        # 기술 교관
│   ├── AbilityUpgradeScene.ts   # 능력 도장
│   ├── CraftingScene.ts         # 합성/제작
│   ├── TalentTreeScene.ts       # 탤런트 트리
│   ├── AchievementScene.ts      # 업적 & 통계
│   ├── PokedexScene.ts          # 포켓덱스
│   ├── QuestBoardScene.ts       # 퀘스트 보드
│   ├── LeaderboardScene.ts      # 리더보드
│   ├── JournalScene.ts          # 던전 일지
│   ├── SettingsScene.ts         # 설정
│   └── HelpScene.ts             # 도움말
│
├── systems/                 # 15개 추출 시스템 (Host Interface 패턴)
│   ├── combat-system.ts         # 전투 계산, 스킬 실행
│   ├── death-rescue-system.ts   # 사망/구조/클리어/리트라이
│   ├── item-system.ts           # 바닥 아이템, 가방 UI, 아이템 효과
│   ├── minimap-system.ts        # 미니맵, 안개, 탐색률
│   ├── shop-system.ts           # 켈리몬 상점, 도둑질
│   ├── puzzle-system.ts         # 퍼즐 룸 5종
│   ├── secret-room-system.ts    # 비밀 방, 워프 허브
│   ├── monster-house-system.ts  # 몬스터 하우스 3종
│   ├── event-room-system.ts     # 이벤트 룸 10종
│   ├── shrine-system.ts         # 제단 축복/저주
│   ├── trap-hazard-system.ts    # 함정 8종 + 지형 위험
│   ├── weather-belly-system.ts  # 날씨 + 배고픔
│   ├── stairs-system.ts         # 계단 + 층 전환
│   ├── gauntlet-system.ts       # 보스 러시 모드
│   └── auto-explore-system.ts   # BFS 오토 탐색
│
├── core/                    # 60+ 코어 모듈
│   ├── pokemon-data.ts      # 540종+ 포켓몬 정의 (5,507줄)
│   ├── skill.ts             # 465종 스킬 (5,234줄)
│   ├── dungeon-data.ts      # 217개 던전 (5,903줄)
│   ├── dungeon-generator.ts # rot.js 던전 생성
│   ├── entity.ts            # 엔티티 (스탯, 상태, 스킬)
│   ├── turn-manager.ts      # 턴 순서 관리
│   ├── type-chart.ts        # 18타입 상성 테이블
│   ├── enemy-ai.ts          # 적 AI (추적/공격)
│   ├── ally-ai.ts           # 동료 AI (FSM: 추적→공격→회피)
│   ├── save-system.ts       # localStorage 세이브/로드
│   ├── sound-manager.ts     # Web Audio API 합성 사운드
│   ├── held-items.ts        # 13종 지닌 아이템
│   ├── enchantments.ts      # 인챈트 4등급
│   ├── ability.ts           # 능력 정의 + 효과
│   ├── ability-upgrade.ts   # 능력 5단계 업그레이드
│   ├── crafting.ts          # 12종 합성 레시피
│   ├── talent-tree.ts       # 탤런트 트리
│   ├── new-game-plus.ts     # NG+ 시스템
│   ├── achievements.ts      # 21개 업적
│   ├── quests.ts            # 일일/챌린지 퀘스트
│   ├── daily-dungeon.ts     # 일일 던전 시드 생성
│   ├── difficulty-settings.ts # 4단계 난이도
│   ├── weather.ts           # 날씨 효과
│   ├── status-effects.ts    # 상태이상
│   ├── relics.ts            # 유물 아이템
│   ├── blessings.ts         # 축복/저주
│   ├── score-chain.ts       # 스코어 체인
│   ├── run-log.ts           # 런 로그
│   ├── rescue-system.ts     # 구조 시스템
│   ├── legendary-encounters.ts # 전설 포켓몬
│   ├── dungeon-mutations.ts # 층 변이
│   ├── enemy-variants.ts    # 적 변종 (엘리트/섀도우/에인션트)
│   ├── passive-income.ts    # 패시브 수입
│   ├── party-presets.ts     # 파티 프리셋
│   ├── dungeon-journal.ts   # 탐험 기록
│   ├── forge.ts             # 제련소
│   ├── starter-data.ts      # 421종 스타터
│   └── ...                  # + 기타 모듈
│
└── ui/
    └── dom-hud.ts           # DOM 기반 HUD (D-Pad, 스킬 버튼, 로그)
```

### DungeonScene 리팩토링

**Before**: DungeonScene.ts 13,720줄 (God Object)
**After**: 5,392줄 + 15개 시스템 파일 (-60.8%)

**패턴**: Host Interface + System Class
- 각 시스템은 `XXXHost` 인터페이스로 필요한 것만 선언
- DungeonScene이 `this as any`로 host 전달
- `protected get scene()` getter로 Phaser.Scene 접근
- getter 포워딩으로 크로스 시스템 호환

---

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| **Phaser 3** | v3.90.0 | WebGL 게임 엔진 |
| **rot.js** | v2.2.1 | 로그라이크 던전 생성 (ROT.Map.Uniform) |
| **TypeScript** | v5.9.3 | 전체 코드 타입 안전 |
| **Vite** | v7.3.1 | 번들러 + HMR 개발 서버 |
| **Web Audio API** | — | 합성 8비트 효과음 + BGM (외부 파일 불필요) |
| **GitHub Pages** | — | 자동 배포 (GitHub Actions CI/CD) |

---

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

---

## 크레딧

- **Pokemon IP**: The Pokemon Company / Nintendo / Game Freak / Creatures Inc.
- **스프라이트**: [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (CC BY-NC 4.0)
- **타일셋**: PMD 커뮤니티 (DTEF 포맷)
- **게임 엔진**: Phaser 3 (MIT), rot.js (BSD-3)

> 비상업적 팬메이드 프로젝트입니다. 모든 포켓몬 관련 지적재산권은 원 저작권자에게 있습니다.
