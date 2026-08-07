import { SCORING } from './config';
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
      coins: state.coins,
      combo: state.comboTimer > 0 ? state.combo : 0,
      stars: state.stars,
      started: state.started,
      nitroActive: state.nitroRemaining > 0,
      nitroReady: state.nitroRemaining <= 0 && state.nitroCooldown <= 0,
      event: state.event,
      eventRemaining: Math.max(0, Math.ceil(state.eventRemaining)),
      theme: state.theme,
      intensity: Math.round(state.intensity * 100) / 100,
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

function isSame(a: Telemetry, b: Telemetry): boolean {
  return (
    a.kmh === b.kmh &&
    a.distance === b.distance &&
    a.coins === b.coins &&
    a.combo === b.combo &&
    a.stars === b.stars &&
    a.started === b.started &&
    a.nitroActive === b.nitroActive &&
    a.nitroReady === b.nitroReady &&
    a.event === b.event &&
    a.eventRemaining === b.eventRemaining &&
    a.theme === b.theme &&
    a.intensity === b.intensity
  );
}
