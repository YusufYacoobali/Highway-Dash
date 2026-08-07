import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { findCar, type CarDefinition } from '@/domain/cars';
import { describeCrateReward, type ShopBundle } from '@/domain/economy';
import type { RunResult } from '@/domain/runResult';
import { totalUpgradeLevel, type UpgradeId } from '@/domain/upgrades';
import { CrashScreen } from '@/features/crash/CrashScreen';
import { GarageScreen } from '@/features/garage/GarageScreen';
import { MenuScreen } from '@/features/menu/MenuScreen';
import { MissionsScreen } from '@/features/missions/MissionsScreen';
import { pushNearMissPop, usePopStore } from '@/features/run/popStore';
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
  selectHasFreeCrate,
  useProfileStore,
} from '@/state/profileStore';
import { useRunStore } from '@/state/runStore';
import { palette } from '@/ui/theme';
import { playerSnapshot } from './playerSnapshot';

/**
 * Wires the persistent 3D surface to the screen overlays and to the profile
 * store. This is the only module that knows about both halves of the app,
 * which keeps every screen and every engine system independently testable.
 */
export const GameStage: React.FC = () => {
  const { feedback, engagement } = useServices();
  const surface = useRef<GameSurfaceHandle | null>(null);

  const screen = useNavigationStore((s) => s.screen);
  const navigate = useNavigationStore((s) => s.navigate);

  // Selected via primitives, then derived — a selector that built these objects
  // inline would allocate on every store read and break snapshot caching.
  const selectedCarId = useProfileStore((s) => s.selectedCarId);
  const upgrades = useProfileStore((s) => s.upgrades);
  const car = useMemo(() => findCar(selectedCarId), [selectedCarId]);
  const tuning = useMemo(() => runTuningFor(car, upgrades), [car, upgrades]);

  const runToken = useRunStore((s) => s.runToken);
  const beginRun = useRunStore((s) => s.beginRun);

  const applyTelemetry = useTelemetryStore((s) => s.apply);
  const resetTelemetry = useTelemetryStore((s) => s.reset);
  const clearPops = usePopStore((s) => s.clear);

  const startRun = useCallback(() => {
    feedback.play('tap');
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

  /** Banks a finished run and reports it to the engagement services. */
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
      feedback.play('crash');
      bankRun(result);
      navigate('crash');
    },
    [bankRun, feedback, navigate],
  );

  /** Quitting mid-run still banks the distance, as every runner does. */
  const handleQuitRun = useCallback(() => {
    feedback.play('tap');
    const result = surface.current?.retireRun();
    if (result) bankRun(result);
    navigate('menu');
  }, [bankRun, feedback, navigate]);

  const handleNearMiss = useCallback(
    ({ combo, stars }: { combo: number; stars: number }) => {
      feedback.play('nearMiss');
      pushNearMissPop(combo, stars);
    },
    [feedback],
  );

  const handleStarGained = useCallback(() => feedback.play('star'), [feedback]);

  const handleNitro = useCallback(() => {
    if (surface.current?.fireNitro()) feedback.play('tap');
  }, [feedback]);

  return (
    <View style={styles.root}>
      <GameSurface
        mode={screen === 'run' || screen === 'crash' ? 'run' : 'attract'}
        car={car}
        tuning={tuning}
        runToken={runToken}
        paused={!isSceneScreen(screen)}
        onTelemetry={applyTelemetry}
        onNearMiss={handleNearMiss}
        onStarGained={handleStarGained}
        onCrash={handleCrash}
        handleRef={surface}
      />

      <ScreenOverlay
        screen={screen}
        onPlay={startRun}
        goTo={goTo}
        onNitro={handleNitro}
        onQuitRun={handleQuitRun}
      />
    </View>
  );
};

interface ScreenOverlayProps {
  screen: ScreenId;
  onPlay(): void;
  goTo(target: ScreenId): () => void;
  onNitro(): void;
  onQuitRun(): void;
}

/**
 * Maps the current screen token to a screen component and supplies it with the
 * profile data and callbacks it needs. Screens themselves stay presentational.
 */
const ScreenOverlay: React.FC<ScreenOverlayProps> = ({
  screen,
  onPlay,
  goTo,
  onNitro,
  onQuitRun,
}) => {
  const { feedback, commerce } = useServices();
  const profile = useProfileStore();
  const summary = useRunStore((s) => s.summary);
  const claimableMissions = useProfileStore(selectClaimableMissions);
  const hasFreeCrate = useProfileStore(selectHasFreeCrate);

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
      // Gem-priced bundles settle in-game; real-money ones must clear the store
      // first and are only credited on a confirmed purchase.
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
    // Not enough gems — send the player to where they can get some.
    goShop();
  }, [feedback, goShop, profile]);

  switch (screen) {
    case 'menu':
      return (
        <MenuScreen
          coins={profile.coins}
          gems={profile.gems}
          seasonTier={profile.season.tier}
          claimableMissions={claimableMissions}
          hasFreeCrate={hasFreeCrate}
          onPlay={onPlay}
          onGarage={goTo('garage')}
          onMissions={goTo('missions')}
          onShop={goShop}
          onSeason={goTo('season')}
        />
      );

    case 'run':
      return <RunHud onQuit={onQuitRun} onNitro={onNitro} />;

    case 'crash':
      return summary ? (
        <CrashScreen
          summary={summary}
          bestDistance={profile.bestDistance}
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
