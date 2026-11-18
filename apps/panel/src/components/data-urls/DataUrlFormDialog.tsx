import { zodResolver } from '@hookform/resolvers/zod';
import { type CreateDataUrlInput, type CreateDataUrlPayload, createDataUrlSchema, type DataUrl, type ParsedUrl } from '@sig/shared';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Label } from 'radix-ui';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useCreateDataUrl, useUpdateDataUrl } from '../../lib/dataUrls';
import { Modal } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { TagInput } from '../ui/tag-input';
import { BulkLinkInput } from './BulkLinkInput';
import { inputCls } from './LinkFields';


export function DataUrlFormDialog({
  open, onOpenChange, dataUrl, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** diisi = mode edit (judul, tag, status). Link dikelola di halaman detail. */
  dataUrl?: DataUrl | null;
  onCreated?: (id: string) => void;
}) {
  const mode = dataUrl ? 'edit' : 'create';
  const create = useCreateDataUrl();
  const update = useUpdateDataUrl();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateDataUrlInput, unknown, CreateDataUrlPayload>({ resolver: zodResolver(createDataUrlSchema) });
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = form;
  // platform sudah terdeteksi di BulkLinkInput (server juga mendeteksi ulang)
  const onLinks = useCallback(
    (links: ParsedUrl[]) => setValue('links', links.map(({ url, platform }) => ({ url, platform }))),
    [setValue],
  );

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    reset(dataUrl
      ? { title: dataUrl.title, tags: dataUrl.tags, isActive: dataUrl.isActive, links: [] }
      : { title: '', tags: [], isActive: true, links: [] });
  }, [open, dataUrl, reset]);

  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (dataUrl) {
        const { links: _l, ...meta } = values;
        await update.mutateAsync({ id: dataUrl.id, ...meta });
      } else {
        const created = await create.mutateAsync(values);
        onCreated?.(created.id);
      }
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  });


  return (
    <Modal
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={mode === 'create' ? 'Tambah Data Url' : 'Edit Data Url'}
      description={mode === 'create' ? 'Kelompokkan link postingan dari berbagai platform dalam satu judul.' : 'Ubah judul, tag, dan status. Link dikelola di halaman detail.'}
      className="max-w-[680px]"
    >
      <form onSubmit={onSubmit} noValidate className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <AnimatePresence>
          {serverError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              role="alert" className="rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-[14px] text-accent">
              {serverError}
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <Label.Root htmlFor="title" className="mb-1.5 block text-[14px] font-medium">Judul</Label.Root>
          <input id="title" autoFocus placeholder="mis. Kampanye Ramadhan 2026" className={inputCls(!!errors.title)} {...register('title')} />
          {errors.title && <p className="mt-1.5 text-[13px] text-accent">{errors.title.message}</p>}
        </div>

        <div>
          <Label.Root htmlFor="tags" className="mb-1.5 block text-[14px] font-medium">
            Tag <span className="font-normal text-ink-3">(opsional, maks. 20)</span>
          </Label.Root>
          <Controller control={control} name="tags"
            render={({ field }) => <TagInput id="tags" value={field.value ?? []} onChange={field.onChange} invalid={!!errors.tags} />} />
          {errors.tags && <p className="mt-1.5 text-[13px] text-accent">{errors.tags.message}</p>}
        </div>

        <Controller control={control} name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
              <Label.Root htmlFor="isActive" className="cursor-pointer">
                <span className="block text-[14px] font-medium">Aktif</span>
                <span className="block text-[12px] text-ink-3">Data Url nonaktif tidak ikut dipantau.</span>
              </Label.Root>
              <Switch id="isActive" checked={!!field.value} onCheckedChange={field.onChange} label="Aktif" />
            </div>
          )} />

        {mode === 'create' && (
          <div>
            <span className="mb-1.5 block text-[14px] font-medium">
              Link postingan <span className="font-normal text-ink-3">(opsional — bisa ditambah nanti)</span>
            </span>
            <BulkLinkInput key={String(open)} onChange={onLinks} />
            {errors.links && <p className="mt-1.5 text-[13px] text-accent">{errors.links.message}</p>}
          </div>
        )}

        <div className="sticky bottom-0 flex justify-end gap-2 bg-card pt-3">
          <button type="button" onClick={() => onOpenChange(false)} disabled={pending}
            className="rounded-xl border border-line px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
            Batal
          </button>
          <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={pending || (mode === 'edit' && !isDirty)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-60">
            {pending && <Loader2 size={16} className="animate-spin" />}
            {mode === 'create' ? 'Simpan Data Url' : 'Simpan perubahan'}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
