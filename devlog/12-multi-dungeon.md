# Phase 4: 다중 던전 시스템

## 목표
3개 던전(Beach Cave, Thunderwave Cave, Tiny Woods), 던전별 타일셋/적/난이도, 허브에서 선택.

## 구현 내용

### dungeon-data.ts (신규)
- `DungeonDef` 인터페이스: id, name, tileset, floors, enemies, difficulty, unlock
- 3개 던전 정의:

| 던전 | 층수 | 난이도 | 적 | 해금 |
|------|------|--------|-----|------|
| Beach Cave | B1~B5F | 1.0x | Zubat/Shellos/Corsola/Geodude | 기본 |
| Tiny Woods | B1~B4F | 0.8x | Caterpie/Pidgey | 기본 |
| Thunderwave Cave | B1~B6F | 1.3x | Voltorb/Magnemite/Pikachu | 1 클리어 |

### 신규 포켓몬 (5종)
| 포켓몬 | 타입 | 던전 | 기술 |
|--------|------|------|------|
| Pikachu | Electric | Thunderwave | Spark, ThunderShock, Quick Attack |
| Voltorb | Electric | Thunderwave | Tackle, SonicBoom, Selfdestruct |
| Magnemite | Electric | Thunderwave | ThunderShock, Thunder Wave, Tackle |
| Caterpie | Bug | Tiny Woods | Tackle, String Shot, Bug Bite |
| Pidgey | Normal/Flying | Tiny Woods | Gust, Quick Attack, Tackle |

### 신규 기술 (9종)
- ThunderShock (Electric/FrontLine/10pow), Spark (Electric/Front1/14pow)
- Thunder Wave (Electric/Front2/Paralyze), SonicBoom (Normal/FrontLine/10pow)
- Selfdestruct (Normal/Around/30pow/3pp), String Shot (Bug/Front2/Paralyze)
- Bug Bite (Bug/Front1/10pow), Gust (Flying/Front2/10pow)
- Quick Attack (Normal/Front1/8pow/100acc)

### 신규 타일셋
- `ThunderwaveCave/tileset_0.png` (432×192)
- `TinyWoods/tileset_0.png` (432×192)

### DungeonScene 리팩토링
- `dungeonDef` 필드 추가 — 모든 하드코딩을 데이터 기반으로 전환
- 타일셋/적/아이템/층수/난이도를 dungeonDef에서 가져옴
- HUD에 던전 이름 표시
- 세이브에 dungeonId 포함

### HubScene 리팩토링
- 던전 목록을 동적 생성 (잠금/해금 표시)
- 던전별 진입 시 dungeonId 전달
- 세이브 이어하기 시 dungeonId 포함

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/dungeon-data.ts` | **신규** — 던전 정의 |
| `src/core/pokemon-data.ts` | 5종 포켓몬 추가 |
| `src/core/skill.ts` | 9종 기술 추가 |
| `src/scenes/DungeonScene.ts` | dungeon-data 기반 리팩토링 |
| `src/scenes/HubScene.ts` | 다중 던전 선택 UI |
| `public/tilesets/ThunderwaveCave/` | **신규** — 타일셋 |
| `public/tilesets/TinyWoods/` | **신규** — 타일셋 |
| `public/sprites/0025/` | **신규** — Pikachu 스프라이트 |
| `public/sprites/0100/` | **신규** — Voltorb 스프라이트 |
| `public/sprites/0081/` | **신규** — Magnemite 스프라이트 |
| `public/sprites/0010/` | **신규** — Caterpie 스프라이트 |
| `public/sprites/0016/` | **신규** — Pidgey 스프라이트 |
