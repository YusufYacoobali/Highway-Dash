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

interface ThemeWindow {
  start: number;
  theme: WorldThemeId;
}

const EARLY_EVENTS: readonly RunEventId[] = ['coinRush', 'construction', 'tunnel', 'nitroRush'];
const OPENING_LATE_EVENTS: readonly RunEventId[] = [
  'police',
  'roadblock',
  'coinRush',
  'construction',
  'nitroRush',
  'tunnel',
];
const ENDLESS_EVENTS: readonly RunEventId[] = [
  ...OPENING_LATE_EVENTS,
  'laneSqueeze',
];
const WORLD_THEMES: readonly WorldThemeId[] = [
  'forest',
  'night',
  'coast',
  'storm',
  'desert',
  'snow',
  'neon',
  'volcano',
];

/** Fresh event deck, durations, variants and world route are rolled every run. */
export class RunDirectorSystem implements GameSystem {
  readonly name = 'runDirector';

  private beatIndex = 0;
  private openingBeats: Beat[] = [];
  private themeWindows: ThemeWindow[] = [];
  private lastSpectacle: RunEventId = 'cruise';

  constructor(private readonly observer: RunDirectorObserver) {}

  update({ state, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;

    const nextTheme = this.themeForState(state.elapsed, state.event);
    if (nextTheme !== state.theme) {
      state.theme = nextTheme;
      this.observer.onThemeChanged(nextTheme);
    }

    state.laneCount = state.event === 'laneSqueeze' ? 3 : 4;

    state.eventRemaining -= dt;
    if (state.eventRemaining <= 0) this.advanceBeat(state);

    const baseDifficulty = clamp(state.elapsed / RUN_DIRECTOR.endlessDifficultySeconds, 0, 1);
    const lateDensity = clamp((state.elapsed - 55) / 120, 0, 1);
    const eventPressure = pressureForEvent(state.event);
    state.intensity = clamp(baseDifficulty * 0.68 + lateDensity * 0.18 + eventPressure, 0, 1);
    state.trafficIntensity = clamp(
      0.5 + baseDifficulty * 0.4 + lateDensity * 0.26 + eventPressure * 0.58,
      0.4,
      1.24,
    );

    state.policePressure = clamp((state.stars - 1) / 4, 0, 1);
    if (state.stars >= 3) state.trafficIntensity = Math.min(1.24, state.trafficIntensity + 0.08);
    if (state.event === 'nitroRush') state.nitroCooldown = Math.min(state.nitroCooldown, 0.18);
  }

  reset({ state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.beatIndex = 0;
    this.lastSpectacle = 'cruise';
    this.openingBeats = buildOpeningBeats();
    this.themeWindows = buildThemeWindows();

    const firstBeat = this.openingBeats[0] ?? { event: 'cruise' as const, seconds: 12 };
    state.event = firstBeat.event;
    state.eventVariant = rollEventVariant(firstBeat.event);
    state.eventRemaining = state.mode === 'run' ? firstBeat.seconds : 9999;
    state.eventSerial = 0;
    state.theme = 'sunset';
    state.intensity = 0;
    state.trafficIntensity = 0.5;
    state.policePressure = 0;
    state.laneCount = 4;
  }

  private advanceBeat(state: SystemContext['state']): void {
    if (this.beatIndex < this.openingBeats.length - 1) {
      this.beatIndex += 1;
      const beat = this.openingBeats[this.beatIndex];
      this.start(state, beat.event, beat.seconds);
      return;
    }

    if (state.event !== 'cruise') {
      this.start(state, 'cruise', randomRange(4.8, RUN_DIRECTOR.recoverySeconds + 1.5));
      return;
    }

    const event = this.pickEndlessEvent(state.stars, state.elapsed);
    this.start(state, event, randomRange(RUN_DIRECTOR.eventMinSeconds, RUN_DIRECTOR.eventMaxSeconds));
  }

  private pickEndlessEvent(stars: number, elapsed: number): RunEventId {
    let pool = [...ENDLESS_EVENTS].filter((event) => event !== this.lastSpectacle);
    if (stars < 2) pool = pool.filter((event) => event !== 'police');
    if (stars < 4 && Math.random() < 0.58) pool = pool.filter((event) => event !== 'roadblock');
    if (elapsed < 105) pool = pool.filter((event) => event !== 'laneSqueeze');
    if (pool.length === 0) pool = ['coinRush', 'construction', 'nitroRush'];
    return pool[Math.floor(Math.random() * pool.length)] ?? 'coinRush';
  }

  private start(state: SystemContext['state'], event: RunEventId, seconds: number): void {
    state.event = event;
    state.eventVariant = rollEventVariant(event);
    state.eventRemaining = seconds;
    state.eventSerial += 1;
    state.laneCount = event === 'laneSqueeze' ? 3 : 4;
    if (event !== 'cruise') this.lastSpectacle = event;

    const nextTheme = this.themeForState(state.elapsed, event);
    if (nextTheme !== state.theme) {
      state.theme = nextTheme;
      this.observer.onThemeChanged(nextTheme);
    }

    this.observer.onEventStarted(event, state.theme);
  }

  private themeForState(elapsed: number, event: RunEventId): WorldThemeId {
    if (event === 'tunnel') return 'tunnel';

    let theme: WorldThemeId = 'sunset';
    for (const window of this.themeWindows) {
      if (elapsed < window.start) break;
      theme = window.theme;
    }
    return theme;
  }
}

function buildOpeningBeats(): Beat[] {
  const beats: Beat[] = [{ event: 'cruise', seconds: randomRange(9.5, 13) }];
  const early = shuffled(EARLY_EVENTS).slice(0, 3);
  const late = shuffled(OPENING_LATE_EVENTS).slice(0, 4);

  for (const event of early) {
    beats.push({ event, seconds: durationForEvent(event, false) });
    beats.push({ event: 'cruise', seconds: randomRange(4.5, 7.2) });
  }

  let previous: RunEventId = early[early.length - 1] ?? 'cruise';
  for (let event of late) {
    if (event === previous) event = event === 'coinRush' ? 'construction' : 'coinRush';
    beats.push({ event, seconds: durationForEvent(event, true) });
    beats.push({ event: 'cruise', seconds: randomRange(4.8, 7.5) });
    previous = event;
  }

  return beats;
}

function buildThemeWindows(): ThemeWindow[] {
  const route = shuffled(WORLD_THEMES).slice(0, 7);
  let start = randomRange(24, 30);
  const windows: ThemeWindow[] = [];

  for (const theme of route) {
    windows.push({ start, theme });
    start += randomRange(25, 36);
  }

  return windows;
}

function rollEventVariant(event: RunEventId): number {
  if (event === 'cruise') return 0;
  if (Math.random() < 0.09) return 3;
  return Math.floor(Math.random() * 3);
}

function durationForEvent(event: RunEventId, late: boolean): number {
  switch (event) {
    case 'coinRush':
      return randomRange(8.5, 12.5);
    case 'construction':
      return randomRange(8, late ? 12.5 : 10.5);
    case 'tunnel':
      return randomRange(11, 16.5);
    case 'nitroRush':
      return randomRange(7.5, 11);
    case 'police':
      return randomRange(12, 18);
    case 'roadblock':
      return randomRange(9, 13.5);
    case 'laneSqueeze':
      return randomRange(11, 16);
    case 'cruise':
      return randomRange(5, 8);
  }
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pressureForEvent(event: RunEventId): number {
  switch (event) {
    case 'cruise':
      return 0;
    case 'coinRush':
      return -0.06;
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
    case 'laneSqueeze':
      return 0.15;
  }
}
