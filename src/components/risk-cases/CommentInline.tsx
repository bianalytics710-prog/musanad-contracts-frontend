/**
 * CommentInline — S-K-6. Append a comment to a case timeline.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { riskCaseService } from '@/services/api/risk-case.service';
import { translateApiError } from '@/lib/translate-api-error';

interface Props {
  caseId: number;
}

export function CommentInline({ caseId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => riskCaseService.addComment(caseId, { comment: comment.trim() }),
    onSuccess: () => {
      toast.success(t('riskCases.toasts.commentAdded'));
      void qc.invalidateQueries({ queryKey: ['riskCase', caseId] });
      setComment('');
    },
    onError: (e: unknown) =>
      toast.error(translateApiError(e, t, 'riskCases.errors.commentFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-3">
      <label htmlFor={`rc-comment-${caseId}`} className="mb-1 block text-sm font-medium text-ink">
        {t('riskCases.fields.comment')}
      </label>
      <textarea
        id={`rc-comment-${caseId}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={5000}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder={t('riskCases.fields.commentPlaceholder')}
      />
      <div className="mt-2 flex items-center justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || !comment.trim()}
          aria-label={t('riskCases.actions.addComment')}
        >
          <Send className="me-1 h-3.5 w-3.5" aria-hidden="true" />
          {mutation.isPending ? t('common.posting') : t('riskCases.actions.addComment')}
        </Button>
      </div>
    </form>
  );
}
