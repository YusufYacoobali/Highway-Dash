import * as Haptics from 'expo-haptics';

export type FeedbackCue =
  | 'tap'
  | 'nearMiss'
  | 'coin'
  | 'star'
  | 'crash'
  | 'reward'
  | 'ram'
  | 'event';

export interface FeedbackService {
  play(cue: FeedbackCue): void;
  setEnabled(enabled: boolean): void;
}

/** Fire-and-forget haptics. A dropped buzz must never stall the render loop. */
export class HapticsService implements FeedbackService {
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(cue: FeedbackCue): void {
    if (!this.enabled) return;

    switch (cue) {
      case 'tap':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop);
        break;
      case 'nearMiss':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(noop);
        break;
      case 'coin':
        void Haptics.selectionAsync().catch(noop);
        break;
      case 'star':
      case 'event':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(noop);
        break;
      case 'ram':
      case 'crash':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(noop);
        break;
      case 'reward':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop);
        break;
    }
  }
}

const noop = () => undefined;
