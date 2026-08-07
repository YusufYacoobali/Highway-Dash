import type { ShopBundle } from '@/domain/economy';

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable';

/**
 * Boundary between the shop UI and a real store transaction.
 *
 * Bundles priced in gems settle entirely in-game and never reach a gateway.
 * Bundles priced in real money must clear this interface first — the profile is
 * only credited once `purchased` comes back.
 */
export interface PurchaseGateway {
  /** True when the underlying billing client is connected and ready. */
  isAvailable(): Promise<boolean>;
  purchase(bundle: ShopBundle): Promise<PurchaseOutcome>;
  /** Re-applies entitlements the player already owns on a new device. */
  restore(): Promise<void>;
}

/**
 * Development gateway that approves every purchase instantly.
 *
 * This is the one place the build knowingly diverges from a shippable app:
 * before release, swap this for a real billing implementation (RevenueCat or
 * `expo-iap`) in `createServices`. Nothing else in the codebase changes.
 */
export class SandboxPurchaseGateway implements PurchaseGateway {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async purchase(bundle: ShopBundle): Promise<PurchaseOutcome> {
    if (__DEV__) console.warn(`[commerce] sandbox purchase granted: ${bundle.id}`);
    return 'purchased';
  }

  async restore(): Promise<void> {
    // No entitlements to restore without a real billing client.
  }
}
