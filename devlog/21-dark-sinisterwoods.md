# Phase 15: Dark 타입 + Sinister Woods

## 목표
Dark 타입 추가, 8번째 던전, 새 포켓몬 3종, D-Pad Wait 버튼.

## 구현 내용

### Dark 타입 추가
- PokemonType.Dark 추가
- 상성: Ghost/Psychic에 2배, Fighting/Dark에 0.5배
- VFX: 보라색 (0x6b21a8), 🌑 심볼

### Dark 스킬 (5종)
| 스킬 | 위력 | 범위 | 특징 |
|------|------|------|------|
| Dark Pulse | 16 | FrontLine | 직선 |
| Feint Attack | 12 | Front1 | 100% 명중 |
| Night Slash | 14 | Front1 | 높은 위력 |
| Snarl | 10 | Around | 전방위 |
| Pursuit | 10 | Front2 | 2칸 |

### 새 포켓몬 (3종)
| 포켓몬 | 타입 | 능력 | 기술 |
|--------|------|------|------|
| Murkrow | Dark/Flying | Run Away | Feint Attack, Pursuit, Wing Attack |
| Sableye | Dark/Ghost | Pickup | Night Slash, Lick, Snarl |
| Absol | Dark | Pure Power | Night Slash, Dark Pulse, Quick Attack |

### Sinister Woods (8번째 던전)
| 속성 | 값 |
|------|-----|
| 층수 | B1F~B14F |
| 난이도 | 2.5x |
| 적 | Murkrow, Sableye, Absol, Gastly, Drowzee |
| 보스 | Shadow Absol (5.5x) |
| 해금 | 8회 클리어 |
| 날씨 | Rain/Hail |
| BGM | 어두운 톤 (sawtooth) |

### D-Pad Wait 버튼
- D-Pad 중앙에 ⏳ Wait 버튼 추가
- 턴 스킵 + PP 회복 + 적 턴 진행

## 파일 변경
| 파일 | 변경 |
|------|------|
| `src/core/type-chart.ts` | Dark 타입 + 상성 |
| `src/core/skill.ts` | 5종 Dark 스킬 |
| `src/core/pokemon-data.ts` | Murkrow, Sableye, Absol 3종 |
| `src/core/dungeon-data.ts` | Sinister Woods 던전 |
| `src/core/ability.ts` | 3종 능력 매핑 |
| `src/core/weather.ts` | Sinister Woods 날씨 풀 |
| `src/core/sound-manager.ts` | Sinister Woods BGM |
| `src/scenes/DungeonScene.ts` | Dark VFX, Wait 버튼, FlameBody |
