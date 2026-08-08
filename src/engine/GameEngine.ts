import {
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
} from 'three';

import { Emitter } from '@/core/Emitter';
import { clamp, damp } from '@/core/math';
import type { CarDefinition } from '@/domain/cars';
import type { RunResult } from '@/domain/runResult';
import { BASE_TUNING, type RunTuning } from '@/domain/tuning';
import {
  ATTRACT_SPEED,
  CAMERA,
  CONTACT,
  DRAFT,
  NEAR_MISS,
  NITRO,
  ROAD_WIDTH,
  SCORING,
  SLOW_MO,
  STEER_LIMIT,
} from './config';
import { RiskGateSystem } from './systems/RiskGateSystem';
import { CameraSystem } from './systems/CameraSystem';
import { CrashSequence } from './systems/CrashSequence';
import { HeatSystem } from './systems/HeatSystem';
import { PickupSystem } from './systems/PickupSystem';
import { PlayerSystem } from './systems/PlayerSystem';
import { PoliceSystem } from './systems/PoliceSystem';
import { RoadLayoutSystem } from './systems/RoadLayoutSystem';
import { RunDirectorSystem } from './systems/RunDirectorSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { SpeedFxSystem } from './systems/SpeedFxSystem';
import { TrafficSystem } from './systems/TrafficSystem';
import { WorldScrollSystem } from './systems/WorldScrollSystem';
import { WorldThemeSystem } from './systems/WorldThemeSystem';
import { TelemetryPublisher } from './TelemetryPublisher';
import type {
  EngineEvents,
  EngineMode,
  GameSystem,
  GateKind,
  RunState,
  SystemContext,
  VehicleObject,
  WorldThemeId,
} from './types';
import { VehicleWorkshop } from './vehicles/VehicleWorkshop';
import { PLAYER_MODEL_ID } from './vehicles/vehicleModelConfig';
import { buildRoad } from './world/RoadBuilder';
import { buildScenery } from './world/SceneryBuilder';
import { buildSky } from './world/SkyBuilder';

const MAX_FRAME_DELTA = 0.05;
const SPEED_RESPONSE = 4.4;
const IDLE_RUN_SPEED = 50;
const ATTRACT_THEMES: readonly WorldThemeId[] = ['sunset', 'neon', 'night'];

function createRunState(mode: EngineMode): RunState {
  return {
    mode,
    elapsed: 0,
    speed: mode === 'run' ? IDLE_RUN_SPEED : ATTRACT_SPEED,
    steerTarget: 0,
    x: 0,
    steerVelocity: 0,
    distance: 0,
    score: 0,
    multiplier: SCORING.multiplierMin,
    bestMultiplier: SCORING.multiplierMin,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    nearMisses: 0,
    sideswipes: 0,
    stars: 0,
    starProgress: 0,
    wantedPeak: 0,
    secondsSinceNearMiss: 0,
    secondsAtMaxStars: 0,
    bustThreat: 0,
    policeProximity: 0,
    contactImmunityRemaining: 0,
    driftModeRemaining: 0,
    drafting: false,
    draftCharge: 0,
    draftSurgeRemaining: 0,
    drafts: 0,
    gateApproaching: false,
    gateRiskSide: 0,
    gateKind: 'double',
    gateBoostRemaining: 0,
    gatesTaken: 0,
    cameraNudge: 0,
    nearMissFlashRemaining: 0,
    topSpeedKmh: 120,
    nitroRemaining: 0,
    nitroCooldown: 0,
    nitroGraceRemaining: 0,
    nitroSmashes: 0,
    started: false,
    crashed: false,
    cameraShake: 0,
    slowMoRemaining: 0,
    slowMoScale: 1,
    slowMoCooldown: 0,
    event: 'cruise',
    eventVariant: 0,
    eventRemaining: 0,
    eventSerial: 0,
    theme: 'sunset',
    intensity: 0,
    trafficIntensity: 0.48,
    policePressure: 0,
    laneCount: 4,
  };
}

