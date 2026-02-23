# 1-7. 해변동굴 완전 플레이 가능 루프

## 목표
Beach Cave B1F~B5F 전체 게임 루프 완성: 시작 → 전투 → 계단 → 클리어/게임오버 → 재시작.

## 게임 루프

```
Boot Screen
  │ (Tap to Start)
  ▼
DungeonScene B1F
  │ ← 이동 + 전투 (턴 기반)
  │ ← HP 지속
  ▼ (계단 밟기)
DungeonScene B2F
  │ ← 적 스탯 ×1.25
  ▼
  ... (B3F ×1.5, B4F ×1.75)
  ▼
DungeonScene B5F
  │ ← 적 스탯 ×2.0
  ▼ (계단 밟기)
DUNGEON CLEAR!
  │ (Tap to restart)
  ▼
DungeonScene B1F (처음부터)
```

### 패배 루트
```
DungeonScene B?F
  │ ← HP 0
  ▼
GAME OVER
  │ (Tap to retry)
  ▼
DungeonScene B1F (처음부터)
```

## 밸런스 요약

| 층 | 적 HP | 적 ATK | 적 DEF | 적 Lv |
|----|--------|--------|--------|-------|
| B1F | 20 | 8 | 3 | 3 |
| B2F | 25 | 10 | 3 | 4 |
| B3F | 30 | 12 | 4 | 5 |
| B4F | 35 | 14 | 5 | 6 |
| B5F | 40 | 16 | 6 | 7 |

**플레이어**: HP 50, ATK 12, DEF 6, Lv.5

**데미지 계산** (ATK - DEF/2, min 1):
- Player → B1F Zubat: 12 - 1 = 11 → 2턴킬
- Player → B5F Zubat: 12 - 3 = 9 → 5턴킬
- B1F Zubat → Player: 8 - 3 = 5 데미지
- B5F Zubat → Player: 16 - 3 = 13 데미지

**생존 가능성**: 플레이어 HP 50으로 B1F~B5F 전체를 돌파하려면 전투를 최소화하고 계단을 빠르게 찾아야 함. 후반 층은 매우 위험.

## 코드 정리
- BootScene.ts: 미사용 import (DungeonScene, COLORS) 제거

## Phase 1 MVP 완료
Phase 1의 모든 하위 작업이 완료됨:
- [x] 1-1: 프로젝트 세팅
- [x] 1-2: 던전 생성 + 오토타일링
- [x] 1-3: 스프라이트 + 이동 + 카메라
- [x] 1-4: 턴 시스템 + 적 AI + 전투
- [x] 1-5~6: 타입 상성 + 계단 + 층수
- [x] 1-7: 전체 게임 루프 완성
