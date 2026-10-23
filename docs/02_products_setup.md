# CommerceJet — Products Setup

**Remove the demo catalog & add your real products.**

## Contents

1. Understand the data model
2. Remove the demo (mock) products
3. Set up your categories
4. Add real products (three methods)
5. Products sold by size or measurement
6. Colours, materials and prices per variant
7. Size guides
8. Import, export and duplicate products
9. Stock day to day
10. Add product images
11. Verify on the storefront

> **Note —** The store ships pre-loaded with a demo catalog so you can see it working
> immediately. Before going live, replace it with your own.

---

## 1. Understand the data model

Products live in these database tables in Supabase:

| Table | Purpose |
|---|---|
| `categories` | Product categories (e.g. Ready-to-Wear, Accessories). |
| `products` | The products themselves. |
| `product_images` | One or more images per product (optionally tied to one colour). |
| `product_colors` | The colours (or materials, finishes…) of a product sold by colour. |
| `product_variants` | One row per size, per colour, or per colour × size — each with its own stock, and optionally its own SKU and price. |
| `size_guides` | Measurement tables shown on the product page, attached to a category or a product. |

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

Colours and variants go with their products. The demo also adds a size guide to
Ready-to-Wear: delete it in **Admin → Size guides** if you don't want it.

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
Click **"New Product"** (top right). A panel opens with all the fields you need:

| Field | Notes |
|---|---|
| Name | Required. The slug is generated automatically. |
| Category | Required. You can create a new category on the spot. |
| Price | Required. |
| Compare-at price | Optional — the original price, shown struck through with the "−20%" when it is higher than the price. |
| Cost per item | Optional and private (only admins see it) — shows the margin, and feeds the margin figure in Admin → Finance. |
| Stock Quantity | Defaults to 0. For a product sold by size or colour you set the stock of each variant instead — see sections 5 and 6. |
| Sold by size / Sold by colour | Optional switches (Inventory) — each size, colour or colour × size gets its own stock. |
| Size guide | Optional — the category's guide is used by default (section 7). |
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
> category UUIDs by hand. For many products at once, a spreadsheet is easier still — see
> section 8 (CSV import).

---

## 5. Products sold by size or measurement

Clothing, shoes, rings — or any object sold in several measurements — are **sold by size**:
the customer must pick one, and every size has its own stock.

**In the admin (recommended).** Open the product (or create it) → **Inventory** → turn on
**Sold by size**:

1. Click a **Quick start** preset — Clothing XS–XL, Clothing XXS–3XL, Numeric 38–54, Shoes EU
   35–46, Rings 5–9, Waist 26–38, S · M · L — or type your own sizes: `S, M, L` adds three at
   once, and any text up to 40 characters works (`42`, `50 cm`, `120x180`).
2. Set the **stock** of each size in the **Stock by variant** table. The product's total
   stock becomes the sum of its sizes on sale — it is calculated for you and can't be typed.
3. Optional: a **SKU** per size (**Fill empty SKUs** builds them from the product SKU, e.g.
   `AUR-RW-104-M`), the order the sizes appear in (arrows), and **Shown to customers as**
   (Size, Measurement, Length, Shoe size, Ring size, Waist).
4. Untick **On sale** to hide a size without deleting it.

Day-to-day restocking doesn't need the editor: in **Admin → Catalog** every product with
variants shows its stock per size (grouped by colour), and **Restock** opens one field per
variant — see section 9.

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

## 6. Colours, materials and prices per variant

