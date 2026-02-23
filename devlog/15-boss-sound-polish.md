# Phase 7: 보스 시스템 + 사운드 + 폴리시

## 7-1. 보스 전투 시스템

### 구현 내용
- `BossDef` 인터페이스로 보스 데이터 정의 (이름, statMultiplier)
- 각 던전 최종 층에 보스 자동 스폰
- 보스는 1.5배 스케일 스프라이트, 빨간 틴트 오라
- 보스 HP바: 화면 상단 고정 UI (붉은 테두리, 체력 비율에 따른 색상 변화)
- 보스 생존 시 계단 사용 불가 ("The stairs are sealed!")
- 보스 처치: 5배 EXP, 50% 추가 골드, 화면 흔들림 + 플래시 연출
- 보스는 리크루트 불가
- 미니맵에 보스를 큰 빨간 점으로 표시

### 보스 목록
| 던전 | 보스 | 배율 |
|------|------|------|
| Beach Cave B5F | Giant Corsola | x2.5 |
| Tiny Woods B4F | Fierce Pidgey | x2.0 |
| Thunderwave Cave B6F | Alpha Pikachu | x3.0 |

## 7-2. 사운드 시스템 (Web Audio API)

### 구현 내용
- `sound-manager.ts` 신규 생성
- 외부 오디오 파일 없이 Web Audio API 오실레이터로 합성 사운드 생성
- 8비트 스타일 효과음: 공격, 슈퍼 이펙티브, 비효과적, 이동, 아이템 줍기, 레벨업, 리크루트, 계단, 사망, 보스 처치, 힐, 스킬 사용, 메뉴 열기/닫기
- BGM: 단순 멜로디 + 베이스 라인 루프 (setInterval 기반 오실레이터 스케줄링)
- 던전 클리어/게임오버 시 BGM 정지
- 첫 터치에서 AudioContext 활성화 (브라우저 정책 준수)

## 7-3. 스킬 시각 이펙트

### 구현 내용
- `showSkillEffect()` 메서드 추가
- 스킬 사용 시 타겟 타일에 타입별 색상 오버레이 + 심볼 표시
- 타입별 색상/심볼: 물(~), 불(*), 전기(⚡), 풀(♣), 비행(>), 독(☠), 바위(◆), 땅(▲), 벌레(●), 노말(✦)
- 0.4초 페이드아웃 애니메이션

## 7-4. 버그 수정

### 입력 마스킹
- 가방(Bag) 열린 상태에서 이동 가능하던 문제 수정
- pointerdown 핸들러에 `this.bagOpen` 체크 추가

### 동료 AI 개선
- 기존: 플레이어에서 멀어져도 적만 쫓아감 → 플레이어와 너무 떨어지는 문제
- 수정: 4단계 우선순위 시스템
  1. 리쉬 (플레이어에서 5칸 이상 → 무조건 플레이어 따라감)
  2. 인접 적 공격
  3. 근처 적 추격 (3칸 이내, 플레이어 근처일 때만)
  4. 플레이어 따라가기 (2칸 이상 떨어졌을 때)
- `findBestDir()` 유틸 함수 분리로 코드 재사용성 향상

---

**파일 변경**:
- `src/core/entity.ts` — `isBoss` 필드 추가
- `src/core/dungeon-data.ts` — `BossDef` 인터페이스, 3개 던전 보스 데이터
- `src/core/ally-ai.ts` — 4단계 우선순위 AI + `findBestDir` 분리
- `src/core/sound-manager.ts` — 신규. Web Audio API 합성 사운드
- `src/scenes/DungeonScene.ts` — 보스 스폰/HP바/처치, 사운드 통합, 스킬 이펙트, 입력 마스킹
- `src/scenes/BootScene.ts` — v0.7.0 버전 표시
- `README.md` — 신규. 전체 게임 소개 문서