export interface GameEngineOptions {
  aspect: number;
  car: CarDefinition;
  tuning: RunTuning;
}

/** Composition root for the simulation and Three scene. */
export class GameEngine {
  readonly events = new Emitter<EngineEvents>();
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly workshop = new VehicleWorkshop();
  private readonly player: VehicleObject;
  private readonly systems: GameSystem[];
  private readonly scoreSystem = new ScoreSystem();
  private readonly heatSystem: HeatSystem;
  private readonly crashSequence: CrashSequence;
  private readonly telemetry: TelemetryPublisher;

  private state: RunState;
  private tuning: RunTuning;
  private disposed = false;

  constructor({ aspect, car, tuning }: GameEngineOptions) {
    this.tuning = tuning;
    this.state = createRunState('attract');

    this.scene.fog = new Fog(0x8fc7f5, 60, 190);
    this.camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
    this.camera.position.set(0, CAMERA.height, CAMERA.distance);
    this.camera.lookAt(0, 1.4, -14);

    this.addLights();
    buildSky(this.scene);
    const road = buildRoad(this.scene);
    const bands = [...road.bands, buildScenery(this.scene)];

    this.player = this.workshop.create({
      silhouette: car.silhouette,
      livery: { body: car.bodyColor, roof: car.roofColor },
      modelId: PLAYER_MODEL_ID,
      recolor: true,
    });
    this.player.position.set(0, 0, -2);
    this.scene.add(this.player);

    this.heatSystem = new HeatSystem({
      onStarGained: (stars) => this.events.emit('starGained', { stars }),
      onShookOff: (stars) => this.events.emit('shookOff', { stars }),
    });
    this.crashSequence = new CrashSequence(this.camera);
    this.telemetry = new TelemetryPublisher((snapshot) => this.events.emit('telemetry', snapshot));

    const director = new RunDirectorSystem({
      onEventStarted: (event, theme) => this.events.emit('eventStarted', { event, theme }),
      onThemeChanged: (theme) => this.events.emit('themeChanged', { theme }),
    });
    const worldTheme = new WorldThemeSystem(this.scene);
    const police = new PoliceSystem(this.scene, this.workshop, {
      onBust: () => this.crash('BUSTED'),
    });
    const speedFx = new SpeedFxSystem(this.scene, this.player);
    const gates = new RiskGateSystem(this.scene, {
      onGateApproaching: (riskSide, kind) =>
        this.events.emit('gateApproaching', { riskSide, kind }),
      onGateChosen: (risky, kind) => this.handleGateChosen(risky, kind),
    });

    this.systems = [
      director,
      gates,
      new PlayerSystem(),
      new WorldScrollSystem(bands),
      new RoadLayoutSystem(road.dashColumns),
      worldTheme,
      new TrafficSystem(this.scene, this.workshop, {
        onNearMiss: (side, gap) => this.handleNearMiss(side, gap),
        onImpact: () => this.crash('SMASHED'),
        onRam: (grace) => this.handleRam(grace),
        onSideswipe: (severity, side) => this.handleSideswipe(severity, side),
      }),
      new PickupSystem(this.scene, {
        onCoinCollected: (value) => {
          this.scoreSystem.registerCoins(this.state, value);
          this.events.emit('coinCollected', { total: this.state.coins });
        },
      }),
      this.scoreSystem,
      this.heatSystem,
      police,
      speedFx,
      new CameraSystem(this.camera),
    ];

    this.resetSystems();
  }

  async prepareHighDetailModels(): Promise<boolean> {
    if (this.disposed) return false;
    return this.workshop.prepareModels();
  }

  activateHighDetailModels(): boolean {
    if (this.disposed) return false;
    return this.workshop.activatePreparedModels(this.player);
  }

