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

## Phase 5: 폴리시 + 배포

### 5-1~4. 미니맵 + 이펙트 + PWA + 배포
- 날짜: 2026-02-23
- [상세 기록](./13-polish-deploy.md)
- 핵심: 미니맵, 그래픽 HP바, 데미지 팝업, PWA, GitHub Pages 배포
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

## Phase 6: 동료 시스템

### 6-1~4. 리크루트 + 동료 AI + 파티 전투
- 날짜: 2026-02-23
- [상세 기록](./14-recruitment.md)
- 핵심: 적 리크루트, 동료 AI, 최대 2명 파티, 프렌들리파이어 방지

## Phase 7: 보스 + 사운드 + 폴리시

### 7-1~3. 보스 시스템 + 효과음/BGM + 스킬 이펙트 + 버그 수정
- 날짜: 2026-02-23
- [상세 기록](./15-boss-sound-polish.md)
- 핵심: 던전별 보스, 보스 HP바, Web Audio 합성 사운드, 스킬 시각 이펙트, 동료 AI 개선, 입력 마스킹 수정

## Phase 8: 함정 + 배고픔 + Mt. Steel

### 8-1~3. 함정 시스템 + 배고픔 + 4번째 던전
- 날짜: 2026-02-23
- [상세 기록](./16-traps-hunger-mtsteel.md)
- 핵심: 7종 함정, Belly 시스템, Apple/Big Apple, Mt. Steel 던전, Aron/Meditite/Machop, Fighting/Steel 타입

## Phase 9: 패시브 능력

### 9-1. 패시브 능력(Abilities) 시스템
- 날짜: 2026-02-23
- [상세 기록](./17-abilities.md)
- 핵심: 12종 패시브 능력, Torrent/Sturdy/Static/Pickup/Guts/Pure Power 등

## Phase 10: 날씨 + 상점 + Sky Tower

### 10-1~3. 날씨 시스템 + 켈레온 상점 + 5번째 던전
- 날짜: 2026-02-23
- [상세 기록](./18-weather-shop-skytower.md)
- 핵심: Rain/Sandstorm/Hail 날씨, 켈레온 상점, Sky Tower 던전, Ghost/Psychic/Ice 타입, Gastly/Drowzee/Snorunt

## Phase 12-13: 진화 + 새 포켓몬 + Frosty Forest

### 12-13. 진화 시스템 + Charmander/Eevee + 6번째 던전
- 날짜: 2026-02-23
- [상세 기록](./19-evolution-newpokemon-frostyforest.md)
- 핵심: 11종 진화 경로, Charmander/Eevee 스타터, Frosty Forest 10층 던전, Fire 스킬 5종

## Phase 14: 사운드 + Magma Cavern

### 14-1~2. 사운드 시스템 + 7번째 던전
- 날짜: 2026-02-23
- [상세 기록](./20-sound-magmacavern.md)
- 핵심: 던전별 BGM, 20종 SFX 통합, Magma Cavern 12층, Numel/Slugma/Torkoal, Flame Body 능력

## Phase 15: Dark 타입 + Sinister Woods

### 15-1. Dark 타입 + 8번째 던전
- 날짜: 2026-02-24
- [상세 기록](./21-dark-sinisterwoods.md)
- 핵심: Dark 타입 + 5종 스킬, Murkrow/Sableye/Absol, Sinister Woods 14층, D-Pad Wait 버튼

## Phase 16: Grass 타입 + Overgrown Forest

### 16-1. Grass 포켓몬 + 9번째 던전
- 날짜: 2026-02-24
- 핵심: Chikorita/Bellsprout/Shroomish, 5종 Grass 스킬, Overgrown Forest 12층, 4종 진화 경로, 3종 새 스타터

## Phase 17: Poison 강화 + Toxic Swamp

### 17-1. Poison 포켓몬 + 10번째 던전
- 날짜: 2026-02-24
- 핵심: Grimer/Nidoran♂/Tentacool, 5종 Poison 스킬, Toxic Swamp 14층, Poison Sting 강화(40% 독)

## Phase 18: Fairy 타입 + Moonlit Cave

### 18-1. Fairy 타입 + 11번째 던전
- 날짜: 2026-02-24
- 핵심: Fairy 타입 상성(Fighting/Dark/Dragon 2x), Clefairy/Jigglypuff/Ralts, 5종 Fairy 스킬, Moonlit Cave 10층

## Phase 19: Dragon 타입 + Dragon's Lair

### 19-1. Dragon 타입 + 12번째 던전
- 날짜: 2026-02-24
- 핵심: Dragon 타입 상성(Dragon 2x, Fairy 면역), Dratini/Bagon/Gible, 5종 Dragon 스킬, Dragon's Lair 16층, Elder Garchomp 보스(6.0x)

## Phase 20: Destiny Tower

### 20-1. 최종 던전
- 날짜: 2026-02-24
- 핵심: Destiny Tower 20층, 3.5x 난이도, Apex Garchomp 보스(7.0x), 모든 타입 혼합, 15클리어 해금

## Phase 21-22: UI + Poochyena

### 21-22. 스크롤 UI + 추가 콘텐츠
- 날짜: 2026-02-24
- 핵심: 허브 스크롤 가능 던전 리스트, Poochyena 추가, 16종 스타터, 35종+ 포켓몬

## Phase 23: 브라우저 테스트 + 버그 수정

### 23. Hub 스크롤 UI 버그 수정
- 날짜: 2026-02-24
- 핵심: 던전 리스트 스크롤 시 고정 버튼과 겹치는 문제 수정, createFixedButton depth 레이어링

## Phase 24: Steel Fortress

### 24. Steel 포켓몬 + 15번째 던전
- 날짜: 2026-02-24
- 핵심: Beldum/Skarmory, 3종 Steel 스킬(ironHead/flashCannon/bulletPunch), Steel Fortress 14층, Iron Metagross 보스

## Phase 25: TM 시스템

### 25. TM + 신규 아이템
- 날짜: 2026-02-24
- 핵심: 6종 TM(Flamethrower/Thunderbolt/IceBeam/ShadowBall/DragonPulse/Earthquake), Warp Orb, Foe-Hold Orb, Max Elixir

## Phase 26-27: Ground + 스타터 확장

### 26-27. Ground 포켓몬 + Buried Ruins + 스타터
- 날짜: 2026-02-24
- 핵심: Sandshrew/Trapinch/Phanpy, 2종 Ground 스킬(dig/sandTomb), Buried Ruins 12층, Ancient Flygon 보스, 20종 스타터, 스크롤 가능 스타터 선택

## Phase 28-29: Stormy Sea + Amp Plains

### 28-29. Water + Electric 포켓몬 + 던전
- 날짜: 2026-02-24
- 핵심: Horsea/Lotad/Carvanha (Water), Elekid/Mareep (Electric), brine/aquaJet/thunderbolt/thunderPunch 스킬, Stormy Sea 18층 + Amp Plains 10층

## Phase 30-31: Verdant Forest

### 30-31. Bug 포켓몬 + 20번째 던전
- 날짜: 2026-02-24
- 핵심: Wurmple/Spinarak, signalBeam/pinMissile 스킬, Verdant Forest 8층, Matriarch Ariados 보스

