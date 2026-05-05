import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminProducts, updateProduct } from '../lib/api';
import type { Product } from '../types';

export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin-products'],
    queryFn: fetchAdminProducts,
  });
}

export function useUpdateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, updates }: { productId: string; updates: Partial<Product> }) =>
      updateProduct(productId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}
