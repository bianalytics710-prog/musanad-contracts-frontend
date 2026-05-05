/**
 * Regulator catalog (M5 — REG-OI-B carry-forward).
 *
 * M5 ships no regulator CRUD endpoints — admin lookup management was
 * deferred (REG-OI-B; admin extends via DDL/migration). The FE needs a
 * regulator list anyway for the regulation create/edit form (issuerId
 * picker) and the regulatory_update create/edit form (regulatorId picker).
 *
 * Strategy: derive the catalog from data the user already has access to
 * — every fn_regulation_list row embeds a RegulatorRef (id+code+nameEn).
 * We dedupe across the user's first page of regulations to assemble a
 * reasonable picker without introducing a new endpoint.
 *
 * Trade-off: brand-new tenants with zero regulations may briefly see an
 * empty picker. A platform_admin may need to migration-seed before the
 * picker is useful. This is documented as carry-forward M5-FE-OI-1.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { regulatoryService } from "@/services/api/regulatory.service";
import { regulatoryKeys } from "./useRegulatory";
import type {
  RegulatorRef,
  RegulatoryUpdateListResponse,
} from "@/types/entities/regulatory.types";

/**
 * Fetch a catalog of regulators by sampling the first 100 regulatory_updates
 * (chosen because every regulatory_update has a non-null regulator FK,
 * unlike regulations where issuerId is also non-null but the volume is
 * lower at tenant onboarding). Returns a deduped, displayOrder-sorted list.
 */
export function useRegulatorCatalog() {
  const query = { page: 1, limit: 100 };
  const { data, isLoading, isError } = useQuery<RegulatoryUpdateListResponse>({
    queryKey: regulatoryKeys.regulatoryUpdateList(query),
    queryFn: () => regulatoryService.listRegulatoryUpdates(query),
    staleTime: 5 * 60_000,
  });

  const regulators = useMemo<RegulatorRef[]>(() => {
    if (!data) return [];
    const byId = new Map<number, RegulatorRef>();
    for (const item of data.data) {
      if (!byId.has(item.regulator.id)) {
        byId.set(item.regulator.id, item.regulator);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }, [data]);

  return { regulators, isLoading, isError };
}
