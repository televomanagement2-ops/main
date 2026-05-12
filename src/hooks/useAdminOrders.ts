import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminOrders, refundOrder, updateOrderStatus, updateOrderTracking } from '../lib/api';
import type { OrderStatus } from '../types';

export function useAdminOrders() {
  return useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => fetchAdminOrders(),
  });
}

export function useUpdateAdminOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });
}

export function useUpdateAdminOrderTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      trackingId,
    }: {
      orderId: string;
      trackingId: string;
    }) => updateOrderTracking(orderId, trackingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount }: { orderId: string; amount?: number }) =>
      refundOrder(orderId, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });
}
