/**
 * NewClauseDialog — first step of the "New clause" flow.
 *
 * Asks the user how they want to start:
 *   - From scratch → /app/clauses/new
 *   - From contract → /app/clauses/new-from-contract (upload + AI extract + multi-select)
 *
 * URL-driven wizard (same pattern as NewTemplateDialog) so refresh + back/fwd
 * work correctly.
 */
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Upload } from "lucide-react";

interface NewClauseDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewClauseDialog({ open, onClose }: NewClauseDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const choose = (path: "/app/clauses/new" | "/app/clauses/new-from-contract") => {
    onClose();
    void navigate({ to: path });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("clauses.newDialog.title", { defaultValue: "Add a new clause" })}
          </DialogTitle>
          <DialogDescription>
            {t("clauses.newDialog.description", {
              defaultValue:
                "How would you like to start? You can author one clause from scratch, or upload a contract and let the AI detect every clause for you to cherry-pick.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("/app/clauses/new-from-contract")}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-start transition-colors hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold/10 text-gold transition-colors group-hover:bg-gold/20">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {t("clauses.newDialog.fromContract.title", {
                  defaultValue: "From a contract",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("clauses.newDialog.fromContract.body", {
                  defaultValue:
                    "Upload a finalised PDF/DOCX. The AI splits it into individual clauses and lets you pick which ones to add to the library.",
                })}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => choose("/app/clauses/new")}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-start transition-colors hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface text-ink-muted transition-colors group-hover:bg-gold/10 group-hover:text-gold">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {t("clauses.newDialog.fromScratch.title", {
                  defaultValue: "From scratch",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("clauses.newDialog.fromScratch.body", {
                  defaultValue:
                    "Start with a blank editor. Pick category + variant, write English (and Arabic) body, save.",
                })}
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
