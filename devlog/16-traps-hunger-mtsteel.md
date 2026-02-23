# Phase 8: 함정 + 배고픔 + Mt. Steel 던전

## 목표
PMD 핵심 시스템인 함정/배고픔을 추가하고, 4번째 던전을 구현.

## 8-1. 함정(Trap) 시스템

### 구현
- `trap.ts` 신규 생성 — 7종 함정 정의
- 바닥에 숨겨진 상태로 스폰 (투명)
- 플레이어가 밟으면 공개 + 효과 발동 + 제거
- 층수에 비례하여 함정 수 증가 (1 + floor/2, 최대 5개)

### 함정 종류
| 함정 | 심볼 | 효과 |
|------|------|------|
| Spike Trap | ▲ | 15 고정 데미지 |
| Poison Trap | ☠ | 독 상태 부여 |
| Slow Trap | ◎ | 3턴 마비 |
| Warp Trap | ◈ | 랜덤 위치 텔레포트 |
| Spin Trap | ✧ | 혼란(마비) |
| Sticky Trap | ■ | 랜덤 아이템 1개 소실 |
| Hunger Trap | ♨ | 배고픔 20 감소 |

### UI
- 미니맵에 공개된 함정 = 보라색 점
- 함정 발동 시 로그 메시지 표시

## 8-2. 배고픔(Belly) 시스템

### 구현
- 최대 Belly 100, 시작 시 100
- 매 턴(이동/공격) Belly -1
- Belly 20 이하: "Getting hungry..." 경고
- Belly 0: 매 턴 HP -2 (기아 데미지)
- 층간 유지 (advanceFloor에서 전달)

### 새 아이템
| 아이템 | 효과 |
|--------|------|
| Apple | Belly +50 |
| Big Apple | Belly 완전 회복 |

### HUD
- 턴 정보에 Belly 수치 표시
- 30 이하: ⚠ 경고, 0: ☠ 위험 표시

## 8-3. Mt. Steel 던전 + 새 포켓몬

### 새 포켓몬 3종
| 포켓몬 | 타입 | 스킬 |
|--------|------|------|
| Aron | Steel/Rock | Metal Claw, Headbutt, Iron Defense |
| Meditite | Fighting | Karate Chop, Meditate, Tackle |
| Machop | Fighting | Karate Chop, Low Kick, Focus Punch |

### 새 타입 2종
- Fighting: Normal/Rock/Steel에 강함, Flying/Poison/Bug에 약함
- Steel: Rock/Bug에 강함, Fire/Water/Electric에 약함

### 새 스킬 7종
- Karate Chop, Low Kick, Focus Punch, Meditate (Fighting)
- Metal Claw, Iron Defense (Steel)
- Headbutt (Normal)

### Mt. Steel 던전
- B1F~B7F, difficulty 1.5
- Aron → Meditite → Machop 순서로 등장
- 보스: **Champion Machop** (3.5x stats)
- 해금 조건: 2회 클리어

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/trap.ts` | **신규** — 7종 함정, 스폰 로직 |
| `src/core/item.ts` | Apple, Big Apple 추가 |
| `src/core/type-chart.ts` | Fighting, Steel 타입 + 상성 추가 |
| `src/core/skill.ts` | 7종 스킬 추가 |
| `src/core/pokemon-data.ts` | Aron, Meditite, Machop 추가 |
| `src/core/dungeon-data.ts` | Mt. Steel 던전 추가 |
| `src/scenes/DungeonScene.ts` | 함정 스폰/트리거, Belly 시스템, 새 포켓몬 스프라이트 |
| `src/scenes/BootScene.ts` | v0.8.0 업데이트 |
| `public/sprites/0304/` | **신규** — Aron 스프라이트 |
| `public/sprites/0307/` | **신규** — Meditite 스프라이트 |
| `public/sprites/0066/` | **신규** — Machop 스프라이트 |
