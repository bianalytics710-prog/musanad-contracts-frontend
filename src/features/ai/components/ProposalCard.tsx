/**
 * ProposalCard — inline card rendered inside an assistant chat bubble when
 * the orchestrator returns a `proposal` SSE event. The user clicks Confirm
 * to fire the action or Cancel to dismiss.
 *
 * Once the user has acted, the card swaps to a compact receipt or
 * dismissed line — preventing double-fire.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Check, X, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { chatActionsService } from '@/services/api/chat-orchestrator.service';
import { MentionChip } from './MentionChip';
import type { ProposalPreviewParam, ProposalReceipt } from '@/types/entities/chat-orchestrator.types';

interface Props {
  proposalId: string;
  actionCode: string;
  actionLabel: string;
  previewParams: ProposalPreviewParam[];
}

type CardState =
  | { kind: 'pending' }
  | { kind: 'executing' }
  | { kind: 'executed'; receipt: ProposalReceipt }
  | { kind: 'rejected' }
  | { kind: 'error'; message: string };

export function ProposalCard({ proposalId, actionCode, actionLabel, previewParams }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<CardState>({ kind: 'pending' });

  const confirm = async () => {
    setState({ kind: 'executing' });
    try {
      const result = await chatActionsService.execute(proposalId);
      setState({ kind: 'executed', receipt: result.receipt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'execute failed';
      setState({ kind: 'error', message: msg });
      toast.error(t('chatActions.error.executeFailed', { defaultValue: 'Action failed to run.' }));
    }
  };

  const cancel = async () => {
    setState({ kind: 'rejected' });
    try {
      await chatActionsService.reject(proposalId, 'user_cancelled');
    } catch {
      /* non-fatal */
    }
  };

  if (state.kind === 'executed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-md border border-sage/40 bg-sage/10 px-3 py-2 text-sm text-ink"
      >
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
          <div className="flex-1">
            <div className="font-medium">{state.receipt.message}</div>
            {state.receipt.link && (
              <Link
                to={state.receipt.link}
                className="mt-1 inline-flex items-center gap-1 text-xs text-gold underline-offset-2 hover:underline"
              >
                {t('chatActions.receipt.viewWork', { defaultValue: 'Open My Work' })}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (state.kind === 'rejected') {
    return (
      <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-ink-muted italic">
        {t('chatActions.proposal.dismissed', { defaultValue: 'Dismissed — nothing was done.' })}
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
        {state.message}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-sm text-ink"
      data-testid="chat-proposal-card"
      data-action={actionCode}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          {t('chatActions.proposal.title', { defaultValue: 'Action proposal' })}
        </div>
        <div className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-ink">{actionLabel}</div>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {previewParams.map((p) => (
            <tr key={p.key} className="align-top">
              <th className="w-32 py-1 pe-2 text-start font-normal text-ink-muted">{p.label}</th>
              <td className="py-1 text-ink">
                {p.mention ? (
                  <MentionChip
                    kind={p.mention.kind}
                    label={p.mention.label}
                    isProspect={p.mention.kind === 'prospect'}
                  />
                ) : (
                  <span>{p.text ?? '—'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={state.kind === 'executing'}
          className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-xs text-ink hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:opacity-50"
          data-testid="chat-proposal-cancel"
        >
          <X className="h-3 w-3" aria-hidden />
          {t('chatActions.proposal.cancel', { defaultValue: 'Cancel' })}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={state.kind === 'executing'}
          className="inline-flex items-center gap-1 rounded bg-gold px-2 py-1 text-xs font-medium text-white hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:opacity-50"
          data-testid="chat-proposal-confirm"
        >
          {state.kind === 'executing' ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3 w-3" aria-hidden />
          )}
          {t('chatActions.proposal.confirm', { defaultValue: 'Confirm' })}
        </button>
      </div>
    </motion.div>
  );
}
