import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { everyOtherDay, type CadencePolicy } from './CadencePolicy';
import { copyForOccurrence, type PlayerSnapshot } from './notificationCopy';

/** Local hour the reminder fires — early evening, when casual sessions peak. */
const PREFERRED_HOUR = 18;
/** How many future reminders are kept on the OS queue at any time. */
const SCHEDULE_DEPTH = 8;
const CHANNEL_ID = 'engagement';

export interface NotificationScheduler {
  configure(): Promise<void>;
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  rescheduleReminders(player: PlayerSnapshot): Promise<number>;
  cancelAll(): Promise<void>;
}

/**
 * Schedules the every-other-day re-engagement reminders.
 *
 * Rather than one repeating trigger, a rolling window of dated notifications is
 * queued. That is what makes it possible to vary the copy per occurrence and to
 * pin every reminder to the same friendly local hour instead of drifting by
 * whenever the app happened to be opened.
 */
export class ExpoNotificationService implements NotificationScheduler {
  constructor(private readonly cadence: CadencePolicy = everyOtherDay) {}

  async configure(): Promise<void> {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Race reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#FFC42E',
        vibrationPattern: [0, 200, 100, 200],
      });
    }
  }

  async hasPermission(): Promise<boolean> {
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  }

  async requestPermission(): Promise<boolean> {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;

    const { granted } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return granted;
  }

  /**
   * Clears the queue and re-fills it starting two days from now. Called on
   * every launch, so an active player's reminders are continually pushed back
   * and they only hear from us once they actually lapse.
   */
  async rescheduleReminders(player: PlayerSnapshot): Promise<number> {
    if (!(await this.hasPermission())) return 0;

    await this.cancelAll();

    const now = Date.now();
    let scheduled = 0;

    for (let index = 0; index < SCHEDULE_DEPTH; index++) {
      const fireAt = alignToPreferredHour(this.cadence.occurrenceAt(now, index + 1));
      if (fireAt <= now) continue;

      const { title, body } = copyForOccurrence(index, player);
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: false, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
      });
      scheduled += 1;
    }

    return scheduled;
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

/** Moves a timestamp to {@link PREFERRED_HOUR} on the same local day. */
function alignToPreferredHour(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(PREFERRED_HOUR, 0, 0, 0);
  return date.getTime();
}
