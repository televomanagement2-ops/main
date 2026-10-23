import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchInventoryMovements,
  fetchLowStock,
  fetchStockRequests,
  fetchStoreSettings,
  runStoreWorker,
  updateStoreSettings,
  type MovementFilters,
} from '../lib/api';
import type { StoreSettings } from '../types';

export function useLowStock() {
  return useQuery({
    queryKey: ['admin-inventory', 'low-stock'],
    queryFn: fetchLowStock,
  });
}

export function useInventoryMovements(filters: MovementFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin-inventory', 'movements', filters],
    queryFn: () => fetchInventoryMovements(filters),
    enabled: options.enabled ?? true,
  });
}

export function useStockRequests() {
  return useQuery({
    queryKey: ['admin-inventory', 'requests'],
    queryFn: fetchStockRequests,
  });
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchStoreSettings,
  });
}

export function useUpdateStoreSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<Pick<StoreSettings, 'back_in_stock_enabled' | 'low_stock_alerts' | 'alert_emails'>>) =>
      updateStoreSettings(settings),
    onSuccess: (data) => {
      qc.setQueryData(['admin-settings'], data);
      qc.invalidateQueries({ queryKey: ['store-settings', 'back-in-stock'] });
    },
  });
}

export function useRunStoreWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: 'back_in_stock' | 'low_stock' | 'all') => runStoreWorker(task),
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
  });
}
