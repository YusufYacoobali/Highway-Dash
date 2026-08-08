import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeTouchEvent,
  StyleSheet,
  View,
} from 'react-native';

import { dayKey } from '@/domain/calendar';
import { findCar, type CarDefinition } from '@/domain/cars';
import { describeCrateReward, type ShopBundle } from '@/domain/economy';
import type { RunResult } from '@/domain/runResult';
import { modifierForDay, type ModifierTone, type RunModifier } from '@/domain/runModifier';
import { totalUpgradeLevel, type UpgradeId } from '@/domain/upgrades';
import type { EngineEvents, Telemetry } from '@/engine/types';
import { CrashScreen } from '@/features/crash/CrashScreen';
import { GarageScreen } from '@/features/garage/GarageScreen';
import { MenuScreen } from '@/features/menu/MenuScreen';
import { MissionsScreen } from '@/features/missions/MissionsScreen';
import {
  isEventWarning,
  pushDraftPop,
  pushEventPop,
  pushGatePop,
  pushNearMissPop,
  pushNewBestPop,
  pushRamPop,
  pushShookOffPop,
  pushSideswipePop,
  pushWantedPop,
  usePopStore,
} from '@/features/run/popStore';
import { RunHud } from '@/features/run/RunHud';
import { SeasonScreen } from '@/features/season/SeasonScreen';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { UpgradesScreen } from '@/features/upgrades/UpgradesScreen';
import { GameSurface, type GameSurfaceHandle } from '@/game/GameSurface';
import { useTelemetryStore } from '@/game/telemetryStore';
import { useServices } from '@/services/ServiceContainer';
import { isSceneScreen, useNavigationStore, type ScreenId } from '@/state/navigationStore';
import {
  runTuningFor,
  selectClaimableMissions,
  useProfileStore,
} from '@/state/profileStore';
import { useRunStore } from '@/state/runStore';
import { palette } from '@/ui/theme';
import { playerSnapshot } from './playerSnapshot';

const NITRO_TOUCH_ZONE_WIDTH = 132;
const NITRO_TOUCH_ZONE_HEIGHT = 178;

/** The domain layer names a tone; the composition root resolves the colour. */
const MODIFIER_TONE_COLORS: Record<ModifierTone, string> = {
  neutral: palette.white,
  gold: palette.gold,
  red: palette.redHot,
  cyan: palette.cyanIce,
  green: palette.greenSoft,
};

