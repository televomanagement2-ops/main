import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchReviews, submitReview, hasPurchasedProduct } from '../lib/api';

export const reviewKeys = {
  all: ['reviews'] as const,
  product: (productId: string) => [...reviewKeys.all, productId] as const,
};

export function useReviews(productId: string) {
  return useQuery({
    queryKey: reviewKeys.product(productId),
    queryFn: () => fetchReviews(productId),
    enabled: Boolean(productId),
  });
}

/** Whether the signed-in user has purchased this product (gates reviewing). */
export function useHasPurchased(productId: string, userId?: string) {
  return useQuery({
    queryKey: ['has-purchased', productId, userId],
    queryFn: () => hasPurchasedProduct(productId),
    enabled: Boolean(productId && userId),
  });
}

export function useSubmitReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      rating,
      body,
    }: {
      userId: string;
      rating: number;
      body: string;
    }) => submitReview(productId, userId, rating, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.product(productId) });
    },
  });
}
