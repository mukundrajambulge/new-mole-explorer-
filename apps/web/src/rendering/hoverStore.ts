// Tiny external store for the hovered atom id. Hover changes at pointer-move
// rate, so it must never enter React state or the render projection: only the
// viewer adapter (and an optional hover label via useHoveredAtomId) subscribe.
import { useSyncExternalStore } from "react";

export type HoverStore = {
  get(): string | null;
  set(id: string | null): void;
  subscribe(listener: () => void): () => void;
};

export function createHoverStore(): HoverStore {
  let current: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(id) {
      if (id === current) return;
      current = id;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export const hoverStore: HoverStore = createHoverStore();

export function useHoveredAtomId(): string | null {
  return useSyncExternalStore(hoverStore.subscribe, hoverStore.get, hoverStore.get);
}
