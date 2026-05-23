'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/Toast';

// Surfaces the result of a delete/archive redirect as a toast, then strips the
// flash query param so a page refresh doesn't replay it.
export function ProductsFlash({
  deleted,
  archived,
  error,
}: {
  deleted?: boolean;
  archived?: boolean;
  error?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    let message: string | null = null;
    let type: 'success' | 'error' = 'success';
    if (error) {
      message = error;
      type = 'error';
    } else if (archived) {
      message = 'Product archived — it has order history, so it was hidden from the store instead of deleted.';
    } else if (deleted) {
      message = 'Product deleted.';
    }
    if (!message) return;
    shown.current = true;
    toast(message, type);
    router.replace('/admin/products');
  }, [deleted, archived, error, router, toast]);

  return null;
}
