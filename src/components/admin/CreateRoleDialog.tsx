/**
 * CreateRoleDialog — modal form for creating a new role.
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminRolesMgmtService } from '@/services/api/admin/roles-mgmt.service';
import { useFocusTrap } from '@/components/common/useFocusTrap';
import { translateApiError } from '@/lib/translate-api-error';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function CreateRoleDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      adminRolesMgmtService.create({
        name: data.name,
        description: data.description || null,
      }),
    onSuccess: () => {
      toast.success(
        t('admin.roles.edit.toast.created', { defaultValue: 'Role created successfully.' }),
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = translateApiError(err, t, 'admin.roles.edit.errors.createFailed');
      // Surface field-level error for name conflict
      setError('name', { message: msg });
    },
  });

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-role-dialog-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2
            id="create-role-dialog-title"
            className="text-lg font-semibold text-ink"
          >
            {t('admin.roles.edit.createTitle', { defaultValue: 'Create role' })}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-subtle hover:bg-surface hover:text-ink"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="create-role-name"
              className="block text-sm font-medium text-ink"
            >
              {t('admin.roles.edit.fields.name', { defaultValue: 'Role name' })}
              <span className="ms-1 text-terracotta" aria-hidden="true">*</span>
            </label>
            <Input
              id="create-role-name"
              {...register('name')}
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'create-role-name-error' : undefined}
            />
            {errors.name && (
              <p id="create-role-name-error" className="text-xs text-terracotta">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="create-role-description"
              className="block text-sm font-medium text-ink"
            >
              {t('admin.roles.edit.fields.description', { defaultValue: 'Description' })}
            </label>
            <Input
              id="create-role-description"
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('common.creating', { defaultValue: 'Creating…' })}
                </>
              ) : (
                t('common.create', { defaultValue: 'Create' })
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