/** Persistent 3D surface + React overlay composition root. */
export const GameStage: React.FC = () => {
  const { feedback, engagement } = useServices();
  const surface = useRef<GameSurfaceHandle | null>(null);
  const runBestTarget = useRef(0);
  const announcedBest = useRef(false);
  const stageSize = useRef({ width: 1, height: 1 });
  const steeringTouchId = useRef<number | null>(null);

  const screen = useNavigationStore((s) => s.screen);
  const navigate = useNavigationStore((s) => s.navigate);

  const selectedCarId = useProfileStore((s) => s.selectedCarId);
  const upgrades = useProfileStore((s) => s.upgrades);
  const today = useProfileStore((s) => s.daily.dayKey);
  const car = useMemo(() => findCar(selectedCarId), [selectedCarId]);
  // Keyed off the persisted day so it rotates with the rest of the dailies.
  const modifier = useMemo(() => modifierForDay(today || dayKey()), [today]);
  const tuning = useMemo(() => runTuningFor(car, upgrades, modifier), [car, upgrades, modifier]);

  const runToken = useRunStore((s) => s.runToken);
  const beginRun = useRunStore((s) => s.beginRun);

  const applyTelemetry = useTelemetryStore((s) => s.apply);
  const resetTelemetry = useTelemetryStore((s) => s.reset);
  const clearPops = usePopStore((s) => s.clear);

  const startRun = useCallback(() => {
    feedback.play('tap');
    runBestTarget.current = useProfileStore.getState().bestScore;
    announcedBest.current = false;
    steeringTouchId.current = null;
    resetTelemetry();
    clearPops();
    beginRun();
    navigate('run');
  }, [beginRun, clearPops, feedback, navigate, resetTelemetry]);

  const goTo = useCallback(
    (target: ScreenId) => () => {
      feedback.play('tap');
      navigate(target);
    },
    [feedback, navigate],
  );

  const bankRun = useCallback(
    (result: RunResult) => {
      const summary = useProfileStore.getState().completeRun(result);
      useRunStore.getState().setSummary(summary);

      const profile = useProfileStore.getState();
      void engagement.onRunCompleted({
        player: playerSnapshot(profile),
        totalRuns: profile.totalRuns,
        isNewBest: summary.isNewBest,
      });
    },
    [engagement],
  );

  const handleCrash = useCallback(
    (result: RunResult) => {
      steeringTouchId.current = null;
      feedback.play('crash');
      bankRun(result);
      navigate('crash');
    },
    [bankRun, feedback, navigate],
  );

  const handleTelemetry = useCallback(
    (snapshot: Telemetry) => {
      applyTelemetry(snapshot);
      if (
        !announcedBest.current &&
        runBestTarget.current > 0 &&
        snapshot.score > runBestTarget.current
      ) {
        announcedBest.current = true;
        feedback.play('reward');
        pushNewBestPop();
      }
    },
    [applyTelemetry, feedback],
  );

  const handleNearMiss = useCallback(
    ({ combo, closeCall }: EngineEvents['nearMiss']) => {
      // Praise and buzz ride the same gate as the slow-mo, so the three land
      // together as one beat instead of firing on every car in the next lane.
      if (!closeCall) return;
      feedback.play('nearMiss');
      pushNearMissPop(combo);
    },
    [feedback],
  );

  const handleStarGained = useCallback(
    ({ stars }: EngineEvents['starGained']) => {
      feedback.play('star');
      pushWantedPop(stars);
    },
    [feedback],
  );

  const handleShookOff = useCallback(() => {
    feedback.play('reward');
    pushShookOffPop();
  }, [feedback]);

  const handleCoinCollected = useCallback(() => feedback.play('coin'), [feedback]);

  const handleTrafficRammed = useCallback(
    ({ smashCount, grace }: EngineEvents['trafficRammed']) => {
      feedback.play(grace ? 'nearMiss' : 'ram');
      pushRamPop(smashCount, grace);
    },
    [feedback],
  );

  const handleSideswiped = useCallback(
    ({ multiplier }: EngineEvents['sideswiped']) => {
      feedback.play('ram');
      pushSideswipePop(multiplier);
    },
    [feedback],
  );

  const handleDrafted = useCallback(
    ({ chain }: EngineEvents['drafted']) => {
      feedback.play('star');
      pushDraftPop(chain);
    },
    [feedback],
  );

  const handleGateChosen = useCallback(
    ({ risky, kind }: EngineEvents['gateChosen']) => {
      feedback.play(risky ? 'reward' : 'tap');
      pushGatePop(risky, kind);
    },
    [feedback],
  );

  const handleEventStarted = useCallback(
    ({ event }: EngineEvents['eventStarted']) => {
      if (!isEventWarning(event)) return;
      feedback.play('event');
      pushEventPop(event);
    },
    [feedback],
  );

  const handleNitro = useCallback(() => {
    if (surface.current?.fireNitro()) feedback.play('nearMiss');
  }, [feedback]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    stageSize.current = { width: Math.max(1, width), height: Math.max(1, height) };
  }, []);

  const isNitroZone = useCallback((touch: NativeTouchEvent): boolean => {
    const { width, height } = stageSize.current;
    return touch.pageX > width - NITRO_TOUCH_ZONE_WIDTH && touch.pageY > height - NITRO_TOUCH_ZONE_HEIGHT;
  }, []);

  const steerFromTouch = useCallback((touch: NativeTouchEvent) => {
    const fraction = Math.max(0, Math.min(1, touch.pageX / stageSize.current.width));
    surface.current?.steerTo(fraction);
  }, []);

  const handleTouchStart = useCallback(
    (event: NativeSyntheticEvent<NativeTouchEvent>) => {
      if (screen !== 'run') return;

      const changedTouches = event.nativeEvent.changedTouches;
      if (changedTouches.some((touch) => isNitroZone(touch))) handleNitro();

      if (steeringTouchId.current !== null) return;
      const candidate = changedTouches.find((touch) => !isNitroZone(touch));
      if (!candidate) return;
      steeringTouchId.current = candidate.identifier;
      steerFromTouch(candidate);
    },
    [handleNitro, isNitroZone, screen, steerFromTouch],
  );

  const handleTouchMove = useCallback(
    (event: NativeSyntheticEvent<NativeTouchEvent>) => {
      if (screen !== 'run' || steeringTouchId.current === null) return;
      const steeringTouch = event.nativeEvent.touches.find(
        (touch) => touch.identifier === steeringTouchId.current,
      );
      if (steeringTouch) steerFromTouch(steeringTouch);
    },
    [screen, steerFromTouch],
  );

  const handleTouchEnd = useCallback((event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const endedSteeringTouch = event.nativeEvent.changedTouches.some(
      (touch) => touch.identifier === steeringTouchId.current,
    );
    if (endedSteeringTouch) steeringTouchId.current = null;
  }, []);

  return (
    <View
      style={styles.root}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <GameSurface
        mode={screen === 'run' || screen === 'crash' ? 'run' : 'attract'}
        car={car}
        tuning={tuning}
        runToken={runToken}
        paused={!isSceneScreen(screen)}
        onTelemetry={handleTelemetry}
        onNearMiss={handleNearMiss}
        onStarGained={handleStarGained}
        onShookOff={handleShookOff}
        onCoinCollected={handleCoinCollected}
        onTrafficRammed={handleTrafficRammed}
        onSideswiped={handleSideswiped}
        onDrafted={handleDrafted}
        onGateChosen={handleGateChosen}
        onEventStarted={handleEventStarted}
        onCrash={handleCrash}
        handleRef={surface}
      />

      <ScreenOverlay
        screen={screen}
        modifier={modifier}
        onPlay={startRun}
        goTo={goTo}
        onNitro={handleNitro}
      />
    </View>
  );
};

