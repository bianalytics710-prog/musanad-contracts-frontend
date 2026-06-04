/**
 * /app/legal/third-party-review/new — upload form.
 *
 * Single-page form. On submit:
 *   1. POST /api/v1/tpa/reviews/upload  (multipart — synchronous gpt-4o analysis)
 *   2. Toast progress / completion
 *   3. Redirect to detail page on success
 */
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Upload, AlertTriangle, FileText, ShieldCheck } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore, selectHasPermission } from '@/store/auth.store';
import { tpaService } from '@/services/api/tpa.service';
import type { AgreementType, PlaybookListItem } from '@/types/tpa.types';

export const Route = createFileRoute('/app/legal/third-party-review/new')({
  component: () => (
    <ErrorBoundary>
      <NewReviewView />
    </ErrorBoundary>
  ),
});

const AGREEMENT_TYPES: { value: AgreementType; label: string }[] = [
  { value: 'nda', label: 'Non-disclosure agreement (NDA)' },
  { value: 'msa', label: 'Master services agreement (MSA)' },
  { value: 'supply', label: 'Supply agreement' },
  { value: 'service', label: 'Service agreement' },
  { value: 'consultancy', label: 'Consultancy agreement' },
  { value: 'epc', label: 'EPC contract' },
  { value: 'spa', label: 'Sale and purchase agreement (SPA)' },
  { value: 'other', label: 'Other' },
];

