# 개발 일지 (Development Log)

포켓몬 미스터리 던전 로그라이트 웹게임의 개발 과정을 기록합니다.
에러, 해결 과정, 스크린샷을 모두 포함합니다.

## 목차

- [Phase 1: MVP](#phase-1-mvp)

---

## Phase 1: MVP

### 1-1. 프로젝트 세팅 (Phaser 3 + Vite + TypeScript)
- 날짜: 2026-02-23
- [상세 기록](./01-project-setup.md)

### 1-2. 던전 생성 + DTEF 오토타일링 + 타일맵 렌더링
- 날짜: 2026-02-23
- [상세 기록](./02-dungeon-generation.md)
- 핵심: DTEF MaskCoordinate 룩업 테이블로 47-state 오토타일링 구현

### 1-3. 포켓몬 스프라이트 + 8방향 이동 + 카메라
- 날짜: 2026-02-23
- [상세 기록](./03-sprite-movement.md)
- 핵심: Mudkip PMD 스프라이트, 탭 기반 8방향 타일 이동, 부드러운 카메라 추적

### 1-4. 턴 시스템 + 적 AI + 기본 전투
- 날짜: 2026-02-23
- [상세 기록](./04-turn-system.md)
- 핵심: TurnManager, Zubat 적 스폰, 추적 AI, ATK-DEF/2 전투

### 1-5~6. 타입 상성 + 계단 + 층수 시스템
- 날짜: 2026-02-23
- [상세 기록](./05-type-stairs.md)
- 핵심: 10타입 상성 테이블, B1F~B5F 층수 진행, 적 스케일링, 승리/패배 조건

### 1-7. 해변동굴 완전 플레이 가능 루프
- 날짜: 2026-02-23
- [상세 기록](./06-game-loop.md)
- 핵심: Boot→B1F~B5F→Clear/GameOver→Restart 전체 루프 완성, Phase 1 MVP 완료

## Phase 2: 핵심 시스템

### 2-1. 기술(스킬) 시스템
- 날짜: 2026-02-23
- [상세 기록](./07-skill-system.md)
- 핵심: 4-슬롯 기술, 6종 범위, PP 시스템, 상태효과, 적 AI 스킬 사용

### 2-2. 아이템 시스템
- 날짜: 2026-02-23
- [상세 기록](./08-item-system.md)
- 핵심: 9종 아이템(열매/씨앗/오브), 바닥 드롭, 가방 UI, Revive Seed 자동발동

### 2-3. 다양한 적 포켓몬
- 날짜: 2026-02-23
- [상세 기록](./09-diverse-enemies.md)
- 핵심: 3종 추가(Shellos/Corsola/Geodude), 층별 등장, 데이터 기반 포켓몬 시스템

### 2-4. 경험치 + 레벨업 시스템
- 날짜: 2026-02-23
- [상세 기록](./10-leveling.md)
- 핵심: 적 처치 EXP, 레벨업 스탯 상승, 노란색 레벨업 연출, 층간 유지

## Phase 3: 메타 진행

### 3-1~4. 세이브 + 허브 마을 + 골드 + 업그레이드
- 날짜: 2026-02-23
- [상세 기록](./11-meta-progression.md)
- 핵심: localStorage 세이브, Pokemon Square 허브, 골드 보상, 5종 영구 업그레이드

## Phase 4: 다중 던전

### 4-1. 3개 던전 + 5종 포켓몬 + 9종 기술
- 날짜: 2026-02-23
- [상세 기록](./12-multi-dungeon.md)
- 핵심: Beach Cave/Thunderwave Cave/Tiny Woods, 던전별 타일셋, 10종 포켓몬
