import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSizeGuide,
  fetchBackInStockEnabled,
  fetchSizeGuide,
  fetchSizeGuides,
  requestStockNotification,
  saveSizeGuide,
  setSizeGuideCategories,
  type SizeGuideInput,
} from '../lib/api';

export function useSizeGuides() {
  return useQuery({
    queryKey: ['size-guides'],
    queryFn: fetchSizeGuides,
  });
}

/** One guide, for the product page (only fetched once the shopper opens it). */
export function useSizeGuide(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['size-guides', id],
    queryFn: () => fetchSizeGuide(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 1000 * 60 * 30,
  });
}

export function useSaveSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ guide, categoryIds }: { guide: SizeGuideInput; categoryIds: string[] }) => {
      const saved = await saveSizeGuide(guide);
      await setSizeGuideCategories(saved.id, categoryIds);
      return saved;
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['size-guides'] }),
        qc.invalidateQueries({ queryKey: ['admin-categories'] }),
        qc.invalidateQueries({ queryKey: ['categories'] }),
      ]),
  });
}

export function useDeleteSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSizeGuide(id),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['size-guides'] }),
        qc.invalidateQueries({ queryKey: ['admin-categories'] }),
        qc.invalidateQueries({ queryKey: ['admin-products'] }),
      ]),
  });
}

/** Whether the shop takes back-in-stock requests (storefront). */
export function useBackInStockEnabled() {
  return useQuery({
    queryKey: ['store-settings', 'back-in-stock'],
    queryFn: fetchBackInStockEnabled,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRequestStockNotification() {
  return useMutation({
    mutationFn: requestStockNotification,
  });
}
