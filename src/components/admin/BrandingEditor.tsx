/**
 * BrandingEditor — logo upload + color pickers + footer fields + live preview.
 */
import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminBrandingService } from '@/services/api/admin/branding.service';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';
import type { BrandingConfig, BrandingPatchDto } from '@/types/admin/branding.types';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/svg+xml'];

interface Props {
  config: BrandingConfig;
}

export function BrandingEditor({ config }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<BrandingPatchDto>({
    colorPrimary: config.colorPrimary ?? '',
    colorAccent: config.colorAccent ?? '',
    footerEn: config.footerEn ?? '',
    footerAr: config.footerAr ?? '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(
    config.logoUri ?? null,
  );
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminBrandingService.upload('logo', file),
    onSuccess: (result) => {
      toast.success(
        t('admin.branding.toast.logoUploaded', { defaultValue: 'Logo uploaded.' }),
      );
      if (result.signedUrl) setLogoPreview(result.signedUrl);
      void queryClient.invalidateQueries({ queryKey: ['adminBranding'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.branding.errors.uploadFailed'));
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => adminBrandingService.patch(draft),
    onSuccess: () => {
      toast.success(t('admin.branding.toast.saved', { defaultValue: 'Branding saved.' }));
      void queryClient.invalidateQueries({ queryKey: ['adminBranding'] });
    },
    onError: (err: unknown) => {
      toast.error(translateApiError(err, t, 'admin.branding.errors.saveFailed'));
    },
  });

  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        t('admin.branding.errors.fileTooLarge', {
          defaultValue: 'File too large. Maximum size is 2 MB.',
        }),
      );
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(
        t('admin.branding.errors.invalidFileType', {
          defaultValue: 'Only PNG and SVG files are allowed.',
        }),
      );
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
    uploadMutation.mutate(file);
  }, [t, uploadMutation]);

  const onDropZoneKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo upload */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">
          {t('admin.branding.fields.logo', { defaultValue: 'Logo' })}
        </p>
        <div
          role="button"
          tabIndex={0}
          aria-label={t('admin.branding.uploadZoneLabel', {
            defaultValue: 'Click or drag a PNG/SVG file here to upload logo',
          })}
          onKeyDown={onDropZoneKey}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${
            isDragging
              ? 'border-gold bg-gold/10'
              : 'border-border hover:border-gold/50 hover:bg-surface/40'
          }`}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
          ) : logoPreview ? (
            <img
              src={logoPreview}
              alt={t('admin.branding.logoPreviewAlt', { defaultValue: 'Logo preview' })}
              className="h-16 w-auto object-contain"
            />
          ) : (
            <Upload className="h-8 w-8 text-ink-muted" />
          )}
          <p className="text-sm text-ink-muted">
            {t('admin.branding.uploadZoneHint', {
              defaultValue: 'PNG or SVG, max 2 MB',
            })}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Color pickers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="branding-color-primary"
            className="block text-sm font-medium text-ink"
          >
            {t('admin.branding.fields.colorPrimary', { defaultValue: 'Primary color' })}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="branding-color-primary"
              type="color"
              value={draft.colorPrimary || '#000000'}
              onChange={(e) =>
                setDraft((d) => ({ ...d, colorPrimary: e.target.value }))
              }
              className="h-9 w-14 cursor-pointer rounded border border-border bg-card p-0.5"
            />
            <Input
              value={draft.colorPrimary || ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, colorPrimary: e.target.value }))
              }
              placeholder="#B8935A"
              className="font-mono text-sm"
              aria-label={t('admin.branding.fields.colorPrimaryHex', {
                defaultValue: 'Primary color hex value',
              })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="branding-color-accent"
            className="block text-sm font-medium text-ink"
          >
            {t('admin.branding.fields.colorAccent', { defaultValue: 'Accent color' })}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="branding-color-accent"
              type="color"
              value={draft.colorAccent || '#000000'}
              onChange={(e) =>
                setDraft((d) => ({ ...d, colorAccent: e.target.value }))
              }
              className="h-9 w-14 cursor-pointer rounded border border-border bg-card p-0.5"
            />
            <Input
              value={draft.colorAccent || ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, colorAccent: e.target.value }))
              }
              placeholder="#5B8374"
              className="font-mono text-sm"
              aria-label={t('admin.branding.fields.colorAccentHex', {
                defaultValue: 'Accent color hex value',
              })}
            />
          </div>
        </div>
      </div>

      {/* Color preview swatches */}
      <div className="flex items-center gap-4">
        <div className="space-y-1 text-center">
          <div
            className="h-12 w-24 rounded border border-border"
            style={{ backgroundColor: draft.colorPrimary || 'var(--gold)' }}
            aria-label={t('admin.branding.preview.primarySwatch', {
              defaultValue: 'Primary color swatch',
            })}
          />
          <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('admin.branding.preview.primary', { defaultValue: 'Primary' })}
          </p>
        </div>
        <div className="space-y-1 text-center">
          <div
            className="h-12 w-24 rounded border border-border"
            style={{ backgroundColor: draft.colorAccent || 'var(--sage)' }}
            aria-label={t('admin.branding.preview.accentSwatch', {
              defaultValue: 'Accent color swatch',
            })}
          />
          <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
            {t('admin.branding.preview.accent', { defaultValue: 'Accent' })}
          </p>
        </div>
        {logoPreview && (
          <div className="space-y-1 text-center">
            <div className="flex h-12 w-24 items-center justify-center rounded border border-border bg-surface">
              <img
                src={logoPreview}
                alt={t('admin.branding.preview.logoAlt', { defaultValue: 'Logo' })}
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
              {t('admin.branding.preview.logo', { defaultValue: 'Logo' })}
            </p>
          </div>
        )}
      </div>

      {/* Footer text EN/AR */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="branding-footer-en"
            className="block text-sm font-medium text-ink"
          >
            {t('admin.branding.fields.footerEn', { defaultValue: 'Footer text (English)' })}
          </label>
          <textarea
            id="branding-footer-en"
            rows={3}
            value={draft.footerEn || ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, footerEn: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="branding-footer-ar"
            className="block text-sm font-medium text-ink"
          >
            {t('admin.branding.fields.footerAr', { defaultValue: 'Footer text (Arabic)' })}
          </label>
          <textarea
            id="branding-footer-ar"
            rows={3}
            dir="rtl"
            value={draft.footerAr || ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, footerAr: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || uploadMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('common.saving', { defaultValue: 'Saving…' })}
            </>
          ) : (
            t('common.save', { defaultValue: 'Save' })
          )}
        </Button>
      </div>
    </div>
  );
}
