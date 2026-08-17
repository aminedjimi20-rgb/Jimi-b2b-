import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Machine } from "@/lib/types";

// Serverless platforms (Vercel, etc.) only allow writes under the OS temp
// directory — the deployed app bundle itself is read-only. This store is
// therefore ephemeral by design; see web/README.md for the production
// migration path (a real database).
const DATA_DIR = path.join(os.tmpdir(), "jimi-machines-store");
const FILE = path.join(DATA_DIR, "machines.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

export type AdminMachineInput = {
  brand: string;
  model: string;
  year: number;
  tonnage: number;
  drive: Machine["drive"];
  status: Machine["status"];
  wilaya: string;
  price: number | null;
  priceOnRequest: boolean;
  description: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getRuntimeMachines(): Promise<Machine[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as Machine[];
  } catch {
    return [];
  }
}

async function saveRuntimeMachines(machines: Machine[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(machines, null, 2), "utf-8");
}

export async function addRuntimeMachine(input: AdminMachineInput): Promise<Machine> {
  const machines = await getRuntimeMachines();
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year}`);
  let slug = baseSlug;
  let counter = 1;
  while (machines.some((m) => m.slug === slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const machine: Machine = {
    id: randomUUID(),
    slug,
    brand: input.brand,
    model: input.model,
    year: input.year,
    tonnage: input.tonnage,
    drive: input.drive,
    category: "injection",
    status: input.status,
    featured: false,
    wilaya: input.wilaya,
    price: input.price,
    priceOnRequest: input.priceOnRequest,
    images: 3,
    videoUrl: null,
    specs: {},
    description: input.description,
    worksPerformed: [],
    defects: [],
    accessories: [],
    isDemo: false,
  };

  machines.unshift(machine);
  await saveRuntimeMachines(machines);
  return machine;
}

export async function updateRuntimeMachine(
  id: string,
  patch: Partial<AdminMachineInput>
): Promise<Machine | null> {
  const machines = await getRuntimeMachines();
  const index = machines.findIndex((m) => m.id === id);
  if (index === -1) return null;
  machines[index] = { ...machines[index], ...patch };
  await saveRuntimeMachines(machines);
  return machines[index];
}

export async function deleteRuntimeMachine(id: string): Promise<void> {
  const machines = await getRuntimeMachines();
  await saveRuntimeMachines(machines.filter((m) => m.id !== id));
}
