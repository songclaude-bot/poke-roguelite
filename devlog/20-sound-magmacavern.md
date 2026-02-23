# Phase 14: 사운드 시스템 + Magma Cavern

## 목표
Web Audio BGM/SFX 통합, 7번째 던전 추가, 새 포켓몬/스킬.

## 구현 내용

### 사운드 시스템 통합
- 기존 sound-manager.ts를 모든 씬에 통합
- 던전별 고유 BGM 멜로디 (8종)
  - Beach Cave: 잔잔한 C장조 (triangle)
  - Thunderwave Cave: 경쾌한 전자 (square)
  - Tiny Woods: 목가적 (triangle)
  - Mt. Steel: 무거운 (sawtooth)
  - Sky Tower: 신비로운 (triangle)
  - Frosty Forest: 차가운 (sine)
  - Magma Cavern: 공격적 (sawtooth)
  - Hub: 평화로운 마을 (triangle)
- SFX 연결:
  - sfxHit/sfxSuperEffective/sfxNotEffective: 기본공격 상성별
  - sfxSkill: 스킬 사용
  - sfxPickup: 아이템 획득
  - sfxHeal: 회복 아이템 사용
  - sfxLevelUp: 레벨업
  - sfxEvolution: 진화
  - sfxRecruit: 동료 영입
  - sfxStairs: 계단 이동
  - sfxDeath: 기절
  - sfxBossDefeat: 보스 격파
  - sfxTrap: 함정 밟기
  - sfxVictory: 던전 클리어
  - sfxGameOver: 게임 오버
  - sfxMenuOpen/Close: 메뉴 열기/닫기
  - sfxShop: 상점 열기

### Magma Cavern (7번째 던전)
| 속성 | 값 |
|------|-----|
| 이름 | Magma Cavern |
| 층수 | B1F~B12F |
| 난이도 | 2.2x |
| 적 | Numel, Slugma, Torkoal, Geodude, Aron |
| 보스 | Volcanic Torkoal (5.0x) |
| 해금 | 7회 클리어 |
| 날씨 | Sandstorm |

### 새 포켓몬 (3종)
| 포켓몬 | 타입 | 능력 | 기술 |
|--------|------|------|------|
| Numel | Fire/Ground | Rock Head | Ember, Mud Shot, Body Slam |
| Slugma | Fire | Flame Body | Ember, Rock Throw, Body Slam |
| Torkoal | Fire | Sturdy | Flamethrower, Body Slam, Iron Defense |

### 새 능력: Flame Body
- 30% 확률로 접촉한 공격자에게 화상 부여
- Slugma에 배정

### 새 스킬 (5종)
| 스킬 | 타입 | 위력 | 범위 | 효과 |
|------|------|------|------|------|
| Mud Shot | Ground | 12 | Front2 | — |
| Earth Power | Ground | 18 | Around | — |
| Fire Blast | Fire | 22 | Front2 | 30% 화상 |
| Lava Plume | Fire | 16 | Around | 30% 화상 |
| Body Slam | Normal | 16 | Front1 | 30% 마비 |

### 진화 (2종 추가)
| 진화 전 | 진화 후 | 레벨 | 보너스 |
|--------|--------|------|--------|
| Slugma | Magcargo | 16 | HP+15, ATK+4, DEF+6, Lava Plume |
| Numel | Camerupt | 16 | HP+15, ATK+5, DEF+4, Earth Power |

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/sound-manager.ts` | 던전별 BGM + sfxEvolution/sfxTrap/sfxVictory/sfxGameOver/sfxShop |
| `src/core/skill.ts` | 5종 새 스킬, 중복 제거 |
| `src/core/pokemon-data.ts` | Numel, Slugma, Torkoal 3종 |
| `src/core/dungeon-data.ts` | Magma Cavern 던전 |
| `src/core/ability.ts` | FlameBody 능력 + 매핑 |
| `src/core/evolution.ts` | Slugma, Numel 진화 |
| `src/core/weather.ts` | Magma Cavern 날씨 풀 |
| `src/scenes/DungeonScene.ts` | 사운드 통합, FlameBody 구현, 스프라이트 매핑 |
| `src/scenes/HubScene.ts` | Hub BGM, stopBgm, v0.14.0 |
| `src/scenes/BootScene.ts` | initAudio, v0.14.0 |
| `public/sprites/0322/` | Numel 스프라이트 |
| `public/sprites/0218/` | Slugma 스프라이트 |
| `public/sprites/0324/` | Torkoal 스프라이트 |
