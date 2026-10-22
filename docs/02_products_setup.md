# CommerceJet — Products Setup

**Remove the demo catalog & add your real products.**

## Contents

1. Understand the data model
2. Remove the demo (mock) products
3. Set up your categories
4. Add real products (three methods)
5. Products sold by size or measurement
6. Add product images
7. Verify on the storefront

> **Note —** The store ships pre-loaded with a demo catalog so you can see it working
> immediately. Before going live, replace it with your own.

---

## 1. Understand the data model

Products live in four database tables in Supabase:

| Table | Purpose |
|---|---|
| `categories` | Product categories (e.g. Ready-to-Wear, Accessories). |
| `products` | The products themselves. |
| `product_images` | One or more images per product. |
| `product_variants` | The sizes (or measurements) of a product sold by size, each with its own stock. |

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

The demo ships with these category slugs: `ready-to-wear`, `bags-leather-goods`,
`watches-jewelry`, `accessories`, `fragrance`. Keep, rename, or replace them. To add one via SQL:

```sql
INSERT INTO public.categories (name, slug, is_active, sort_order)
VALUES ('Shoes', 'shoes', TRUE, 1);
```

> **Note —** The category `slug` is used in URLs and filters, so keep it lowercase with
> hyphens (e.g. `bags-leather-goods`).

---

## 4. Add real products

**Method A — Admin UI (easiest, no SQL).** Log in as admin and go to `/admin/catalog`.
Click **"New Product"** (top right). A modal opens with all the fields you need:

| Field | Notes |
|---|---|
| Name | Required. The slug is generated automatically. |
| Category | Required. You can create a new category on the spot. |
| Price | Required. |
| Stock Quantity | Defaults to 0. For a product sold by size you set the stock of each size instead — see section 5. |
| Sold by size | Optional switch (Inventory) — sizes or measurements, each with its own stock. |
| SKU | Optional — unique identifier. |
| Description | Optional. |
| Active / Featured | Checkboxes. "Featured" shows the product on the home page. |
| Images | Multi-file upload — goes directly to Supabase Storage. The first image you upload becomes the primary thumbnail automatically. |

> **Note —** You need to be promoted to admin first (see `HANDOVER_GUIDE.md` Step 4).
> Enable the `product-images` storage bucket in Supabase Storage before uploading images
> (Dashboard → Storage → New bucket, name it `product-images`, set to Public).

**Method B — Supabase Table Editor (no SQL).** Dashboard → Table Editor → `products` →
Insert row. Fill `name`, `slug`, `price`, `stock_quantity`, pick a `category_id`, save.

**Method C — SQL (fastest for bulk imports):**

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
> category UUIDs by hand. Use Method C when importing many products at once; for a handful,
> Method A is faster.

---

## 5. Products sold by size or measurement

Clothing, shoes, rings — or any object sold in several measurements — are **sold by size**:
the customer must pick one, and every size has its own stock.

**In the admin (recommended).** Open the product (or create it) → **Inventory** → turn on
**Sold by size**:

1. Click a **Quick start** preset — Clothing XS–XL, Clothing XXS–3XL, Numeric 38–54, Shoes EU
   35–46, Rings 5–9, Waist 26–38, S · M · L — or type your own sizes: `S, M, L` adds three at
   once, and any text up to 40 characters works (`42`, `50 cm`, `120x180`).
2. Set the **stock** of each size. The product's total stock becomes the sum of its sizes on
   sale — it is calculated for you and can't be typed.
3. Optional: a **SKU** per size (**Fill empty SKUs** builds them from the product SKU, e.g.
   `AUR-RW-104-M`), the order the sizes appear in (arrows), and **Shown to customers as**
   (Size, Measurement, Length, Shoe size, Ring size, Waist).
4. Untick **On sale** to hide a size without deleting it.

Day-to-day restocking doesn't need the editor: in **Admin → Catalog** every sized product
shows its stock per size, and **Restock sizes** opens one field per size.

> **Good to know —**
> - A size that already has orders can't be deleted: removing it switches it off instead, so
>   past orders and refunds keep working. Add the same size again to switch it back on.
> - Stock moves per size: a paid order takes from the size it bought, a cancellation or
>   refund puts it back. An oversold size goes negative and its order is flagged **Needs
>   review**.
> - If an order comes in while you are editing, saving won't overwrite it: you're told which
>   size changed, with the new figure, and asked to save again.
> - Turning **Sold by size** off switches the product back to a single stock figure.

**With SQL.** Mark the product as sized, then insert one row per size:

```sql
UPDATE public.products SET has_sizes = TRUE, size_label = 'shoe_size'
 WHERE slug = 'running-shoes-pro';

INSERT INTO public.product_variants (product_id, size, sku, stock_qty, sort_order)
SELECT p.id, s.size, 'RSP-001-' || s.size, s.qty, s.ord
  FROM public.products p,
       (VALUES ('40', 6, 1), ('41', 8, 2), ('42', 10, 3), ('43', 6, 4)) AS s(size, qty, ord)
 WHERE p.slug = 'running-shoes-pro';
```

The product's `stock_quantity` updates itself (here to 30). `size_label` is one of `size`,
`measure`, `length`, `shoe_size`, `ring_size`, `waist`.

---

## 6. Add product images

> **Note —** If you used **Method A** (Admin UI), images were already uploaded via the modal
> and stored in Supabase Storage. Skip this section. The SQL below is for Method B/C bulk imports
> where you host images on an external CDN.

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

## 7. Verify on the storefront

- Home page — featured products (`is_featured = TRUE`) appear.
- Category page — your products are listed.
- Product page — image, price, and description are correct.
- Add to cart — quantity respects `stock_quantity`.
- Product sold by size — the size buttons appear in your order, a sold-out size is crossed out,
  and the cart only accepts what that size has in stock.

> **Note —** If you changed category slugs, also review the home-page category icons in
> [`src/features/products/pages/HomePage.tsx`](../src/features/products/pages/HomePage.tsx) so
> the icons match your new slugs.
