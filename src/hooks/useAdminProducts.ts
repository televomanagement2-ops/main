import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  fetchAdminProducts,
  updateProduct,
  createProduct,
  addProductImages,
  deleteProductImage,
  setPrimaryProductImage,
  setImageColor,
  fetchAdminCategories,
  createCategory,
  saveProductVariants,
  setVariantStock,
  setProductStock,
  fetchCatalogCosts,
  duplicateProduct,
  importProducts,
  type ProductInput,
  type ProductUpdate,
  type VariantStockChange,
} from '../lib/api';
import { productKeys } from './useProducts';

/**
 * Stock is what the storefront reads to decide what can be bought, so a
 * stock change also drops the cached product pages, not just the admin list
 * (and the low-stock figures). Returned so the mutation settles only once the
 * list shows the new figures: an editor that clears its drafts on success then
 * never flashes the old ones.
 */
function invalidateStock(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-products'] }),
    qc.invalidateQueries({ queryKey: productKeys.all }),
    qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
    qc.invalidateQueries({ queryKey: ['admin-analytics'] }),
  ]);
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin-products'],
    queryFn: fetchAdminProducts,
  });
}

/** Cost prices (admin-only; not selectable through the product list). */
export function useCatalogCosts() {
  return useQuery({
    queryKey: ['admin-products', 'costs'],
    queryFn: fetchCatalogCosts,
  });
}

export function useUpdateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, updates }: { productId: string; updates: ProductUpdate }) =>
      updateProduct(productId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: productKeys.all });
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

/** Colours, sizes, prices, costs and stock from the product editor. */
export function useSaveProductVariants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, config }: { productId: string; config: Parameters<typeof saveProductVariants>[1] }) =>
      saveProductVariants(productId, config),
    // Settled, not success: a stock conflict means the cached figures are the
    // stale ones, and the admin needs the fresh ones to decide what to do.
    onSettled: () => invalidateStock(qc),
  });
}

/** Quick restock of variants from the catalog. */
export function useSetVariantStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ changes, note }: { changes: VariantStockChange[]; note?: string | null }) =>
      setVariantStock(changes, note),
    onSettled: () => invalidateStock(qc),
  });
}

/** Quick restock of a product without variants, refused if the figure moved meanwhile. */
export function useSetProductStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, stock, expected, note }: { productId: string; stock: number; expected: number; note?: string | null }) =>
      setProductStock(productId, stock, expected, note),
    onSettled: () => invalidateStock(qc),
  });
}

export function useDuplicateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, name }: { productId: string; name: string }) => duplicateProduct(productId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}

export function useImportProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ products, createCategories }: { products: unknown[]; createCategories: boolean }) =>
      importProducts(products, { createCategories }),
    onSettled: () =>
      Promise.all([
        invalidateStock(qc),
        qc.invalidateQueries({ queryKey: ['admin-categories'] }),
        qc.invalidateQueries({ queryKey: ['categories'] }),
      ]),
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
      images: { url: string; alt_text?: string | null; is_primary?: boolean; sort_order?: number; color_id?: string | null }[];
    }) => addProductImages(productId, images),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}

export function useSetImageColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, colorId }: { imageId: string; colorId: string | null }) => setImageColor(imageId, colorId),
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
