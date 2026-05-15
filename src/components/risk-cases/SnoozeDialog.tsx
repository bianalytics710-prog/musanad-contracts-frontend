/**
 * SnoozeDialog — S-K-12. Snooze until ISO datetime; cap 30 days.
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
}

const MS_PER_DAY = 86_400_000;

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SnoozeDialog({ open, onClose, caseId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { minLocal, maxLocal, defaultLocal } = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + MS_PER_DAY);
    const max = new Date(now.getTime() + 30 * MS_PER_DAY);
    return {
      minLocal: toDatetimeLocal(new Date(now.getTime() + 60_000)),
      maxLocal: toDatetimeLocal(max),
      defaultLocal: toDatetimeLocal(tomorrow),
    };
  }, []);

  const [snoozedUntilLocal, setSnoozedUntilLocal] = useState(defaultLocal);
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const iso = new Date(snoozedUntilLocal).toISOString();
      return riskCaseService.snooze(caseId, { snoozedUntil: iso });
    },
    onSuccess: () => {
      toast.success(t('riskCases.toasts.snoozed'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      setErr(null);
      onClose();
    },
    onError: (e: unknown) => toast.error(translateApiError(e, t, 'riskCases.errors.snoozeFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const picked = new Date(snoozedUntilLocal);
    const now = new Date();
    if (Number.isNaN(picked.getTime())) {
      setErr(t('riskCases.errors.invalidDate'));
      return;
    }
    if (picked.getTime() <= now.getTime()) {
      setErr(t('riskCases.errors.snoozeMustBeFuture'));
      return;
    }
    if (picked.getTime() - now.getTime() > 30 * MS_PER_DAY) {
      setErr(t('riskCases.errors.snoozeMax30Days'));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.snooze.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.snooze.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-snooze-until" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.snoozedUntil')}
            </label>
            <Input
              id="rc-snooze-until"
              type="datetime-local"
              value={snoozedUntilLocal}
              min={minLocal}
              max={maxLocal}
              onChange={(e) => {
                setSnoozedUntilLocal(e.target.value);
                setErr(null);
              }}
              required
            />
          </div>

          {err && (
            <p role="alert" className="text-sm text-error">
              {err}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('riskCases.actions.snooze')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
