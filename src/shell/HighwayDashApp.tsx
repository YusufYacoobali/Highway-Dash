import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ServiceProvider } from '@/services/ServiceContainer';
import { useProfileStore } from '@/state/profileStore';
import { palette } from '@/ui/theme';
import { FONT_MANIFEST } from './fontManifest';
import { GameStage } from './GameStage';
import { useAppLifecycle } from './useAppLifecycle';

void SplashScreen.preventAutoHideAsync();

/**
 * Application root. It holds the splash screen until both the fonts and the
 * persisted profile are ready, so the first frame the player sees is already
 * the finished title screen rather than a flash of unstyled UI.
 */
export const HighwayDashApp: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts(FONT_MANIFEST);
  const [profileHydrated, setProfileHydrated] = useState(
    () => useProfileStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (profileHydrated) return;
    const unsubscribe = useProfileStore.persist.onFinishHydration(() => setProfileHydrated(true));
    void useProfileStore.persist.rehydrate();
    return unsubscribe;
  }, [profileHydrated]);

  const ready = (fontsLoaded || !!fontError) && profileHydrated;

  const handleLayout = useCallback(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={styles.boot} />;

  return (
    <SafeAreaProvider>
      <ServiceProvider>
        <StatusBar style="light" />
        <View style={styles.root} onLayout={handleLayout}>
          <BootstrappedStage />
        </View>
      </ServiceProvider>
    </SafeAreaProvider>
  );
};

/** Split out so the lifecycle hook can consume services from the provider above. */
const BootstrappedStage: React.FC = () => {
  useAppLifecycle();
  return <GameStage />;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.navy700 },
  boot: { flex: 1, backgroundColor: palette.navy800 },
});
