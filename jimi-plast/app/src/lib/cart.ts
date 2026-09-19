import { useEffect, useState } from 'react';

export interface CartLine {
  productId: string;
  quantityPackages: number;
  discount: number;
  /** Pièces/carton effectivement utilisées pour cette ligne, si différentes du catalogue. */
  unitsPerPackage?: number;
  /** Nombre de pièces réel indiqué à l'ajout, si différent de quantityPackages × unitsPerPackage. */
  totalPieces?: number;
}

export interface CartLineMeta {
  unitsPerPackage?: number;
  totalPieces?: number;
}

export interface CartSession {
  id: string;
  label: string;
  items: CartLine[];
  createdAt: number;
}

const CARTS_KEY = 'jimiplast_carts';
const ACTIVE_KEY = 'jimiplast_active_cart';
const CART_EVENT = 'jimiplast_cart_changed';

function readCarts(): CartSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CARTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCarts(sessions: CartSession[]) {
  localStorage.setItem(CARTS_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(CART_EVENT));
}

function readActiveId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

function writeActiveId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event(CART_EVENT));
}

function genId() {
  return `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Garantit qu'un panier actif existe toujours — en crée un vide si la liste est vide. */
function ensureActiveCart(sessions: CartSession[]): { sessions: CartSession[]; activeId: string } {
  const activeId = readActiveId();
  if (activeId && sessions.some((s) => s.id === activeId)) return { sessions, activeId };
  if (sessions.length > 0) {
    writeActiveId(sessions[0].id);
    return { sessions, activeId: sessions[0].id };
  }
  const fresh: CartSession = { id: genId(), label: '', items: [], createdAt: Date.now() };
  const next = [fresh];
  writeCarts(next);
  writeActiveId(fresh.id);
  return { sessions: next, activeId: fresh.id };
}

export const cart = {
  listSessions(): CartSession[] {
    return ensureActiveCart(readCarts()).sessions;
  },
  getActiveId(): string {
    return ensureActiveCart(readCarts()).activeId;
  },
  setActiveId(id: string) {
    writeActiveId(id);
  },
  createSession(label = ''): string {
    const sessions = readCarts();
    const fresh: CartSession = { id: genId(), label, items: [], createdAt: Date.now() };
    writeCarts([...sessions, fresh]);
    writeActiveId(fresh.id);
    return fresh.id;
  },
  closeSession(id: string) {
    const sessions = readCarts().filter((s) => s.id !== id);
    writeCarts(sessions);
    if (readActiveId() === id) {
      writeActiveId(sessions.length > 0 ? sessions[0].id : null);
    }
  },
  renameSession(id: string, label: string) {
    writeCarts(readCarts().map((s) => (s.id === id ? { ...s, label } : s)));
  },
  add(productId: string, quantityPackages: number, discount = 0, meta?: CartLineMeta, cartId?: string) {
    const { sessions, activeId } = ensureActiveCart(readCarts());
    const targetId = cartId ?? activeId;
    const next = sessions.map((s) => {
      if (s.id !== targetId) return s;
      const items = [...s.items];
      const existing = items.find((i) => i.productId === productId);
      if (existing) {
        existing.quantityPackages += quantityPackages;
        existing.discount += discount;
        // Un réajout du même produit avec un ajustement manuel remplace l'ancien
        // (cumuler des "pièces réelles" de deux ajouts séparés n'aurait pas de sens clair).
        existing.unitsPerPackage = meta?.unitsPerPackage;
        existing.totalPieces = meta?.totalPieces;
      } else {
        items.push({ productId, quantityPackages, discount, unitsPerPackage: meta?.unitsPerPackage, totalPieces: meta?.totalPieces });
      }
      return { ...s, items };
    });
    writeCarts(next);
  },
  setQuantity(cartId: string, productId: string, quantityPackages: number) {
    writeCarts(
      readCarts().map((s) =>
        s.id === cartId
          ? {
              ...s,
              items: s.items
                .map((i) => (i.productId === productId ? { ...i, quantityPackages } : i))
                .filter((i) => i.quantityPackages > 0),
            }
          : s,
      ),
    );
  },
  setDiscount(cartId: string, productId: string, discount: number) {
    writeCarts(
      readCarts().map((s) =>
        s.id === cartId ? { ...s, items: s.items.map((i) => (i.productId === productId ? { ...i, discount } : i)) } : s,
      ),
    );
  },
  remove(cartId: string, productId: string) {
    writeCarts(readCarts().map((s) => (s.id === cartId ? { ...s, items: s.items.filter((i) => i.productId !== productId) } : s)));
  },
  clear(cartId: string) {
    writeCarts(readCarts().map((s) => (s.id === cartId ? { ...s, items: [] } : s)));
  },
};

export function useCarts(): { sessions: CartSession[]; activeId: string } {
  const [state, setState] = useState<{ sessions: CartSession[]; activeId: string }>({ sessions: [], activeId: '' });

  useEffect(() => {
    function sync() {
      setState({ sessions: cart.listSessions(), activeId: cart.getActiveId() });
    }
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return state;
}
