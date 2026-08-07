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
import { palette, radii, rarityColor, softShadow, spacing } from '@/ui/theme';
import { CarThumb } from './CarThumb';

export interface GarageScreenProps {
  coins: number;
  gems: number;
  ownedCarIds: readonly string[];
  selectedCarId: string;
  upgradeTotal: number;
  onBack(): void;
  onOpenUpgrades(): void;
  /** Equips when owned, attempts a purchase otherwise. */
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
        title="GARAGE"
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
        <AppText variant="label" style={styles.upgradeLabel} numberOfLines={1}>
          {`UPGRADE ${selectedCar.name}`}
        </AppText>
        <AppText variant="label" color={palette.gold}>
          {`LV ${upgradeTotal} ›`}
        </AppText>
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

  const ctaBackground = owned
    ? selected
      ? palette.gold
      : palette.frostAlt
    : affordable
      ? car.currency === 'gems'
        ? palette.green
        : palette.gold
      : palette.frostAlt;

  const ctaColor =
    owned && !selected
      ? palette.steel
      : !owned && !affordable
        ? palette.slate
        : !owned && car.currency === 'gems'
          ? palette.white
          : palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.name}, ${ctaLabel}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: owned ? palette.white : 'rgba(255,255,255,0.62)' },
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <AppText variant="micro" color={rarityColor[car.rarity]}>
          {car.rarity}
        </AppText>
        {selected ? <CheckIcon size={15} color={palette.goldDeep} /> : null}
      </View>

      <View style={styles.thumbSlot}>
        <CarThumb car={car} width={60} locked={!owned} />
      </View>

      <AppText variant="bodyStrong" color={palette.ink} numberOfLines={1}>
        {car.name}
      </AppText>

      <View style={[styles.cta, { backgroundColor: ctaBackground }]}>
        <AppText variant="label" color={ctaColor}>
          {ctaLabel}
        </AppText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  headerChips: { flexDirection: 'row', gap: 6 },
  upgradeBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: palette.navy500,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...softShadow(5),
  },
  upgradeLabel: { flex: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingTop: 10,
    paddingBottom: 11,
    ...softShadow(5),
  },
  cardSelected: { borderWidth: 3, borderColor: palette.gold },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 16 },
  thumbSlot: { height: 78, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  cta: {
    marginTop: spacing.sm,
    borderRadius: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
});
