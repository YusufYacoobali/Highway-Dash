import React, { createContext, useContext, useMemo } from 'react';

import { SandboxPurchaseGateway, type PurchaseGateway } from './commerce/PurchaseGateway';
import { EngagementCoordinator } from './engagement/EngagementCoordinator';
import { ExpoNotificationService } from './engagement/NotificationService';
import { StoreReviewService } from './engagement/ReviewService';
import { HapticsService, type FeedbackService } from './feedback/HapticsService';
import { asyncStorageStore, type KeyValueStore } from './storage/keyValueStore';

export interface Services {
  storage: KeyValueStore;
  feedback: FeedbackService;
  engagement: EngagementCoordinator;
  commerce: PurchaseGateway;
}

/**
 * Composition root. Concrete implementations are chosen exactly once, here;
 * every consumer receives them through {@link useServices} and depends only on
 * the interfaces.
 */
export function createServices(storage: KeyValueStore = asyncStorageStore): Services {
  const notifications = new ExpoNotificationService();
  const review = new StoreReviewService(storage);

  return {
    storage,
    feedback: new HapticsService(),
    engagement: new EngagementCoordinator(notifications, review, storage),
    commerce: new SandboxPurchaseGateway(),
  };
}

const ServicesContext = createContext<Services | null>(null);

export const ServiceProvider: React.FC<{ services?: Services; children: React.ReactNode }> = ({
  services,
  children,
}) => {
  const value = useMemo(() => services ?? createServices(), [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
};

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside a <ServiceProvider>');
  return services;
}
