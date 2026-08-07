import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { formatCountdown, msUntilMidnight } from '@/domain/calendar';
import { COIN_BUNDLES, GEM_BUNDLES, type ShopBundle } from '@/domain/economy';
import {
  AppText,
  CoinIcon,
  GemChip,
  GemIcon,
  MetaScreen,
  ScreenHeader,
  shopGradient,
} from '@/ui/components';
import { useMinuteTick } from '@/ui/hooks/useMinuteTick';
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface ShopScreenProps {
  gems: number;
  crateClaimed: boolean;
  crateResultLabel: string | null;
  onBack(): void;
  onClaimCrate(): void;
  onBuyBundle(bundle: ShopBundle): void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  gems,
  crateClaimed,
  crateResultLabel,
  onBack,
  onClaimCrate,
  onBuyBundle,
}) => {
  useMinuteTick();

  return (
    <MetaScreen colors={shopGradient}>
      <ScreenHeader title="Shop" onBack={onBack} right={<GemChip size="sm" value={gems} />} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['rgba(255,122,61,0.94)', 'rgba(255,196,46,0.94)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.crate}
        >
          <View style={styles.crateCopy}>
            <AppText variant="caption" color="rgba(20,33,61,0.62)">
              {`FREE · ${formatCountdown(msUntilMidnight())}`}
            </AppText>
            <AppText variant="title" color={palette.ink} style={styles.crateTitle}>
              Daily crate
            </AppText>
            <AppText variant="body" color="rgba(20,33,61,0.72)">
              Coins, gems or a random car.
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: crateClaimed }}
            disabled={crateClaimed}
            onPress={onClaimCrate}
            style={({ pressed }) => [styles.crateButton, crateClaimed && styles.crateButtonDone, pressed && styles.pressed]}
          >
            <AppText variant="label" color={crateClaimed ? alpha.white55 : palette.white}>
              {crateClaimed ? (crateResultLabel ?? 'CLAIMED') : 'OPEN'}
            </AppText>
          </Pressable>
        </LinearGradient>

        <SectionLabel>GEMS</SectionLabel>
        {GEM_BUNDLES.map((bundle) => (
          <BundleRow
            key={bundle.id}
            bundle={bundle}
            icon={<GemIcon size={38} />}
            accent={palette.cyanIce}
            onPress={() => onBuyBundle(bundle)}
          />
        ))}

        <SectionLabel>COINS</SectionLabel>
        {COIN_BUNDLES.map((bundle) => (
          <BundleRow
            key={bundle.id}
            bundle={bundle}
            icon={<CoinIcon size={38} />}
            accent={palette.gold}
            affordable={bundle.costsGems === undefined || gems >= bundle.costsGems}
            onPress={() => onBuyBundle(bundle)}
          />
        ))}
      </ScrollView>
    </MetaScreen>
  );
};

const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <AppText variant="caption" color={alpha.white45} style={styles.sectionLabel}>
    {children}
  </AppText>
);

interface BundleRowProps {
  bundle: ShopBundle;
  icon: React.ReactNode;
  accent: string;
  affordable?: boolean;
  onPress(): void;
}

const BundleRow: React.FC<BundleRowProps> = ({ bundle, icon, accent, affordable = true, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${bundle.amount} for ${bundle.price}`}
    accessibilityState={{ disabled: !affordable }}
    disabled={!affordable}
    onPress={onPress}
    style={({ pressed }) => [styles.bundle, !affordable && styles.dimmed, pressed && styles.pressed]}
  >
    <View style={[styles.bundleAccent, { backgroundColor: accent }]} />
    <View style={styles.bundleIcon}>{icon}</View>
    <View style={styles.bundleText}>
      <AppText variant="bodyStrong" color={palette.white}>{bundle.amount}</AppText>
      <AppText variant="body" color={alpha.white55}>{bundle.note}</AppText>
    </View>
    <View style={styles.price}>
      <AppText variant="bodyStrong" color={affordable ? palette.white : alpha.white35 ?? alpha.white45}>
        {bundle.price}
      </AppText>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  crate: {
    borderRadius: radii.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crateCopy: { flex: 1 },
  crateTitle: { marginTop: 2 },
  crateButton: {
    minWidth: 78,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: palette.navy800,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  crateButtonDone: { backgroundColor: 'rgba(8,21,43,0.42)' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  sectionLabel: { marginTop: 22, marginBottom: 5 },
  bundle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
  },
  bundleAccent: { width: 3, height: 32, borderRadius: 2 },
  bundleIcon: { width: 45, alignItems: 'center' },
  dimmed: { opacity: 0.48 },
  bundleText: { flex: 1 },
  price: {
    borderRadius: radii.pill,
    backgroundColor: alpha.white08,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
});
