/**
 * ContractApprovalChainCard — R-LC2 LC-E8.
 *
 * Renders the active approval chain for a contract on the contract detail
 * page (mirrors Lovable's "Approval stages" inline list above the tabs).
 * Wraps the existing ApprovalChainPreview in read-only mode and skips
 * rendering on chains that don't yet exist (e.g. fresh draft → in_approval
 * race).
 */
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { ApprovalChainPreview } from "@/features/approvals/components/ApprovalChainPreview";
import { useApprovalChainByContract } from "@/features/approvals/hooks/useApprovals";

interface Props {
  contractId: number;
}

export function ContractApprovalChainCard({ contractId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useApprovalChainByContract(contractId);

  // No chain yet → render nothing (parent decides when to invoke us).
  if (isLoading || isError || !data) return null;

  return (
    <Card className="overflow-hidden">
      <header className="border-b border-border/60 bg-card/50 px-5 py-3">
        <h2 className="text-base font-semibold text-ink">
          {t("contracts.detail.chainCard.title", { defaultValue: "Approval stages" })}
        </h2>
      </header>
      <div className="p-4">
        <ApprovalChainPreview mode="read-only" data={data} />
      </div>
    </Card>
  );
}

export default ContractApprovalChainCard;