interface ScreenOverlayProps {
  screen: ScreenId;
  modifier: RunModifier;
  onPlay(): void;
  goTo(target: ScreenId): () => void;
  onNitro(): void;
}

const ScreenOverlay: React.FC<ScreenOverlayProps> = ({
  screen,
  modifier,
  onPlay,
  goTo,
  onNitro,
}) => {
  const { feedback, commerce } = useServices();
  const profile = useProfileStore();
  const summary = useRunStore((s) => s.summary);
  const claimableMissions = useProfileStore(selectClaimableMissions);

  const [crateResultLabel, setCrateResultLabel] = useState<string | null>(null);

  const handleSelectCar = useCallback(
    (car: CarDefinition) => {
      if (profile.ownedCarIds.includes(car.id)) {
        profile.equipCar(car.id);
        feedback.play('tap');
        return;
      }
      feedback.play(profile.purchaseCar(car.id) ? 'reward' : 'tap');
    },
    [feedback, profile],
  );

  const handleBuyUpgrade = useCallback(
    (upgradeId: UpgradeId) => {
      feedback.play(profile.purchaseUpgrade(upgradeId) ? 'reward' : 'tap');
    },
    [feedback, profile],
  );

  const handleClaimCrate = useCallback(() => {
    const reward = profile.claimDailyCrate();
    if (!reward) return;
    feedback.play('reward');
    setCrateResultLabel(describeCrateReward(reward, (id) => findCar(id).name));
  }, [feedback, profile]);

  const handleBuyBundle = useCallback(
    async (bundle: ShopBundle) => {
      if (bundle.costsGems === undefined) {
        const outcome = await commerce.purchase(bundle);
        if (outcome !== 'purchased') {
          feedback.play('tap');
          return;
        }
      }
      feedback.play(profile.purchaseBundle(bundle) ? 'reward' : 'tap');
    },
    [commerce, feedback, profile],
  );

  const handleClaimMission = useCallback(
    (templateId: string) => {
      feedback.play(profile.claimMission(templateId) ? 'reward' : 'tap');
    },
    [feedback, profile],
  );

  const goShop = goTo('shop');
  const handleUnlockPass = useCallback(() => {
    if (profile.purchaseSeasonPass()) {
      feedback.play('reward');
      return;
    }
    goShop();
  }, [feedback, goShop, profile]);

  switch (screen) {
    case 'menu':
      return (
        <MenuScreen
          coins={profile.coins}
          gems={profile.gems}
          claimableMissions={claimableMissions}
          modifier={modifier}
          modifierColor={MODIFIER_TONE_COLORS[modifier.tone]}
          onPlay={onPlay}
          onGarage={goTo('garage')}
          onMissions={goTo('missions')}
        />
      );

    case 'run':
      return <RunHud onNitro={onNitro} />;

    case 'crash':
      return summary ? (
        <CrashScreen
          summary={summary}
          bestScore={profile.bestScore}
          carName={findCar(profile.selectedCarId).name}
          seasonXp={profile.season.xp}
          onReplay={onPlay}
          onMenu={goTo('menu')}
          onGarage={goTo('garage')}
        />
      ) : null;

    case 'garage':
      return (
        <GarageScreen
          coins={profile.coins}
          gems={profile.gems}
          ownedCarIds={profile.ownedCarIds}
          selectedCarId={profile.selectedCarId}
          upgradeTotal={totalUpgradeLevel(profile.upgrades)}
          onBack={goTo('menu')}
          onOpenUpgrades={goTo('upgrades')}
          onSelectCar={handleSelectCar}
        />
      );

    case 'upgrades':
      return (
        <UpgradesScreen
          coins={profile.coins}
          car={findCar(profile.selectedCarId)}
          levels={profile.upgrades}
          onBack={goTo('garage')}
          onBuy={handleBuyUpgrade}
        />
      );

    case 'season':
      return (
        <SeasonScreen
          tier={profile.season.tier}
          xp={profile.season.xp}
          hasPass={profile.hasSeasonPass}
          onBack={goTo('menu')}
          onUnlockPass={handleUnlockPass}
        />
      );

    case 'missions':
      return (
        <MissionsScreen
          missions={profile.daily.missions}
          streakDay={profile.streak.day}
          onBack={goTo('menu')}
          onClaim={handleClaimMission}
          onPlay={onPlay}
        />
      );

    case 'shop':
      return (
        <ShopScreen
          gems={profile.gems}
          crateClaimed={profile.daily.crateClaimed}
          crateResultLabel={crateResultLabel}
          onBack={goTo('menu')}
          onClaimCrate={handleClaimCrate}
          onBuyBundle={handleBuyBundle}
        />
      );
  }
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.navy700 },
});
