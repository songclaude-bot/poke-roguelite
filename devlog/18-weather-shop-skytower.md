# Phase 10: 날씨 시스템 + 켈레온 상점 + Sky Tower

## 목표
날씨 시스템으로 전투 다양성 추가, 상점으로 아이템 경제 추가, 5번째 던전으로 콘텐츠 확장.

## 구현 내용

### 날씨 시스템
| 날씨 | 효과 | 등장 던전 |
|------|------|-----------|
| Clear | 효과 없음 | 모든 던전 |
| Rain | Water +50%, Fire -50%, SwiftSwim 활성화 | Beach Cave, Tiny Woods, Sky Tower |
| Sandstorm | Rock/Steel/Ground 면역, 나머지 5 dmg/턴 | Thunderwave, Mt. Steel |
| Hail | Ice 면역, 나머지 5 dmg/턴 | Mt. Steel, Sky Tower |

- 층마다 10~40% 확률로 날씨 변경
- 기본 공격/스킬 모두 날씨 배율 적용
- 턴 종료 시 날씨 칩 데미지 (Sandstorm/Hail)
- 날씨 HUD 표시 (이모지 + 이름 + 설명)

### 켈레온 상점
- 20% 확률로 층에 상점 방 생성 (보스 층 제외)
- 3~5개 아이템 판매, 가격은 아이템별 + 층수 스케일링
- 플레이어가 상점 방에 들어가면 🛒 버튼으로 상점 UI 오픈
- 골드로 아이템 구매 → 가방에 추가
- HUD에 골드 표시

### Sky Tower 던전 (5번째)
| 속성 | 값 |
|------|-----|
| 이름 | Sky Tower |
| 층수 | B1F~B8F |
| 난이도 | 1.8x |
| 적 타입 | Ghost, Psychic, Ice |
| 보스 | Phantom Gastly (4.0x) |
| 해금 | 3회 클리어 |

### 새 포켓몬 (3종)
| 포켓몬 | 타입 | 능력 | 기술 |
|--------|------|------|------|
| Gastly | Ghost/Poison | Levitate | Lick, Night Shade, Hypnosis |
| Drowzee | Psychic | No Guard | Confusion, Hypnosis, Headbutt |
| Snorunt | Ice | Shield Dust | Ice Shard, Ice Beam, Headbutt |

### 새 타입 (3종)
- Ghost: → Ghost×2, Psychic×2, Normal×0
- Psychic: → Fighting×2, Poison×2
- Ice: → Grass×2, Ground×2, Flying×2

### 새 스킬 (8종)
| 스킬 | 타입 | 위력 | 범위 | 효과 |
|------|------|------|------|------|
| Shadow Ball | Ghost | 16 | Front2 | — |
| Lick | Ghost | 8 | Front1 | 30% 마비 |
| Night Shade | Ghost | 12 | FrontLine | — |
| Confusion | Psychic | 12 | Front2 | — |
| Psybeam | Psychic | 16 | FrontLine | — |
| Hypnosis | Psychic | 0 | Front2 | 100% 마비 |
| Ice Beam | Ice | 16 | FrontLine | — |
| Ice Shard | Ice | 10 | Front1 | 100% 명중 |

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/weather.ts` | Sky Tower 날씨 풀 추가 |
| `src/core/shop.ts` | 상점 아이템 생성, 가격, 스폰 확률 |
| `src/core/type-chart.ts` | Ghost/Psychic/Ice 타입 + 상성 추가 |
| `src/core/skill.ts` | 8종 새 스킬 추가 |
| `src/core/pokemon-data.ts` | Gastly/Drowzee/Snorunt 종 추가 |
| `src/core/dungeon-data.ts` | Sky Tower 던전 추가 |
| `src/core/ability.ts` | 새 포켓몬 어빌리티 매핑 |
| `src/scenes/DungeonScene.ts` | 날씨 완성, 상점 UI, 스프라이트 매핑, VFX |
| `src/scenes/BootScene.ts` | v0.10.0 버전 업데이트 |
