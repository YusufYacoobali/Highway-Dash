import { clamp, randomRange } from '@/core/math';
import { RUN_DIRECTOR } from '@/engine/config';
import type { GameSystem, RunEventId, SystemContext, WorldThemeId } from '@/engine/types';

export interface RunDirectorObserver {
  onEventStarted(event: RunEventId, theme: WorldThemeId): void;
  onThemeChanged(theme: WorldThemeId): void;
}

interface Beat {
  event: RunEventId;
  seconds: number;
}

/**
 * A run is a sequence of pressure/recovery beats, not one continuous spawn ramp.
 * The first lap is authored so every new player gets a strong 2-minute story;
 * after that the director remixes safe event beats indefinitely.
 */
const OPENING_BEATS: readonly Beat[] = [
  { event: 'cruise', seconds: 13 },
  { event: 'coinRush', seconds: 10 },
  { event: 'construction', seconds: 10 },
  { event: 'cruise', seconds: 7 },
  { event: 'tunnel', seconds: 14 },
  { event: 'nitroRush', seconds: 9 },
  { event: 'cruise', seconds: 7 },
  { event: 'police', seconds: 16 },
  { event: 'cruise', seconds: 7 },
  { event: 'roadblock', seconds: 11 },
  { event: 'coinRush', seconds: 10 },
];

const ENDLESS_POOL: readonly RunEventId[] = [
  'coinRush',
  'construction',
  'nitroRush',
  'police',
  'roadblock',
];

export class RunDirectorSystem implements GameSystem {
  readonly name = 'runDirector';

  private beatIndex = 0;
  private lastTheme: WorldThemeId = 'sunset';

  constructor(private readonly observer: RunDirectorObserver) {}

  update({ state, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;

    const nextTheme = themeForElapsed(state.elapsed, state.event);
    if (nextTheme !== state.theme) {
      state.theme = nextTheme;
      this.lastTheme = nextTheme;
      this.observer.onThemeChanged(nextTheme);
    }

    state.eventRemaining -= dt;
    if (state.eventRemaining <= 0) this.advanceBeat(state);

    const baseDifficulty = clamp(state.elapsed / RUN_DIRECTOR.endlessDifficultySeconds, 0, 1);
    const eventPressure = pressureForEvent(state.event);
    state.intensity = clamp(baseDifficulty * 0.72 + eventPressure, 0, 1);
    state.trafficIntensity = clamp(0.48 + baseDifficulty * 0.42 + eventPressure * 0.6, 0.38, 1.08);

    // Wanted level amplifies an authored police beat instead of silently killing the player.
    state.policePressure = clamp((state.stars - 1) / 4, 0, 1);
    if (state.stars >= 3) state.trafficIntensity = Math.min(1.08, state.trafficIntensity + 0.08);

    if (state.event === 'nitroRush') state.nitroCooldown = Math.min(state.nitroCooldown, 0.25);
  }

  reset({ state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.beatIndex = 0;
    this.lastTheme = 'sunset';
    state.event = 'cruise';
    state.eventRemaining = state.mode === 'run' ? OPENING_BEATS[0].seconds : 9999;
    state.eventSerial = 0;
    state.theme = 'sunset';
    state.intensity = 0;
    state.trafficIntensity = 0.48;
    state.policePressure = 0;
  }

  private advanceBeat(state: SystemContext['state']): void {
    if (this.beatIndex < OPENING_BEATS.length - 1) {
      this.beatIndex += 1;
      const beat = OPENING_BEATS[this.beatIndex];
      this.start(state, beat.event, beat.seconds);
      return;
    }

    // Endless mode always inserts recovery after a spectacle beat.
    if (state.event !== 'cruise') {
      this.start(state, 'cruise', RUN_DIRECTOR.recoverySeconds);
      return;
    }

    let event = ENDLESS_POOL[Math.floor(Math.random() * ENDLESS_POOL.length)];
    if (state.stars < 2 && event === 'police') event = 'construction';
    if (state.stars < 4 && event === 'roadblock' && Math.random() < 0.55) event = 'coinRush';
    this.start(
      state,
      event,
      randomRange(RUN_DIRECTOR.eventMinSeconds, RUN_DIRECTOR.eventMaxSeconds),
    );
  }

  private start(state: SystemContext['state'], event: RunEventId, seconds: number): void {
    state.event = event;
    state.eventRemaining = seconds;
    state.eventSerial += 1;

    const nextTheme = themeForElapsed(state.elapsed, event);
    if (nextTheme !== state.theme) {
      state.theme = nextTheme;
      this.lastTheme = nextTheme;
      this.observer.onThemeChanged(nextTheme);
    }

    this.observer.onEventStarted(event, state.theme);
  }
}

function pressureForEvent(event: RunEventId): number {
  switch (event) {
    case 'cruise':
      return 0;
    case 'coinRush':
      return -0.08;
    case 'construction':
      return 0.12;
    case 'tunnel':
      return 0.06;
    case 'nitroRush':
      return 0.08;
    case 'police':
      return 0.16;
    case 'roadblock':
      return 0.22;
  }
}

function themeForElapsed(elapsed: number, event: RunEventId): WorldThemeId {
  if (event === 'tunnel') return 'tunnel';
  if (elapsed < 30) return 'sunset';
  if (elapsed < 52) return 'forest';
  if (elapsed < 70) return 'tunnel';
  if (elapsed < 116) return 'night';
  if (elapsed < 158) return 'coast';
  return 'storm';
}
