import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  addOrderNote,
  adminCancelOrder,
  confirmOrderPayment,
  deleteOrderNote,
  exchangeOrderItem,
  fetchAdminOrders,
  fetchOrderEvents,
  fetchOrderRefunds,
  issueInvoices,
  markOrderDelivered,
  refundOrder,
  refundOrderLines,
  resolveOrderReview,
  syncOrderPayment,
  updateOrderStatus,
  updateOrderTracking,
  type AdminOrdersFilters,
  type RefundRequest,
} from '../lib/api';
import { productKeys } from './useProducts';
import type { OrderStatus } from '../types';

export const orderKeys = {
  events: (orderId: string) => ['admin-order', orderId, 'events'] as const,
  refunds: (orderId: string) => ['admin-order', orderId, 'refunds'] as const,
};

/** An order changed: its list, its timeline and the dashboard figures. */
function invalidateOrders(qc: QueryClient, orderId?: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-orders'] }),
    qc.invalidateQueries({ queryKey: ['admin-analytics'] }),
    orderId ? qc.invalidateQueries({ queryKey: ['admin-order', orderId] }) : Promise.resolve(),
  ]);
}

/** …and stock moved with it (refunds that restock, exchanges, cancellations). */
function invalidateOrdersAndStock(qc: QueryClient, orderId?: string) {
  return Promise.all([
    invalidateOrders(qc, orderId),
    qc.invalidateQueries({ queryKey: ['admin-products'] }),
    qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
    qc.invalidateQueries({ queryKey: productKeys.all }),
  ]);
}

export function useAdminOrders(filters: AdminOrdersFilters = {}) {
  return useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: () => fetchAdminOrders(filters),
  });
}

export function useOrderEvents(orderId: string | null) {
  return useQuery({
    queryKey: orderKeys.events(orderId ?? ''),
    queryFn: () => fetchOrderEvents(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useOrderRefunds(orderId: string | null) {
  return useQuery({
    queryKey: orderKeys.refunds(orderId ?? ''),
    queryFn: () => fetchOrderRefunds(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useUpdateAdminOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onSuccess: (_data, { orderId }) => invalidateOrders(qc, orderId),
  });
}

export function useUpdateAdminOrderTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, trackingId }: { orderId: string; trackingId: string }) =>
      updateOrderTracking(orderId, trackingId),
    onSuccess: (_data, { orderId }) => invalidateOrders(qc, orderId),
  });
}

export function useMarkOrderDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => markOrderDelivered(orderId),
    onSuccess: (_data, { orderId }) => invalidateOrders(qc, orderId),
  });
}

/** Everything left to refund (the finance page's one-click refund). */
export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => refundOrder(orderId),
    onSettled: (_data, _err, { orderId }) => invalidateOrdersAndStock(qc, orderId),
  });
}

export function useRefundOrderLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: RefundRequest) => refundOrderLines(request),
    onSettled: (_data, _err, request) => invalidateOrdersAndStock(qc, request.orderId),
  });
}

export function useAdminCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => adminCancelOrder(orderId),
    onSettled: (_data, _err, { orderId }) => invalidateOrdersAndStock(qc, orderId),
  });
}

export function useSyncOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => syncOrderPayment(orderId),
    onSettled: (_data, _err, { orderId }) => invalidateOrdersAndStock(qc, orderId),
  });
}

export function useConfirmOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => confirmOrderPayment(orderId),
    onSettled: (_data, _err, { orderId }) => invalidateOrdersAndStock(qc, orderId),
  });
}

export function useResolveOrderReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string | null }) => resolveOrderReview(orderId, note),
    onSuccess: (_data, { orderId }) => invalidateOrders(qc, orderId),
  });
}

export function useExchangeOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof exchangeOrderItem>[0] & { orderId: string }) => exchangeOrderItem(input),
    onSettled: (_data, _err, input) => invalidateOrdersAndStock(qc, input.orderId),
  });
}

export function useAddOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, actorId, message }: { orderId: string; actorId: string; message: string }) =>
      addOrderNote(orderId, actorId, message),
    onSuccess: (_data, { orderId }) => qc.invalidateQueries({ queryKey: orderKeys.events(orderId) }),
  });
}

export function useDeleteOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId }: { eventId: number; orderId: string }) => deleteOrderNote(eventId),
    onSuccess: (_data, { orderId }) => qc.invalidateQueries({ queryKey: orderKeys.events(orderId) }),
  });
}

export function useIssueInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => issueInvoices(orderIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
  });
}
