import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { dayKey } from '@/domain/calendar';
import { useServices } from '@/services/ServiceContainer';
import { useProfileStore } from '@/state/profileStore';
import { playerSnapshot } from './playerSnapshot';

/**
 * Daily rollover and re-engagement scheduling, driven by the app lifecycle.
 *
 * Both run on launch and again on every foreground, because a hyper-casual
 * session is short enough that the app is frequently still resident when the
 * date — or the two-day reminder window — rolls over.
 */
export function useAppLifecycle(): void {
  const { engagement, feedback } = useServices();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const refresh = (isColdStart: boolean) => {
      const store = useProfileStore.getState();
      store.syncDaily(dayKey());

      const reward = store.claimStreak(dayKey());
      if (reward) feedback.play('reward');

      const snapshot = playerSnapshot(useProfileStore.getState());
      void (isColdStart ? engagement.onAppStart(snapshot) : engagement.onAppForeground(snapshot));
    };

    refresh(true);

    const subscription = AppState.addEventListener('change', (next) => {
      const returning = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (returning) refresh(false);
    });

    return () => subscription.remove();
  }, [engagement, feedback]);
}
