/**
 * CreateRiskCaseDialog — manual risk case creation (S-K-2).
 *
 * AC-SK2: title required (trim), priority enum required, slaHours integer >0.
 * D6 — every input gets id + label htmlFor.
 * T9 — destructive-free (creation is not destructive); validation via zod.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';
import { RISK_CASE_PRIORITIES } from '@/types/risk-case.types';
import type { CreateRiskCaseDto, RiskCasePriority } from '@/types/risk-case.types';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultContractId?: number | null;
}

const formSchema = z.object({
  title: z.string().trim().min(1).max(500),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  body: z.string().trim().max(10_000).optional(),
  slaHours: z
    .union([z.string(), z.number()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .pipe(z.number().int().positive().nullable())
    .optional(),
});

export function CreateRiskCaseDialog({ open, onClose, defaultContractId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<RiskCasePriority>('medium');
  const [body, setBody] = useState('');
  const [slaHours, setSlaHours] = useState('');
  const [titleErr, setTitleErr] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateRiskCaseDto) => riskCaseService.create(payload),
    onSuccess: () => {
      toast.success(t('riskCases.toasts.created'));
      void qc.invalidateQueries({ queryKey: ['riskCases'] });
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'riskCases.errors.createFailed'));
    },
  });

  const reset = () => {
    setTitle('');
    setPriority('medium');
    setBody('');
    setSlaHours('');
    setTitleErr(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTitleErr(null);

    const parsed = formSchema.safeParse({
      title,
      priority,
      body: body || undefined,
      slaHours: slaHours || undefined,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'title') {
        setTitleErr(t('riskCases.errors.titleRequired'));
      } else {
        toast.error(t('riskCases.errors.invalidInput'));
      }
      return;
    }

    const payload: CreateRiskCaseDto = {
      title: parsed.data.title,
      priority: parsed.data.priority,
      body: parsed.data.body ?? null,
      slaHours: parsed.data.slaHours ?? null,
      contractId: defaultContractId ?? null,
    };

    createMutation.mutate(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('riskCases.create.title')}</DialogTitle>
          <DialogDescription>{t('riskCases.create.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="rc-create-title" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.title')}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <Input
              id="rc-create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              required
              aria-invalid={!!titleErr}
              aria-describedby={titleErr ? 'rc-create-title-err' : undefined}
            />
            {titleErr && (
              <p id="rc-create-title-err" className="mt-1 text-xs text-error">
                {titleErr}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="rc-create-priority" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.priority')}
              <span className="text-error ms-1" aria-hidden="true">*</span>
            </label>
            <select
              id="rc-create-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as RiskCasePriority)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {RISK_CASE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`riskCases.priorities.${p}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rc-create-sla" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.slaHours')}
            </label>
            <Input
              id="rc-create-sla"
              type="number"
              inputMode="numeric"
              min={1}
              max={720}
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
              placeholder={t('riskCases.fields.slaHoursHint')}
            />
          </div>

          <div>
            <label htmlFor="rc-create-body" className="mb-1 block text-sm font-medium text-ink">
              {t('riskCases.fields.body')}
            </label>
            <textarea
              id="rc-create-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={10_000}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('riskCases.fields.bodyPlaceholder')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.creating') : t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
