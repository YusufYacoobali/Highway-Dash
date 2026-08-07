import { create } from 'zustand';

export type ScreenId =
  | 'menu'
  | 'run'
  | 'crash'
  | 'garage'
  | 'upgrades'
  | 'season'
  | 'missions'
  | 'shop';

/** Screens rendered on top of the live 3D scene rather than replacing it. */
const SCENE_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>(['menu', 'run', 'crash']);

export const isSceneScreen = (screen: ScreenId): boolean => SCENE_SCREENS.has(screen);

interface NavigationState {
  screen: ScreenId;
  previous: ScreenId | null;
  navigate(screen: ScreenId): void;
  back(fallback?: ScreenId): void;
}

/**
 * The 3D surface must stay mounted across menu → run → crash, so navigation is
 * a single screen token rather than a stack navigator that unmounts children.
 */
export const useNavigationStore = create<NavigationState>((set, get) => ({
  screen: 'menu',
  previous: null,
  navigate: (screen) => {
    if (get().screen === screen) return;
    set({ screen, previous: get().screen });
  },
  back: (fallback = 'menu') => {
    const previous = get().previous;
    set({ screen: previous ?? fallback, previous: null });
  },
}));

export const useCurrentScreen = (): ScreenId => useNavigationStore((s) => s.screen);
export const useNavigate = (): ((screen: ScreenId) => void) =>
  useNavigationStore((s) => s.navigate);
