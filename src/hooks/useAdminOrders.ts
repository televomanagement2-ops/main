import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminOrders,
  markOrderDelivered,
  refundOrder,
  updateOrderStatus,
  updateOrderTracking,
  type AdminOrdersFilters,
} from '../lib/api';
import type { OrderStatus } from '../types';

export function useAdminOrders(filters: AdminOrdersFilters = {}) {
  return useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: () => fetchAdminOrders(filters),
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

export function useMarkOrderDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => markOrderDelivered(orderId),
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
