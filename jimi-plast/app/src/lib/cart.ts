import { useEffect, useState } from 'react';

export interface CartLine {
  productId: string;
  quantityPackages: number;
}

const CART_KEY = 'jimiplast_cart';
const CART_EVENT = 'jimiplast_cart_changed';

function readCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export const cart = {
  get: readCart,
  add(productId: string, quantityPackages: number) {
    const items = readCart();
    const existing = items.find((i) => i.productId === productId);
    if (existing) existing.quantityPackages += quantityPackages;
    else items.push({ productId, quantityPackages });
    writeCart(items);
  },
  setQuantity(productId: string, quantityPackages: number) {
    const items = readCart()
      .map((i) => (i.productId === productId ? { ...i, quantityPackages } : i))
      .filter((i) => i.quantityPackages > 0);
    writeCart(items);
  },
  remove(productId: string) {
    writeCart(readCart().filter((i) => i.productId !== productId));
  },
  clear() {
    writeCart([]);
  },
};

export function useCart(): CartLine[] {
  const [items, setItems] = useState<CartLine[]>([]);

  useEffect(() => {
    setItems(readCart());
    const handler = () => setItems(readCart());
    window.addEventListener(CART_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(CART_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return items;
}
