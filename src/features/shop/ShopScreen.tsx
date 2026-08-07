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
import { alpha, palette, radii, softShadow, spacing } from '@/ui/theme';

export interface ShopScreenProps {
  gems: number;
  crateClaimed: boolean;
  /** Set after a claim so the button can show what dropped. */
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
    <ScreenHeader title="SHOP" onBack={onBack} right={<GemChip size="sm" value={gems} />} />

    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#FF7A3D', palette.gold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.crate}
      >
        <AppText variant="caption" color={alpha.white90}>
          {`FREE · RESETS IN ${formatCountdown(msUntilMidnight())}`}
        </AppText>
        <AppText variant="displayS" emboss="rgba(180,85,10,0.6)" style={styles.crateTitle}>
          DAILY CRATE
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.95)">
          One spin. Coins, gems, or a random car.
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: crateClaimed }}
          disabled={crateClaimed}
          onPress={onClaimCrate}
          style={({ pressed }) => [styles.crateButton, pressed && styles.pressed]}
        >
          <AppText variant="label" color={palette.ink}>
            {crateClaimed ? (crateResultLabel ?? 'CLAIMED TODAY') : 'OPEN CRATE'}
          </AppText>
        </Pressable>
      </LinearGradient>

      <SectionLabel>GEMS</SectionLabel>
      {GEM_BUNDLES.map((bundle) => (
        <BundleRow
          key={bundle.id}
          bundle={bundle}
          icon={<GemIcon size={44} />}
          priceBackground={palette.green}
          priceColor={palette.white}
          onPress={() => onBuyBundle(bundle)}
        />
      ))}

      <SectionLabel>COINS</SectionLabel>
      {COIN_BUNDLES.map((bundle) => (
        <BundleRow
          key={bundle.id}
          bundle={bundle}
          icon={<CoinIcon size={44} />}
          priceBackground={palette.gold}
          priceColor={palette.ink}
          affordable={bundle.costsGems === undefined || gems >= bundle.costsGems}
          onPress={() => onBuyBundle(bundle)}
        />
      ))}
    </ScrollView>
  </MetaScreen>
  );
};

const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <AppText variant="caption" color={alpha.white85} style={styles.sectionLabel}>
    {children}
  </AppText>
);

interface BundleRowProps {
  bundle: ShopBundle;
  icon: React.ReactNode;
  priceBackground: string;
  priceColor: string;
  affordable?: boolean;
  onPress(): void;
}

const BundleRow: React.FC<BundleRowProps> = ({
  bundle,
  icon,
  priceBackground,
  priceColor,
  affordable = true,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${bundle.amount} for ${bundle.price}`}
    accessibilityState={{ disabled: !affordable }}
    disabled={!affordable}
    onPress={onPress}
    style={({ pressed }) => [styles.bundle, !affordable && styles.dimmed, pressed && styles.pressed]}
  >
    {icon}
    <View style={styles.bundleText}>
      <AppText variant="title" color={palette.ink}>
        {bundle.amount}
      </AppText>
      <AppText variant="body" color={palette.inkMuted}>
        {bundle.note}
      </AppText>
    </View>
    <View style={[styles.price, { backgroundColor: affordable ? priceBackground : palette.frostAlt }]}>
      <AppText variant="bodyStrong" color={affordable ? priceColor : palette.slate}>
        {bundle.price}
      </AppText>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 11 },
  crate: { borderRadius: radii.xl, padding: 15, ...softShadow(6) },
  crateTitle: { fontSize: 26, lineHeight: 30, marginTop: 3 },
  crateButton: {
    marginTop: 11,
    height: 46,
    borderRadius: 15,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  sectionLabel: { paddingLeft: 4, marginTop: spacing.xs },
  bundle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: palette.white,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...softShadow(5),
  },
  dimmed: { opacity: 0.6 },
  bundleText: { flex: 1 },
  price: { borderRadius: radii.md, paddingVertical: 8, paddingHorizontal: 14 },
});
