# CommerceJet — Products Setup

**Remove the demo catalog & add your real products.**

## Contents

1. Understand the data model
2. Remove the demo (mock) products
3. Set up your categories
4. Add real products (two methods)
5. Add product images
6. Verify on the storefront

> **Note —** The store ships pre-loaded with a demo catalog so you can see it working
> immediately. Before going live, replace it with your own.

---

## 1. Understand the data model

Products live in three database tables in Supabase:

| Table | Purpose |
|---|---|
| `categories` | Product categories (e.g. Electronics, Clothing). |
| `products` | The products themselves. |
| `product_images` | One or more images per product. |

**Required product fields:** `category_id` (must reference an existing category), `name`,
`slug` (must be unique — used in the URL), `price` (≥ 0), `stock_quantity` (≥ 0).

**Useful optional fields:** `sku` (unique if set), `description`, `compare_at_price` (the
struck-through "before" price), `is_featured` (`TRUE` to show on the home page), `is_active`
(`FALSE` to hide without deleting).

> **Important —** For images, exactly **one** image per product should have
> `is_primary = TRUE` — that's the main thumbnail.

---

## 2. Remove the demo products

In Supabase Dashboard → SQL Editor, run this (delete images first because they reference
products):

```sql
DELETE FROM public.product_images;
DELETE FROM public.products;
```

> **Tip —** To start categories from scratch too, also run
> `DELETE FROM public.categories;` — but then insert your own categories **before** inserting
> products (products reference a category).

---

## 3. Set up your categories

The demo ships with these category slugs: `electronics`, `clothing`, `home-garden`,
`smartphones`. Keep, rename, or replace them. To add one via SQL:

```sql
INSERT INTO public.categories (name, slug, is_active, sort_order)
VALUES ('Shoes', 'shoes', TRUE, 1);
```

> **Note —** The category `slug` is used in URLs and filters, so keep it lowercase with
> hyphens (e.g. `home-garden`).

---

## 4. Add real products

**Method A — Supabase Table Editor (no SQL).** Dashboard → Table Editor → `products` →
Insert row. Fill `name`, `slug`, `price`, `stock_quantity`, pick a `category_id`, save.

**Method B — SQL (faster for many products):**

```sql
INSERT INTO public.products
  (category_id, name, slug, description, price, sku, stock_quantity, is_featured, is_active)
VALUES
  (
    (SELECT id FROM public.categories WHERE slug = 'shoes'),
    'Running Shoes Pro',
    'running-shoes-pro',
    'Lightweight running shoes with breathable mesh.',
    119.00, 'RSP-001', 40, TRUE, TRUE
  );
```

> **Tip —** Using `(SELECT id FROM categories WHERE slug = '…')` means you don't have to copy
> category UUIDs by hand.

---

## 5. Add product images

```sql
INSERT INTO public.product_images (product_id, url, alt_text, sort_order, is_primary)
VALUES
  ((SELECT id FROM public.products WHERE slug = 'running-shoes-pro'),
   'https://your-cdn.com/shoes-front.jpg', 'Running shoes front view', 0, TRUE),
  ((SELECT id FROM public.products WHERE slug = 'running-shoes-pro'),
   'https://your-cdn.com/shoes-side.jpg', 'Running shoes side view', 1, FALSE);
```

Host images anywhere public (your CDN or Supabase Storage). Only one row per product gets
`is_primary = TRUE`.

---

## 6. Verify on the storefront

- Home page — featured products (`is_featured = TRUE`) appear.
- Category page — your products are listed.
- Product page — image, price, and description are correct.
- Add to cart — quantity respects `stock_quantity`.

> **Note —** If you changed category slugs, also review the home-page category icons in
> [`src/features/products/pages/HomePage.tsx`](../src/features/products/pages/HomePage.tsx) so
> the icons match your new slugs.