## Phase 32: Mystic Sanctum

### 32. Psychic 포켓몬 + 21번째 던전
- 날짜: 2026-02-24
- 핵심: Abra/Natu, psychic 스킬, Mystic Sanctum 12층, Grand Alakazam 보스(5.5x)

## Phase 34: Shadow Forest

### 34. Dark 포켓몬 + 22번째 던전
- 날짜: 2026-02-24
- 핵심: Houndour(Dark/Fire)/Sneasel(Dark/Ice), crunch/icePunch 스킬, Shadow Forest 14층, Dread Absol 보스

## Phase 35: Windy Summit

### 35. Flying 포켓몬 + 23번째 던전
- 날짜: 2026-02-24
- 핵심: Taillow/Starly, braveBird/airSlash 스킬, Windy Summit 10층, Storm Swellow 보스

## Phase 36: Battle Arena

### 36. Fighting 포켓몬 + 24번째 던전
- 날짜: 2026-02-24
- 핵심: Makuhita/Riolu, auraSphere/drainPunch 스킬, Battle Arena 12층, Champion Lucario 보스

## Phase 37: Rocky Cavern

### 37. Rock 포켓몬 + 25번째 던전
- 날짜: 2026-02-24
- 핵심: Larvitar/Nosepass, rockSlide/stoneEdge 스킬, Rocky Cavern 12층, Ancient Tyranitar 보스(6.0x)

## Phase 38: 스타터 확장

### 38. 26종 스타터 + v0.30.0
- 날짜: 2026-02-24
- 핵심: Houndour/Sneasel/Riolu/Larvitar/Taillow/Starly 스타터 추가 (총 26종)

## Phase 39: Frozen Tundra

### 39. Ice 포켓몬 + 27번째 던전
- 날짜: 2026-02-24
- 핵심: Swinub(Ice/Ground)/Spheal(Ice/Water), avalanche/icyWind 스킬, Frozen Tundra 14층, Frost Mamoswine 보스

## Phase 40: Meadow Path

### 40. Normal 포켓몬 + 28번째 던전
- 날짜: 2026-02-24
- 핵심: Zigzagoon/Whismur, hyperVoice 스킬, Meadow Path 8층, Booming Exploud 보스

---

## Phase 43: Petal Garden

### 43. Grass 2차 던전
- 날짜: 2026-02-24
- 핵심: Oddish/Budew, petalDance/energyBall 스킬, Petal Garden 10층, Blooming Vileplume 보스

---

## Phase 44: Ember Grotto

### 44. Fire 2차 던전
- 날짜: 2026-02-24
- 핵심: Vulpix/Ponyta, flameWheel/fireSpin 스킬, Ember Grotto 12층, Blazing Rapidash 보스

---

## Phase 45: Coral Reef

### 45. Water 2차 던전
- 날짜: 2026-02-24
- 핵심: Staryu/Clamperl, whirlpool 스킬, Coral Reef 11층, Dazzling Starmie 보스

---

## Phase 47: Voltage Lab

### 47. Electric 2차 던전
- 날짜: 2026-02-24
- 핵심: Shinx/Electrike, sparkCharge/wildCharge 스킬, Voltage Lab 10층, Storm Manectric 보스

---

## Phase 48: Venom Depths

### 48. Poison 2차 던전
- 날짜: 2026-02-24
- 핵심: Gulpin/Ekans, sludgeBomb/venoshock 스킬 재활용, Venom Depths 11층, Viper Arbok 보스

---

## Phase 49: Quake Tunnel

### 49. Ground 2차 던전
- 날짜: 2026-02-24
- 핵심: Cubone/Diglett, boneRush/bulldoze 스킬, Quake Tunnel 12층, Skull Marowak 보스

---

## Phase 51: Moss Burrow

### 51. Bug 2차 던전
- 날짜: 2026-02-24
- 핵심: Paras/Venonat, xScissor 스킬, Moss Burrow 10층, Toxic Venomoth 보스

---

## Phase 52: Iron Works

### 52. Steel 2차 던전
- 날짜: 2026-02-24
- 핵심: Shieldon/Bronzor, gyroBall 스킬, Iron Works 13층, Iron Bastiodon 보스

---

## Phase 53: Phantom Crypt

### 53. Ghost 2차 던전
- 날짜: 2026-02-24
- 핵심: Misdreavus/Duskull, shadowSneak 스킬, Phantom Crypt 12층, Phantom Mismagius 보스

---

## Phase 55: Wyrm Abyss

### 55. Dragon 2차 던전
- 날짜: 2026-02-24
- 핵심: Axew/Deino, dragonRush 스킬, Wyrm Abyss 13층, Titan Haxorus 보스

---

## Phase 56: Enchanted Glade

### 56. Fairy 2차 던전
- 날짜: 2026-02-24
- 핵심: Snubbull/Togepi, playRough 스킬, Enchanted Glade 10층, Radiant Granbull 보스

---

## Phase 57: Glacial Cavern

### 57. Ice 2차 던전
- 날짜: 2026-02-24
- 핵심: Snover/Bergmite, iceHammer 스킬, Glacial Cavern 12층, Frost Abomasnow 보스

---

## Phase 59: Astral Spire

### 59. Psychic 2차 던전
- 날짜: 2026-02-24
- 핵심: Spoink (Natu 기존), psyshock 스킬, Astral Spire 11층, Cosmic Grumpig 보스

---

## Phase 60: Shadow Alley

### 60. Dark 2차 던전
- 날짜: 2026-02-24
- 핵심: Stunky/Purrloin, foulPlay 스킬, Shadow Alley 11층, Shadow Skuntank 보스

---

## Phase 61: Gale Cliffs

### 61. Flying 2차 던전
- 날짜: 2026-02-24
- 핵심: Pidove/Rufflet, hurricane 스킬, Gale Cliffs 11층, Storm Braviary 보스

---

## Phase 63: Brawl Dojo

### 63. Fighting 2차 던전
- 날짜: 2026-02-24
- 핵심: Tyrogue/Crabrawler, hammerArm 스킬, Brawl Dojo 12층, Grand Crabominable 보스

---

## Phase 64: Boulder Pass

### 64. Rock 2차 던전
- 날짜: 2026-02-24
- 핵심: Roggenrola/Rockruff, rockWrecker 스킬, Boulder Pass 12층, Alpha Lycanroc 보스

---

## Phase 65: Tranquil Grove

### 65. Normal 2차 던전
- 날짜: 2026-02-24
- 핵심: Lillipup/Minccino, triAttack 스킬, Tranquil Grove 10층, Noble Stoutland 보스

---

## Phase 67: Fungal Marsh

### 67. Grass 3차 던전
- 날짜: 2026-02-24
- 핵심: Foongus/Petilil, grassKnot 스킬, Fungal Marsh 13층, Spore Lord Amoonguss 보스

---

## Phase 68: Abyssal Trench

### 68. Water 3차 던전
- 날짜: 2026-02-24
- 핵심: Feebas/Wailmer, dive 스킬, Abyssal Trench 14층, Leviathan Wailord 보스

