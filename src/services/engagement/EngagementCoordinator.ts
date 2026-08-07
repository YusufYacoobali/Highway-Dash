import type { KeyValueStore } from '@/services/storage/keyValueStore';
import type { NotificationScheduler } from './NotificationService';
import type { PlayerSnapshot } from './notificationCopy';
import type { ReviewPrompter } from './ReviewService';

const PERMISSION_ASKED_KEY = 'highway-dash/notifications/asked';
/** Ask for notifications only once the player has finished a couple of runs. */
const RUNS_BEFORE_PERMISSION_PROMPT = 2;

export interface RunCompletedContext {
  player: PlayerSnapshot;
  totalRuns: number;
  isNewBest: boolean;
}

/**
 * Single place that decides *when* re-engagement happens; the two services
 * below it only know *how*. Keeping the timing policy here means the "every
 * other day" product rule is stated once and can be changed once.
 */
export class EngagementCoordinator {
  constructor(
    private readonly notifications: NotificationScheduler,
    private readonly review: ReviewPrompter,
    private readonly storage: KeyValueStore,
  ) {}

  /** Runs once at launch, before the menu is interactive. */
  async onAppStart(player: PlayerSnapshot): Promise<void> {
    await this.notifications.configure();
    await this.notifications.rescheduleReminders(player);
  }

  /**
   * Re-arms the reminder window every time the player returns, so the next
   * nudge is always two days after their last real session.
   */
  async onAppForeground(player: PlayerSnapshot): Promise<void> {
    await this.notifications.rescheduleReminders(player);
  }

  /**
   * The end of a run is the only moment both prompts make sense: the player
   * has just experienced the game and is looking at their score.
   */
  async onRunCompleted({ player, totalRuns, isNewBest }: RunCompletedContext): Promise<void> {
    await this.maybeAskForNotifications(totalRuns, player);
    await this.review.maybePrompt({ totalRuns, isPositiveMoment: isNewBest || totalRuns % 5 === 0 });
  }

  private async maybeAskForNotifications(
    totalRuns: number,
    player: PlayerSnapshot,
  ): Promise<void> {
    if (totalRuns < RUNS_BEFORE_PERMISSION_PROMPT) return;
    if (await this.storage.getItem(PERMISSION_ASKED_KEY)) return;

    await this.storage.setItem(PERMISSION_ASKED_KEY, '1');
    const granted = await this.notifications.requestPermission();
    if (granted) await this.notifications.rescheduleReminders(player);
  }
}
