import { clamp01 } from '@/core/math';
import { DRAFT, SCORING } from './config';
import type { RunState, Telemetry } from './types';

/** Bridges the 60 fps simulation to React at a fixed, cheap sampling rate. */
export class TelemetryPublisher {
  private accumulator = 0;
  private readonly interval: number;
  private last: Telemetry | null = null;

  constructor(
    private readonly publish: (telemetry: Telemetry) => void,
    samplesPerSecond = 15,
  ) {
    this.interval = 1 / samplesPerSecond;
  }

  update(state: RunState, dt: number): void {
    this.accumulator += dt;
    if (this.accumulator < this.interval) return;
    this.accumulator = 0;

    const next: Telemetry = {
      kmh: Math.round(state.speed * SCORING.speedToKmh),
      distance: Math.round(state.distance * SCORING.distanceScale),
      score: Math.round(state.score),
      multiplier: Math.round(state.multiplier * 10) / 10,
      chainRemaining: Math.round(clamp01(state.comboTimer / SCORING.comboWindow) * 20) / 20,
      coins: state.coins,
      combo: state.comboTimer > 0 ? state.combo : 0,
      stars: state.stars,
      bustThreat: Math.round(clamp01(state.bustThreat) * 20) / 20,
      policeProximity: Math.round(clamp01(state.policeProximity) * 20) / 20,
      driftMode: state.driftModeRemaining > 0,
      draftCharge:
        Math.round(clamp01(state.draftCharge / DRAFT.chargeSeconds) * 20) / 20,
      drafting: state.drafting,
      gateApproaching: state.gateApproaching,
      gateRiskSide: state.gateRiskSide,
      gateKind: state.gateKind,
      gateBoostRemaining: Math.ceil(state.gateBoostRemaining),
      // Lets the gate UI light up whichever side the car is currently headed
      // for, so the choice is legible without looking away from the road.
      playerSide: state.x < 0 ? -1 : 1,
      started: state.started,
      nitroActive: state.nitroRemaining > 0,
      nitroReady:
        state.nitroRemaining <= 0 &&
        state.nitroGraceRemaining <= 0 &&
        state.nitroCooldown <= 0,
      nitroRemaining: roundTenth(state.nitroRemaining),
      nitroGraceActive: state.nitroGraceRemaining > 0,
      nitroGraceRemaining: roundTenth(state.nitroGraceRemaining),
      nitroSmashes: state.nitroSmashes,
      event: state.event,
      eventVariant: state.eventVariant,
      eventRemaining: Math.max(0, Math.ceil(state.eventRemaining)),
      theme: state.theme,
      intensity: Math.round(state.intensity * 100) / 100,
      laneCount: state.laneCount,
    };

    if (this.last && isSame(this.last, next)) return;
    this.last = next;
    this.publish(next);
  }

  reset(): void {
    this.accumulator = 0;
    this.last = null;
  }
}

function roundTenth(value: number): number {
  return Math.max(0, Math.ceil(value * 10) / 10);
}

function isSame(a: Telemetry, b: Telemetry): boolean {
  return (
    a.kmh === b.kmh &&
    a.distance === b.distance &&
    a.score === b.score &&
    a.multiplier === b.multiplier &&
    a.chainRemaining === b.chainRemaining &&
    a.coins === b.coins &&
    a.combo === b.combo &&
    a.stars === b.stars &&
    a.bustThreat === b.bustThreat &&
    a.policeProximity === b.policeProximity &&
    a.driftMode === b.driftMode &&
    a.draftCharge === b.draftCharge &&
    a.drafting === b.drafting &&
    a.gateApproaching === b.gateApproaching &&
    a.gateRiskSide === b.gateRiskSide &&
    a.gateKind === b.gateKind &&
    a.gateBoostRemaining === b.gateBoostRemaining &&
    a.playerSide === b.playerSide &&
    a.started === b.started &&
    a.nitroActive === b.nitroActive &&
    a.nitroReady === b.nitroReady &&
    a.nitroRemaining === b.nitroRemaining &&
    a.nitroGraceActive === b.nitroGraceActive &&
    a.nitroGraceRemaining === b.nitroGraceRemaining &&
    a.nitroSmashes === b.nitroSmashes &&
    a.event === b.event &&
    a.eventVariant === b.eventVariant &&
    a.eventRemaining === b.eventRemaining &&
    a.theme === b.theme &&
    a.intensity === b.intensity &&
    a.laneCount === b.laneCount
  );
}