---

## Phase 69: Inferno Pit

### 69. Fire 3차 던전
- 날짜: 2026-02-24
- 핵심: Litwick/Growlithe, heatWave 스킬, Inferno Pit 14층, Infernal Arcanine 보스

---

## Phase 71: Voltage Spire

### 71. Electric 3차 던전
- 날짜: 2026-02-24
- 핵심: Joltik/Tynamo, voltSwitch 스킬, Voltage Spire 13층, Storm Galvantula 보스

---

## Phase 72: Corrosive Sewer

### 72. Poison 3차 던전
- 날짜: 2026-02-24
- 핵심: Trubbish/Skorupi, gunkShot 스킬, Corrosive Sewer 13층, Toxic Garbodor 보스

---

## Phase 73: Seismic Fault

### 73. Ground 3차 던전
- 날짜: 2026-02-24
- 핵심: Mudbray/Hippopotas, highHorsepower 스킬, Seismic Fault 14층, Quake Mudsdale 보스

---

## Phase 75: Stalactite Grotto

### 75. Rock 3차 던전
- 날짜: 2026-02-24
- 핵심: Dwebble/Binacle, smackDown 스킬, Stalactite Grotto 13층, Stone Barbaracle 보스

---

## Phase 76: Chitin Burrow

### 76. Bug 3차 던전
- 날짜: 2026-02-24
- 핵심: Nincada/Venipede, megahorn 스킬, Chitin Burrow 13층, Swift Ninjask 보스

---

## Phase 77: Valor Arena

### 77. Fighting 3차 던전
- 날짜: 2026-02-24
- 핵심: Mienfoo/Timburr, superpower 스킬, Valor Arena 14층, Grand Mienshao 보스

---

## Phase 79: Titanium Mine

### 79. Steel 3차 던전
- 날짜: 2026-02-24
- 핵심: Klink/Ferroseed, gearGrind 스킬, Titanium Mine 14층, Overdrive Klinklang 보스

---

## Phase 80: Spectral Woods

### 80. Ghost 3차 던전
- 날짜: 2026-02-24
- 핵심: Phantump/Honedge, phantomForce 스킬, Spectral Woods 13층, Ancient Trevenant 보스

---

## Phase 81: Cosmic Rift

### 81. Psychic 3차 던전
- 날짜: 2026-02-24
- 핵심: Solosis/Elgyem, futuresight 스킬, Cosmic Rift 14층, Cosmic Reuniclus 보스

---

## Phase 83-85: Ice/Dark/Fairy 3차 던전 (v0.85.0 → v0.90.0)
- **Ice 3rd**: Frostbite Chasm — Cryogonal(0615), Cubchoo(0613) + freezeDry 스킬
- **Dark 3rd**: Midnight Alley — Sandile(0551), Inkay(0686) + knockOff 스킬
- **Fairy 3rd**: Pixie Hollow — Spritzee(0682), Swirlix(0684) + moonlight 스킬
- 기존 2nd 던전과 이름 충돌 해결 (glacialCavern→frostbiteChasm 등)
- AbilityId.Intimidate 미존재 → AbilityId.Guts로 대체

## Phase 87-89: Dragon/Flying/Normal 3차 던전 (v0.90.0 → v0.95.0)
- **Dragon 3rd**: Drake Nest — Goomy(0704), Jangmo-o(0782) + outrage 스킬
- **Flying 3rd**: Stormy Nest — Noibat(0714), Vullaby(0629) + aerialAce 스킬
- **Normal 3rd**: Cozy Burrow — Stufful(0759), Furfrou(0676) + workUp 스킬
- **마일스톤**: 전 18타입 3차 던전 완성!

## Phase 91-94: QoL Improvements (v0.95.0 → v1.0.0)
- **Auto-Save**: 매 층 이동 시 자동 저장 (데이터 손실 방지)
- **Status Effect Tints**: 번/마비/공업/방업 상태를 스프라이트 색상으로 표시
- **Enemy HP Bars**: 적 데미지 시 임시 HP바 표시 (색상 변화)
- **Level-Up Animations**: 스케일 바운스 + 스탯 팝업 (HP 초록, ATK 빨강, DEF 파랑)
- **Evolution Animations**: 화면 흔들림 + 줌 효과 + 800ms 플래시

## 🎉 v1.0.0 Full Release!
- **18종 타입**: Normal, Water, Fire, Grass, Electric, Flying, Poison, Ground, Rock, Bug, Fighting, Steel, Ghost, Psychic, Ice, Dark, Fairy, Dragon
- **69개 던전**: Beach Cave → Cozy Burrow + Destiny Tower (18타입 × 3 + Destiny Tower + etc.)
- **165종+ 포켓몬** (진화 포함 185종+)
- **147종+ 기술**
- **20종 아이템** (6종 TM 포함)
- **97종 스타터** (클리어 수로 해금)
- **131종+ 진화 경로**
- **Auto-save, Enemy HP bars, Status tints, Enhanced animations**
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

## Phase 96-104: 4th Dungeons Batch 1 (v1.0.0 → v1.1.0)

### Water/Fire/Grass 4th 던전
- Tidal Grotto (Water): Wimpod(0767)/Tympole(0535), waterfall 스킬, 16층
- Blazing Caldera (Fire): Salandit(0757)/Larvesta(0636), fireWhip 스킬, 16층
- Verdant Canopy (Grass): Fomantis(0753)/Morelull(0755), leafStorm 스킬, 16층

### Electric/Poison/Ground 4th 던전
- Sparking Plant (Electric): Charjabug(0737)/Helioptile(0694), electricTerrain 스킬, 16층
- Venomous Reef (Poison): Mareanie(0747)/Croagunk(0453), poisonJab 스킬, 16층
- Shifting Sands (Ground): Sandygast(0769)/Silicobra(0843), scorchingSand 스킬, 16층

### Rock/Bug/Fighting 4th 던전
- Crystal Cavern (Rock): Carbink(0703)/Minior(0774), stealthRock 스킬, 16층
- Silk Web (Bug): Dewpider(0751)/Sizzlipede(0850), lunge 스킬, 16층
- Champion Dojo (Fighting): Pancham(0674)/Hawlucha(0701), skyUppercut 스킬, 16층

- **신규 포켓몬 18종**, 115종 스타터, 4th 던전 난이도 3.5, 보스 7.5x

## Phase 106-114: 4th Dungeons Batch 2-3 (v1.1.0 → v1.2.0)

### Steel/Ghost/Psychic 4th 던전
- Forge Mountain (Steel): Durant(0632)/Togedemaru(0777), autotomize 스킬, 16층
- Haunted Manor (Ghost): Drifloon(0425)/Golett(0622), shadowPunch 스킬, 16층
- Dream Temple (Psychic): Hatenna(0856)/Indeedee(0876), expandingForce 스킬, 16층

### Ice/Dark/Fairy 4th 던전
- Permafrost Peak (Ice): Vanillite(0582)/Snom(0872), auroraBeam(기존) 스킬, 16층
- Thief's Den (Dark): Nickit(0827)/Impidimp(0859), throatChop 스킬, 16층
- Sugar Garden (Fairy): Milcery(0868)/Comfey(0764), sweetKiss 스킬, 16층