A product **sold by colour** shows round swatches (or the colour's name) on its page; the
customer picks one, and each colour has its own stock. With **Sold by size** on as well, stock
is kept per colour × size — a red M and a blue M are counted separately.

**In the admin.** Open the product → **Inventory** → turn on **Sold by colour**:

1. **Shown to customers as** — Colour, Material, Finish, Pattern, Style, Scent or Variant
   (a candle sold by scent, a table by wood, a print by finish).
2. Add colours: click one of the **Common colours**, or type a name and pick its swatch. A
   colour can also be shown **by name only** (no swatch) — useful for materials such as
   "Oak" or "Linen".
3. With sizes too, the **Stock by variant** table lists every colour with its sizes. Untick
   **On sale** for a combination you don't make; **All sizes on sale** switches a whole colour.
4. **Price and cost per variant** (tick box above the table) gives each row its own price and
   private cost. An empty price uses the product price. The storefront then shows
   "From $79.00" on the product card and page until a variant is chosen.
5. **Photos per colour** — in **Media**, each photo has a colour menu (*All colours* by
   default). Choosing a colour on the product page shows that colour's photos plus the
   untagged ones. Before uploading, **New photos are for** tags a batch in one go.

> **Good to know —**
> - Like sizes, a colour or combination that has orders is switched off instead of deleted.
> - Renaming a colour keeps its stock, photos and history.
> - Changing how a product is sold (adding colours to a sized product, or the reverse) keeps
>   the old variants that have orders, switched off, so those orders stay intact.
> - Orders, emails, invoices and exports show the colour and size bought, and the SKU.

**With SQL.** Colours first, then one variant per colour (or per colour × size):

```sql
UPDATE public.products SET has_colors = TRUE, color_label = 'color'
 WHERE slug = 'canvas-tote';

INSERT INTO public.product_colors (product_id, name, swatch, sort_order)
SELECT id, c.name, c.swatch, c.ord
  FROM public.products,
       (VALUES ('Natural', '#E8DFC9', 0), ('Black', '#161412', 1)) AS c(name, swatch, ord)
 WHERE slug = 'canvas-tote';

INSERT INTO public.product_variants (product_id, color_id, sku, stock_qty, price, sort_order)
SELECT c.product_id, c.id, 'TOTE-' || upper(c.name), 25, NULL, c.sort_order
  FROM public.product_colors c
  JOIN public.products p ON p.id = c.product_id
 WHERE p.slug = 'canvas-tote';
```

`color_label` is one of `color`, `material`, `finish`, `pattern`, `style`, `scent`,
`variant`. The admin editor (or the CSV import) is the safer way to change variants later: it
checks every rule in one step.

---

## 7. Size guides

A size guide is a measurement table the customer opens from the product page (**Size guide**,
next to the sizes).

1. **Admin → Size guides → New guide.** Start from a template (Tops and dresses, Shoes,
   Trousers, Rings) or from scratch; edit headings and values freely (up to 12 columns and 60
   rows) and add notes such as how to measure. The preview shows it as customers will.
2. **Categories** — tick the categories that use it: every product in them shows the guide.
3. To override it for one product, pick another guide (or **None**) in that product's
   **Size guide** field.

---

## 8. Import, export and duplicate products

**Export.** Admin → Catalog → **Export CSV** downloads the whole catalogue, one row per
variant, ready for Excel, Numbers or Google Sheets. It uses commas, or semicolons with decimal
commas when the admin is in Italian, Spanish or French — the import reads either.

**Import.** Admin → Catalog → **Import CSV** → choose the file. It is checked line by line
before anything is saved, and then saved all at once — or not at all, if any row fails.

| Column | Meaning |
|---|---|
| `handle` | Required. The product's URL name (lowercase letters, digits, dashes). An existing handle updates that product; a new one creates it. |
| `name`, `description`, `category` | `category` is a category slug or name; tick **Create categories that do not exist yet** to add new ones. |
| `price`, `compare_at_price`, `cost_price` | Amounts. A new product needs a name, a category and a price. |
| `product_sku`, `active`, `featured`, `weight_grams`, `low_stock_threshold` | `active` / `featured` take yes / no. |
| `size_label`, `color_label` | As in sections 5 and 6 (`size`, `shoe_size`…, `color`, `material`…). |
| `color`, `color_swatch`, `size` | The variant of this row. |
| `variant_sku`, `variant_price`, `variant_cost`, `variant_active` | Per variant. |
| `stock` | The stock of the variant (or of the product, without variants). |
| `images` | `https://` addresses separated by ` \| `; new ones are added to the product. |

Rules worth knowing:

- A column you leave out of the file leaves that field unchanged; an empty cell clears an
  optional field.
- One row per variant; the product's own fields are read from its first row.
- **With a `size` or `color` column**, a product's rows are its complete list of variants:
  variants not in the file are removed (or switched off, if they have orders). **Without
  those columns**, variants stay exactly as they are — handy for a price-only update.
- A negative stock figure (backorder, as the export writes it) leaves the stock unchanged.
- **Download the template** in the import panel for a filled-in example.

**Duplicate.** The copy icon on a catalogue row creates "Name (copy)" with the same details,
colours, sizes, prices and photos — hidden, without SKUs and with zero stock, so nothing is
sold by mistake. Edit it, then switch it to Active.

---

## 9. Stock day to day

- **Admin → Catalog** — each product shows its stock (per variant, with colour and size);
  **Restock** opens one field per variant, with an optional note (e.g. "supplier delivery").
- **Admin → Inventory**
  - **Running low** — everything on sale at or below its low-stock threshold, with how many
    customers are waiting for it.
  - **Movements** — every stock change with its reason (sale, cancellation, refund, return,
    exchange, manual change, import), who made it and when; filter by product, reason and
    dates, and export to CSV. The product editor shows the same history for one product.
  - **Restock requests** — customers who asked to be emailed when a sold-out item is back.
    They are emailed automatically within 10 minutes of the restock.
  - **Alerts** — the hourly low-stock email to the admins (on/off and recipients) and the
    customer "email me when it is back" option.
- **Admin → Dashboard** shows out-of-stock, running-low and waiting counts at a glance.

> **Note —** The two emails need a one-time setup in Supabase (`docs/03_supabase_setup.md`,
> step 6). Each item is reported once when it drops to its threshold, and again only after it
> has been restocked.

---

## 10. Add product images

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
`is_primary = TRUE`. To tie a photo to one colour, set its `color_id` to that colour's id in
`product_colors` (or use the colour menu under each photo in the admin).

---

## 11. Verify on the storefront

- Home page — featured products (`is_featured = TRUE`) appear.
- Category page — your products are listed.
- Product page — image, price, and description are correct.
- Add to cart — quantity respects `stock_quantity`.
- Product sold by size — the size buttons appear in your order, a sold-out size is crossed out,
  and the cart only accepts what that size has in stock.
- Product sold by colour — the swatches appear, choosing one changes the photos (if tagged) and
  the sizes on offer; a sold-out choice offers "Notify me" instead of "Add to cart".
- Size guide — the **Size guide** link opens the table for products in its categories.

> **Note —** If you changed category slugs, also review the home-page category icons in
> [`src/features/products/pages/HomePage.tsx`](../src/features/products/pages/HomePage.tsx) so
> the icons match your new slugs.
