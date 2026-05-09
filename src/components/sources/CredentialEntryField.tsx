/**
 * CredentialEntryField — write-only credential entry input.
 *
 * Behaviour (AC-S3-04 / AC-S3-05 / AC-S10-03):
 *   - When a credential exists, render a disabled placeholder showing
 *     "<encrypted>" (literal text — never the actual value).
 *   - "Replace credential" button enables the input for write.
 *   - On submit, the parent calls /sources/:id/credential and refetches.
 *   - The input clears + re-disables back to placeholder after success.
 *
 * SENSITIVE: credentialRef must match /^(env:|vault:)/ — we surface a
 * client-side hint but the BE remains the source of truth for validation
 * (a 400 from the BE is rendered as inline error via the parent form).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CredentialKind,
  SourceCredentialMetadata,
} from "@/types/entities/osint.types";

const CREDENTIAL_KINDS: CredentialKind[] = [
  "api_key",
  "oauth_token",
  "basic_auth",
  "none",
];

interface CredentialEntryFieldProps {
  idPrefix: string;
  /** Existing credential metadata (kind + lastRotatedAt) — never the ref. */
  current: SourceCredentialMetadata | null;
  disabled?: boolean;
  /** Called with the kind + ref when the user submits a credential change. */
  onSubmit: (input: { credentialKind: CredentialKind; credentialRef: string }) => void;
  /** Field-level error from the most recent server attempt. */
  fieldError?: string | null;
  /** True while the parent's mutation is pending. */
  isSubmitting?: boolean;
}

export function CredentialEntryField({
  idPrefix,
  current,
  disabled,
  onSubmit,
  fieldError,
  isSubmitting,
}: CredentialEntryFieldProps) {
  const { t } = useTranslation();
  const hasExisting = current !== null;
  const [editing, setEditing] = useState(!hasExisting);
  const [kind, setKind] = useState<CredentialKind>(current?.kind ?? "api_key");
  const [ref, setRef] = useState<string>("");

  const beginEdit = () => {
    setEditing(true);
    setRef("");
  };

  const cancelEdit = () => {
    if (!hasExisting) return;
    setEditing(false);
    setRef("");
  };

  const handleSubmit = () => {
    if (ref.trim().length === 0) return;
    onSubmit({ credentialKind: kind, credentialRef: ref.trim() });
    setRef("");
    if (hasExisting) setEditing(false);
  };

  const placeholder = t("admin.sources.credential.placeholder", {
    defaultValue: "<encrypted>",
  });
  const formatHint = t("admin.sources.credential.formatHint", {
    defaultValue: "Use env:VARNAME or vault:path — never plain-text secrets.",
  });

  return (
    <fieldset className="grid gap-3 rounded-md border border-border bg-surface/30 p-3">
      <legend className="flex items-center gap-2 px-1">
        <KeyRound className="h-3.5 w-3.5 text-gold" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          {t("admin.sources.credential.section", {
            defaultValue: "Credential",
          })}
        </span>
      </legend>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-credentialKind`} className="text-xs">
            {t("admin.sources.credential.kindLabel", {
              defaultValue: "Kind",
            })}
          </Label>
          <select
            id={`${idPrefix}-credentialKind`}
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as CredentialKind)}
            disabled={disabled || (!editing && hasExisting)}
          >
            {CREDENTIAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`admin.sources.credential.kind.${k}`, {
                  defaultValue: k,
                })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-credentialRef`} className="text-xs">
            {t("admin.sources.credential.refLabel", {
              defaultValue: "Reference",
            })}
          </Label>
          <Input
            id={`${idPrefix}-credentialRef`}
            type={editing ? "password" : "text"}
            value={editing ? ref : placeholder}
            onChange={(e) => setRef(e.target.value)}
            placeholder="env:OPENWEATHER_API_KEY"
            autoComplete="off"
            disabled={disabled || (!editing && hasExisting)}
          />
          <p className="text-[11px] text-ink-muted">{formatHint}</p>
          {fieldError ? (
            <p className="text-xs text-terracotta">{fieldError}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-muted">
          {hasExisting && current?.lastRotatedAt ? (
            <span>
              {t("admin.sources.credential.lastRotated", {
                defaultValue: "Last rotated:",
              })}{" "}
              <time dateTime={current.lastRotatedAt}>{current.lastRotatedAt}</time>
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          {editing && hasExisting ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              disabled={disabled || isSubmitting}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
          ) : null}
          {editing ? (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || isSubmitting || ref.trim().length === 0}
            >
              {isSubmitting
                ? t("admin.sources.credential.saving", {
                    defaultValue: "Saving…",
                  })
                : hasExisting
                  ? t("admin.sources.credential.update", {
                      defaultValue: "Update credential",
                    })
                  : t("admin.sources.credential.set", {
                      defaultValue: "Save credential",
                    })}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={beginEdit}
              disabled={disabled}
            >
              <RefreshCcw className="me-2 h-3.5 w-3.5" />
              {t("admin.sources.credential.replace", {
                defaultValue: "Replace credential",
              })}
            </Button>
          )}
        </div>
      </div>
    </fieldset>
  );
}