### Dragon/Flying/Normal 4th 던전
- Draconic Spire (Dragon): Turtonator(0776)/Drampa(0780), dragonDance 스킬, 16층
- Sky High Nest (Flying): Rookidee(0821)/Archen(0566), pluck 스킬, 16층
- Pastoral Plains (Normal): Wooloo(0831)/Skwovet(0819), facade 스킬, 16층

### v1.2.0 마일스톤
- **전 18타입 × 4개 던전 = 72개 던전** + Destiny Tower = 총 73개 던전!
- **신규 포켓몬 36종** (Phases 96-114)
- **133종 스타터** (전체)
- **200종+ 포켓몬** (진화 포함)
- **160종+ 기술**

---

## Phase 5: 5th Dungeons (18층, 난이도 4.0, 보스 8.0x)

### 5-1. Water/Fire/Grass 5th 던전 (Phase 118-120)
- 날짜: 2026-02-24
- Abyssal Depths (Water): Bruxish(0779)/Chewtle(0833), liquidation 스킬, 18층
- Volcanic Core (Fire): Litleo(0667)/Torchic(0255), blazeKick 스킬, 18층
- Ancient Woods (Grass): Gossifleur(0829)/Bounsweet(0761), tropicalKick 스킬, 18층

### 5-2. Electric/Poison/Ground 5th 던전 (Phase 121-123)
- 날짜: 2026-02-24
- Thunder Dome (Electric): Yamper(0835)/Pincurchin(0871), nuzzle 스킬, 18층
- Miasma Swamp (Poison): Skrelp(0690)/Toxel(0848), 18층
- Tectonic Rift (Ground): Drilbur(0529)/Barboach(0339), muddyWater 스킬, 18층

### 5-3. Rock/Bug/Fighting 5th 던전 (Phase 124-126)
- 날짜: 2026-02-24
- Crystal Depths (Rock): Nacli(0932)/Tyrunt(0696), rockBlast 스킬, 18층
- Silkwood Grove (Bug): Blipbug(0824)/Cutiefly(0742), bugBuzz 스킬, 18층
- Warlord's Arena (Fighting): Clobbopus(0852)/Passimian(0766), closeCombat 스킬, 18층

### 5-4. Steel/Ghost/Psychic 5th 던전 (Phase 127-129)
- 날짜: 2026-02-24
- Steelworks Citadel (Steel): Tinkatink(0957)/Varoom(0965), smartStrike 스킬, 18층
- Spectral Crypt (Ghost): Greavard(0971)/Sinistea(0854), poltergeist 스킬, 18층
- Astral Sanctum (Psychic): Flittle(0955)/Espurr(0677), 18층

### 5-5. Ice/Dark/Fairy 5th 던전 (Phase 130-132)
- 날짜: 2026-02-24
- Glacial Abyss (Ice): Cetoddle(0974)/Frigibax(0996), icicleCrash 스킬, 18층
- Shadow Labyrinth (Dark): Zorua(0570)/Pawniard(0624), 18층
- Faerie Garden (Fairy): Fidough(0926)/Dedenne(0702), 18층

### 5-6. Dragon/Flying/Normal 5th 던전 (Phase 133-135)
- 날짜: 2026-02-24
- Dragon's Den (Dragon): Cyclizar(0967)/Tatsugiri(0978), scaleShot 스킬, 18층
- Stormy Skies (Flying): Wingull(0278)/Swablu(0333), 18층
- Verdant Meadow (Normal): Lechonk(0915)/Tandemaus(0921), 18층

### v1.3.0 마일스톤
- **전 18타입 × 5개 던전 = 90개 던전** + Destiny Tower = 총 91개 던전!
- **신규 포켓몬 36종** (Phases 118-135)
- **169종 스타터** (전체)
- **240종+ 포켓몬** (진화 포함)
- **180종+ 기술**

---

## Phase 6: 6th Dungeons (20층, 난이도 4.5, 보스 9.0x)

### 6-1. Water/Fire/Grass/Electric/Poison/Ground 6th 던전 (Phase 137-139)
- 날짜: 2026-02-24
- Tidal Trench (Water): Buizel(0418)/Finizen(0963), 20층
- Inferno Peak (Fire): Fletchinder(0662)/Heatmor(0631), 20층
- Eterna Forest (Grass): Smoliv(0928)/Deerling(0585), 20층
- Volt Chamber (Electric): Pachirisu(0417)/Emolga(0587), discharge 스킬, 20층
- Venom Depths (Poison): Glimmet(0969)/Koffing(0109), 20층
- Faultline Chasm (Ground): Wooper(0194)/Baltoy(0343), 20층

### 6-2. Rock/Bug/Fighting/Steel/Ghost/Psychic 6th 던전 (Phase 140-142)
- 날짜: 2026-02-24
- Fossil Crypt (Rock): Anorith(0347)/Lunatone(0337), ancientPower 스킬, 20층
- Cocoon Hollow (Bug): Surskit(0283)/Volbeat(0313), silverWind 스킬, 20층
- Titan's Dojo (Fighting): Scraggy(0559)/Mankey(0056), aurasphere 스킬, 20층
- Iron Vault (Steel): Klefki(0707)/Mawile(0303), 20층
- Phantom Rift (Ghost): Rotom(0479)/Dreepy(0885), shadowForce 스킬, 20층
- Mind Palace (Psychic): Munna(0517)/Chingling(0433), 20층

### 6-3. Ice/Dark/Fairy/Dragon/Flying/Normal 6th 던전 (Phase 143-145)
- 날짜: 2026-02-24
- Frozen Citadel (Ice): Smoochum(0238)/Delibird(0225), glacialLance 스킬, 20층
- Eclipse Vault (Dark): Nuzleaf(0274)/Spiritomb(0442), 20층
- Moonlit Garden (Fairy): Marill(0183)/Cleffa(0173), 20층
- Wyrm's Nest (Dragon): Druddigon(0621)/Applin(0840), 20층
- Sky Pinnacle (Flying): Hoppip(0187)/Tropius(0357), 20층
- Primeval Plains (Normal): Aipom(0190)/Smeargle(0235), boomburst 스킬, 20층

### v1.4.0 마일스톤
- **전 18타입 × 6개 던전 = 108개 던전** + Destiny Tower = 총 109개 던전!
- **신규 포켓몬 36종** (Phases 137-145)
- **205종 스타터** (전체)
- **300종+ 포켓몬** (진화 포함)
- **200종+ 기술**

---

## Phase 7: 7th Dungeons (22층, 난이도 5.0, 보스 10.0x)

### 7-1. Water/Fire/Grass/Electric/Poison/Ground (Phase 148-150)
- 날짜: 2026-02-24
- Abyssopelagic (Water), Caldera Core (Fire), Primordial Canopy (Grass)
- Plasma Corridor (Electric), Corrosive Pit (Poison), Mantle Cavern (Ground)

