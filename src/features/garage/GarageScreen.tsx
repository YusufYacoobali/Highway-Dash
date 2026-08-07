import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CAR_CATALOG, type CarDefinition } from '@/domain/cars';
import {
  AppText,
  CheckIcon,
  CoinChip,
  GemChip,
  MetaScreen,
  ScreenHeader,
} from '@/ui/components';
import { alpha, palette, radii, rarityColor, spacing } from '@/ui/theme';
import { CarThumb } from './CarThumb';

export interface GarageScreenProps {
  coins: number;
  gems: number;
  ownedCarIds: readonly string[];
  selectedCarId: string;
  upgradeTotal: number;
  onBack(): void;
  onOpenUpgrades(): void;
  onSelectCar(car: CarDefinition): void;
}

export const GarageScreen: React.FC<GarageScreenProps> = ({
  coins,
  gems,
  ownedCarIds,
  selectedCarId,
  upgradeTotal,
  onBack,
  onOpenUpgrades,
  onSelectCar,
}) => {
  const selectedCar = CAR_CATALOG.find((car) => car.id === selectedCarId) ?? CAR_CATALOG[0];

  const canAfford = useCallback(
    (car: CarDefinition) => (car.currency === 'gems' ? gems : coins) >= car.price,
    [coins, gems],
  );

  return (
    <MetaScreen>
      <ScreenHeader
        title="Garage"
        onBack={onBack}
        right={
          <View style={styles.headerChips}>
            <CoinChip size="sm" value={coins} />
            <GemChip size="sm" value={gems} />
          </View>
        }
      />

      <Pressable
        accessibilityRole="button"
        onPress={onOpenUpgrades}
        style={({ pressed }) => [styles.upgradeBanner, pressed && styles.pressed]}
      >
        <View>
          <AppText variant="caption" color={alpha.white55}>CURRENT BUILD</AppText>
          <AppText variant="bodyStrong" color={palette.white} numberOfLines={1}>
            {selectedCar.name}
          </AppText>
        </View>
        <View style={styles.upgradeAction}>
          <AppText variant="label" color={palette.gold}>{`LV ${upgradeTotal}`}</AppText>
          <AppText variant="label" color={alpha.white62}>UPGRADE ›</AppText>
        </View>
      </Pressable>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {CAR_CATALOG.map((car) => (
          <CarCard
            key={car.id}
            car={car}
            owned={ownedCarIds.includes(car.id)}
            selected={car.id === selectedCarId}
            affordable={canAfford(car)}
            onPress={() => onSelectCar(car)}
          />
        ))}
      </ScrollView>
    </MetaScreen>
  );
};

interface CarCardProps {
  car: CarDefinition;
  owned: boolean;
  selected: boolean;
  affordable: boolean;
  onPress(): void;
}

const CarCard: React.FC<CarCardProps> = ({ car, owned, selected, affordable, onPress }) => {
  const ctaLabel = owned
    ? selected
      ? 'EQUIPPED'
      : 'EQUIP'
    : `${car.price.toLocaleString()} ${car.currency === 'gems' ? 'GEMS' : 'COINS'}`;

  const ctaColor = selected
    ? palette.gold
    : owned
      ? palette.cyanIce
      : affordable
        ? palette.white
        : alpha.white45;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.name}, ${ctaLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <AppText variant="micro" color={rarityColor[car.rarity]}>
          {car.rarity}
        </AppText>
        {selected ? <CheckIcon size={15} color={palette.gold} /> : null}
      </View>

      <View style={styles.thumbSlot}>
        <CarThumb car={car} width={68} locked={!owned} />
      </View>

      <AppText variant="bodyStrong" color={palette.white} numberOfLines={1}>
        {car.name}
      </AppText>
      <AppText variant="label" color={ctaColor} style={styles.ctaText}>
        {ctaLabel}
      </AppText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  headerChips: { flexDirection: 'row', gap: 6 },
  upgradeBanner: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: alpha.white08,
    borderWidth: 1,
    borderColor: alpha.white14,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  upgradeAction: { alignItems: 'flex-end', gap: 2 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    minHeight: 164,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 12,
    backgroundColor: 'rgba(8,21,43,0.52)',
    borderWidth: 1,
    borderColor: alpha.white08,
  },
  cardSelected: {
    backgroundColor: 'rgba(255,196,46,0.10)',
    borderColor: 'rgba(255,196,46,0.55)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 16 },
  thumbSlot: { height: 88, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 7 },
  ctaText: { marginTop: spacing.xs },
});
