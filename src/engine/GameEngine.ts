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
  NITRO,
  ROAD_WIDTH,
  SCORING,
  STEER_LIMIT,
} from './config';
import { CameraSystem } from './systems/CameraSystem';
import { CrashSequence } from './systems/CrashSequence';
import { HeatSystem } from './systems/HeatSystem';
import { PickupSystem } from './systems/PickupSystem';
import { PlayerSystem } from './systems/PlayerSystem';
import { PoliceSystem } from './systems/PoliceSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { TrafficSystem } from './systems/TrafficSystem';
import { WorldScrollSystem } from './systems/WorldScrollSystem';
import { TelemetryPublisher } from './TelemetryPublisher';
import type {
  EngineEvents,
  EngineMode,
  GameSystem,
  RunState,
  SystemContext,
  VehicleObject,
} from './types';
import { VehicleWorkshop } from './vehicles/VehicleWorkshop';
import { buildRoad } from './world/RoadBuilder';
import { buildScenery } from './world/SceneryBuilder';
import { buildSky } from './world/SkyBuilder';

const MAX_FRAME_DELTA = 0.05;
const SPEED_RESPONSE = 3.2;
/** Speed the car holds before the player first touches the screen. */
const IDLE_RUN_SPEED = 44;

function createRunState(mode: EngineMode): RunState {
  return {
    mode,
    elapsed: 0,
    speed: mode === 'run' ? 30 : ATTRACT_SPEED,
    steerTarget: 0,
    x: 0,
    distance: 0,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    nearMisses: 0,
    stars: 0,
    starProgress: 0,
    wantedPeak: 0,
    secondsSinceNearMiss: 0,
    secondsAtMaxStars: 0,
    topSpeedKmh: 90,
    nitroRemaining: 0,
    nitroCooldown: 0,
    started: false,
    crashed: false,
    cameraShake: 0,
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
    const bands = [...buildRoad(this.scene), buildScenery(this.scene)];

    this.player = this.workshop.create({
      silhouette: car.silhouette,
      livery: { body: car.bodyColor, roof: car.roofColor },
      recolor: true,
    });
    this.player.position.set(0, 0, -2);
    this.scene.add(this.player);

    this.heatSystem = new HeatSystem({
      onStarGained: (stars) => this.events.emit('starGained', { stars }),
      onBusted: () => this.crash('BUSTED'),
    });
    this.crashSequence = new CrashSequence(this.camera);
    this.telemetry = new TelemetryPublisher((snapshot) => this.events.emit('telemetry', snapshot));

    this.systems = [
      new PlayerSystem(),
      new WorldScrollSystem(bands),
      new TrafficSystem(this.scene, this.workshop, {
        onNearMiss: () => this.handleNearMiss(),
        onImpact: () => this.crash('SMASHED'),
      }),
      new PickupSystem(this.scene, {
        onCoinCollected: (value) => {
          this.scoreSystem.registerCoins(this.state, value);
          this.events.emit('coinCollected', { total: this.state.coins });
        },
      }),
      this.scoreSystem,
      this.heatSystem,
      new PoliceSystem(this.scene, this.workshop),
      new CameraSystem(this.camera),
    ];

    this.resetSystems();
  }

  /* ----------------------------- public API ----------------------------- */

  /** Decode the glTF pack without mutating live scene objects. */
  async prepareHighDetailModels(): Promise<boolean> {
    if (this.disposed) return false;
    return this.workshop.prepareModels();
  }

  /** Apply an already-decoded glTF pack synchronously between gameplay frames. */
  activateHighDetailModels(): boolean {
    if (this.disposed) return false;
    return this.workshop.activatePreparedModels(this.player);
  }

  /** Legacy immediate helper retained for compatibility. */
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
    );
  }

  /** `fraction` is the touch position across the viewport, 0 (left) → 1 (right). */
  steerTo(fraction: number): void {
    if (this.state.mode !== 'run' || this.state.crashed) return;
    this.state.started = true;
    this.state.steerTarget = clamp((fraction - 0.5) * ROAD_WIDTH, -STEER_LIMIT, STEER_LIMIT);
  }

  fireNitro(): boolean {
    const { state } = this;
    if (state.mode !== 'run' || state.crashed) return false;
    if (state.nitroCooldown > 0) return false;

    state.nitroRemaining = this.tuning.nitroSeconds;
    state.nitroCooldown = this.tuning.nitroSeconds + NITRO.cooldownSeconds;
    state.started = true;
    this.events.emit('nitroFired', {});
    return true;
  }

  /** Ends the current run early and banks it. */
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
    const dt = Math.min(MAX_FRAME_DELTA, rawDt);

    if (this.state.crashed) {
      this.updateCrash(dt);
      return;
    }

    this.state.elapsed += dt;
    this.advanceSpeed(dt);
    this.state.distance += this.state.speed * dt;
    this.state.topSpeedKmh = Math.max(
      this.state.topSpeedKmh,
      Math.round(this.state.speed * SCORING.speedToKmh),
    );

    this.runSystems(dt, this.state.speed * dt);
    if (this.state.mode === 'run') this.telemetry.update(this.state, dt);
  }

  dispose(): void {
    this.disposed = true;
    for (const system of this.systems) system.dispose?.();
    this.events.clear();
    this.scene.clear();
  }

  /* ------------------------------ internals ----------------------------- */

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xeaf6ff, 0x4e7a3a, 0.95));

    const sun = new DirectionalLight(0xfff0d0, 1.5);
    sun.position.set(-16, 30, 12);
    this.scene.add(sun);
  }

  private advanceSpeed(dt: number): void {
    const { state, tuning } = this;

    if (state.mode === 'attract') {
      state.speed = ATTRACT_SPEED;
      return;
    }

    state.nitroRemaining = Math.max(0, state.nitroRemaining - dt);
    state.nitroCooldown = Math.max(0, state.nitroCooldown - dt);

    if (!state.started) {
      state.speed = IDLE_RUN_SPEED;
      return;
    }

    const rampProgress = Math.min(1, state.elapsed / Math.max(20, tuning.rampSeconds));
    const cruise = tuning.baseSpeed + rampProgress * tuning.speedGain;
    const target = state.nitroRemaining > 0 ? cruise * tuning.nitroMultiplier : cruise;

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

    // World/traffic/pickups can continue drifting in slow motion. PlayerSystem
    // and CameraSystem explicitly stand down while crashed so they do not
    // overwrite the tumble and cinematic camera from CrashSequence.
    this.runSystems(dt * slow, this.state.speed * dt * slow);

    if (shouldReport) this.events.emit('crashed', this.buildResult());
  }

  private handleNearMiss(): void {
    this.scoreSystem.registerNearMiss(this.state);
    this.heatSystem.registerNearMiss(this.state);
    this.events.emit('nearMiss', { combo: this.state.combo, stars: this.state.stars });
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
      distance: Math.round(state.distance * SCORING.distanceScale),
      coins: state.coins,
      nearMisses: state.nearMisses,
      bestCombo: state.bestCombo,
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
