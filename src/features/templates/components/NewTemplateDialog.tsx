/**
 * NewTemplateDialog — first step of the "New template" flow.
 *
 * Asks the user how they want to start:
 *   - From scratch → /app/templates/new
 *   - From contract → /app/templates/new-from-contract (upload + AI redact)
 *
 * The actual editing happens on those routes, NOT inside this modal, so we
 * keep the dialog dumb + the wizard URL-driven (good for refresh + back/fwd).
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

interface NewTemplateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewTemplateDialog({ open, onClose }: NewTemplateDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const choose = (path: "/app/templates/new" | "/app/templates/new-from-contract") => {
    onClose();
    void navigate({ to: path });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("templates.newDialog.title", { defaultValue: "Create a new template" })}
          </DialogTitle>
          <DialogDescription>
            {t("templates.newDialog.description", {
              defaultValue:
                "How would you like to start? You can author from scratch, or upload an existing contract and let the AI redact entity-specific data into placeholders.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("/app/templates/new-from-contract")}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-start transition-colors hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold/10 text-gold transition-colors group-hover:bg-gold/20">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {t("templates.newDialog.fromContract.title", {
                  defaultValue: "From a contract",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("templates.newDialog.fromContract.body", {
                  defaultValue:
                    "Upload a finalised PDF/DOCX. AI extracts the structure, redacts party-specific data into {{placeholder}} tokens, and lets you review before saving.",
                })}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => choose("/app/templates/new")}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-start transition-colors hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface text-ink-muted transition-colors group-hover:bg-gold/10 group-hover:text-gold">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {t("templates.newDialog.fromScratch.title", {
                  defaultValue: "From scratch",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("templates.newDialog.fromScratch.body", {
                  defaultValue:
                    "Start with an empty editor. Author the body in Markdown using {{snake_case}} tokens and define the placeholder catalog as you go.",
                })}
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
