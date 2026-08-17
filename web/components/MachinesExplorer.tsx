"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MachineCard } from "@/components/MachineCard";
import { Select, TextInput, FieldWrapper } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import type { Machine, MachineDrive, MachineStatus } from "@/lib/types";
import { RotateCcw, SearchX } from "lucide-react";

interface Filters {
  brand: string;
  drive: MachineDrive | "";
  status: MachineStatus | "";
  tonnageMin: string;
  tonnageMax: string;
}

const EMPTY_FILTERS: Filters = { brand: "", drive: "", status: "", tonnageMin: "", tonnageMax: "" };

const DRIVE_KEY: Record<MachineDrive, "hydraulic" | "servo" | "hybrid"> = {
  hydraulique: "hydraulic",
  servo: "servo",
  hybride: "hybrid",
};

export function MachinesExplorer({ machines, brands }: { machines: Machine[]; brands: string[] }) {
  const t = useTranslations();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      if (filters.brand && m.brand !== filters.brand) return false;
      if (filters.drive && m.drive !== filters.drive) return false;
      if (filters.status && m.status !== filters.status) return false;
      if (filters.tonnageMin && m.tonnage < Number(filters.tonnageMin)) return false;
      if (filters.tonnageMax && m.tonnage > Number(filters.tonnageMax)) return false;
      return true;
    });
  }, [machines, filters]);

  const driveOptions: MachineDrive[] = ["hydraulique", "servo", "hybride"];
  const statusOptions: MachineStatus[] = ["disponible", "reservee", "vendue", "nouveau"];

  return (
    <div>
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
          {t("machines.filters.title")}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <FieldWrapper label={t("machines.filters.brand")} className="col-span-2 lg:col-span-1">
            <Select
              value={filters.brand}
              onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
            >
              <option value="">{t("machines.filters.allBrands")}</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label={t("machines.filters.type")}>
            <Select
              value={filters.drive}
              onChange={(e) => setFilters((f) => ({ ...f, drive: e.target.value as MachineDrive | "" }))}
            >
              <option value="">{t("machines.filters.allTypes")}</option>
              {driveOptions.map((d) => (
                <option key={d} value={d}>
                  {t(`forms.options.driveType.${DRIVE_KEY[d]}`)}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label={t("machines.filters.status")}>
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as MachineStatus | "" }))}
            >
              <option value="">{t("machines.filters.allStatus")}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {t(`badges.${s}`)}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label={t("machines.filters.tonnageMin")}>
            <TextInput
              type="number"
              min={0}
              value={filters.tonnageMin}
              onChange={(e) => setFilters((f) => ({ ...f, tonnageMin: e.target.value }))}
              placeholder="0"
            />
          </FieldWrapper>

          <FieldWrapper label={t("machines.filters.tonnageMax")}>
            <TextInput
              type="number"
              min={0}
              value={filters.tonnageMax}
              onChange={(e) => setFilters((f) => ({ ...f, tonnageMax: e.target.value }))}
              placeholder="2000"
            />
          </FieldWrapper>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-full"
              icon={<RotateCcw size={15} />}
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              {t("machines.filters.reset")}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm font-medium text-[var(--color-text-muted)]">
        {t("machines.resultsCount", { count: filtered.length })}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((machine, i) => (
            <MachineCard key={machine.id} machine={machine} index={i} />
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-white py-16 text-center">
          <SearchX size={32} className="text-slate-300" />
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">{t("machines.noResults")}</p>
          <Button href="/acheter-machine" size="sm">
            {t("machines.noResultsCta")}
          </Button>
        </div>
      )}
    </div>
  );
}