const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function NewReviewView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = useAuthStore(selectHasPermission('tpa.review.create'));

  const [agreementType, setAgreementType] = useState<AgreementType>('nda');
  const [playbookId, setPlaybookId] = useState<number | null>(null);
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [agreementTitle, setAgreementTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: playbooks, isLoading: playbooksLoading } = useQuery({
    queryKey: ['tpa.playbooks'],
    queryFn: () => tpaService.listPlaybooks(),
    enabled: canCreate,
    staleTime: 5 * 60_000,
  });

  // Auto-select first matching playbook when agreement type changes
  const matchingPlaybooks =
    playbooks?.data.filter((p) => p.agreementType === agreementType) ?? [];
  if (
    playbookId === null &&
    matchingPlaybooks.length > 0 &&
    matchingPlaybooks[0]
  ) {
    setPlaybookId(matchingPlaybooks[0].id);
  }

  const uploadMutation = useMutation({
    mutationFn: tpaService.upload,
    onSuccess: (result) => {
      toast.success(
        t('tpa.upload.toast.success', {
          defaultValue: `Analysis complete · ${result.acceptCount} accept · ${result.amendCount} amend · ${result.rejectCount} reject`,
          accept: result.acceptCount,
          amend: result.amendCount,
          reject: result.rejectCount,
        }),
      );
      navigate({
        to: '/app/legal/third-party-review/$id',
        params: { id: String(result.id) },
      });
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message ?? err.message ?? 'Upload failed';
      toast.error(msg);
    },
  });

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_MIME.includes(f.type)) {
      setFileError('Only PDF or DOCX files are accepted');
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileError('File is larger than the 10 MB limit');
      setFile(null);
      return;
    }
    setFile(f);
    if (!agreementTitle && f.name) {
      setAgreementTitle(f.name.replace(/\.(pdf|docx)$/i, '').replace(/[_-]+/g, ' '));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFileError('Please select a file to upload');
      return;
    }
    if (!playbookId) {
      toast.error('Please select a playbook');
      return;
    }
    if (!counterpartyName.trim() || !agreementTitle.trim()) {
      toast.error('Counterparty name and agreement title are required');
      return;
    }
    uploadMutation.mutate({
      file,
      playbookId,
      agreementType,
      counterpartyName: counterpartyName.trim(),
      counterpartyEmail: counterpartyEmail.trim() || undefined,
      agreementTitle: agreementTitle.trim(),
    });
  };

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-ink-subtle">
        {t('tpa.upload.forbidden', {
          defaultValue: 'You do not have permission to upload third-party agreements.',
        })}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 lg:px-8"
    >
      <div>
        <Link
          to="/app/legal/third-party-review"
          className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" /> Back to reviews
        </Link>
        <div className="mt-3 font-mono text-xs uppercase tracking-wider text-ink-subtle">
          Legal Counsel · Third-Party Review
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Upload counterparty agreement
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-subtle">
          We extract the clauses, compare them line-by-line against the ADNOC playbook, and produce
          a Word redline you can send back. Analysis typically takes 30–60 seconds.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Agreement details */}
        <Card>
          <CardContent className="space-y-5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle">
              Agreement details
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-subtle" htmlFor="agreementType">
                  Agreement type
                </label>
                <select
                  id="agreementType"
                  value={agreementType}
                  onChange={(e) => {
                    setAgreementType(e.target.value as AgreementType);
                    setPlaybookId(null);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {AGREEMENT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-subtle" htmlFor="playbookId">
                  ADNOC playbook
                </label>
                <select
                  id="playbookId"
                  value={playbookId ?? ''}
                  onChange={(e) => setPlaybookId(Number(e.target.value) || null)}
                  disabled={playbooksLoading}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm disabled:bg-surface/30"
                >
                  <option value="">
                    {playbooksLoading ? 'Loading playbooks…' : '— Select a playbook —'}
                  </option>
                  {matchingPlaybooks.map((p: PlaybookListItem) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn} (v{p.version}, {p.clauseCount} clauses)
                    </option>
                  ))}
                </select>
                {matchingPlaybooks.length === 0 && !playbooksLoading && (
                  <p className="mt-1 text-xs text-amber-ink">
                    No playbook seeded for this agreement type yet. Pick a different type or contact
                    your administrator.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-ink-subtle" htmlFor="counterpartyName">
                  Counterparty name
                </label>
                <Input
                  id="counterpartyName"
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder="e.g. Aqaba Drilling Services Ltd"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-subtle" htmlFor="counterpartyEmail">
                  Counterparty email (optional)
                </label>
                <Input
                  id="counterpartyEmail"
                  type="email"
                  value={counterpartyEmail}
                  onChange={(e) => setCounterpartyEmail(e.target.value)}
                  placeholder="counsel@aqabadrilling.example.com"
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-ink-subtle" htmlFor="agreementTitle">
                  Agreement title
                </label>
                <Input
                  id="agreementTitle"
                  value={agreementTitle}
                  onChange={(e) => setAgreementTitle(e.target.value)}
                  placeholder="e.g. Mutual Non-Disclosure Agreement — June 2026"
                  required
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File upload */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle">
              Document
            </h2>

            <label
              htmlFor="file"
              className="flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-surface/30 p-8 hover:border-ink-subtle"
            >
              <Upload className="h-5 w-5 text-ink-subtle" />
              <div className="text-sm">
                {file ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">{file.name}</span>
                    <span className="text-xs text-ink-subtle">
                      {(file.size / 1024).toFixed(1)} KB · {file.type.split('/').pop()?.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <span className="text-ink-subtle">
                    Click to select a PDF or DOCX file (max 10 MB)
                  </span>
                )}
              </div>
              <input
                id="file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={onFileChange}
                className="hidden"
              />
            </label>

            {fileError && (
              <div className="flex items-center gap-2 text-xs text-terracotta">
                <AlertTriangle className="h-3 w-3" /> {fileError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action bar */}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface/40 p-4">
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <ShieldCheck className="h-3 w-3 text-sage-ink" />
            <span>Files are encrypted in transit and stored within ADNOC's tenant.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app/legal/third-party-review">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={uploadMutation.isPending || !file} className="gap-2">
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" /> Upload &amp; analyse
                </>
              )}
            </Button>
          </div>
        </div>

        {uploadMutation.isPending && (
          <Card className="border-amber-ink/30 bg-amber-tint/30">
            <CardContent className="flex items-start gap-3 p-4 text-xs text-ink">
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-amber-ink" />
              <div>
                <div className="font-semibold">Running gpt-4o analysis…</div>
                <div className="mt-0.5 text-ink-subtle">
                  Extracting clauses, comparing to playbook, classifying each clause as accept / amend
                  / reject, and proposing redline language. Please don&apos;t leave this page.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </motion.div>
  );
}