### 7-2. Rock/Bug/Fighting/Steel/Ghost/Psychic (Phase 151-153)
- 날짜: 2026-02-24
- Obsidian Forge (Rock), Chitin Labyrinth (Bug), Colosseum (Fighting)
- Steel Abyss (Steel), Necropolis Depths (Ghost), Cosmic Library (Psychic)

### 7-3. Ice/Dark/Fairy/Dragon/Flying/Normal (Phase 154-156)
- 날짜: 2026-02-24
- Glacier Fortress (Ice), Umbral Citadel (Dark), Sylvan Sanctuary (Fairy)
- Dragon's Spine (Dragon), Stratosphere (Flying), Sovereign Hall (Normal)

### v1.5.0 마일스톤
- **전 18타입 × 7개 던전 = 126개 던전** + Destiny Tower = 총 127개 던전!
- **MAX_ALLIES 4로 증가** (5인 파티)
- **신규 아이템 사용 로직**: reviveSeed, allPowerOrb, escapeOrb
- **신규 포켓몬 36종** (Phases 148-156)
- **241종 스타터** (전체)
- **360종+ 포켓몬** (진화 포함)
- **220종+ 기술**
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 8: 8th Tier Dungeons

### 8-1. Water/Fire/Grass/Electric/Poison/Ground (Phase 158-160)
- 날짜: 2026-02-24
- Psyduck, Seel, Cyndaquil, Fennekin, Sunkern, Cacnea, Pichu, Chinchou, Weedle, Qwilfish, Donphan, Marowak
- Abyssal Trench (Water), Volcanic Core (Fire), Primeval Canopy (Grass)
- Thunder Spire (Electric), Venom Abyss (Poison), Tectonic Depths (Ground)

### 8-2. Rock/Bug/Fighting/Steel/Ghost/Psychic (Phase 161-163)
- 날짜: 2026-02-24
- Onix, Omanyte, Scyther, Pinsir, Medicham, Lucario, Metang, Lairon, Gengar, Chandelure, Alakazam, Gardevoir
- 진화 대상 추가: Omastar, Metagross, Aggron

### 8-3. Ice/Dark/Fairy/Dragon/Flying/Normal (Phase 164-166)
- 날짜: 2026-02-24
- Lapras, Weavile, Honchkrow, Houndoom, Florges, Mimikyu, Dragonite, Flygon, Staraptor, Braviary, Snorlax, Zangoose
- Glacial Tomb (Ice), Abyssal Shadow (Dark), Enchanted Grove (Fairy)
- Wyrmpeak Summit (Dragon), Gale Stronghold (Flying), Apex Arena (Normal)

### v1.6.0 마일스톤
- **전 18타입 × 8개 던전 = 144개 던전** + Destiny Tower = 총 145개 던전!
- **신규 포켓몬 36종** (Phases 158-166) + 진화 대상 3종
- **277종 스타터** (전체)
- **395종+ 포켓몬** (진화 포함)
- **230종+ 기술**
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 9: 9th Tier Dungeons

### 9-1. Water/Fire/Grass/Electric/Poison/Ground (Phase 168-170)
- 날짜: 2026-02-24
- Gyarados, Kingdra, Blaziken, Typhlosion, Venusaur, Sceptile, Jolteon, Ampharos, Nidoking, Crobat, Krookodile, Nidoqueen
- Leviathan Trench (Water), Infernal Summit (Fire), World Tree Canopy (Grass)
- Thunder God Spire (Electric), Venomous Abyss (Poison), Tectonic Throne (Ground)

### 9-2. Rock/Bug/Fighting/Steel/Ghost/Psychic (Phase 171-173)
- 날짜: 2026-02-24
- Tyranitar, Aerodactyl, Yanmega, Scolipede, Conkeldurr, Machamp, Magnezone, Empoleon, Dusknoir, Cofagrigus, Reuniclus, Gothitelle
- Ancient Monolith (Rock), Predator Hive (Bug), Wargod's Temple (Fighting)
- Magnetar Core (Steel), Spectral Throne (Ghost), Cognition Spire (Psychic)

### 9-3. Ice/Dark/Fairy/Dragon/Flying/Normal (Phase 174-176)
- 날짜: 2026-02-24
- Mamoswine, Walrein, Darkrai, Hydreigon, Sylveon, Hatterene, Haxorus, Goodra, Pidgeot, Noivern, Blissey, Porygon-Z
- Absolute Zero Peak (Ice), Eternal Night (Dark), Celestial Blossom (Fairy)
- Dragon's Sovereignty (Dragon), Zenith Stormfront (Flying), Infinity Hall (Normal)

### v1.7.0 마일스톤
- **전 18타입 × 9개 던전 = 162개 던전** + Destiny Tower = 총 163개 던전!
- **신규 포켓몬 36종** (Phases 168-176)
- **313종 스타터** (전체)
- **430종+ 포켓몬** (진화 포함)
- **250종+ 기술**
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 10: 10th Tier Dungeons

### 10-1. Water/Fire/Grass/Electric/Poison/Ground (Phase 178-180)
- 날짜: 2026-02-24
- Blastoise, Feraligatr, Charizard, Delphox, Torterra, Serperior, Electivire, Luxray, Roserade, Vileplume, Rhyperior, Dugtrio
- Abyssal Maelstrom (Water), Primordial Inferno (Fire), Yggdrasil Root (Grass)
- Voltex Pinnacle (Electric), Miasmatic Core (Poison), Pangaea Fault (Ground)

### 10-2. Rock/Bug/Fighting/Steel/Ghost/Psychic (Phase 181-183)
- 날짜: 2026-02-24
- Golem, Terrakion, Pheromosa, Escavalier, Kommo-o, Gallade, Corviknight, Bastiodon, Aegislash, Jellicent, Slowking, Bronzong
- Titan's Geode (Rock), Sovereign Hive (Bug), Apex Colosseum (Fighting)
- Adamantine Citadel (Steel), Ethereal Sanctum (Ghost), Transcendence Spire (Psychic)

### 10-3. Ice/Dark/Fairy/Dragon/Flying/Normal (Phase 184-186)
- 날짜: 2026-02-24
- Froslass, Abomasnow, Sharpedo, Zoroark, Primarina, Diancie, Dragapult, Duraludon, Swellow, Talonflame, Slaking, Lopunny
- Frozen Nether (Ice), Abyssal Eclipse (Dark), Radiant Crystal Garden (Fairy)
- Void Dragon Spire (Dragon), Celestial Galefort (Flying), Primordial Colossus (Normal)

### v1.8.0 마일스톤
- **전 18타입 × 10개 던전 = 180개 던전** + Destiny Tower = 총 181개 던전!
- **신규 포켓몬 36종** (Phases 178-186)
- **349종 스타터** (전체)
- **465종+ 포켓몬** (진화 포함)
- **275종+ 기술**
- **HubScene 리팩터링**: 가상 스크롤 스타터 선택 UI
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 11: 11th Tier Legendary Post-Game Dungeons

