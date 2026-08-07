import * as Haptics from 'expo-haptics';

export type FeedbackCue = 'tap' | 'nearMiss' | 'coin' | 'star' | 'crash' | 'reward';

export interface FeedbackService {
  play(cue: FeedbackCue): void;
  setEnabled(enabled: boolean): void;
}

/**
 * Thin, fire-and-forget haptics layer. Every call is deliberately unawaited —
 * a dropped buzz must never stall a frame — and unsupported devices simply
 * swallow the promise rejection.
 */
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
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(noop);
        break;
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
