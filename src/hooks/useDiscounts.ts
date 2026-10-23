import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteDiscountCode,
  fetchDiscountCodes,
  fetchDiscountUsage,
  saveDiscountCode,
  type DiscountCodeInput,
} from '../lib/api';

export function useDiscountCodes() {
  return useQuery({
    queryKey: ['admin-discounts'],
    queryFn: fetchDiscountCodes,
  });
}

export function useDiscountUsage() {
  return useQuery({
    queryKey: ['admin-discounts', 'usage'],
    queryFn: fetchDiscountUsage,
  });
}

export function useSaveDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscountCodeInput) => saveDiscountCode(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-discounts'] }),
  });
}

export function useDeleteDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDiscountCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-discounts'] }),
  });
}