### 11-1. Water/Fire/Grass/Electric/Poison/Ground (Phase 188-190)
- 날짜: 2026-02-24
- Suicune, Lugia, Entei, Ho-Oh, Celebi, Virizion, Raikou, Zekrom, Nihilego, Naganadel, Groudon, Landorus
- Ocean Sovereignty (Water), Sacred Pyre (Fire), Timeless Grove (Grass)
- Thunder Sovereignty (Electric), Ultra Venom Nexus (Poison), Pangaea Throne (Ground)

### 11-2. Rock/Bug/Fighting/Steel/Ghost/Psychic (Phase 191-193)
- 날짜: 2026-02-24
- Regirock, Stakataka, Genesect, Buzzwole, Cobalion, Marshadow, Registeel, Solgaleo, Giratina, Lunala, Mewtwo, Deoxys
- Petrified Colossus (Rock), Cyber Hive (Bug), Justice Hall (Fighting)
- Iron Sanctuary (Steel), Distortion Rift (Ghost), Genesis Chamber (Psychic)

### 11-3. Ice/Dark/Fairy/Dragon/Flying/Normal (Phase 194-196)
- 날짜: 2026-02-24
- Regice, Kyurem, Yveltal, Hoopa, Xerneas, Magearna, Rayquaza, Dialga, Tornadus, Articuno, Arceus, Regigigas
- Frozen Regolith (Ice), Nihility Abyss (Dark), Eternal Garden (Fairy)
- Temporal Spire (Dragon), Storm Sovereign (Flying), Origin Hall (Normal)

### v1.9.0 마일스톤
- **전 18타입 × 11개 던전 = 198개 던전** + Destiny Tower = 총 199개 던전!
- **전설/환상 포켓몬 36종** 추가 (Phases 188-196)
- **385종 스타터** (전체)
- **500종+ 포켓몬** (진화 포함)
- **350종+ 기술**
- **포스트게임 컨텐츠**: 50클리어 이상 해금 전설 던전
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 12: 12th Tier FINAL Dungeons

### 12-1. Water/Fire/Grass/Electric/Poison/Ground (Phase 198-200)
- 날짜: 2026-02-24
- Kyogre, Palkia, Reshiram, Victini, Shaymin, Tapu Bulu, Thundurus, Zeraora, Eternatus, Poipole, Zygarde, Excadrill
- Sovereign Depths (Water), Primordial Flame (Fire), Eden's Heart (Grass)
- Thunder Sovereign Spire (Electric), Venom Nexus Apex (Poison), Tectonic Core (Ground)

### 12-2. Rock/Bug/Fighting/Steel/Ghost/Psychic (Phase 201-203)
- 날짜: 2026-02-24
- Lycanroc, Gigalith, Volcarona, Golisopod, Urshifu, Keldeo, Heatran, Kartana, Spectrier, Polteageist, Mew, Cresselia
- Petrified Apex (Rock), Primordial Hive (Bug), Martial Summit (Fighting)
- Molten Forge (Steel), Spectral Plains (Ghost), Genesis Temple (Psychic)

### 12-3. Ice/Dark/Fairy/Dragon/Flying/Normal (Phase 204-206)
- 날짜: 2026-02-24
- Calyrex-Ice, Cloyster, Grimmsnarl, Incineroar, Zacian, Tapu Lele, Garchomp, Latios, Zapdos, Moltres, Silvally, Meloetta
- Crown Tundra Throne (Ice), Abyssal Darkhold (Dark), Radiant Sword Garden (Fairy)
- Dragon Sovereign Spire (Dragon), Celestial Thunderpeak (Flying), Harmony Hall (Normal)

### v2.0.0 마일스톤
- **전 18타입 × 12개 던전 = 216개 던전** + Destiny Tower = 총 217개 던전!
- **12th 티어 포켓몬 36종** 추가 (Phases 198-206)
- **421종 스타터** (전체)
- **540종+ 포켓몬** (진화 포함)
- **450종+ 기술**
- **전체 던전 완성!**: 1티어(기본) ~ 12티어(FINAL) 모든 던전 구현
- **난이도 범위**: 1.0 ~ 8.0, 보스 배율 3.0x ~ 20.0x
- **해금 조건**: 0클리어 ~ 60클리어
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 13: Post-v2.0 Features

### 13-1. 던전 선택 UI 개편 (Phase 208)
- 날짜: 2026-02-24
- 217개 던전을 난이도 티어별로 접기/펼치기 그룹핑
- 13개 티어 (Beginner → FINAL + Destiny Tower)
- 색상별 티어 표시, 해금 진행도 표시
- 최고 해금 티어만 자동 펼침

### 13-2. 무한 던전 (Phase 209)
- 날짜: 2026-02-24
- Endless Abyss: 층수 제한 없는 무한 던전
- 난이도 = 1.0 + (층 × 0.1), 무한 스케일링
- 전체 포켓몬 풀에서 랜덤 적 선택
- 10층마다 미니보스 등장
- 10클리어 이상 해금

### 13-3. 챌린지 모드 (Phase 210)
- 날짜: 2026-02-24
- Speed Run: 턴 제한 (층수 × 50), 2배 골드
- No Items: 아이템 사용/획득 불가, 적 15% 약화
- Solo: 동료 모집 불가, 스탯 30% 증가
- 15/20/25 클리어에서 각각 해금

### 13-4. 통계 & 업적 (Phase 211)
- 날짜: 2026-02-24
- AchievementScene: 21개 업적 (7카테고리)
- 런/클리어/골드/적처치/무한/챌린지/다양성
- 상세 플레이 통계 추적 (적 처치수, 턴수 등)
- Records 버튼 → AchievementScene으로 변경

### 13-5. 포켓몬 도감 (Phase 212)
- 날짜: 2026-02-24
- PokedexScene: 540종+ 포켓몬 가상스크롤 도감
- 만난/사용한 포켓몬 추적
- 필터 탭: 전체/발견/사용
- 타입별 색상, 스탯 표시

### v2.1.0 마일스톤
- **접기/펼치기 티어별 던전 선택 UI**
- **Endless Abyss**: 무한 던전 모드
- **3종 챌린지 모드**: Speed Run, No Items, Solo
- **21개 업적** 시스템 + 상세 통계
- **포켓몬 도감**: 540종+ 추적
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 14: 게임플레이 심화

### 14-1. 팀 콤보 공격 (Phase 214)
- 날짜: 2026-02-24
- 플레이어와 동료가 같은 적 인접 시 25% 확률 콤보
- 콤보 데미지 = 동료 ATK × 50%
- 카메라 흔들림 + COMBO! 팝업 효과

### 14-2. 데일리 던전 (Phase 215)
- 날짜: 2026-02-24
- 매일 시드 기반 랜덤 던전 생성
- 15-25층, 난이도 3.0-7.0, 1-2개 모디파이어
- 하루 1회 도전, 점수 localStorage 저장 (30일분)
- 5클리어 이상 해금

### 14-3. 던전 모디파이어 (Phase 216)
- 날짜: 2026-02-24
- 일반 던전 진입 시 30% 확률로 1-2개 모디파이어 적용
- 긍정: Gold Rush, Power Surge, Iron Will, EXP Boost, Restoration, Bounty
- 부정(보상): Hard Mode, Famine, Swarm, Lone Wolf, Fragile, Tank Enemies
- 모디파이어 배지 HUD 표시 + 인트로 오버레이

