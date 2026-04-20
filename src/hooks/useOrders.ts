import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOrders, fetchOrderById, cancelOrder } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function useOrders() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => fetchOrders(user!.id),
    enabled: Boolean(user),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: Boolean(orderId),
  });
}

export function useCancelOrder(orderId: string) {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['orders', user?.id] });
    },
  });
}
