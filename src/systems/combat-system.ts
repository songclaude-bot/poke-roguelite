/**
 * CombatSystem — Extracted from DungeonScene.
 * Manages all combat/battle logic: movement, basic attacks, skill attacks,
 * damage calculations, status effects, and all combat visual effects.
 */
import Phaser from "phaser";
import { TILE_DISPLAY } from "../config";
import { Direction, DIR_DX, DIR_DY } from "../core/direction";
import {
  Entity, canMoveTo, canMoveDiagonal,
  getEffectiveAtk, getEffectiveDef, StatusEffect,
  thawEntity,
} from "../core/entity";
import { directionToPlayer } from "../core/enemy-ai";
import { PokemonType, getEffectiveness, effectivenessText } from "../core/type-chart";
import { Skill, SkillRange, SkillEffect } from "../core/skill";
import { getSkillTargetTiles } from "../core/skill-targeting";
import { AbilityId } from "../core/ability";
import {
  getTorrentValues, getSturdyHp,
  getStaticChance, getFlameBodyChance,
  getRunAwayDodgeBonus, getLevitateDodgeBonus,
} from "../core/ability-upgrade";
import {
  WeatherType, WEATHERS, weatherDamageMultiplier,
  WeatherIntensity, INTENSITY_MULTIPLIER, getWeatherSynergyBonus,
} from "../core/weather";
import { HeldItemEffect } from "../core/held-items";
import { Enchantment } from "../core/enchantments";
import { DifficultyModifiers } from "../core/difficulty-settings";
import { FloorEvent, FloorEventType, invertEffectiveness } from "../core/floor-events";
import {
  ScoreChain, addChainAction, resetChain,
} from "../core/score-chain";
import { RunLog, RunLogEvent } from "../core/run-log";
import { ActiveBlessing, getBlessingEffect } from "../core/blessings";
import { hasRelicEffect, Relic } from "../core/relics";
import { DungeonData, TerrainType } from "../core/dungeon-generator";
import { TurnManager } from "../core/turn-manager";
import {
  sfxHit, sfxSuperEffective, sfxNotEffective, sfxSkill,
  sfxCombo, sfxCritical, sfxDodge, sfxBuff,
} from "../core/sound-manager";

// ── Host interface: what CombatSystem needs from DungeonScene ──

export interface CombatHost {
  /** Phaser Scene API (for add, tweens, time, cameras) */
  scene: Phaser.Scene;

  // ── Read-only game state ──
  readonly player: Entity;
  readonly enemies: Entity[];
  readonly allies: Entity[];
  readonly allEntities: Entity[];
  readonly dungeon: DungeonData;
  readonly currentFloor: number;
  readonly turnManager: TurnManager;

  // ── Weather state (read-only) ──
  readonly currentWeather: WeatherType;
  readonly currentWeatherIntensity: WeatherIntensity;

  // ── Combat modifier state (read-only) ──
  readonly heldItemEffect: HeldItemEffect;
  readonly relicEffects: Record<string, number>;
  readonly activeRelics: Relic[];
  readonly activeBlessings: ActiveBlessing[];
  readonly difficultyMods: DifficultyModifiers;
  readonly enchantment: Enchantment | null;
  readonly floorEvent: FloorEvent | null;
  readonly activeTypeGems: Map<string, number>;

  // ── Combo state (mutable) ──
  comboDoubleDamage: boolean;
  comboCritGuarantee: boolean;
  comboDragonsRage: boolean;
  comboShadowDanceTurns: number;

  // ── Score chain (mutable) ──
  scoreChain: ScoreChain;
  chainActionThisTurn: boolean;

  // ── Run log ──
  readonly runLog: RunLog;

  // ── Relic flags (mutable) ──
  focusSashUsed: boolean;

  // ── Callbacks (delegate back to DungeonScene) ──
  showLog(msg: string): void;
  updateHUD(): void;
  updateChainHUD(): void;
  updateStatusTint(entity: { sprite?: Phaser.GameObjects.Sprite; statusEffects: StatusEffect[] }): void;
  checkDeath(entity: Entity): void;
  applyWindyKnockback(attacker: Entity, defender: Entity): void;
  tileToPixelX(tileX: number): number;
  tileToPixelY(tileY: number): number;
}

const MOVE_DURATION = 150; // ms per tile movement

// ── CombatSystem class ──

export class CombatSystem {
  constructor(private host: CombatHost) {}

  // ══════════════════════════════════════════════
  //  Movement
  // ══════════════════════════════════════════════

  /** Check if an entity can move in a given direction */
  canEntityMove(entity: Entity, dir: Direction): boolean {
    const nx = entity.tileX + DIR_DX[dir];
    const ny = entity.tileY + DIR_DY[dir];
    if (!canMoveTo(nx, ny, this.host.dungeon.terrain, this.host.dungeon.width, this.host.dungeon.height, this.host.allEntities, entity)) {
      return false;
    }
    return canMoveDiagonal(entity.tileX, entity.tileY, dir, this.host.dungeon.terrain, this.host.dungeon.width, this.host.dungeon.height);
  }

  /** Move entity one tile in the given direction with walk animation */
  moveEntity(entity: Entity, dir: Direction): Promise<void> {
    const scene = this.host.scene;
    return new Promise((resolve) => {
      entity.facing = dir;
      entity.tileX += DIR_DX[dir];
      entity.tileY += DIR_DY[dir];
      entity.sprite!.play(`${entity.spriteKey}-walk-${dir}`);

      scene.tweens.add({
        targets: entity.sprite,
        x: this.host.tileToPixelX(entity.tileX),
        y: this.host.tileToPixelY(entity.tileY),
        duration: MOVE_DURATION,
        ease: "Linear",
        onComplete: () => {
          entity.sprite!.play(`${entity.spriteKey}-idle-${dir}`);
          resolve();
        },
      });
    });
  }

