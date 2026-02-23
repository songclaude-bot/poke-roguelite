# 2-4. 경험치 + 레벨업 시스템

## 목표
적 처치 시 EXP 획득, 레벨업 시 스탯 상승, 층 간 레벨/스탯 유지.

## 구현 내용

### EXP 획득 공식
```
expFromEnemy = 10 + enemyLevel × 3 + floor × 5
```
예시:
- B1F Lv3 Zubat: 10 + 9 + 5 = 24 EXP
- B5F Lv7 Geodude: 10 + 21 + 25 = 56 EXP

### 레벨업 필요 EXP
```
expForLevel(n) = 10 + (n - 1) × 5
```
- Lv5→6: 35 EXP
- Lv6→7: 40 EXP
- Lv10→11: 60 EXP

### 레벨업 스탯 상승
- HP: +3~5 (랜덤)
- ATK: 60% 확률로 +1
- DEF: 40% 확률로 +1
- HP는 레벨업 시 증가분만큼 회복 (현재 HP에 추가)

### 레벨업 연출
- 노란색 플래시 (0.6초)
- 로그 메시지: "Level up! Lv.X! HP+Y ATK+Z DEF+W"
- 연속 레벨업 지원 (한 번에 여러 레벨 가능)

### HUD 업데이트
- 기존: `Lv.5  Turn 3`
- 변경: `Lv.5  EXP:24  T3`

### 층 이동 시 유지
scene.restart에 level, atk, def, exp 전달

## 파일 변경

| 파일 | 변경 |
|------|------|
| `src/core/leveling.ts` | **신규** — EXP 계산, 레벨업 처리 |
| `src/scenes/DungeonScene.ts` | EXP 획득, 레벨업 처리, HUD에 EXP 표시 |
