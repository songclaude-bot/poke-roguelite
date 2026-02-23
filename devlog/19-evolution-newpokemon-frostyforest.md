# Phase 12-13: 진화 시스템 + 새 포켓몬 + Frosty Forest

## 목표
진화 시스템으로 장기 성장, 새 스타터/포켓몬, 6번째 던전으로 엔드게임 콘텐츠 추가.

## 구현 내용

### 진화 시스템
- 특정 레벨 도달 시 자동 진화
- 진화 시 스탯 보너스 + 새 스킬 학습
- 11종 진화 경로:

| 진화 전 | 진화 후 | 레벨 | 보너스 |
|--------|--------|------|--------|
| Mudkip | Marshtomp | 16 | HP+15, ATK+4, DEF+3, Surf |
| Pikachu | Raichu | 16 | HP+10, ATK+5, DEF+2 |
| Machop | Machoke | 16 | HP+15, ATK+5, DEF+3 |
| Geodude | Graveler | 16 | HP+12, ATK+3, DEF+5 |
| Gastly | Haunter | 16 | HP+8, ATK+6, DEF+2, Shadow Ball |
| Caterpie | Butterfree | 10 | HP+12, ATK+4, DEF+3, Gust |
| Pidgey | Pidgeotto | 14 | HP+10, ATK+4, DEF+3 |
| Aron | Lairon | 16 | HP+15, ATK+4, DEF+6 |
| Drowzee | Hypno | 16 | HP+12, ATK+5, DEF+4, Psybeam |
| Charmander | Charmeleon | 16 | HP+12, ATK+5, DEF+3, Flamethrower |
| Eevee | Espeon | 16 | HP+10, ATK+5, DEF+4, Confusion |

### 새 포켓몬 (2종)
| 포켓몬 | 타입 | 능력 | 기술 | 진화 |
|--------|------|------|------|------|
| Charmander | Fire | Torrent* | Scratch, Ember, Flamethrower, Swords Dance | → Charmeleon Lv.16 |
| Eevee | Normal | Run Away | Tackle, Bite, Swift, Quick Attack | → Espeon Lv.16 |

### 새 스킬 (5종)
| 스킬 | 타입 | 위력 | 범위 | 효과 |
|------|------|------|------|------|
| Ember | Fire | 10 | Front2 | 20% 화상 |
| Flamethrower | Fire | 18 | FrontLine | — |
| Scratch | Normal | 8 | Front1 | — |
| Bite | Normal | 12 | Front1 | — |
| Swift | Normal | 12 | Room | 100% 명중 |

### Frosty Forest 던전 (6번째)
| 속성 | 값 |
|------|-----|
| 이름 | Frosty Forest |
| 층수 | B1F~B10F |
| 난이도 | 2.0x |
| 적 | Snorunt, Shellos, Zubat, Drowzee |
| 보스 | Frost King Snorunt (4.5x) |
| 해금 | 5회 클리어 |
| 날씨 | Hail |

### 스타터 선택 확장
총 10종: Mudkip, Pikachu, Caterpie, Charmander, Geodude, Machop, Magnemite, Eevee, Gastly, Snorunt

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/evolution.ts` | 진화 시스템 + 11종 진화 데이터 |
| `src/core/skill.ts` | 5종 새 스킬 (Ember, Flamethrower, Scratch, Bite, Swift) |
| `src/core/pokemon-data.ts` | Charmander, Eevee 종 + 레벨업 스킬 |
| `src/core/dungeon-data.ts` | Frosty Forest 던전 추가 |
| `src/core/ability.ts` | Charmander, Eevee 어빌리티 매핑 |
| `src/core/weather.ts` | Frosty Forest 날씨 풀 |
| `src/scenes/DungeonScene.ts` | 진화 체크, 스프라이트 매핑 |
| `src/scenes/HubScene.ts` | 스타터 10종, v0.12.0 |
| `src/scenes/BootScene.ts` | v0.12.0 |