  /** Swap positions with an ally (player walks into ally's tile) */
  swapWithAlly(player: Entity, ally: Entity, dir: Direction): Promise<void> {
    const scene = this.host.scene;
    return new Promise((resolve) => {
      const oldPx = player.tileX, oldPy = player.tileY;
      const oldAx = ally.tileX, oldAy = ally.tileY;

      player.facing = dir;
      player.tileX = oldAx;
      player.tileY = oldAy;
      ally.tileX = oldPx;
      ally.tileY = oldPy;

      player.sprite!.play(`${player.spriteKey}-walk-${dir}`);

      let done = 0;
      const checkDone = () => { if (++done >= 2) resolve(); };

      scene.tweens.add({
        targets: player.sprite,
        x: this.host.tileToPixelX(player.tileX),
        y: this.host.tileToPixelY(player.tileY),
        duration: MOVE_DURATION, ease: "Linear",
        onComplete: () => {
          player.sprite!.play(`${player.spriteKey}-idle-${dir}`);
          checkDone();
        },
      });

      scene.tweens.add({
        targets: ally.sprite,
        x: this.host.tileToPixelX(ally.tileX),
        y: this.host.tileToPixelY(ally.tileY),
        duration: MOVE_DURATION, ease: "Linear",
        onComplete: () => {
          if (ally.sprite) ally.sprite.play(`${ally.spriteKey}-idle-${ally.facing}`);
          checkDone();
        },
      });
    });
  }

  /** PP recovery: on move, recover 1 PP on a random depleted skill */
  recoverPP(entity: Entity) {
    const depleted = entity.skills.filter(s => s.currentPp < s.pp);
    if (depleted.length > 0) {
      const pick = depleted[Math.floor(Math.random() * depleted.length)];
      pick.currentPp = Math.min(pick.pp, pick.currentPp + 1);
    }
  }

  // ══════════════════════════════════════════════
  //  Combat Core
  // ══════════════════════════════════════════════

