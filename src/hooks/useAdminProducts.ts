import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  fetchAdminProducts,
  updateProduct,
  createProduct,
  addProductImages,
  deleteProductImage,
  setPrimaryProductImage,
  fetchAdminCategories,
  createCategory,
  setProductInventory,
  setVariantStock,
  updateProductStock,
  type InventoryInput,
  type ProductInput,
  type ProductUpdate,
  type VariantStockChange,
} from '../lib/api';
import { productKeys } from './useProducts';

/**
 * Stock is what the storefront reads to decide what can be bought, so a
 * stock change also drops the cached product pages, not just the admin list.
 * Returned so the mutation settles only once the list shows the new figures:
 * an editor that clears its drafts on success then never flashes the old ones.
 */
function invalidateStock(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-products'] }),
    qc.invalidateQueries({ queryKey: productKeys.all }),
  ]);
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin-products'],
    queryFn: fetchAdminProducts,
  });
}

export function useUpdateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, updates }: { productId: string; updates: ProductUpdate }) =>
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

/** Sizes and stock from the product editor (admin_set_product_inventory). */
export function useSetProductInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InventoryInput) => setProductInventory(input),
    // Settled, not success: a stock conflict means the cached figures are the
    // stale ones, and the admin needs the fresh ones to decide what to do.
    onSettled: () => invalidateStock(qc),
  });
}

/** Quick per-size restock from the catalog (admin_set_variant_stock). */
export function useSetVariantStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: VariantStockChange[]) => setVariantStock(changes),
    onSettled: () => invalidateStock(qc),
  });
}

/** Quick restock of an unsized product, refused if the figure moved meanwhile. */
export function useUpdateProductStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, stock, expected }: { productId: string; stock: number; expected: number }) =>
      updateProductStock(productId, stock, expected),
    onSettled: () => invalidateStock(qc),
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