  async loadHighDetailModels(): Promise<boolean> {
    if (this.disposed) return false;
    return this.workshop.upgradeToModels(this.player);
  }

  setMode(mode: EngineMode): void {
    if (this.state.mode === mode && !this.state.crashed) return;
    this.state = createRunState(mode);
    this.telemetry.reset();
    this.resetSystems();
  }

  setTuning(tuning: RunTuning): void {
    this.tuning = tuning;
  }

  setPlayerCar(car: CarDefinition): void {
    this.workshop.reskin(
      this.player,
      car.silhouette,
      { body: car.bodyColor, roof: car.roofColor },
      true,
      PLAYER_MODEL_ID,
    );
  }

  steerTo(fraction: number): void {
    if (this.state.mode !== 'run' || this.state.crashed) return;
    this.state.started = true;
    this.state.steerTarget = clamp((fraction - 0.5) * ROAD_WIDTH, -STEER_LIMIT, STEER_LIMIT);
  }

  fireNitro(): boolean {
    const { state } = this;
    if (state.mode !== 'run' || state.crashed) return false;
    if (state.nitroCooldown > 0 || state.nitroGraceRemaining > 0) return false;

    state.nitroRemaining = this.tuning.nitroSeconds;
    state.nitroGraceRemaining = 0;
    state.nitroSmashes = 0;
    const cooldown = state.event === 'nitroRush' ? NITRO.frenzyCooldownSeconds : NITRO.cooldownSeconds;
    state.nitroCooldown = this.tuning.nitroSeconds + cooldown;
    state.started = true;
    state.cameraShake = Math.max(state.cameraShake, 1.25);
    state.slowMoRemaining = NITRO.ignitionHitStopSeconds;
    state.slowMoScale = NITRO.ignitionHitStopScale;
    this.events.emit('nitroFired', {});
    return true;
  }

  retire(): RunResult | null {
    if (this.state.mode !== 'run' || this.state.crashed) return null;

    const result = this.buildResult();
    this.state.mode = 'attract';
    this.state.started = false;
    return result;
  }

  setViewportAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(rawDt: number): void {
    if (this.disposed) return;
    const wallDt = Math.min(MAX_FRAME_DELTA, rawDt);

    if (this.state.crashed) {
      this.updateCrash(wallDt);
      return;
    }

    const slowScale = this.state.slowMoRemaining > 0 ? this.state.slowMoScale : 1;
    const dt = wallDt * slowScale;
    this.state.slowMoRemaining = Math.max(0, this.state.slowMoRemaining - wallDt);
    this.state.slowMoCooldown = Math.max(0, this.state.slowMoCooldown - wallDt);
    if (this.state.slowMoRemaining <= 0) this.state.slowMoScale = 1;

    this.state.elapsed += wallDt;
    // The immunity window runs on wall clock so slow-motion cannot stretch it.
    this.state.contactImmunityRemaining = Math.max(
      0,
      this.state.contactImmunityRemaining - wallDt,
    );
    this.advanceSpeed(dt);
    this.state.distance += this.state.speed * dt;
    this.state.topSpeedKmh = Math.max(
      this.state.topSpeedKmh,
      Math.round(this.state.speed * SCORING.speedToKmh),
    );

    this.runSystems(dt, this.state.speed * dt);
    // After the systems, because TrafficSystem decides `drafting` this frame.
    if (this.state.mode === 'run') this.advanceDraft(dt);
    if (this.state.mode === 'run') this.telemetry.update(this.state, wallDt);
  }