### v2.2.0 마일스톤
- **팀 콤보 공격**: 동료와의 연계 공격 시스템
- **데일리 던전**: 매일 바뀌는 시드 기반 던전
- **던전 모디파이어**: 12종 랜덤 버프/디버프
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 15: 장비 & QoL

### 15-1. 무브 튜터 (Phase 218)
- 날짜: 2026-02-24
- MoveTutorScene: 골드로 기술 교체
- 타입 일치 + 노말 타입 스킬 브라우징
- 파워 기반 비용 (80-600G)
- customSkills로 영구 저장

### 15-2. 지닌 아이템 (Phase 219)
- 날짜: 2026-02-24
- 13종 패시브 장비 (3티어)
- ATK/DEF/HP 보너스, 크리티컬, 회피
- 층당 회복, 골드/경험치 보너스
- HeldItemScene: 구매 + 장착

### 15-3. 미니맵 개선 (Phase 220)
- 날짜: 2026-02-24
- 탭으로 소/대 미니맵 토글
- 아이템(노랑), 동료(초록), 상점(금색) 표시
- 확장 모드 컬러 범례
- 안개 전쟁 적용

### v2.3.0 마일스톤
- **무브 튜터**: 골드로 기술 교체 시스템
- **지닌 아이템**: 13종 패시브 장비
- **미니맵 개선**: 토글 확대, 아이템/동료/상점 표시
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 16: 던전 메카닉스

### 16-1. 바닥 함정 개편 (Phase 222)
- 날짜: 2026-02-24
- 8종 함정: Spike, Poison, Warp, Spin, Slowdown, Blast, Trip, Seal
- 난이도 기반 함정 수 스케일링
- 인접 타일 이동 시 함정 공개
- Levitate 능력으로 일부 함정 면역

### 16-2. 날씨 시각효과 (Phase 223)
- 날짜: 2026-02-24
- Rain: 파란 오버레이 + 대각선 빗줄기 파티클
- Sandstorm: 갈색 오버레이 + 모래 입자
- Hail: 하늘색 오버레이 + 흰색 우박
- HUD 날씨 표시 텍스트

### 16-3. 배고픔 시스템 개선 (Phase 224)
- 날짜: 2026-02-24
- 시각적 배 게이지 바 (초록/노랑/빨강)
- 20%/10% 경고 메시지
- 난이도 기반 소모율 (0.5 + difficulty × 0.1)
- 굶주림 데미지 = maxHP의 2%/턴
- Grimy Food 아이템 추가

### v2.4.0 마일스톤
- **8종 바닥 함정**: 데미지, 워프, 아이템 드롭, 스킬 봉인 등
- **날씨 시각효과**: 비/모래폭풍/우박 파티클 + 화면 틴트
- **배고픔 게이지**: 시각적 바, 경고 시스템, 스케일링
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 17: 보스 러시 + 도움말 + 효과음

### 17-1. 보스 러시 모드 (Phase 226)
- 날짜: 2026-02-24
- 10층 보스 전용 던전, 30클리어 이상 해금
- 랜덤 보스 종, 배율 3.0 + (층 × 1.5)
- 로마 숫자 보스 이름, 일반 적/상점/몬스터 하우스 없음

### 17-2. 튜토리얼/도움말 (Phase 227)
- 날짜: 2026-02-24
- HelpScene: 11개 섹션 (조작, 전투, 타입, 아이템 등)
- 허브 [?] 도움말 버튼
- 첫 층 진입 시 자동 팁 표시

### 17-3. 효과음 개선 (Phase 228)
- 날짜: 2026-02-24
- 6종 신규 SFX: Combo, Critical, Dodge, ItemPickup, Buff, WeatherChange
- DungeonScene 전투/이벤트에 상황별 SFX 통합

### v2.5.0 마일스톤
- **보스 러시**: 10층 보스 전용 던전 모드
- **튜토리얼**: 11섹션 도움말 + 첫 플레이 팁
- **6종 신규 SFX**: 콤보, 크리티컬, 회피, 아이템, 버프, 날씨
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 18: 몬스터 하우스 + 상태이상

### 18-1. 몬스터 하우스 개편 (Phase 230)
- 날짜: 2026-02-24
- 3종 몬스터 하우스: Standard(빨강), Treasure(금색), Ambush(보라)
- Standard: 3-5적, 클리어 시 아이템 1개
- Treasure: 5-8적, 클리어 시 아이템 3-5개 + 2배 골드
- Ambush: 4-6적 투명→페이드인, 클리어 시 아이템 2개 + EXP 보너스
- 경고 팝업 + 카메라 흔들림, 클리어 감지 시스템

### 18-2. 상태이상 개선 (Phase 231)
- 날짜: 2026-02-24
- 상태 지속턴: Burn 5턴, Paralyze 3턴, AtkUp/DefUp 10턴
- HUD 상태 배지: BRN(빨강)/PAR(노랑)/ATK↑(주황)/DEF↑(파랑) + 남은 턴수
- Burn 틱 데미지 (5HP/턴), 상태 해제 메시지
- 주기적 Burn/Paralyze 시각 효과 (오렌지/노랑 플래시)

### v2.6.0 마일스톤
- **몬스터 하우스 3종**: Standard/Treasure/Ambush + 보상 시스템
- **상태 지속턴**: 번/마비/버프 카운트다운 + HUD 표시
- **상태 시각효과**: 주기적 플래시, 틱 데미지
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 19: 자동탐색 + 아이템 합성

### 19-1. 오토 탐색 (Phase 233)
- 날짜: 2026-02-24
- D-pad 영역에 Auto 버튼 추가
- BFS 기반 미탐색 타일 탐색 경로 탐색
- 150ms/스텝 고속 이동, 정상 턴 처리
- 자동 정지: 적 발견, 피해, 아이템/계단 근처, 막다른 길, 탭 인터럽트
- 우측 상단 "AUTO" 펄싱 인디케이터

### 19-2. 아이템 합성 (Phase 234)
- 날짜: 2026-02-24
- 12종 합성 레시피 (Oran Fusion, Apple Merge, Revive Synthesis 등)
- CraftingScene: 아이템 포지 UI (스크롤, 재료 표시)
- 던전 귀환 시 아이템 자동 보관 (5개 경로 모두)
- 클리어 수 기반 레시피 해금 (0~8 클리어)
- 허브에 Item Forge 버튼 추가 (7번째 고정 버튼)

### v2.7.0 마일스톤
- **오토 탐색**: BFS 경로탐색 + 스마트 자동정지
- **아이템 합성**: 12종 레시피, 아이템 보관, Item Forge
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 20: 능력 강화 + 던전 프리뷰

### 20-1. 능력 업그레이드 시스템 (Phase 236)
- 날짜: 2026-02-24
- 13종 능력 × 5단계 업그레이드 (300G~2000G)
- Ability Dojo 씬: 별 등급, 티어 미리보기, 업그레이드 버튼
- 전투 중 능력 레벨에 따른 효과 스케일링
- 허브에 Ability Dojo 버튼 추가 (8번째 고정 버튼)

