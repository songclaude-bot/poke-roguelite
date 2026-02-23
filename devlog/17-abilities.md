# Phase 9: 패시브 능력(Abilities) 시스템

## 목표
각 포켓몬 종에게 고유 패시브 능력을 부여하여 전투 다양성 증가.

## 구현 내용

### 능력 목록 (12종)
| 능력 | 보유 포켓몬 | 효과 |
|------|------------|------|
| Torrent | Mudkip | HP < 33%일 때 Water 기술 +50% |
| Sturdy | Corsola, Magnemite, Aron | 치명타 1회 1HP로 생존 (층당 1회) |
| Rock Head | Geodude | 함정 데미지 면역 |
| Guts | Machop | 상태이상 시 ATK +50% |
| Pure Power | Meditite | ATK 항상 +30% |
| No Guard | — | 모든 공격 100% 명중 |
| Run Away | Pidgey | Warp Trap이 계단 근처로 이동 |
| Shield Dust | Caterpie | 적 스킬 부가효과 면역 |
| Static | Pikachu, Voltorb | 피격 시 30% 마비 부여 |
| Pickup | — | 적 처치 시 10% 아이템 획득 |
| Swift Swim | Shellos | 비 날씨에서 이동 속도 증가 |
| Levitate | Zubat | Ground 타입 함정 면역 |

### 적용 위치
- `getEffectiveAtk()`: Pure Power (+30%), Guts (+50%)
- `checkDeath()`: Sturdy (1HP 생존)
- `checkTraps()`: Rock Head (함정 면역)
- `performBasicAttack()`: Torrent (Water +50%), Static (30% 마비)
- `checkDeath()` 적 처치: Pickup (10% 아이템)

### HUD
- 턴 정보에 현재 능력 이름 표시: `[Torrent]`

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/ability.ts` | **신규** — 12종 능력 정의, 종별 매핑 |
| `src/core/entity.ts` | ability, sturdyUsed 필드 추가, ATK 계산에 능력 반영 |
| `src/scenes/DungeonScene.ts` | 능력 효과 적용 (전투, 함정, 아이템, HUD) |
