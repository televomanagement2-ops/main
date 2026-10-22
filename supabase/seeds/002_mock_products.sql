-- ============================================================
-- AURUM demo catalogue: 40 products across 5 categories.
-- Run in the Supabase SQL editor AFTER schema.sql, rls.sql and the migrations.
-- Safe to re-run: every write is an upsert keyed on the fixed ids below.
--
-- The six featured products are the homepage (newest first: the first one is
-- the hero). Their images are cut from the AURUM mock sheet; the rest are
-- Unsplash photographs (free for commercial use under the Unsplash License,
-- brand marks cropped out), cropped to 4:5.
--
-- All images are served from the AURUM demo project's public bucket
-- (product-images/catalog/). Replace the demo catalogue with your own products
-- (and images uploaded to YOUR bucket) before going live.
--
-- Stock: 70 units per product; sized products split them across XS-XL.
-- ============================================================

BEGIN;

-- ============================================================
-- CATEGORIES — fixed ids, so this renames the stock categories from schema.sql
-- ============================================================
INSERT INTO public.categories (id, name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Ready-to-Wear', 'ready-to-wear', 'Tailoring, knitwear and silk, cut to last.', NULL, 1, TRUE),
  ('a1000000-0000-0000-0000-000000000001', 'Bags & Leather Goods', 'bags-leather-goods', 'Totes, crossbody bags and small leather goods.', NULL, 2, TRUE),
  ('a1000000-0000-0000-0000-000000000003', 'Watches & Jewelry', 'watches-jewelry', 'Timepieces and gold, made to be worn every day.', NULL, 3, TRUE),
  ('3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9', 'Accessories', 'accessories', 'Eyewear, silk, leather and the finishing touches.', NULL, 4, TRUE),
  ('a1000000-0000-0000-0000-000000000004', 'Fragrance', 'fragrance', 'Eaux de parfum, candles and scents for the home.', NULL, 5, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  slug        = EXCLUDED.slug,
  description = EXCLUDED.description,
  parent_id   = EXCLUDED.parent_id,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active,
  updated_at  = now();

-- ============================================================
-- RETIRE EARLIER DEMO PRODUCTS (FK-safe: soft only)
-- The upsert below re-activates exactly the current catalogue.
-- ============================================================
UPDATE public.products
SET is_active = FALSE, is_featured = FALSE, updated_at = now()
WHERE id::text LIKE 'c1000000-%'
   OR id::text LIKE 'd2000000-%'
   OR id::text LIKE 'b1000000-%';

-- Rows from a partial earlier run can hold one of our slugs or SKUs under a
-- different id. Free those values instead of deleting the rows, which may be
-- referenced by orders.
UPDATE public.products
SET slug = slug || '-retired-' || left(id::text, 8),
    sku = NULL,
    is_active = FALSE,
    is_featured = FALSE,
    updated_at = now()
WHERE (slug IN ('meridian-automatic-watch', 'siena-leather-tote', 'ambre-nuit-eau-de-parfum', 'riviera-round-sunglasses', 'compass-medallion-necklace', 'noir-wireless-headphones', 'nappa-leather-jacket', 'firenze-top-handle-bag', 'emerald-cut-solitaire-ring', 'cashmere-crewneck-sweater', 'silk-twill-scarf', 'vetiver-eau-de-parfum', 'wide-leg-wool-trousers', 'brera-leather-clutch', 'soleil-gold-hoops', 'garment-dyed-linen-shirt', 'gold-navigator-sunglasses', 'figue-noire-scented-candle', 'tailored-linen-blazer', 'lucca-leather-weekender', 'baroque-pearl-studs', 'chunky-cashmere-rollneck', 'wool-felt-fedora', 'santal-reed-diffuser', 'silk-camisole', 'portofino-crossbody-bag', 'fine-chain-bracelet-set', 'ribbed-cashmere-cardigan', 'braided-leather-belt', 'neroli-eau-de-toilette', 'drawstring-linen-trousers', 'milano-leather-messenger', 'gold-oval-cufflinks', 'silk-blend-camp-shirt', 'cashmere-travel-wrap', 'paisley-silk-tie', 'supima-cotton-t-shirt', 'heritage-leather-bifold', 'twin-gold-stacking-rings', 'floral-silk-tie')
    OR sku IN ('AUR-WJ-101', 'AUR-BG-101', 'AUR-FR-101', 'AUR-AC-101', 'AUR-WJ-102', 'AUR-AC-102', 'AUR-RW-104', 'AUR-BG-107', 'AUR-WJ-104', 'AUR-RW-103', 'AUR-AC-104', 'AUR-FR-103', 'AUR-RW-102', 'AUR-BG-103', 'AUR-WJ-103', 'AUR-RW-101', 'AUR-AC-107', 'AUR-FR-102', 'AUR-RW-111', 'AUR-BG-104', 'AUR-WJ-106', 'AUR-RW-106', 'AUR-AC-106', 'AUR-FR-104', 'AUR-RW-105', 'AUR-BG-102', 'AUR-WJ-105', 'AUR-RW-107', 'AUR-AC-105', 'AUR-FR-105', 'AUR-RW-108', 'AUR-BG-105', 'AUR-WJ-107', 'AUR-RW-109', 'AUR-AC-103', 'AUR-AC-108', 'AUR-RW-110', 'AUR-BG-106', 'AUR-WJ-108', 'AUR-AC-109'))
  AND id NOT IN (
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000024'::uuid,
  'd2000000-0000-0000-0000-000000000028'::uuid,
  'd2000000-0000-0000-0000-000000000031'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000014'::uuid,
  'd2000000-0000-0000-0000-000000000007'::uuid,
  'd2000000-0000-0000-0000-000000000009'::uuid,
  'd2000000-0000-0000-0000-000000000013'::uuid,
  'd2000000-0000-0000-0000-000000000032'::uuid,
  'd2000000-0000-0000-0000-000000000038'::uuid,
  'd2000000-0000-0000-0000-000000000012'::uuid,
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000008'::uuid,
  'd2000000-0000-0000-0000-000000000011'::uuid,
  'd2000000-0000-0000-0000-000000000035'::uuid,
  'd2000000-0000-0000-0000-000000000025'::uuid,
  'cbe3c632-6975-43f1-b394-31e5109700e8'::uuid,
  'd2000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000023'::uuid,
  'd2000000-0000-0000-0000-000000000016'::uuid,
  'd2000000-0000-0000-0000-000000000034'::uuid,
  'b1000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000015'::uuid,
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'd2000000-0000-0000-0000-000000000022'::uuid,
  'd2000000-0000-0000-0000-000000000017'::uuid,
  'd2000000-0000-0000-0000-000000000033'::uuid,
  'b1000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000018'::uuid,
  'd2000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000026'::uuid,
  'd2000000-0000-0000-0000-000000000019'::uuid,
  'd2000000-0000-0000-0000-000000000027'::uuid,
  'd2000000-0000-0000-0000-000000000036'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000006'::uuid,
  'd2000000-0000-0000-0000-000000000029'::uuid,
  'd2000000-0000-0000-0000-000000000037'::uuid
  );

-- ============================================================
-- PRODUCTS
-- Ready-to-Wear 11 · Bags & Leather Goods 7 · Watches & Jewelry 8 · Accessories 9 · Fragrance 5
-- created_at is staggered one hour apart so "newest first" is a stable order.
-- ============================================================
INSERT INTO public.products
  (id, category_id, name, slug, description, price, compare_at_price, sku, stock_quantity, weight_grams, is_featured, is_active, created_at)
VALUES
  (
    'd2000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000003',
    'Meridian Automatic Watch',
    'meridian-automatic-watch',
    'A 40 mm brushed-steel case with a polished bezel frames a deep black sunray dial and applied baton indices. Inside, a self-winding movement with a 42-hour power reserve; outside, a five-link bracelet with a butterfly clasp. Water resistant to 100 metres.',
    1850.00, NULL, 'AUR-WJ-101', 70, 165, TRUE, TRUE, '2026-10-20T09:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000024',
    'a1000000-0000-0000-0000-000000000001',
    'Siena Leather Tote',
    'siena-leather-tote',
    'Structured in full-grain vegetable-tanned leather in a warm cognac, with rolled top handles and a long shoulder strap. The interior is left unlined to show the leather''s natural reverse, with a zipped pocket for the essentials. It deepens to a rich patina with every season of use.',
    890.00, NULL, 'AUR-BG-101', 70, 980, TRUE, TRUE, '2026-10-20T08:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000028',
    'a1000000-0000-0000-0000-000000000004',
    'Ambre Nuit Eau de Parfum',
    'ambre-nuit-eau-de-parfum',
    'Warm amber and labdanum open onto a heart of iris and smoked vanilla, settling into sandalwood and soft musk. A slow, close evening scent with lasting depth. 100 ml in a weighted glass flacon with a lacquered black cap.',
    185.00, NULL, 'AUR-FR-101', 70, 420, TRUE, TRUE, '2026-10-20T07:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000031',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Riviera Round Sunglasses',
    'riviera-round-sunglasses',
    'A softly rounded frame cut from polished black acetate, with a keyhole bridge and riveted temples. Grey mineral-glass lenses give full UV400 protection. Supplied with a leather case and a cleaning cloth.',
    340.00, NULL, 'AUR-AC-101', 70, 32, TRUE, TRUE, '2026-10-20T06:00:00.000Z'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000003',
    'Compass Medallion Necklace',
    'compass-medallion-necklace',
    'A domed medallion engraved with a compass rose, cast in 18k gold vermeil over sterling silver and hung on a fine 50 cm cable chain. A lobster clasp with an extender also allows a 45 cm wear. Each piece is hand-finished and hallmarked.',
    420.00, NULL, 'AUR-WJ-102', 70, 9, TRUE, TRUE, '2026-10-20T05:00:00.000Z'
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Noir Wireless Headphones',
    'noir-wireless-headphones',
    'Over-ear headphones in matte black aluminium with memory-foam cushions wrapped in soft protein leather. Adaptive noise cancelling and a 40-hour battery, with a folding design and a structured travel case. Bluetooth 5.3 with multipoint pairing.',
    549.00, NULL, 'AUR-AC-102', 70, 290, TRUE, TRUE, '2026-10-20T04:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000014',
    'a1000000-0000-0000-0000-000000000002',
    'Nappa Leather Jacket',
    'nappa-leather-jacket',
    'Cut from supple lamb nappa in a deep tan, with a clean collar, concealed snap front and welt pockets. Fully lined in cupro, so it layers easily over knitwear. The leather softens and shapes to the wearer over time.',
    1450.00, NULL, 'AUR-RW-104', 70, 1450, FALSE, TRUE, '2026-10-20T03:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000007',
    'a1000000-0000-0000-0000-000000000001',
    'Firenze Top-Handle Bag',
    'firenze-top-handle-bag',
    'A structured top-handle bag in polished calf leather with tonal stitching, double front straps and gunmetal hardware. Two interior compartments and a detachable shoulder strap. Made by hand by leather artisans in Tuscany.',
    980.00, NULL, 'AUR-BG-107', 70, 1100, FALSE, TRUE, '2026-10-20T02:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000009',
    'a1000000-0000-0000-0000-000000000003',
    'Emerald-Cut Solitaire Ring',
    'emerald-cut-solitaire-ring',
    'An emerald-cut white sapphire held in a four-claw setting on a slender 18k yellow-gold band, pave-set along the shoulders. A quiet, architectural cut that catches the light without excess. Ring sizes 5 to 8.',
    2400.00, NULL, 'AUR-WJ-104', 70, 4, FALSE, TRUE, '2026-10-20T01:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000013',
    'a1000000-0000-0000-0000-000000000002',
    'Cashmere Crewneck Sweater',
    'cashmere-crewneck-sweater',
    'Knitted from two-ply Mongolian cashmere in a relaxed, slightly cropped crewneck. Ribbed cuffs and hem hold their shape wash after wash. Light enough to layer, warm enough to wear alone.',
    480.00, NULL, 'AUR-RW-103', 70, 320, FALSE, TRUE, '2026-10-20T00:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000032',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Silk Twill Scarf',
    'silk-twill-scarf',
    'A 90 x 90 cm square of heavy silk twill in undyed ivory, with hand-rolled edges. Knot it at the neck, fold it as a headscarf or tie it to a bag handle. Woven and finished in Como, Italy.',
    260.00, NULL, 'AUR-AC-104', 70, 70, FALSE, TRUE, '2026-10-19T23:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000038',
    'a1000000-0000-0000-0000-000000000004',
    'Vetiver Eau de Parfum',
    'vetiver-eau-de-parfum',
    'Haitian vetiver and grapefruit zest over a dry base of cedar and incense. A clean, green-woody signature that sits close to the skin. 100 ml in clear glass with a black cap.',
    175.00, NULL, 'AUR-FR-103', 70, 400, FALSE, TRUE, '2026-10-19T22:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000012',
    'a1000000-0000-0000-0000-000000000002',
    'Wide-Leg Wool Trousers',
    'wide-leg-wool-trousers',
    'High-rise trousers in fluid wool crepe with a long, wide leg and a pressed front crease. Side-seam pockets and a hook-and-bar closure keep the line clean. Lined to the knee.',
    420.00, NULL, 'AUR-RW-102', 70, 450, FALSE, TRUE, '2026-10-19T21:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000001',
    'Brera Leather Clutch',
    'brera-leather-clutch',
    'A slim zip clutch in grained calf leather with a stitched wrist strap and a single snap tab. Holds a phone, cards and keys. Carry it alone or slip it inside a larger bag.',
    460.00, NULL, 'AUR-BG-103', 70, 260, FALSE, TRUE, '2026-10-19T20:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000008',
    'a1000000-0000-0000-0000-000000000003',
    'Soleil Gold Hoops',
    'soleil-gold-hoops',
    'Chunky tube hoops in 18k gold vermeil with a high-polish finish and a hinged click closure. 25 mm across: substantial without the weight. Hypoallergenic and nickel free.',
    290.00, NULL, 'AUR-WJ-103', 70, 8, FALSE, TRUE, '2026-10-19T19:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000011',
    'a1000000-0000-0000-0000-000000000002',
    'Garment-Dyed Linen Shirt',
    'garment-dyed-linen-shirt',
    'Heavy European linen, dyed after sewing for a softly broken-in midnight navy. A relaxed fit with a point collar, box-pleated back and corozo buttons. Wears just as well open over a T-shirt.',
    295.00, NULL, 'AUR-RW-101', 70, 280, FALSE, TRUE, '2026-10-19T18:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000035',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Gold Navigator Sunglasses',
    'gold-navigator-sunglasses',
    'A semi-rimless navigator with a fine gold-tone frame, double bridge and black acetate temple tips. Gradient brown lenses with full UV400 protection. Supplied with a leather case.',
    360.00, NULL, 'AUR-AC-107', 70, 28, FALSE, TRUE, '2026-10-19T17:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000025',
    'a1000000-0000-0000-0000-000000000004',
    'Figue Noire Scented Candle',
    'figue-noire-scented-candle',
    'Black fig, green leaves and a whisper of cedar, poured into an amber glass vessel. A cotton wick gives a clean, even burn of around 60 hours. Keep the glass once the wax is gone.',
    95.00, NULL, 'AUR-FR-102', 70, 520, FALSE, TRUE, '2026-10-19T16:00:00.000Z'
  ),
  (
    'cbe3c632-6975-43f1-b394-31e5109700e8',
    'a1000000-0000-0000-0000-000000000002',
    'Tailored Linen Blazer',
    'tailored-linen-blazer',
    'An unstructured single-breasted blazer in ivory linen, with soft shoulders, notch lapels and patch pockets. Half-lined to stay light in warm weather. Wear it with its trousers or with denim.',
    690.00, NULL, 'AUR-RW-111', 70, 540, FALSE, TRUE, '2026-10-19T15:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000001',
    'Lucca Leather Weekender',
    'lucca-leather-weekender',
    'A soft black leather holdall sized for two or three nights away, with a wide zip opening and rolled carry handles. A detachable shoulder strap and an interior pocket for documents. Fits most overhead cabins.',
    1150.00, NULL, 'AUR-BG-104', 70, 1650, FALSE, TRUE, '2026-10-19T14:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000023',
    'a1000000-0000-0000-0000-000000000003',
    'Baroque Pearl Studs',
    'baroque-pearl-studs',
    'Freshwater baroque pearls, each with its own lustre and shape, set on 18k gold vermeil posts with a small polished dome. A modern take on the classic stud. Sold as a pair.',
    260.00, NULL, 'AUR-WJ-106', 70, 4, FALSE, TRUE, '2026-10-19T13:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000016',
    'a1000000-0000-0000-0000-000000000002',
    'Chunky Cashmere Rollneck',
    'chunky-cashmere-rollneck',
    'A generous rollneck in thick ribbed cashmere, knitted to a relaxed, slightly oversized fit. Dropped shoulders and long cuffs that turn back. Undyed winter-white yarn.',
    520.00, NULL, 'AUR-RW-106', 70, 560, FALSE, TRUE, '2026-10-19T12:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000034',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Wool Felt Fedora',
    'wool-felt-fedora',
    'A camel fedora blocked by hand from wool felt, with a pinched crown, a 6 cm brim and a striped grosgrain band. Water-repellent finish and a leather inner sweatband. Arrives in its own hat box.',
    340.00, NULL, 'AUR-AC-106', 70, 120, FALSE, TRUE, '2026-10-19T11:00:00.000Z'
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000004',
    'Santal Reed Diffuser',
    'santal-reed-diffuser',
    'Creamy sandalwood, cardamom and a trace of leather, diffused through natural rattan reeds from a smoked-glass bottle. Scents a room for around three months. Turn the reeds weekly for a stronger throw.',
    120.00, NULL, 'AUR-FR-104', 70, 480, FALSE, TRUE, '2026-10-19T10:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000015',
    'a1000000-0000-0000-0000-000000000002',
    'Silk Camisole',
    'silk-camisole',
    'A bias-cut camisole in black sandwashed silk with a straight neckline and a fluid, skimming fit. A concealed back zip keeps the front clean. Layer it under tailoring or wear it alone.',
    320.00, NULL, 'AUR-RW-105', 70, 90, FALSE, TRUE, '2026-10-19T09:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Portofino Crossbody Bag',
    'portofino-crossbody-bag',
    'A compact crossbody in burnished cognac leather with two zipped compartments and a flap front pocket. The adjustable strap also lets it sit at the waist. Antiqued gunmetal hardware throughout.',
    640.00, NULL, 'AUR-BG-102', 70, 640, FALSE, TRUE, '2026-10-19T08:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000022',
    'a1000000-0000-0000-0000-000000000003',
    'Fine Chain Bracelet Set',
    'fine-chain-bracelet-set',
    'Three delicate chain bracelets in 18k gold vermeil: a cable chain, a satellite chain and a star-charm chain. Wear them stacked or apart. Adjustable from 16 to 19 cm.',
    340.00, NULL, 'AUR-WJ-105', 70, 6, FALSE, TRUE, '2026-10-19T07:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000017',
    'a1000000-0000-0000-0000-000000000002',
    'Ribbed Cashmere Cardigan',
    'ribbed-cashmere-cardigan',
    'A deep V-neck cardigan in fisherman-rib cashmere and wool, in soft camel. Horn-effect buttons, a ribbed placket and a relaxed fit that layers over shirting. Knitted in Scotland.',
    540.00, NULL, 'AUR-RW-107', 70, 480, FALSE, TRUE, '2026-10-19T06:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000033',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Braided Leather Belt',
    'braided-leather-belt',
    'Hand-braided strips of chestnut calf leather on a 3.5 cm strap, finished with a brushed nickel buckle. The braid lets you fasten it at any length. Leather-lined keeper.',
    240.00, NULL, 'AUR-AC-105', 70, 180, FALSE, TRUE, '2026-10-19T05:00:00.000Z'
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000004',
    'Neroli Eau de Toilette',
    'neroli-eau-de-toilette',
    'Bright neroli and bitter orange over orange blossom and white musk: a fresh, sunlit cologne for every day. 100 ml in a square amber flacon. Made to be reapplied generously.',
    140.00, NULL, 'AUR-FR-105', 70, 400, FALSE, TRUE, '2026-10-19T04:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000018',
    'a1000000-0000-0000-0000-000000000002',
    'Drawstring Linen Trousers',
    'drawstring-linen-trousers',
    'Relaxed, tapered trousers in washed olive linen with a drawstring waist and side pockets. Cropped just above the ankle. The fabric softens further with every wash.',
    280.00, NULL, 'AUR-RW-108', 70, 320, FALSE, TRUE, '2026-10-19T03:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'Milano Leather Messenger',
    'milano-leather-messenger',
    'A dark brown leather messenger with a full flap, twin buckle straps and a padded sleeve for a 14-inch laptop. A top carry handle and an adjustable shoulder strap. Built around a reinforced base.',
    1090.00, NULL, 'AUR-BG-105', 70, 1450, FALSE, TRUE, '2026-10-19T02:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000026',
    'a1000000-0000-0000-0000-000000000003',
    'Gold Oval Cufflinks',
    'gold-oval-cufflinks',
    'Polished oval cufflinks in 18k gold vermeil with a swivel T-bar fastening. Plain faces, ready for engraving. Presented in a leather box.',
    290.00, NULL, 'AUR-WJ-107', 70, 14, FALSE, TRUE, '2026-10-19T01:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000019',
    'a1000000-0000-0000-0000-000000000002',
    'Silk-Blend Camp Shirt',
    'silk-blend-camp-shirt',
    'A short-sleeved camp shirt in a silk and linen blend, in off-white. A relaxed, boxy fit with a straight hem made to be worn untucked. Mother-of-pearl buttons.',
    320.00, NULL, 'AUR-RW-109', 70, 210, FALSE, TRUE, '2026-10-19T00:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000027',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Cashmere Travel Wrap',
    'cashmere-travel-wrap',
    'An oversized wrap in brushed cashmere, 200 x 70 cm, finished with a woven edge. Light enough to fold into a bag, warm enough for a long-haul flight. Ivory with a charcoal companion.',
    590.00, NULL, 'AUR-AC-103', 70, 300, FALSE, TRUE, '2026-10-18T23:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000036',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Paisley Silk Tie',
    'paisley-silk-tie',
    'A hand-rolled tie in navy silk twill printed with a classic paisley in blue and caramel. Untipped for a lighter knot. 8 cm blade.',
    190.00, NULL, 'AUR-AC-108', 70, 60, FALSE, TRUE, '2026-10-18T22:00:00.000Z'
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000002',
    'Supima Cotton T-Shirt',
    'supima-cotton-t-shirt',
    'A heavyweight crewneck T-shirt in long-staple Supima cotton jersey, garment-washed for softness. A neckline that keeps its shape and a straight, slightly boxy body. White.',
    95.00, NULL, 'AUR-RW-110', 70, 220, FALSE, TRUE, '2026-10-18T21:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000006',
    'a1000000-0000-0000-0000-000000000001',
    'Heritage Leather Bifold',
    'heritage-leather-bifold',
    'A slim bifold in pull-up leather that burnishes to a rich patina as it is used. Six card slots, two hidden pockets and a full-length note compartment. Hand-stitched edges.',
    260.00, NULL, 'AUR-BG-106', 70, 70, FALSE, TRUE, '2026-10-18T20:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000029',
    'a1000000-0000-0000-0000-000000000003',
    'Twin Gold Stacking Rings',
    'twin-gold-stacking-rings',
    'A pair of 4 mm comfort-fit bands in polished 18k gold vermeil, made to be worn together or apart. Classic, weighty and quietly bright. Sold as a set of two.',
    520.00, NULL, 'AUR-WJ-108', 70, 7, FALSE, TRUE, '2026-10-18T19:00:00.000Z'
  ),
  (
    'd2000000-0000-0000-0000-000000000037',
    '3ab2b8e7-ca84-425f-8d7b-2fa0c818d5c9',
    'Floral Silk Tie',
    'floral-silk-tie',
    'A forest-green silk tie printed with a small white and cornflower floral, hand-rolled and untipped. 8 cm blade, made in Como.',
    190.00, NULL, 'AUR-AC-109', 70, 60, FALSE, TRUE, '2026-10-18T18:00:00.000Z'
  )
ON CONFLICT (id) DO UPDATE SET
  category_id      = EXCLUDED.category_id,
  name             = EXCLUDED.name,
  slug             = EXCLUDED.slug,
  description      = EXCLUDED.description,
  price            = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  sku              = EXCLUDED.sku,
  stock_quantity   = EXCLUDED.stock_quantity,
  weight_grams     = EXCLUDED.weight_grams,
  is_featured      = EXCLUDED.is_featured,
  is_active        = EXCLUDED.is_active,
  created_at       = EXCLUDED.created_at,
  updated_at       = now();

-- ============================================================
-- PRODUCT IMAGES — replaced wholesale for the catalogue
-- (no unique key on non-primary rows, so a naive re-insert would stack)
-- ============================================================
DELETE FROM public.product_images
WHERE product_id IN (
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000024'::uuid,
  'd2000000-0000-0000-0000-000000000028'::uuid,
  'd2000000-0000-0000-0000-000000000031'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000014'::uuid,
  'd2000000-0000-0000-0000-000000000007'::uuid,
  'd2000000-0000-0000-0000-000000000009'::uuid,
  'd2000000-0000-0000-0000-000000000013'::uuid,
  'd2000000-0000-0000-0000-000000000032'::uuid,
  'd2000000-0000-0000-0000-000000000038'::uuid,
  'd2000000-0000-0000-0000-000000000012'::uuid,
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000008'::uuid,
  'd2000000-0000-0000-0000-000000000011'::uuid,
  'd2000000-0000-0000-0000-000000000035'::uuid,
  'd2000000-0000-0000-0000-000000000025'::uuid,
  'cbe3c632-6975-43f1-b394-31e5109700e8'::uuid,
  'd2000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000023'::uuid,
  'd2000000-0000-0000-0000-000000000016'::uuid,
  'd2000000-0000-0000-0000-000000000034'::uuid,
  'b1000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000015'::uuid,
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'd2000000-0000-0000-0000-000000000022'::uuid,
  'd2000000-0000-0000-0000-000000000017'::uuid,
  'd2000000-0000-0000-0000-000000000033'::uuid,
  'b1000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000018'::uuid,
  'd2000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000026'::uuid,
  'd2000000-0000-0000-0000-000000000019'::uuid,
  'd2000000-0000-0000-0000-000000000027'::uuid,
  'd2000000-0000-0000-0000-000000000036'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000006'::uuid,
  'd2000000-0000-0000-0000-000000000029'::uuid,
  'd2000000-0000-0000-0000-000000000037'::uuid
);

INSERT INTO public.product_images (product_id, url, alt_text, sort_order, is_primary) VALUES
  ('d2000000-0000-0000-0000-000000000002', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/aurum-watch-hero-0058d1f1.jpg', 'Meridian automatic watch in brushed steel with a black dial', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000024', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/aurum-tote-d63f4261.jpg', 'Siena tote in cognac full-grain leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000028', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/aurum-perfume-f2ac5a80.jpg', 'Ambre Nuit eau de parfum in a glass flacon with a black cap', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000031', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/aurum-sunglasses-163b6265.jpg', 'Riviera round sunglasses in black acetate', 0, TRUE),
  ('b1000000-0000-0000-0000-000000000001', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/aurum-necklace-6e14e998.jpg', 'Compass medallion necklace in 18k gold vermeil', 0, TRUE),
  ('b1000000-0000-0000-0000-000000000002', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/aurum-headphones-1817094d.jpg', 'Noir over-ear wireless headphones in matte black', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000014', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/nappa-leather-jacket-1-f727ace3.jpg', 'Nappa leather jacket in tan hanging on a wall peg', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000007', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/firenze-top-handle-bag-1-5bd2372b.jpg', 'Firenze top-handle bag in polished cognac calf leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000007', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/firenze-top-handle-bag-2-0a4192a8.jpg', 'Firenze top-handle bag in polished cognac calf leather, view 2', 1, FALSE),
  ('d2000000-0000-0000-0000-000000000009', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/emerald-cut-solitaire-ring-1-5f2683e7.jpg', 'Emerald-cut solitaire ring on a pave yellow-gold band', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/cashmere-crewneck-sweater-1-d36018a3.jpg', 'Folded cashmere crewneck sweaters in warm neutral tones', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000032', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/silk-twill-scarf-1-d3ed2ec9.jpg', 'Ivory silk twill scarf draped in soft folds', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000038', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/vetiver-eau-de-parfum-1-81056466.jpg', 'Vetiver eau de parfum in a clear glass bottle with a black cap', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/wide-leg-wool-trousers-1-44ccb9e7.jpg', 'Wide-leg trousers in sand wool crepe', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000003', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/brera-leather-clutch-1-ddb89e42.jpg', 'Brera zip clutch in dark brown grained leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000003', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/brera-leather-clutch-2-9931b244.jpg', 'Brera zip clutch in dark brown grained leather, view 2', 1, FALSE),
  ('d2000000-0000-0000-0000-000000000008', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/soleil-gold-hoops-1-fc704e40.jpg', 'Soleil chunky gold hoop earrings', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/garment-dyed-linen-shirt-1-3f168816.jpg', 'Garment-dyed linen shirt in midnight navy', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000035', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/gold-navigator-sunglasses-1-126e7e7e.jpg', 'Gold navigator sunglasses with gradient brown lenses', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000025', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/figue-noire-scented-candle-1-98b2dd56.jpg', 'Figue Noire scented candle burning in an amber glass vessel', 0, TRUE),
  ('cbe3c632-6975-43f1-b394-31e5109700e8', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/tailored-linen-blazer-1-2db9f407.jpg', 'Tailored linen blazer in ivory on a hanger', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000004', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/lucca-leather-weekender-1-c12c02f6.jpg', 'Lucca weekender in soft black leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000023', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/baroque-pearl-studs-1-a3e325f8.jpg', 'Baroque pearl stud earrings on gold vermeil posts', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/chunky-cashmere-rollneck-1-c805cf2a.jpg', 'Chunky winter-white cashmere rollneck on a hanger', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000034', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/wool-felt-fedora-1-e4a41264.jpg', 'Camel wool felt fedora with a striped band', 0, TRUE),
  ('b1000000-0000-0000-0000-000000000004', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/santal-reed-diffuser-1-886b319a.jpg', 'Santal reed diffuser with rattan reeds in a smoked glass bottle', 0, TRUE),
  ('b1000000-0000-0000-0000-000000000004', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/santal-reed-diffuser-2-6da2a490.jpg', 'Santal reed diffuser with rattan reeds in a smoked glass bottle, view 2', 1, FALSE),
  ('b1000000-0000-0000-0000-000000000004', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/santal-reed-diffuser-3-6c26ef94.jpg', 'Santal reed diffuser with rattan reeds in a smoked glass bottle, view 3', 2, FALSE),
  ('d2000000-0000-0000-0000-000000000015', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/silk-camisole-1-bcad461c.jpg', 'Black sandwashed silk camisole on a hanger', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000001', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/portofino-crossbody-bag-1-71cdea3b.jpg', 'Portofino crossbody bag in burnished cognac leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000022', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/fine-chain-bracelet-set-1-9f38e5da.jpg', 'Set of three fine gold chain bracelets', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/ribbed-cashmere-cardigan-1-6e689530.jpg', 'Ribbed camel cashmere cardigan with horn-effect buttons', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000033', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/braided-leather-belt-1-776f9133.jpg', 'Braided chestnut leather belt with a brushed buckle', 0, TRUE),
  ('b1000000-0000-0000-0000-000000000005', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/neroli-eau-de-toilette-1-c987983e.jpg', 'Neroli eau de toilette in a square amber flacon', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/drawstring-linen-trousers-1-a6506883.jpg', 'Drawstring trousers in washed olive linen', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000005', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/milano-leather-messenger-1-755b9814.jpg', 'Milano messenger bag in dark brown leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000026', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/gold-oval-cufflinks-1-a0f42a8f.jpg', 'Polished gold oval cufflinks on linen', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/silk-blend-camp-shirt-1-26d36447.jpg', 'Off-white silk-blend camp shirt on a hanger', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/silk-blend-camp-shirt-2-5f3fa2bf.jpg', 'Off-white silk-blend camp shirt on a hanger, view 2', 1, FALSE),
  ('d2000000-0000-0000-0000-000000000027', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/cashmere-travel-wrap-1-a9133999.jpg', 'Folded cashmere travel wraps on a stool', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000036', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/paisley-silk-tie-1-3aec7417.jpg', 'Navy paisley silk tie', 0, TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/supima-cotton-t-shirt-1-acce8575.jpg', 'White Supima cotton T-shirt on a wooden hanger', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000006', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/heritage-leather-bifold-1-272b2265.jpg', 'Heritage bifold wallet in brown pull-up leather', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000029', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/twin-gold-stacking-rings-1-099e8f1e.jpg', 'Two interlocking gold stacking rings', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000037', 'https://hagftvwzonevwtbsvgjn.supabase.co/storage/v1/object/public/product-images/catalog/floral-silk-tie-1-603ae587.jpg', 'Forest green silk tie with a small floral print', 0, TRUE);

-- ============================================================
-- SIZES — Ready-to-Wear only, 70 units split across XS-XL
-- Upserted on (product_id, size) so existing variant ids survive.
-- ============================================================
-- Products without sizes lose any size rows. A size that appears on an order
-- cannot be deleted (order_items.variant_id, migration 021), so it is
-- switched off first and only the rest are deleted.
UPDATE public.product_variants
SET is_active = FALSE, updated_at = now()
WHERE product_id IN (
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000024'::uuid,
  'd2000000-0000-0000-0000-000000000028'::uuid,
  'd2000000-0000-0000-0000-000000000031'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000007'::uuid,
  'd2000000-0000-0000-0000-000000000009'::uuid,
  'd2000000-0000-0000-0000-000000000032'::uuid,
  'd2000000-0000-0000-0000-000000000038'::uuid,
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000008'::uuid,
  'd2000000-0000-0000-0000-000000000035'::uuid,
  'd2000000-0000-0000-0000-000000000025'::uuid,
  'd2000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000023'::uuid,
  'd2000000-0000-0000-0000-000000000034'::uuid,
  'b1000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'd2000000-0000-0000-0000-000000000022'::uuid,
  'd2000000-0000-0000-0000-000000000033'::uuid,
  'b1000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000026'::uuid,
  'd2000000-0000-0000-0000-000000000027'::uuid,
  'd2000000-0000-0000-0000-000000000036'::uuid,
  'd2000000-0000-0000-0000-000000000006'::uuid,
  'd2000000-0000-0000-0000-000000000029'::uuid,
  'd2000000-0000-0000-0000-000000000037'::uuid
);

DELETE FROM public.product_variants v
WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.variant_id = v.id)
  AND v.product_id IN (
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000024'::uuid,
  'd2000000-0000-0000-0000-000000000028'::uuid,
  'd2000000-0000-0000-0000-000000000031'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000007'::uuid,
  'd2000000-0000-0000-0000-000000000009'::uuid,
  'd2000000-0000-0000-0000-000000000032'::uuid,
  'd2000000-0000-0000-0000-000000000038'::uuid,
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000008'::uuid,
  'd2000000-0000-0000-0000-000000000035'::uuid,
  'd2000000-0000-0000-0000-000000000025'::uuid,
  'd2000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000023'::uuid,
  'd2000000-0000-0000-0000-000000000034'::uuid,
  'b1000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'd2000000-0000-0000-0000-000000000022'::uuid,
  'd2000000-0000-0000-0000-000000000033'::uuid,
  'b1000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000026'::uuid,
  'd2000000-0000-0000-0000-000000000027'::uuid,
  'd2000000-0000-0000-0000-000000000036'::uuid,
  'd2000000-0000-0000-0000-000000000006'::uuid,
  'd2000000-0000-0000-0000-000000000029'::uuid,
  'd2000000-0000-0000-0000-000000000037'::uuid
);

INSERT INTO public.product_variants (product_id, size, sku, stock_qty, sort_order, is_active) VALUES
  ('d2000000-0000-0000-0000-000000000014', 'XS', 'AUR-RW-104-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000014', 'S', 'AUR-RW-104-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000014', 'M', 'AUR-RW-104-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000014', 'L', 'AUR-RW-104-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000014', 'XL', 'AUR-RW-104-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'XS', 'AUR-RW-103-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'S', 'AUR-RW-103-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'M', 'AUR-RW-103-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'L', 'AUR-RW-103-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'XL', 'AUR-RW-103-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'XS', 'AUR-RW-102-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'S', 'AUR-RW-102-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'M', 'AUR-RW-102-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'L', 'AUR-RW-102-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'XL', 'AUR-RW-102-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'XS', 'AUR-RW-101-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'S', 'AUR-RW-101-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'M', 'AUR-RW-101-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'L', 'AUR-RW-101-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'XL', 'AUR-RW-101-XL', 12, 5, TRUE),
  ('cbe3c632-6975-43f1-b394-31e5109700e8', 'XS', 'AUR-RW-111-XS', 8, 1, TRUE),
  ('cbe3c632-6975-43f1-b394-31e5109700e8', 'S', 'AUR-RW-111-S', 14, 2, TRUE),
  ('cbe3c632-6975-43f1-b394-31e5109700e8', 'M', 'AUR-RW-111-M', 20, 3, TRUE),
  ('cbe3c632-6975-43f1-b394-31e5109700e8', 'L', 'AUR-RW-111-L', 16, 4, TRUE),
  ('cbe3c632-6975-43f1-b394-31e5109700e8', 'XL', 'AUR-RW-111-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'XS', 'AUR-RW-106-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'S', 'AUR-RW-106-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'M', 'AUR-RW-106-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'L', 'AUR-RW-106-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'XL', 'AUR-RW-106-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000015', 'XS', 'AUR-RW-105-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000015', 'S', 'AUR-RW-105-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000015', 'M', 'AUR-RW-105-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000015', 'L', 'AUR-RW-105-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000015', 'XL', 'AUR-RW-105-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'XS', 'AUR-RW-107-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'S', 'AUR-RW-107-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'M', 'AUR-RW-107-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'L', 'AUR-RW-107-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'XL', 'AUR-RW-107-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'XS', 'AUR-RW-108-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'S', 'AUR-RW-108-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'M', 'AUR-RW-108-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'L', 'AUR-RW-108-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'XL', 'AUR-RW-108-XL', 12, 5, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'XS', 'AUR-RW-109-XS', 8, 1, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'S', 'AUR-RW-109-S', 14, 2, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'M', 'AUR-RW-109-M', 20, 3, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'L', 'AUR-RW-109-L', 16, 4, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'XL', 'AUR-RW-109-XL', 12, 5, TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'XS', 'AUR-RW-110-XS', 8, 1, TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'S', 'AUR-RW-110-S', 14, 2, TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'M', 'AUR-RW-110-M', 20, 3, TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'L', 'AUR-RW-110-L', 16, 4, TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'XL', 'AUR-RW-110-XL', 12, 5, TRUE)
ON CONFLICT (product_id, size) DO UPDATE SET
  sku        = EXCLUDED.sku,
  stock_qty  = EXCLUDED.stock_qty,
  sort_order = EXCLUDED.sort_order,
  is_active  = TRUE,
  updated_at = now();

UPDATE public.product_variants
SET is_active = FALSE, updated_at = now()
WHERE product_id IN (
  'd2000000-0000-0000-0000-000000000014'::uuid,
  'd2000000-0000-0000-0000-000000000013'::uuid,
  'd2000000-0000-0000-0000-000000000012'::uuid,
  'd2000000-0000-0000-0000-000000000011'::uuid,
  'cbe3c632-6975-43f1-b394-31e5109700e8'::uuid,
  'd2000000-0000-0000-0000-000000000016'::uuid,
  'd2000000-0000-0000-0000-000000000015'::uuid,
  'd2000000-0000-0000-0000-000000000017'::uuid,
  'd2000000-0000-0000-0000-000000000018'::uuid,
  'd2000000-0000-0000-0000-000000000019'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid
)
  AND size NOT IN ('XS', 'S', 'M', 'L', 'XL');

-- ============================================================
-- SOLD BY SIZE — exactly the Ready-to-Wear pieces above
-- A sized product's stock_quantity is derived from its sizes on sale
-- (migration 021), so the 70 written in the products upsert is recomputed
-- here from XS-XL — to the same 70.
-- ============================================================
UPDATE public.products
SET has_sizes = id IN (
      'd2000000-0000-0000-0000-000000000014'::uuid,
      'd2000000-0000-0000-0000-000000000013'::uuid,
      'd2000000-0000-0000-0000-000000000012'::uuid,
      'd2000000-0000-0000-0000-000000000011'::uuid,
      'cbe3c632-6975-43f1-b394-31e5109700e8'::uuid,
      'd2000000-0000-0000-0000-000000000016'::uuid,
      'd2000000-0000-0000-0000-000000000015'::uuid,
      'd2000000-0000-0000-0000-000000000017'::uuid,
      'd2000000-0000-0000-0000-000000000018'::uuid,
      'd2000000-0000-0000-0000-000000000019'::uuid,
      'b1000000-0000-0000-0000-000000000003'::uuid
    ),
    size_label = 'size',
    updated_at = now()
WHERE id IN (
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000024'::uuid,
  'd2000000-0000-0000-0000-000000000028'::uuid,
  'd2000000-0000-0000-0000-000000000031'::uuid,
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'b1000000-0000-0000-0000-000000000002'::uuid,
  'd2000000-0000-0000-0000-000000000014'::uuid,
  'd2000000-0000-0000-0000-000000000007'::uuid,
  'd2000000-0000-0000-0000-000000000009'::uuid,
  'd2000000-0000-0000-0000-000000000013'::uuid,
  'd2000000-0000-0000-0000-000000000032'::uuid,
  'd2000000-0000-0000-0000-000000000038'::uuid,
  'd2000000-0000-0000-0000-000000000012'::uuid,
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000008'::uuid,
  'd2000000-0000-0000-0000-000000000011'::uuid,
  'd2000000-0000-0000-0000-000000000035'::uuid,
  'd2000000-0000-0000-0000-000000000025'::uuid,
  'cbe3c632-6975-43f1-b394-31e5109700e8'::uuid,
  'd2000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000023'::uuid,
  'd2000000-0000-0000-0000-000000000016'::uuid,
  'd2000000-0000-0000-0000-000000000034'::uuid,
  'b1000000-0000-0000-0000-000000000004'::uuid,
  'd2000000-0000-0000-0000-000000000015'::uuid,
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'd2000000-0000-0000-0000-000000000022'::uuid,
  'd2000000-0000-0000-0000-000000000017'::uuid,
  'd2000000-0000-0000-0000-000000000033'::uuid,
  'b1000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000018'::uuid,
  'd2000000-0000-0000-0000-000000000005'::uuid,
  'd2000000-0000-0000-0000-000000000026'::uuid,
  'd2000000-0000-0000-0000-000000000019'::uuid,
  'd2000000-0000-0000-0000-000000000027'::uuid,
  'd2000000-0000-0000-0000-000000000036'::uuid,
  'b1000000-0000-0000-0000-000000000003'::uuid,
  'd2000000-0000-0000-0000-000000000006'::uuid,
  'd2000000-0000-0000-0000-000000000029'::uuid,
  'd2000000-0000-0000-0000-000000000037'::uuid
);

COMMIT;