### 20-2. 던전 프리뷰 씬 (Phase 237)
- 날짜: 2026-02-24
- DungeonPreviewScene: 던전 진입 전 정보 확인
- 난이도 별 표시, 적 포켓몬 미리보기, 보스 위험도 게이지
- 팀 정보 (스타터, HP, 장비, 능력 레벨)
- 모디파이어 프리뷰, 스크롤 가능 레이아웃

### v2.8.0 마일스톤
- **능력 업그레이드**: 13종 능력 5단계 강화 + Ability Dojo
- **던전 프리뷰**: 진입 전 정보 확인 화면
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 21: 리더보드 + 진화 트리

### 21-1. 리더보드/랭킹 (Phase 239)
- 날짜: 2026-02-24
- 런 점수 계산: 층수×100 + 적×10 + 클리어 보너스 + 골드 + 턴효율 + 챌린지 배율
- Hall of Fame 씬: By Dungeon / All Time / Recent 3개 탭
- 금/은/동 랭크 색상, 던전별 Top 10, 최근 20회 기록
- 던전 클리어/패배 시 자동 점수 저장

### 21-2. 진화 트리 뷰어 (Phase 240)
- 날짜: 2026-02-24
- evolution-chain.ts: 트리 빌더, 베이스 폼 탐색기
- 도감에서 포켓몬 탭 시 상세 패널: 스탯 바, 기술, 진화 체인
- 발견/사용 포켓몬 하이라이트, 미발견 회색 처리
- 반투명 오버레이, 스크롤 안전 탭 감지

### v2.9.0 마일스톤
- **Hall of Fame**: 점수 계산 + 3탭 리더보드
- **진화 트리**: 도감 상세보기 + 진화 체인 시각화
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 22: 설정 + 통계 대시보드

### 22-1. 난이도 설정 (Phase 242)
- 날짜: 2026-02-24
- 4단계 난이도: Easy/Normal/Hard/Nightmare
- 8종 배율 (적HP, 적ATK, 피해, 골드, 경험치, 아이템, 배고픔, 함정)
- SettingsScene: 난이도 선택, 사운드 토글, 진행 초기화
- DungeonScene 전체 시스템에 난이도 배율 적용
- 리더보드에 비기본 난이도 태그

### 22-2. 통계 대시보드 (Phase 243)
- 날짜: 2026-02-24
- AchievementScene 탭 분할: Achievements / Statistics
- 7개 통계 카테고리: 일반, 무한, 챌린지, 컬렉션, 평균, 보관, 장비
- 색상 코딩: 골드/초록/파랑/보라
- starter-data.ts 추출 (425종 스타터 데이터 공유)

### v3.0.0 마일스톤 🎉
- **난이도 설정**: 4단계 + 8종 배율 + Settings UI
- **통계 대시보드**: 7카테고리 상세 통계 + 탭 UI
- **v3.0.0 총 컨텐츠**:
  - 217개 던전 (12티어 × 18타입 + Destiny Tower)
  - 540종+ 포켓몬, 450종+ 기술, 421종 스타터
  - 무한 던전, 보스 러시, 데일리 던전
  - 3종 챌린지 모드, 12종 던전 모디파이어
  - 3종 몬스터 하우스, 8종 함정
  - 13종 지닌 아이템, 12종 합성 레시피
  - 13종 능력 × 5단계 업그레이드
  - 4단계 난이도, 오토 탐색
  - Hall of Fame, 도감, 진화 트리, 통계 대시보드
  - 던전 프리뷰, 무브 튜터, 아이템 포지
  - 튜토리얼, 6종 SFX, 날씨 시각효과
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 23: NG+ & 스킬 콤보

### 23-1. New Game Plus (Phase 245)
- 날짜: 2026-02-24
- 5단계 프레스티지: NG+1(30클) ~ NG+5(200클)
- 누적 보너스: HP/ATK/DEF/골드/EXP/아이템/배고픔/시작아이템/PP
- 허브에 NG+ 인디케이터 (펄싱 애니메이션)
- NG+ 패널: 활성 보너스, 다음 레벨 미리보기, 진행도

### 23-2. 스킬 콤보 시스템 (Phase 246)
- 날짜: 2026-02-24
- 10종 콤보: Fire Chain, Quick Strike, Power Surge, Type Barrage 등
- 5종 효과: DoubleDamage, AreaBlast, HealBurst, SpeedBoost, CritGuarantee
- 유연한 슬롯 매칭: 정확 ID, 타입, 효과, 카테고리별
- 콤보 팝업 + 카메라 흔들림 + SFX
- Help 씬에 콤보 목록 추가

### v3.1.0 마일스톤
- **New Game Plus**: 5단계 프레스티지 + 누적 보너스
- **스킬 콤보**: 10종 콤보 + 5종 효과
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 24: 동료 전술 + 이벤트 룸

### 24-1. 동료 명령 시스템 (Phase 248)
- 날짜: 2026-02-24
- 4종 전술: FollowMe, GoAfterFoes, StayHere, Scatter
- Team 패널: 동료별 HP바 + 전술 버튼
- GoAfterFoes: BFS 8타일 적 추적
- StayHere: 위치 고정, 인접만 공격
- Scatter: 랜덤 탐색 이동

### 24-2. 던전 이벤트 룸 (Phase 249)
- 날짜: 2026-02-24
- 8종 이벤트: Wishing Well, Abandoned Stash, Mysterious Statue 등
- 20% 층 확률, 가중치 희귀도, 최소 층수 요구
- 선택지 UI 오버레이 + 효과 설명
- 효과: 힐, 버프, 아이템, EXP, 동료 소환, 미니맵 공개
- 미니맵 청록 테두리, 펄싱 "!" 마커

### v3.2.0 마일스톤
- **동료 전술**: 4종 명령 + Team 패널
- **이벤트 룸**: 8종 랜덤 이벤트 + 선택지 시스템
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/

---

## Phase 25: 비주얼 + 인챈트

### 25-1. 던전 층 테마 (Phase 251)
- 날짜: 2026-02-24
- 12종 비주얼 테마: Cave, Forest, Ocean, Volcano, Temple 등
- 벽/바닥/복도 색상 오버레이, 체커보드 패턴
- 타일맵 앰비언트 틴트, 테마별 안개 색상
- 5층마다 5% 어둡게 (깊이감)

### 25-2. 아이템 인챈트 (Phase 252)
- 날짜: 2026-02-24
- 10종 인챈트 (3티어): Sharpness, Resilience, Vampiric, Phoenix 등
- HeldItemScene에 인챈트 섹션 + 티어 색상
- 전투 효과: Thorns 반사, Haste 추가턴, Phoenix 부활
- Phoenix: 극적인 금색 플래시 + 불꽃 틴트 + 상승 텍스트

### v3.3.0 마일스톤
- **층 테마**: 12종 비주얼 테마 + 깊이 어두움
- **인챈트**: 10종 장비 강화 + Phoenix 부활
- **라이브**: https://songclaude-bot.github.io/poke-roguelite/
