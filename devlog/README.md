# 개발 일지 (Development Log)

포켓몬 미스터리 던전 로그라이트 웹게임의 개발 과정을 기록합니다.
에러, 해결 과정, 스크린샷을 모두 포함합니다.

## 목차

- [Phase 1: MVP](#phase-1-mvp)

---

## Phase 1: MVP

### 1-1. 프로젝트 세팅 (Phaser 3 + Vite + TypeScript)
- 날짜: 2026-02-23
- [상세 기록](./01-project-setup.md)

### 1-2. 던전 생성 + DTEF 오토타일링 + 타일맵 렌더링
- 날짜: 2026-02-23
- [상세 기록](./02-dungeon-generation.md)
- 핵심: DTEF MaskCoordinate 룩업 테이블로 47-state 오토타일링 구현

### 1-3. 포켓몬 스프라이트 + 8방향 이동 + 카메라
- 날짜: 2026-02-23
- [상세 기록](./03-sprite-movement.md)
- 핵심: Mudkip PMD 스프라이트, 탭 기반 8방향 타일 이동, 부드러운 카메라 추적

### 1-4. 턴 시스템 + 적 AI + 기본 전투
- 날짜: 2026-02-23
- [상세 기록](./04-turn-system.md)
- 핵심: TurnManager, Zubat 적 스폰, 추적 AI, ATK-DEF/2 전투

### 1-5~6. 타입 상성 + 계단 + 층수 시스템
- 날짜: 2026-02-23
- [상세 기록](./05-type-stairs.md)
- 핵심: 10타입 상성 테이블, B1F~B5F 층수 진행, 적 스케일링, 승리/패배 조건

### 1-7. 해변동굴 완전 플레이 가능 루프
- 날짜: 2026-02-23
- [상세 기록](./06-game-loop.md)
- 핵심: Boot→B1F~B5F→Clear/GameOver→Restart 전체 루프 완성, Phase 1 MVP 완료

## Phase 2: 핵심 시스템

### 2-1. 기술(스킬) 시스템
- 날짜: 2026-02-23
- [상세 기록](./07-skill-system.md)
- 핵심: 4-슬롯 기술, 6종 범위, PP 시스템, 상태효과, 적 AI 스킬 사용

### 2-2. 아이템 시스템
- 날짜: 2026-02-23
- [상세 기록](./08-item-system.md)
- 핵심: 9종 아이템(열매/씨앗/오브), 바닥 드롭, 가방 UI, Revive Seed 자동발동

### 2-3. 다양한 적 포켓몬
- 날짜: 2026-02-23
- [상세 기록](./09-diverse-enemies.md)
- 핵심: 3종 추가(Shellos/Corsola/Geodude), 층별 등장, 데이터 기반 포켓몬 시스템

### 2-4. 경험치 + 레벨업 시스템
- 날짜: 2026-02-23
- [상세 기록](./10-leveling.md)
- 핵심: 적 처치 EXP, 레벨업 스탯 상승, 노란색 레벨업 연출, 층간 유지

## Phase 3: 메타 진행

### 3-1~4. 세이브 + 허브 마을 + 골드 + 업그레이드
- 날짜: 2026-02-23
- [상세 기록](./11-meta-progression.md)
- 핵심: localStorage 세이브, Pokemon Square 허브, 골드 보상, 5종 영구 업그레이드

## Phase 4: 다중 던전

### 4-1. 3개 던전 + 5종 포켓몬 + 9종 기술
- 날짜: 2026-02-23
- [상세 기록](./12-multi-dungeon.md)
- 핵심: Beach Cave/Thunderwave Cave/Tiny Woods, 던전별 타일셋, 10종 포켓몬

## Phase 5: 폴리시 + 배포

### 5-1~4. 미니맵 + 이펙트 + PWA + 배포
- 날짜: 2026-02-23
- [상세 기록](./13-polish-deploy.md)
- 핵심: 미니맵, 그래픽 HP바, 데미지 팝업, PWA, GitHub Pages 배포
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

## Phase 6: 동료 시스템

### 6-1~4. 리크루트 + 동료 AI + 파티 전투
- 날짜: 2026-02-23
- [상세 기록](./14-recruitment.md)
- 핵심: 적 리크루트, 동료 AI, 최대 2명 파티, 프렌들리파이어 방지

## Phase 7: 보스 + 사운드 + 폴리시

### 7-1~3. 보스 시스템 + 효과음/BGM + 스킬 이펙트 + 버그 수정
- 날짜: 2026-02-23
- [상세 기록](./15-boss-sound-polish.md)
- 핵심: 던전별 보스, 보스 HP바, Web Audio 합성 사운드, 스킬 시각 이펙트, 동료 AI 개선, 입력 마스킹 수정

## Phase 8: 함정 + 배고픔 + Mt. Steel

### 8-1~3. 함정 시스템 + 배고픔 + 4번째 던전
- 날짜: 2026-02-23
- [상세 기록](./16-traps-hunger-mtsteel.md)
- 핵심: 7종 함정, Belly 시스템, Apple/Big Apple, Mt. Steel 던전, Aron/Meditite/Machop, Fighting/Steel 타입

## Phase 9: 패시브 능력

### 9-1. 패시브 능력(Abilities) 시스템
- 날짜: 2026-02-23
- [상세 기록](./17-abilities.md)
- 핵심: 12종 패시브 능력, Torrent/Sturdy/Static/Pickup/Guts/Pure Power 등

## Phase 10: 날씨 + 상점 + Sky Tower

### 10-1~3. 날씨 시스템 + 켈레온 상점 + 5번째 던전
- 날짜: 2026-02-23
- [상세 기록](./18-weather-shop-skytower.md)
- 핵심: Rain/Sandstorm/Hail 날씨, 켈레온 상점, Sky Tower 던전, Ghost/Psychic/Ice 타입, Gastly/Drowzee/Snorunt

## Phase 12-13: 진화 + 새 포켓몬 + Frosty Forest

### 12-13. 진화 시스템 + Charmander/Eevee + 6번째 던전
- 날짜: 2026-02-23
- [상세 기록](./19-evolution-newpokemon-frostyforest.md)
- 핵심: 11종 진화 경로, Charmander/Eevee 스타터, Frosty Forest 10층 던전, Fire 스킬 5종

## Phase 14: 사운드 + Magma Cavern

### 14-1~2. 사운드 시스템 + 7번째 던전
- 날짜: 2026-02-23
- [상세 기록](./20-sound-magmacavern.md)
- 핵심: 던전별 BGM, 20종 SFX 통합, Magma Cavern 12층, Numel/Slugma/Torkoal, Flame Body 능력

## Phase 15: Dark 타입 + Sinister Woods

### 15-1. Dark 타입 + 8번째 던전
- 날짜: 2026-02-24
- [상세 기록](./21-dark-sinisterwoods.md)
- 핵심: Dark 타입 + 5종 스킬, Murkrow/Sableye/Absol, Sinister Woods 14층, D-Pad Wait 버튼

## Phase 16: Grass 타입 + Overgrown Forest

### 16-1. Grass 포켓몬 + 9번째 던전
- 날짜: 2026-02-24
- 핵심: Chikorita/Bellsprout/Shroomish, 5종 Grass 스킬, Overgrown Forest 12층, 4종 진화 경로, 3종 새 스타터

## Phase 17: Poison 강화 + Toxic Swamp

### 17-1. Poison 포켓몬 + 10번째 던전
- 날짜: 2026-02-24
- 핵심: Grimer/Nidoran♂/Tentacool, 5종 Poison 스킬, Toxic Swamp 14층, Poison Sting 강화(40% 독)

## Phase 18: Fairy 타입 + Moonlit Cave

### 18-1. Fairy 타입 + 11번째 던전
- 날짜: 2026-02-24
- 핵심: Fairy 타입 상성(Fighting/Dark/Dragon 2x), Clefairy/Jigglypuff/Ralts, 5종 Fairy 스킬, Moonlit Cave 10층

## Phase 19: Dragon 타입 + Dragon's Lair

### 19-1. Dragon 타입 + 12번째 던전
- 날짜: 2026-02-24
- 핵심: Dragon 타입 상성(Dragon 2x, Fairy 면역), Dratini/Bagon/Gible, 5종 Dragon 스킬, Dragon's Lair 16층, Elder Garchomp 보스(6.0x)

## Phase 20: Destiny Tower

### 20-1. 최종 던전
- 날짜: 2026-02-24
- 핵심: Destiny Tower 20층, 3.5x 난이도, Apex Garchomp 보스(7.0x), 모든 타입 혼합, 15클리어 해금

## Phase 21-22: UI + Poochyena

### 21-22. 스크롤 UI + 추가 콘텐츠
- 날짜: 2026-02-24
- 핵심: 허브 스크롤 가능 던전 리스트, Poochyena 추가, 16종 스타터, 35종+ 포켓몬

## Phase 23: 브라우저 테스트 + 버그 수정

### 23. Hub 스크롤 UI 버그 수정
- 날짜: 2026-02-24
- 핵심: 던전 리스트 스크롤 시 고정 버튼과 겹치는 문제 수정, createFixedButton depth 레이어링

## Phase 24: Steel Fortress

### 24. Steel 포켓몬 + 15번째 던전
- 날짜: 2026-02-24
- 핵심: Beldum/Skarmory, 3종 Steel 스킬(ironHead/flashCannon/bulletPunch), Steel Fortress 14층, Iron Metagross 보스

## Phase 25: TM 시스템

### 25. TM + 신규 아이템
- 날짜: 2026-02-24
- 핵심: 6종 TM(Flamethrower/Thunderbolt/IceBeam/ShadowBall/DragonPulse/Earthquake), Warp Orb, Foe-Hold Orb, Max Elixir

## Phase 26-27: Ground + 스타터 확장

### 26-27. Ground 포켓몬 + Buried Ruins + 스타터
- 날짜: 2026-02-24
- 핵심: Sandshrew/Trapinch/Phanpy, 2종 Ground 스킬(dig/sandTomb), Buried Ruins 12층, Ancient Flygon 보스, 20종 스타터, 스크롤 가능 스타터 선택

---

## 현재 게임 규모 (v0.22.0)
- **18종 타입**: Normal, Water, Fire, Grass, Electric, Flying, Poison, Ground, Rock, Bug, Fighting, Steel, Ghost, Psychic, Ice, Dark, Fairy, Dragon
- **16개 던전**: Beach Cave → Destiny Tower
- **40종+ 포켓몬** (진화 포함 55종+)
- **70종+ 기술**
- **20종 아이템** (6종 TM 포함)
- **20종 스타터** (클리어 수로 해금)
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/
