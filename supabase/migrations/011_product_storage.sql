-- ============================================================
-- MIGRATION 011 — Storage bucket for product images
-- Run after 010_reviews_verified_purchase.sql
-- ============================================================
-- Public-read bucket for product images; only admins may upload/modify/delete.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read of objects in this bucket (images shown on the storefront).
DROP POLICY IF EXISTS "product-images: public read" ON storage.objects;
CREATE POLICY "product-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Admin-only writes. public.is_admin() is SECURITY DEFINER (defined in rls.sql).
DROP POLICY IF EXISTS "product-images: admin insert" ON storage.objects;
CREATE POLICY "product-images: admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product-images: admin update" ON storage.objects;
CREATE POLICY "product-images: admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product-images: admin delete" ON storage.objects;
CREATE POLICY "product-images: admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.is_admin());
