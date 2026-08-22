import { useQuery } from '@tanstack/react-query';
import { fetchProducts, fetchProductBySlug, fetchFeaturedProducts } from '../lib/api';
import type { ProductFilters } from '../types';

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => [...productKeys.all, 'list', filters] as const,
  detail: (slug: string) => [...productKeys.all, 'detail', slug] as const,
  featured: () => [...productKeys.all, 'featured'] as const,
};

export function useProducts(filters: ProductFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => fetchProducts(filters),
    enabled: options.enabled ?? true,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => fetchProductBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: productKeys.featured(),
    queryFn: fetchFeaturedProducts,
  });
}
