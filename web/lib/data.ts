import machinesData from "@/data/machines.json";
import projectsData from "@/data/projects.json";
import articlesData from "@/data/articles.json";
import type { Machine, Project, Article } from "@/lib/types";
import { getRuntimeMachines } from "@/lib/machinesStore";

export async function getMachines(): Promise<Machine[]> {
  const runtime = await getRuntimeMachines();
  return [...runtime, ...(machinesData as Machine[])];
}

export async function getMachineBySlug(slug: string): Promise<Machine | undefined> {
  const machines = await getMachines();
  return machines.find((m) => m.slug === slug);
}

export async function getFeaturedMachines(limit = 6): Promise<Machine[]> {
  const machines = await getMachines();
  const featured = machines.filter((m) => m.featured);
  const pool = featured.length > 0 ? featured : machines;
  return pool.slice(0, limit);
}

export async function getMachineBrands(): Promise<string[]> {
  const machines = await getMachines();
  return Array.from(new Set(machines.map((m) => m.brand))).sort();
}

export function getProjects(): Project[] {
  return projectsData as Project[];
}

export function getProjectBySlug(slug: string): Project | undefined {
  return getProjects().find((p) => p.slug === slug);
}

export function getArticles(): Article[] {
  return [...(articlesData as Article[])].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  return getArticles().find((a) => a.slug === slug);
}
