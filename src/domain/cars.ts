export type CarRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGEND' | 'MYTHIC';
export type Currency = 'coins' | 'gems';

/** Which glTF silhouette from the low-poly pack renders this car. */
export type VehicleSilhouette = 'sports' | 'sedan' | 'hatch' | 'suv' | 'truck';

export interface CarStats {
  /** Drives top speed and how quickly the run ramps up. 1–5. */
  speed: number;
  /** Drives steering response. 1–5. */
  handling: number;
  /** Widens the near-miss scoring window. 1–5. */
  nerve: number;
}

export interface CarDefinition {
  id: string;
  name: string;
  rarity: CarRarity;
  /** Livery applied on top of the shared glTF silhouette. */
  bodyColor: string;
  roofColor: string;
  price: number;
  currency: Currency;
  silhouette: VehicleSilhouette;
  stats: CarStats;
}

export const CAR_CATALOG: readonly CarDefinition[] = [
  {
    id: 'sprint',
    name: 'STREET SPRINT',
    rarity: 'COMMON',
    bodyColor: '#E8332E',
    roofColor: '#C22824',
    price: 0,
    currency: 'coins',
    silhouette: 'sports',
    stats: { speed: 3, handling: 3, nerve: 2 },
  },
  {
    id: 'cab',
    name: 'CITY CAB',
    rarity: 'COMMON',
    bodyColor: '#F2B705',
    roofColor: '#D19A00',
    price: 1200,
    currency: 'coins',
    silhouette: 'sedan',
    stats: { speed: 2, handling: 4, nerve: 3 },
  },
  {
    id: 'van',
    name: 'PARTY VAN',
    rarity: 'RARE',
    bodyColor: '#24C6DC',
    roofColor: '#12A2B8',
    price: 2600,
    currency: 'coins',
    silhouette: 'suv',
    stats: { speed: 2, handling: 3, nerve: 5 },
  },
  {
    id: 'brute',
    name: 'BRUTE V8',
    rarity: 'EPIC',
    bodyColor: '#9B5DE5',
    roofColor: '#7B3FC7',
    price: 4500,
    currency: 'coins',
    silhouette: 'sports',
    stats: { speed: 5, handling: 2, nerve: 2 },
  },
  {
    id: 'cart',
    name: 'SHOPPING CART',
    rarity: 'EPIC',
    bodyColor: '#D7DEE8',
    roofColor: '#B3BDCC',
    price: 60,
    currency: 'gems',
    silhouette: 'hatch',
    stats: { speed: 4, handling: 5, nerve: 1 },
  },
  {
    id: 'dog',
    name: 'HOT DOG WAGON',
    rarity: 'LEGEND',
    bodyColor: '#F08A24',
    roofColor: '#D06A0C',
    price: 120,
    currency: 'gems',
    silhouette: 'truck',
    stats: { speed: 3, handling: 3, nerve: 5 },
  },
  {
    id: 'jet',
    name: 'JET ON WHEELS',
    rarity: 'LEGEND',
    bodyColor: '#F5F7FA',
    roofColor: '#CDD6E2',
    price: 9000,
    currency: 'coins',
    silhouette: 'sports',
    stats: { speed: 5, handling: 4, nerve: 3 },
  },
  {
    id: 'cruiser',
    name: 'STOLEN CRUISER',
    rarity: 'MYTHIC',
    bodyColor: '#3B7BE0',
    roofColor: '#245FBC',
    price: 250,
    currency: 'gems',
    silhouette: 'sedan',
    stats: { speed: 5, handling: 5, nerve: 4 },
  },
];

export const DEFAULT_CAR_ID = CAR_CATALOG[0].id;

const CAR_INDEX = new Map(CAR_CATALOG.map((car) => [car.id, car]));

export function findCar(id: string): CarDefinition {
  return CAR_INDEX.get(id) ?? CAR_CATALOG[0];
}

/** Cars that can drop from a crate — everything that is not the starter car. */
export const CRATE_CAR_POOL: readonly CarDefinition[] = CAR_CATALOG.filter(
  (car) => car.id !== DEFAULT_CAR_ID,
);