  /** Basic (non-skill) attack -- front 1 tile, uses entity's attackType */
  performBasicAttack(attacker: Entity, defender: Entity): Promise<void> {
    const host = this.host;
    const scene = host.scene;
    return new Promise((resolve) => {
      const dir = attacker === host.player
        ? attacker.facing
        : directionToPlayer(attacker, host.player);
      attacker.facing = dir;
      attacker.sprite!.play(`${attacker.spriteKey}-idle-${dir}`);

      // Shadow Dance combo: 100% dodge for player
      if (defender === host.player && host.comboShadowDanceTurns > 0) {
        sfxDodge();
        host.showLog(`${defender.name} dodged with Shadow Dance!`);
        if (defender.sprite) {
          this.showDamagePopup(defender.sprite.x, defender.sprite.y, 0, 1, "Shadow Dance!");
        }
        host.updateHUD();
        scene.time.delayedCall(250, resolve);
        return;
      }

      // Held item + ability dodge chance (defender is player)
      let dodgeChance = host.heldItemEffect.dodgeChance ?? 0;
      // Ability: Run Away / Levitate dodge bonus at higher levels
      if (defender.ability === AbilityId.RunAway) dodgeChance += getRunAwayDodgeBonus(defender.abilityLevel ?? 1) * 100;
      if (defender.ability === AbilityId.Levitate) dodgeChance += getLevitateDodgeBonus(defender.abilityLevel ?? 1) * 100;
      // Blessing: Swift Step dodge chance bonus
      if (defender === host.player) dodgeChance += getBlessingEffect(host.activeBlessings, "dodgeChance") * 100;
      if (defender === host.player && dodgeChance > 0 && Math.random() * 100 < dodgeChance) {
        sfxDodge();
        host.showLog(`${defender.name} dodged ${attacker.name}'s attack!`);
        if (defender.sprite) {
          this.showDamagePopup(defender.sprite.x, defender.sprite.y, 0, 1, "Dodged!");
        }
        host.updateHUD();
        scene.time.delayedCall(250, resolve);
        return;
      }

      let effectiveness = getEffectiveness(attacker.attackType, defender.types);
      // InverseFloor: reverse type effectiveness
      if (host.floorEvent?.type === FloorEventType.InverseFloor) {
        effectiveness = invertEffectiveness(effectiveness);
      }
      const effText = effectivenessText(effectiveness);

      let atk = getEffectiveAtk(attacker);
      let def = getEffectiveDef(defender);
      // Relic: ATK/DEF multipliers (player only)
      if (attacker === host.player) atk = Math.floor(atk * (1 + (host.relicEffects.atkMult ?? 0)));
      if (defender === host.player) def = Math.floor(def * (1 + (host.relicEffects.defMult ?? 0)));
      // Blessing: ATK/DEF multipliers (player only)
      if (attacker === host.player) atk = Math.floor(atk * (1 + getBlessingEffect(host.activeBlessings, "atkMult")));
      if (defender === host.player) def = Math.floor(def * (1 + getBlessingEffect(host.activeBlessings, "defMult")));
      const baseDmg = Math.max(1, atk - Math.floor(def / 2));
      // Ability: Torrent -- scaled by ability level
      let abilityMult = 1.0;
      if (attacker.ability === AbilityId.Torrent &&
          attacker.attackType === PokemonType.Water) {
        const torrent = getTorrentValues(attacker.abilityLevel ?? 1);
        if (attacker.stats.hp < attacker.stats.maxHp * torrent.threshold) {
          abilityMult = torrent.multiplier;
        }
      }
      const wMult = weatherDamageMultiplier(host.currentWeather, attacker.attackType);
      // Weather intensity scales the weather multiplier deviation from 1.0
      const intensityMult = INTENSITY_MULTIPLIER[host.currentWeatherIntensity];
      const scaledWMult = wMult === 1.0 ? 1.0 : 1.0 + (wMult - 1.0) * intensityMult;
      // Weather synergy bonus for matching pokemon type
      const synergyBonus = (attacker === host.player)
        ? 1.0 + getWeatherSynergyBonus(host.currentWeather, attacker.attackType)
        : 1.0;
      // Held item + Relic: crit chance (attacker is player)
      const critChance = (host.heldItemEffect.critChance ?? 0) + (attacker === host.player ? (host.relicEffects.critBonus ?? 0) : 0);
      const isCrit = attacker === host.player && critChance > 0 && Math.random() * 100 < critChance;
      const critMult = isCrit ? 1.5 : 1.0;
      // Relic: Wide Glass -- type advantage bonus (player attacking with super effective)
      const relicTypeAdvMult = (attacker === host.player && effectiveness >= 2.0 && (host.relicEffects.typeAdvantageBonus ?? 0) > 0) ? (1 + host.relicEffects.typeAdvantageBonus) : 1.0;
      // Apply difficulty playerDamageMult when defender is the player
      const diffDmgMult = defender === host.player ? host.difficultyMods.playerDamageMult : 1.0;
      // Type Gem boost: +50% if player has active gem matching attack type
      const basicGemBoost = (attacker === host.player && host.activeTypeGems.has(attacker.attackType))
        ? 1 + (host.activeTypeGems.get(attacker.attackType)! / 100) : 1.0;
      const dmg = Math.max(1, Math.floor(baseDmg * effectiveness * abilityMult * scaledWMult * synergyBonus * critMult * relicTypeAdvMult * diffDmgMult * basicGemBoost));
      defender.stats.hp = Math.max(0, defender.stats.hp - dmg);

      // Fire-type attacks thaw frozen targets
      if (attacker.attackType === PokemonType.Fire && thawEntity(defender)) {
        host.showLog(`${defender.name} was thawed by the fire attack!`);
        host.updateStatusTint(defender);
      }

      // Sound effects based on effectiveness
      if (isCrit) sfxCritical();
      else if (effectiveness >= 2) sfxSuperEffective();
      else if (effectiveness <= 0.5 && effectiveness > 0) sfxNotEffective();
      else sfxHit();

      this.flashEntity(defender, effectiveness);
      if (isCrit) this.showCritFlash(defender);
      if (defender.sprite) {
        this.showDamagePopup(defender.sprite.x, defender.sprite.y, dmg, effectiveness, undefined, isCrit, attacker.attackType);
        if (defender !== host.player) this.showEnemyHpBar(defender);
      }

      let logMsg = `${attacker.name} attacks ${defender.name}! ${dmg} dmg!`;
      if (isCrit) logMsg += " Critical hit!";
      if (effText) logMsg += ` ${effText}`;
      if (abilityMult > 1) logMsg += " (Torrent!)";
      if (scaledWMult !== 1.0) logMsg += ` (${WEATHERS[host.currentWeather].name}!)`;
      if (synergyBonus > 1.0) logMsg += " (Weather Synergy!)";
      if (basicGemBoost > 1.0) logMsg += ` (${attacker.attackType} Gem!)`;
      host.showLog(logMsg);

      // Run log: damage dealt/taken (basic attack)
      if (attacker === host.player) {
        host.runLog.add(RunLogEvent.DamageDealt, `${dmg}`, host.currentFloor, host.turnManager.turn);
      } else if (defender === host.player) {
        host.runLog.add(RunLogEvent.DamageTaken, `${dmg}`, host.currentFloor, host.turnManager.turn);
      }

      // Relic: Shell Bell -- heal % of damage dealt (player attacking)
      if (attacker === host.player && dmg > 0 && (host.relicEffects.lifeStealPercent ?? 0) > 0) {
        const shellHeal = Math.max(1, Math.floor(dmg * host.relicEffects.lifeStealPercent / 100));
        if (host.player.stats.hp < host.player.stats.maxHp) {
          host.player.stats.hp = Math.min(host.player.stats.maxHp, host.player.stats.hp + shellHeal);
          if (host.player.sprite) this.showHealPopup(host.player.sprite.x, host.player.sprite.y, shellHeal);
        }
      }

      // Score chain: type-effective basic attack by player
      if (attacker === host.player && effectiveness >= 2.0) {
        addChainAction(host.scoreChain, "effective");
        host.chainActionThisTurn = true;
        host.updateChainHUD();
      }
      // Score chain: player took damage from basic attack -> reset chain
      if (defender === host.player && dmg > 0) {
        if (host.scoreChain.currentMultiplier > 1.0) {
          resetChain(host.scoreChain);
          host.showLog("Chain broken!");
          host.updateChainHUD();
        }
      }

      // Ability: Static -- paralyze chance scaled by ability level
      if (defender.ability === AbilityId.Static && Math.random() < getStaticChance(defender.abilityLevel ?? 1)) {
        if (!attacker.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          attacker.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 2 });
          host.showLog(`${defender.name}'s Static paralyzed ${attacker.name}!`);
        }
      }

      // Ability: Flame Body -- burn chance scaled by ability level
      if (defender.ability === AbilityId.FlameBody && Math.random() < getFlameBodyChance(defender.abilityLevel ?? 1)) {
        if (!attacker.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          attacker.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 3 });
          host.showLog(`${defender.name}'s Flame Body burned ${attacker.name}!`);
        }
      }

      // Thorns enchantment: reflect 10% damage back to attacker when player is hit
      if (host.enchantment?.id === "thorns" && defender === host.player && attacker.alive && dmg > 0) {
        const thornsDmg = Math.max(1, Math.floor(dmg * 0.1));
        attacker.stats.hp = Math.max(0, attacker.stats.hp - thornsDmg);
        if (attacker.sprite) {
          this.showDamagePopup(attacker.sprite.x, attacker.sprite.y, thornsDmg, 1.0, `${thornsDmg} Thorns`);
        }
        host.showLog(`Thorns reflected ${thornsDmg} damage!`);
        host.checkDeath(attacker);
      }

      // WindyFloor: knockback defender 1 tile away from attacker
      if (host.floorEvent?.type === FloorEventType.WindyFloor && defender.alive && defender.sprite) {
        host.applyWindyKnockback(attacker, defender);
      }

      host.updateHUD();
      host.checkDeath(defender);
      scene.time.delayedCall(250, resolve);
    });
  }

  /** Skill-based attack -- variable range, typed damage, effects */
  performSkill(user: Entity, skill: Skill, dir: Direction): Promise<void> {
    const host = this.host;
    const scene = host.scene;
    return new Promise((resolve) => {
      user.facing = dir;
      user.sprite!.play(`${user.spriteKey}-idle-${dir}`);

      sfxSkill();

      // Run log: skill used (only player skills)
      if (user === host.player) {
        host.runLog.add(RunLogEvent.SkillUsed, skill.name, host.currentFloor, host.turnManager.turn);
      }

      // Self-targeting (buff/heal)
      if (skill.range === SkillRange.Self) {
        this.applySkillEffect(user, user, skill);
        host.showLog(`${user.name} used ${skill.name}!`);
        scene.time.delayedCall(250, resolve);
        return;
      }

      // Get target tiles
      const tiles = getSkillTargetTiles(
        skill.range, user.tileX, user.tileY, dir,
        host.dungeon.terrain, host.dungeon.width, host.dungeon.height
      );

      // Show visual effect on target tiles
      this.showSkillEffect(tiles, skill);

      // Find entities on those tiles (friendly fire prevention)
      const isUserFriendly = user === host.player || user.isAlly;
      const targets = host.allEntities.filter(e => {
        if (!e.alive || e === user) return false;
        if (!tiles.some(t => t.x === e.tileX && t.y === e.tileY)) return false;
        // Friendly = player or ally; don't hit same team
        const isTargetFriendly = e === host.player || e.isAlly;
        return isUserFriendly !== isTargetFriendly;
      });

      if (targets.length === 0) {
        host.showLog(`${user.name} used ${skill.name}! But it missed!`);
        scene.time.delayedCall(200, resolve);
        return;
      }

      // Apply damage to each target
      let totalHits = 0;
      for (const target of targets) {
        // Accuracy check (NoGuard: always hit)
        const noGuard = user.ability === AbilityId.NoGuard || target.ability === AbilityId.NoGuard;
        if (!noGuard && Math.random() * 100 > skill.accuracy) {
          host.showLog(`${user.name}'s ${skill.name} missed ${target.name}!`);
          continue;
        }

        if (skill.power > 0) {
          // Shadow Dance combo: 100% dodge for player against enemy skills
          if (target === host.player && host.comboShadowDanceTurns > 0) {
            sfxDodge();
            host.showLog(`${target.name} dodged ${user.name}'s ${skill.name} with Shadow Dance!`);
            if (target.sprite) {
              this.showDamagePopup(target.sprite.x, target.sprite.y, 0, 1, "Shadow Dance!");
            }
            continue;
          }
          // Held item + ability dodge chance (target is player, attacker is enemy)
          let skillDodge = host.heldItemEffect.dodgeChance ?? 0;
          if (target.ability === AbilityId.RunAway) skillDodge += getRunAwayDodgeBonus(target.abilityLevel ?? 1) * 100;
          if (target.ability === AbilityId.Levitate) skillDodge += getLevitateDodgeBonus(target.abilityLevel ?? 1) * 100;
          if (target === host.player && !user.isAlly && user !== host.player && skillDodge > 0 && Math.random() * 100 < skillDodge) {
            sfxDodge();
            host.showLog(`${target.name} dodged ${user.name}'s ${skill.name}!`);
            if (target.sprite) {
              this.showDamagePopup(target.sprite.x, target.sprite.y, 0, 1, "Dodged!");
            }
            continue;
          }

          let effectiveness = getEffectiveness(skill.type, target.types);
          // InverseFloor: reverse type effectiveness
          if (host.floorEvent?.type === FloorEventType.InverseFloor) {
            effectiveness = invertEffectiveness(effectiveness);
          }
          const effText = effectivenessText(effectiveness);
          let skillAtk = getEffectiveAtk(user);
          let skillDef = getEffectiveDef(target);
          // Relic: ATK/DEF multipliers (player only)
          if (user === host.player) skillAtk = Math.floor(skillAtk * (1 + (host.relicEffects.atkMult ?? 0)));
          if (target === host.player) skillDef = Math.floor(skillDef * (1 + (host.relicEffects.defMult ?? 0)));
          const baseDmg = Math.max(1, Math.floor(skill.power * skillAtk / 10) - Math.floor(skillDef / 2));
          const wMult = weatherDamageMultiplier(host.currentWeather, skill.type);
          // Weather intensity scales the weather multiplier deviation from 1.0
          const skillIntensityMult = INTENSITY_MULTIPLIER[host.currentWeatherIntensity];
          const skillScaledWMult = wMult === 1.0 ? 1.0 : 1.0 + (wMult - 1.0) * skillIntensityMult;
          // Weather synergy bonus for matching pokemon type (player only)
          const skillSynergyBonus = (user === host.player)
            ? 1.0 + getWeatherSynergyBonus(host.currentWeather, user.attackType)
            : 1.0;
          // Held item + Relic: crit chance (user is player)
          const skillCritChance = (host.heldItemEffect.critChance ?? 0) + (user === host.player ? (host.relicEffects.critBonus ?? 0) : 0);
          const skillIsCrit = user === host.player && (host.comboCritGuarantee || (skillCritChance > 0 && Math.random() * 100 < skillCritChance));
          const skillCritMult = skillIsCrit ? 1.5 : 1.0;
          // Skill Combo: damage multiplier (Dragon's Rage 3x > DoubleDamage 2x)
          const comboMult = (user === host.player && host.comboDragonsRage) ? 3.0
            : (user === host.player && host.comboDoubleDamage) ? 2.0 : 1.0;
          // Relic: Wide Glass -- type advantage bonus
          const skillRelicTypeAdvMult = (user === host.player && effectiveness >= 2.0 && (host.relicEffects.typeAdvantageBonus ?? 0) > 0) ? (1 + host.relicEffects.typeAdvantageBonus) : 1.0;
          // Apply difficulty playerDamageMult when target is the player
          const skillDiffDmgMult = target === host.player ? host.difficultyMods.playerDamageMult : 1.0;
          // Type Gem boost: +50% if player has active gem matching skill type
          const typeGemBoost = (user === host.player && host.activeTypeGems.has(skill.type))
            ? 1 + (host.activeTypeGems.get(skill.type)! / 100) : 1.0;
          const dmg = Math.max(1, Math.floor(baseDmg * effectiveness * skillScaledWMult * skillSynergyBonus * skillCritMult * comboMult * skillRelicTypeAdvMult * skillDiffDmgMult * typeGemBoost));
          target.stats.hp = Math.max(0, target.stats.hp - dmg);

          // Fire-type skills thaw frozen targets
          if (skill.type === PokemonType.Fire && thawEntity(target)) {
            host.showLog(`${target.name} was thawed by the fire attack!`);
            host.updateStatusTint(target);
          }

          this.flashEntity(target, effectiveness);
          if (skillIsCrit) this.showCritFlash(target);
          if (target.sprite) {
            this.showDamagePopup(target.sprite.x, target.sprite.y, dmg, effectiveness, undefined, skillIsCrit, skill.type);
            if (target !== host.player) this.showEnemyHpBar(target);
          }

          if (skillIsCrit) sfxCritical();

          let logMsg = `${user.name}'s ${skill.name} hit ${target.name}! ${dmg} dmg!`;
          if (skillIsCrit) logMsg += " Critical hit!";
          if (effText) logMsg += ` ${effText}`;
          if (skillScaledWMult !== 1.0) logMsg += ` (${WEATHERS[host.currentWeather].name}!)`;
          if (skillSynergyBonus > 1.0) logMsg += " (Weather Synergy!)";
          if (typeGemBoost > 1.0) logMsg += ` (${skill.type} Gem!)`;
          host.showLog(logMsg);

          // Run log: damage dealt/taken (skill attack)
          if (user === host.player) {
            host.runLog.add(RunLogEvent.DamageDealt, `${dmg}`, host.currentFloor, host.turnManager.turn);
          } else if (target === host.player) {
            host.runLog.add(RunLogEvent.DamageTaken, `${dmg}`, host.currentFloor, host.turnManager.turn);
          }

          // Relic: Shell Bell -- heal % of damage dealt (player using skill)
          if (user === host.player && dmg > 0 && (host.relicEffects.lifeStealPercent ?? 0) > 0) {
            const skillShellHeal = Math.max(1, Math.floor(dmg * host.relicEffects.lifeStealPercent / 100));
            if (host.player.stats.hp < host.player.stats.maxHp) {
              host.player.stats.hp = Math.min(host.player.stats.maxHp, host.player.stats.hp + skillShellHeal);
              if (host.player.sprite) this.showHealPopup(host.player.sprite.x, host.player.sprite.y, skillShellHeal);
            }
          }

          // Score chain: type-effective hit by player
          if (user === host.player && effectiveness >= 2.0) {
            addChainAction(host.scoreChain, "effective");
            host.chainActionThisTurn = true;
            host.updateChainHUD();
          }
          // Score chain: player took damage -> reset chain
          if (target === host.player && dmg > 0) {
            if (host.scoreChain.currentMultiplier > 1.0) {
              resetChain(host.scoreChain);
              host.showLog("Chain broken!");
              host.updateChainHUD();
            }
          }

          // Thorns enchantment: reflect 10% damage back when player is hit by skill
          if (host.enchantment?.id === "thorns" && target === host.player && user.alive && dmg > 0) {
            const skillThornsDmg = Math.max(1, Math.floor(dmg * 0.1));
            user.stats.hp = Math.max(0, user.stats.hp - skillThornsDmg);
            if (user.sprite) {
              this.showDamagePopup(user.sprite.x, user.sprite.y, skillThornsDmg, 1.0, `${skillThornsDmg} Thorns`);
            }
            host.showLog(`Thorns reflected ${skillThornsDmg} damage!`);
            host.checkDeath(user);
          }

          totalHits++;
        }

        // Apply effect
        this.applySkillEffect(user, target, skill);
        host.updateHUD();
        host.checkDeath(target);
      }

      // Consume combo flags after applying them
      if (user === host.player) {
        if (host.comboDoubleDamage) host.comboDoubleDamage = false;
        if (host.comboCritGuarantee) host.comboCritGuarantee = false;
        if (host.comboDragonsRage) host.comboDragonsRage = false;
      }

      if (totalHits === 0 && skill.power > 0) {
        host.showLog(`${user.name} used ${skill.name}!`);
      }

      // -- Team Combo Attack --
      // Only triggers on player attacks with power, when allies exist
      if (user === host.player && skill.power > 0 && totalHits > 0 && host.allies.length > 0) {
        for (const target of targets) {
          if (!target.alive) continue;
          // Find allies adjacent to this target (Chebyshev distance = 1)
          const adjacentAllies = host.allies.filter(ally => {
            if (!ally.alive) return false;
            const dx = Math.abs(ally.tileX - target.tileX);
            const dy = Math.abs(ally.tileY - target.tileY);
            return dx <= 1 && dy <= 1 && (dx + dy > 0);
          });

          if (adjacentAllies.length > 0 && Math.random() < 0.25) {
            const comboAlly = adjacentAllies[Math.floor(Math.random() * adjacentAllies.length)];
            const comboAtk = getEffectiveAtk(comboAlly);
            const comboDmg = Math.max(1, Math.floor(comboAtk * 0.5));
            target.stats.hp = Math.max(0, target.stats.hp - comboDmg);

            // Log
            host.showLog(`COMBO! ${comboAlly.name} follows up for ${comboDmg} damage!`);
            sfxCombo();

            // Camera shake
            scene.cameras.main.shake(100, 0.005);

            // Flash the ally sprite
            if (comboAlly.sprite) {
              scene.tweens.add({
                targets: comboAlly.sprite,
                alpha: { from: 1, to: 0.3 },
                duration: 100,
                yoyo: true,
                repeat: 1,
              });
            }

            // Damage popup on target
            if (target.sprite) {
              this.showDamagePopup(target.sprite.x, target.sprite.y, comboDmg, 1.0);
              this.showEnemyHpBar(target);
            }

            // "COMBO!" floating text at target position
            const comboTextX = target.tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
            const comboTextY = target.tileY * TILE_DISPLAY - 20;
            const comboText = scene.add.text(comboTextX, comboTextY, "COMBO!", {
              fontSize: "12px",
              color: "#fbbf24",
              fontFamily: "monospace",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(300);

            scene.tweens.add({
              targets: comboText,
              y: comboTextY - 30,
              alpha: 0,
              duration: 800,
              onComplete: () => comboText.destroy(),
            });

            // Check if enemy defeated by combo
            host.updateHUD();
            host.checkDeath(target);
          }
        }
      }

      host.updateHUD();
      scene.time.delayedCall(300, resolve);
    });
  }

  /** Apply status/buff/debuff effects from a skill */
  applySkillEffect(user: Entity, target: Entity, skill: Skill) {
    const host = this.host;
    const scene = host.scene;
    if (!skill.effect || skill.effect === SkillEffect.None) return;
    const chance = skill.effectChance ?? 100;
    if (Math.random() * 100 > chance) return;

    // ShieldDust: immune to harmful secondary effects from enemy skills
    const harmfulEffects = [
      SkillEffect.Paralyze, SkillEffect.Burn, SkillEffect.Frozen,
      SkillEffect.BadlyPoisoned, SkillEffect.Flinch, SkillEffect.Drowsy, SkillEffect.Cursed,
    ];
    if (target.ability === AbilityId.ShieldDust && user !== target &&
        harmfulEffects.includes(skill.effect)) {
      host.showLog(`${target.name}'s Shield Dust blocked the effect!`);
      return;
    }

    switch (skill.effect) {
      case SkillEffect.AtkUp:
        target.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        sfxBuff();
        host.showLog(`${target.name}'s ATK rose! (10 turns)`);
        if (target.sprite) target.sprite.setTint(0xff8844);
        scene.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;

      case SkillEffect.DefUp:
        target.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        host.showLog(`${target.name}'s DEF rose! (10 turns)`);
        break;

      case SkillEffect.Heal: {
        const healAmt = Math.floor(target.stats.maxHp * 0.3);
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmt);
        host.showLog(`${target.name} recovered ${healAmt} HP!`);
        if (target.sprite) {
          target.sprite.setTint(0x44ff44);
          this.showHealPopup(target.sprite.x, target.sprite.y, healAmt);
        }
        scene.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;
      }

      case SkillEffect.Paralyze:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
          host.showLog(`${target.name} was paralyzed! (3 turns)`);
          if (target.sprite) target.sprite.setTint(0xffff00);
          scene.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        }
        break;

      case SkillEffect.Burn:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          target.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
          host.showLog(`${target.name} was burned! (5 turns)`);
        }
        break;

      case SkillEffect.Frozen: {
        if (!target.statusEffects.some(s => s.type === SkillEffect.Frozen)) {
          const frozenTurns = 2 + Math.floor(Math.random() * 2); // 2-3 turns
          target.statusEffects.push({ type: SkillEffect.Frozen, turnsLeft: frozenTurns });
          host.showLog(`${target.name} was frozen solid! (${frozenTurns} turns)`);
          if (target.sprite) target.sprite.setTint(0x88ccff);
          scene.time.delayedCall(300, () => { if (target.sprite) host.updateStatusTint(target); });
        }
        break;
      }

      case SkillEffect.BadlyPoisoned:
        if (!target.statusEffects.some(s => s.type === SkillEffect.BadlyPoisoned)) {
          target.statusEffects.push({ type: SkillEffect.BadlyPoisoned, turnsLeft: 8, poisonCounter: 0 });
          host.showLog(`${target.name} was badly poisoned! (8 turns)`);
          if (target.sprite) target.sprite.setTint(0x9944cc);
          scene.time.delayedCall(300, () => { if (target.sprite) host.updateStatusTint(target); });
        }
        break;

      case SkillEffect.Flinch:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Flinch)) {
          target.statusEffects.push({ type: SkillEffect.Flinch, turnsLeft: 1 });
          host.showLog(`${target.name} flinched!`);
        }
        break;

      case SkillEffect.Drowsy:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Drowsy)) {
          target.statusEffects.push({ type: SkillEffect.Drowsy, turnsLeft: 3 });
          host.showLog(`${target.name} became drowsy! (3 turns)`);
          if (target.sprite) target.sprite.setTint(0xccaadd);
          scene.time.delayedCall(300, () => { if (target.sprite) host.updateStatusTint(target); });
        }
        break;

      case SkillEffect.Cursed:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Cursed)) {
          target.statusEffects.push({ type: SkillEffect.Cursed, turnsLeft: 8, curseTick: 0 });
          host.showLog(`${target.name} was cursed! (8 turns)`);
          if (target.sprite) target.sprite.setTint(0x553366);
          scene.time.delayedCall(300, () => { if (target.sprite) host.updateStatusTint(target); });
        }
        break;
    }
  }

  // ══════════════════════════════════════════════
  //  Visual Effects
  // ══════════════════════════════════════════════

  /** Flash entity sprite with color based on effectiveness */
  flashEntity(entity: Entity, effectiveness: number) {
    const scene = this.host.scene;
    if (!entity.sprite) return;
    const tintColor = effectiveness >= 2.0 ? 0xff2222 : effectiveness < 1.0 ? 0x8888ff : 0xff4444;
    entity.sprite.setTint(tintColor);
    scene.time.delayedCall(200, () => {
      if (entity.sprite) entity.sprite.clearTint();
    });

    // Screen shake for super effective
    if (effectiveness >= 2.0) {
      scene.cameras.main.shake(200, 0.008);
    }
  }

  /** Show visual effect on skill target tiles */
  showSkillEffect(tiles: { x: number; y: number }[], skill: Skill) {
    const scene = this.host.scene;
    const typeColors: Record<string, { color: number; symbol: string }> = {
      Water: { color: 0x3b82f6, symbol: "~" },
      Fire: { color: 0xef4444, symbol: "*" },
      Electric: { color: 0xfbbf24, symbol: "\u26A1" },
      Grass: { color: 0x22c55e, symbol: "\u2663" },
      Flying: { color: 0xa78bfa, symbol: ">" },
      Poison: { color: 0xa855f7, symbol: "\u2620" },
      Rock: { color: 0x92400e, symbol: "\u25C6" },
      Ground: { color: 0xd97706, symbol: "\u25B2" },
      Bug: { color: 0x84cc16, symbol: "\u25CF" },
      Fighting: { color: 0xdc2626, symbol: "\u270A" },
      Steel: { color: 0x94a3b8, symbol: "\u2B21" },
      Ghost: { color: 0x7c3aed, symbol: "\uD83D\uDC7B" },
      Psychic: { color: 0xec4899, symbol: "\uD83D\uDD2E" },
      Ice: { color: 0x67e8f9, symbol: "\u2744" },
      Dark: { color: 0x6b21a8, symbol: "\uD83C\uDF11" },
      Fairy: { color: 0xf9a8d4, symbol: "\u273F" },
      Dragon: { color: 0x7c3aed, symbol: "\uD83D\uDC09" },
      Normal: { color: 0xd1d5db, symbol: "\u2726" },
    };
    const tc = typeColors[skill.type] ?? typeColors.Normal;

    for (const t of tiles) {
      const px = t.x * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = t.y * TILE_DISPLAY + TILE_DISPLAY / 2;

      // Colored tile overlay
      const gfx = scene.add.graphics().setDepth(15);
      gfx.fillStyle(tc.color, 0.4);
      gfx.fillRect(t.x * TILE_DISPLAY, t.y * TILE_DISPLAY, TILE_DISPLAY, TILE_DISPLAY);

      // Symbol
      const sym = scene.add.text(px, py, tc.symbol, {
        fontSize: "16px", color: "#ffffff", fontFamily: "monospace",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(16);

      // Fade out
      scene.tweens.add({
        targets: [gfx, sym],
        alpha: { from: 1, to: 0 },
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => { gfx.destroy(); sym.destroy(); },
      });
    }
  }

  /** Floating damage number popup -- color-coded by effectiveness, size-scaled by damage */
  showDamagePopup(
    x: number, y: number, dmg: number, effectiveness: number,
    overrideText?: string, isCrit?: boolean, attackType?: PokemonType
  ) {
    const scene = this.host.scene;
    // Determine color by effectiveness
    let color: string;
    if (effectiveness === 0) color = "#999999";       // Immune -- gray
    else if (effectiveness >= 2.0) color = "#ff3333";  // Super effective -- red
    else if (effectiveness < 1.0) color = "#999999";   // Not very effective -- gray
    else color = "#ffffff";                             // Normal -- white

    // Critical hit overrides to gold
    if (isCrit) color = "#ffd700";

    // Build display text
    let displayText: string;
    if (overrideText) {
      displayText = overrideText;
    } else if (effectiveness === 0) {
      displayText = "Immune";
    } else if (isCrit) {
      displayText = `CRIT ${dmg}`;
    } else if (effectiveness >= 2.0) {
      displayText = `${dmg}!`;
    } else {
      displayText = `${dmg}`;
    }

    // Size scaling by damage amount
    let fontSize: number;
    if (effectiveness === 0) {
      fontSize = 10;
    } else if (effectiveness < 1.0) {
      fontSize = 10; // Not very effective -- small
    } else if (dmg >= 31) {
      fontSize = 16;
    } else if (dmg >= 16) {
      fontSize = 14;
    } else if (dmg >= 6) {
      fontSize = 12;
    } else {
      fontSize = 10;
    }

    // Super effective always at least 14px
    if (effectiveness >= 2.0 && fontSize < 14) fontSize = 14;
    // Crit always at least 14px
    if (isCrit && fontSize < 14) fontSize = 14;

    // Random horizontal offset for visual variety
    const xOffset = (Math.random() - 0.5) * 16;

    const popup = scene.add.text(x + xOffset, y - 10, displayText, {
      fontSize: `${fontSize}px`, color, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    // Scale bounce: start at 1.5x, settle to 1.0x
    popup.setScale(1.5);
    scene.tweens.add({
      targets: popup,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Float upward and fade
    scene.tweens.add({
      targets: popup,
      y: y - 45,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
    });

    // Massive damage (31+) bounce effect -- extra vertical wobble
    if (dmg >= 31 && effectiveness > 0) {
      scene.tweens.add({
        targets: popup,
        scaleX: { from: 1.3, to: 1.0 },
        scaleY: { from: 0.8, to: 1.0 },
        duration: 150,
        delay: 200,
        ease: "Bounce.easeOut",
      });
    }

    // Hit spark effect at impact point
    if (effectiveness > 0 && !overrideText) {
      this.showHitSpark(x, y, attackType);
    }
  }

  /** Hit spark effect -- brief colored circle at impact point */
  showHitSpark(x: number, y: number, attackType?: PokemonType) {
    const scene = this.host.scene;
    // Type-based spark colors
    const sparkColors: Partial<Record<PokemonType, number>> = {
      [PokemonType.Fire]: 0xff8c00,     // orange
      [PokemonType.Water]: 0x3b82f6,    // blue
      [PokemonType.Electric]: 0xfbbf24, // yellow
      [PokemonType.Grass]: 0x22c55e,    // green
      [PokemonType.Ice]: 0x67e8f9,      // cyan
      [PokemonType.Poison]: 0xa855f7,   // purple
      [PokemonType.Fighting]: 0xdc2626, // red
      [PokemonType.Ghost]: 0x7c3aed,    // violet
      [PokemonType.Psychic]: 0xec4899,  // pink
      [PokemonType.Dark]: 0x6b21a8,     // dark purple
    };
    const sparkColor = (attackType && sparkColors[attackType]) ? sparkColors[attackType]! : 0xffffff;

    const spark = scene.add.graphics().setDepth(49);
    spark.fillStyle(sparkColor, 0.9);
    spark.fillCircle(x, y, 8);
    // Outer glow ring
    spark.fillStyle(sparkColor, 0.4);
    spark.fillCircle(x, y, 14);

    scene.tweens.add({
      targets: spark,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1.0, to: 1.8 },
      scaleY: { from: 1.0, to: 1.8 },
      duration: 150,
      ease: "Quad.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  /** Brief flash effect on target for critical hits */
  showCritFlash(entity: Entity) {
    const scene = this.host.scene;
    if (!entity.sprite) return;
    // Bright gold flash
    entity.sprite.setTint(0xffd700);
    scene.time.delayedCall(100, () => {
      if (entity.sprite) entity.sprite.setTint(0xffffff);
      scene.time.delayedCall(80, () => {
        if (entity.sprite) entity.sprite.setTint(0xffd700);
        scene.time.delayedCall(100, () => {
          if (entity.sprite) entity.sprite.clearTint();
        });
      });
    });
  }

  /** Show temporary HP bar above an entity */
  showEnemyHpBar(entity: { sprite?: Phaser.GameObjects.Sprite; stats: { hp: number; maxHp: number } }) {
    const scene = this.host.scene;
    if (!entity.sprite || entity.stats.hp <= 0) return;
    const x = entity.sprite.x;
    const y = entity.sprite.y - 18;
    const barW = 24;
    const barH = 3;
    const ratio = Math.max(0, entity.stats.hp / entity.stats.maxHp);

    const bar = scene.add.graphics().setDepth(51);
    bar.fillStyle(0x000000, 0.7);
    bar.fillRect(x - barW / 2 - 1, y - 1, barW + 2, barH + 2);
    const barColor = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
    bar.fillStyle(barColor, 1);
    bar.fillRect(x - barW / 2, y, barW * ratio, barH);

    scene.tweens.add({
      targets: bar,
      alpha: { from: 1, to: 0 },
      delay: 1200,
      duration: 600,
      onComplete: () => bar.destroy(),
    });
  }

  /** Heal number popup (green, floats upward with bounce) */
  showHealPopup(x: number, y: number, amount: number) {
    const scene = this.host.scene;
    const xOffset = (Math.random() - 0.5) * 12;
    const popup = scene.add.text(x + xOffset, y - 10, `+${amount}`, {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    // Scale bounce on appearance
    popup.setScale(1.5);
    scene.tweens.add({
      targets: popup,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Float upward and fade
    scene.tweens.add({
      targets: popup,
      y: y - 45,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
    });
  }

  /** Floating stat gain popup for level-ups */
  showStatPopup(x: number, y: number, text: string, color: string, delay: number) {
    const scene = this.host.scene;
    scene.time.delayedCall(delay, () => {
      const popup = scene.add.text(x, y, text, {
        fontSize: "8px", color, fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(52);
      scene.tweens.add({
        targets: popup,
        y: y - 30,
        alpha: { from: 1, to: 0 },
        duration: 1200,
        ease: "Quad.easeOut",
        onComplete: () => popup.destroy(),
      });
    });
  }
}