  dispose(): void {
    this.disposed = true;
    for (const system of this.systems) system.dispose?.();
    this.events.clear();
    this.scene.clear();
  }

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xeaf6ff, 0x4e7a3a, 0.95));

    const sun = new DirectionalLight(0xfff0d0, 1.5);
    sun.position.set(-16, 30, 12);
    this.scene.add(sun);
  }

  private advanceSpeed(dt: number): void {
    const { state, tuning } = this;

    if (state.mode === 'attract') {
      const phase = state.elapsed % 8.2;
      const burst = phase > 4.5 && phase < 6.25;
      state.nitroRemaining = burst ? 1 : 0;
      state.nitroGraceRemaining = 0;
      state.nitroSmashes = 0;
      state.theme = ATTRACT_THEMES[Math.floor(state.elapsed / 10.5) % ATTRACT_THEMES.length] ?? 'sunset';
      const target = ATTRACT_SPEED * (burst ? 2.05 : 1.22);
      state.speed = damp(state.speed, target, burst ? 5.5 : 2.2, dt);
      return;
    }

    const wasNitroActive = state.nitroRemaining > 0;
    state.nitroRemaining = Math.max(0, state.nitroRemaining - dt);
    state.nitroCooldown = Math.max(0, state.nitroCooldown - dt);
    state.nitroGraceRemaining = Math.max(0, state.nitroGraceRemaining - dt);

    if (wasNitroActive && state.nitroRemaining <= 0) {
      state.nitroGraceRemaining = Math.max(state.nitroGraceRemaining, NITRO.graceSeconds);
      state.cameraShake = Math.max(state.cameraShake, 0.55);
    }

    if (!state.started) {
      state.speed = IDLE_RUN_SPEED;
      return;
    }

    const rampProgress = Math.min(1, state.elapsed / Math.max(60, tuning.rampSeconds));
    const cruise = tuning.baseSpeed + rampProgress * tuning.speedGain;
    const surge = state.draftSurgeRemaining > 0 ? DRAFT.surgeMultiplier : 1;
    const target =
      (state.nitroRemaining > 0 ? cruise * tuning.nitroMultiplier : cruise) * surge;

    state.speed = damp(state.speed, target, SPEED_RESPONSE, dt);
  }

  private runSystems(dt: number, scroll: number): void {
    const ctx: SystemContext = {
      scene: this.scene,
      state: this.state,
      tuning: this.tuning,
      player: this.player,
      dt,
      scroll,
    };
    for (const system of this.systems) system.update(ctx);
  }

  private updateCrash(dt: number): void {
    const slow = this.crashSequence.slowFactor;
    const shouldReport = this.crashSequence.update(this.state, this.player, dt);
    this.runSystems(dt * slow, this.state.speed * dt * slow);

    if (shouldReport) this.events.emit('crashed', this.buildResult());
  }

  private handleNearMiss(side: number, gap: number): void {
    const { state } = this;
    this.scoreSystem.registerNearMiss(state);
    this.heatSystem.registerNearMiss(state);

    // Every pass inside the scoring window still scores and still kicks the
    // camera — but the kick scales with how close it actually was, so a car
    // two lanes over barely registers.
    const closeness = clamp(1 - gap / SLOW_MO.grazeGap, 0, 1);
    state.cameraNudge = side * NEAR_MISS.cameraNudge * (0.3 + closeness * 0.7);

    // Only a genuine squeeze earns the cinematic beat, and only once per
    // cooldown, so a wall of traffic cannot strobe the whole run.
    const closeCall = gap < SLOW_MO.grazeGap && state.slowMoCooldown <= 0;
    if (closeCall) {
      state.slowMoCooldown = SLOW_MO.cooldownSeconds;
      state.slowMoRemaining = SLOW_MO.nearMissSeconds;
      state.slowMoScale =
        gap < SLOW_MO.hugeGap ? SLOW_MO.hugeNearMissScale : SLOW_MO.nearMissScale;
      state.nearMissFlashRemaining = NEAR_MISS.flashSeconds;
    }

    this.events.emit('nearMiss', {
      combo: state.combo,
      stars: state.stars,
      closeCall,
      gap,
    });
  }

  private handleGateChosen(risky: boolean, kind: GateKind): void {
    this.scoreSystem.registerGate(this.state, risky);
    if (risky) this.state.cameraShake = Math.max(this.state.cameraShake, 1.1);
    this.events.emit('gateChosen', { risky, kind, multiplier: this.state.multiplier });
  }

  /**
   * Slipstreaming. Holding station in a car's wake charges a meter that pays
   * out in chain fuel and a short surge — which turns traffic from a pure
   * hazard into something worth getting close to on purpose.
   */
  private advanceDraft(dt: number): void {
    const { state } = this;
    state.draftSurgeRemaining = Math.max(0, state.draftSurgeRemaining - dt);

    if (!state.started || state.crashed) return;

    if (!state.drafting) {
      state.draftCharge = Math.max(0, state.draftCharge - DRAFT.decayRate * dt);
      return;
    }

    state.draftCharge += dt;
    state.nitroCooldown = Math.max(0, state.nitroCooldown - DRAFT.nitroCooldownCut * dt);
    if (state.draftCharge < DRAFT.chargeSeconds) return;

    state.draftCharge = 0;
    state.draftSurgeRemaining = DRAFT.surgeSeconds;
    this.scoreSystem.registerDraft(state, DRAFT.coins, DRAFT.multiplierBonus);
    this.events.emit('drafted', { chain: state.drafts, multiplier: state.multiplier });
  }

  private handleRam(grace: boolean): void {
    this.state.nitroSmashes += 1;
    this.scoreSystem.registerRam(this.state);
    this.state.slowMoRemaining = grace ? 0.045 : SLOW_MO.ramSeconds;
    this.state.slowMoScale = grace ? 0.62 : SLOW_MO.ramScale;
    this.events.emit('trafficRammed', {
      combo: this.state.combo,
      smashCount: this.state.nitroSmashes,
      grace,
    });
  }

  /**
   * A graze along the flank. It costs speed, most of the chain and control of
   * the line — but not the run. Dying to a wing mirror at 400 km/h is the
   * single least defensible death in this genre.
   */
  private handleSideswipe(severity: number, side: number): void {
    const { state } = this;

    state.speed *= CONTACT.sideswipeSpeedKeep;
    state.steerVelocity += side * CONTACT.sideswipeKnock * (0.6 + severity);
    // Only the first graze opens the window; later ones inside it do not
    // extend it, so a pile-up cannot be ridden out indefinitely.
    if (state.contactImmunityRemaining <= 0) {
      state.contactImmunityRemaining = CONTACT.sideswipeImmunitySeconds;
    }
    state.cameraShake = Math.max(state.cameraShake, CONTACT.sideswipeShake);
    state.slowMoRemaining = CONTACT.sideswipeSlowMoSeconds;
    state.slowMoScale = CONTACT.sideswipeSlowMoScale;
    this.scoreSystem.registerSideswipe(state);

    this.events.emit('sideswiped', { severity, multiplier: state.multiplier });
  }


  private crash(cause: RunResult['cause']): void {
    if (this.state.crashed || this.state.mode !== 'run') return;
    this.pendingCause = cause;
    this.crashSequence.begin(this.state);
  }

  private pendingCause: RunResult['cause'] = 'SMASHED';

  private buildResult(): RunResult {
    const { state } = this;
    return {
      cause: this.pendingCause,
      score: Math.round(state.score),
      distance: Math.round(state.distance * SCORING.distanceScale),
      coins: state.coins,
      nearMisses: state.nearMisses,
      sideswipes: state.sideswipes,
      bestCombo: state.bestCombo,
      bestMultiplier: Math.round(state.bestMultiplier * 10) / 10,
      topSpeed: state.topSpeedKmh,
      wantedPeak: state.wantedPeak,
      duration: state.elapsed,
    };
  }

  private resetSystems(): void {
    const ctx = {
      scene: this.scene,
      state: this.state,
      tuning: this.tuning,
      player: this.player,
    };
    for (const system of this.systems) system.reset?.(ctx);
  }
}

export const DEFAULT_TUNING = BASE_TUNING;
