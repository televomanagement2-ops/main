import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminProducts,
  updateProduct,
  createProduct,
  addProductImages,
  deleteProductImage,
  setPrimaryProductImage,
  fetchAdminCategories,
  createCategory,
  type ProductInput,
} from '../lib/api';
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

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin-categories'],
    queryFn: fetchAdminCategories,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useAddProductImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      images,
    }: {
      productId: string;
      images: { url: string; alt_text?: string | null; is_primary?: boolean; sort_order?: number }[];
    }) => addProductImages(productId, images),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}

export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => deleteProductImage(imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}

export function useSetPrimaryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      setPrimaryProductImage(productId, imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}
