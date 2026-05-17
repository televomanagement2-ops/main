-- 35 curated mock products across 4 categories, each with 3 images
-- Run in Supabase SQL editor AFTER schema.sql and rls.sql

BEGIN;

-- Soft-retire any legacy c1000000 mock products
UPDATE public.products
SET is_active = FALSE, is_featured = FALSE, updated_at = now()
WHERE id::text LIKE 'c1000000-%';

-- Soft-retire old d2000000 Studio Items from previous seed (FK-safe)
UPDATE public.products
SET is_active = FALSE, is_featured = FALSE, updated_at = now()
WHERE id::text LIKE 'd2000000-%';

-- Remove orphan rows that share our target slugs but have a different ID.
-- This happens when a previous partial run inserted new slugs with random UUIDs.
-- We delete by slug, then re-insert with our canonical IDs below.
DELETE FROM public.products
WHERE slug IN (
  'mechanical-keyboard-tkl','monitor-27-4k-usbc','noise-isolating-earbuds',
  'portable-ssd-1tb','smart-home-hub','webcam-4k-pro','wireless-charging-pad-15w',
  'laptop-stand-aluminium','bluetooth-trackpad',
  'relaxed-linen-shirt','slim-fit-chinos','merino-wool-crewneck','organic-denim-jacket',
  'technical-running-shorts','oversized-hoodie','ribbed-knit-cardigan',
  'wide-leg-trousers','pique-polo-shirt',
  'linen-duvet-cover-set','cast-iron-dutch-oven-5qt','artisan-pour-over-set',
  'modular-shelving-unit','scented-soy-candle-trio','bamboo-cutting-board-set',
  'handwoven-wool-throw','indoor-herb-garden-kit','ceramic-dinner-set-4pc',
  'prophone-x2-ultra','novapad-11-tablet','rugged-case-magsafe',
  'tempered-glass-screen-guard','magsafe-wallet-cardholder','fast-charger-20w-usbc',
  'compact-mirrorless-camera','prophone-x1-se'
)
AND id NOT IN (
  SELECT unnest(ARRAY[
    'd2000000-0000-0000-0000-000000000001'::uuid,
    'd2000000-0000-0000-0000-000000000002'::uuid,
    'd2000000-0000-0000-0000-000000000003'::uuid,
    'd2000000-0000-0000-0000-000000000004'::uuid,
    'd2000000-0000-0000-0000-000000000005'::uuid,
    'd2000000-0000-0000-0000-000000000006'::uuid,
    'd2000000-0000-0000-0000-000000000007'::uuid,
    'd2000000-0000-0000-0000-000000000008'::uuid,
    'd2000000-0000-0000-0000-000000000009'::uuid,
    'd2000000-0000-0000-0000-000000000011'::uuid,
    'd2000000-0000-0000-0000-000000000012'::uuid,
    'd2000000-0000-0000-0000-000000000013'::uuid,
    'd2000000-0000-0000-0000-000000000014'::uuid,
    'd2000000-0000-0000-0000-000000000015'::uuid,
    'd2000000-0000-0000-0000-000000000016'::uuid,
    'd2000000-0000-0000-0000-000000000017'::uuid,
    'd2000000-0000-0000-0000-000000000018'::uuid,
    'd2000000-0000-0000-0000-000000000019'::uuid,
    'd2000000-0000-0000-0000-000000000021'::uuid,
    'd2000000-0000-0000-0000-000000000022'::uuid,
    'd2000000-0000-0000-0000-000000000023'::uuid,
    'd2000000-0000-0000-0000-000000000024'::uuid,
    'd2000000-0000-0000-0000-000000000025'::uuid,
    'd2000000-0000-0000-0000-000000000026'::uuid,
    'd2000000-0000-0000-0000-000000000027'::uuid,
    'd2000000-0000-0000-0000-000000000028'::uuid,
    'd2000000-0000-0000-0000-000000000029'::uuid,
    'd2000000-0000-0000-0000-000000000031'::uuid,
    'd2000000-0000-0000-0000-000000000032'::uuid,
    'd2000000-0000-0000-0000-000000000033'::uuid,
    'd2000000-0000-0000-0000-000000000034'::uuid,
    'd2000000-0000-0000-0000-000000000035'::uuid,
    'd2000000-0000-0000-0000-000000000036'::uuid,
    'd2000000-0000-0000-0000-000000000037'::uuid,
    'd2000000-0000-0000-0000-000000000038'::uuid
  ])
);

-- ============================================================
-- SECTION 1: ELECTRONICS
-- category: a1000000-0000-0000-0000-000000000001
-- IDs: d2000000-0000-0000-0000-000000000001 → ...009
-- ============================================================
INSERT INTO public.products
  (id, category_id, name, slug, description, price, compare_at_price, sku, stock_quantity, is_featured, is_active)
VALUES
  (
    'd2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Mechanical Keyboard TKL',
    'mechanical-keyboard-tkl',
    'Tenkeyless layout with Cherry MX Brown switches for tactile, quiet feedback. Aluminium top frame, USB-C detachable cable, and per-key white backlighting. An ideal daily driver for writers and developers alike.',
    129.00, 159.00, 'MKTL-001', 85, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    '27" 4K USB-C Monitor',
    'monitor-27-4k-usbc',
    'IPS panel with 3840×2160 resolution, 99% sRGB coverage, and 60W USB-C power delivery. Factory-calibrated to Delta-E < 2 for colour-accurate work. Slim bezels and a height-adjustable stand complete the setup.',
    449.00, 529.00, 'MON-27-4K', 40, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000001',
    'Noise-Isolating Earbuds',
    'noise-isolating-earbuds',
    'Silicone ear tips in three sizes create a passive seal that blocks up to 26 dB of ambient noise. Drivers tuned for extended listening with a balanced mid-range. Includes a premium braided cable with inline remote.',
    89.00, NULL, 'EAR-NI-001', 150, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000001',
    'Portable SSD 1TB',
    'portable-ssd-1tb',
    'USB 3.2 Gen 2 delivers up to 1,050 MB/s read speeds in a palm-sized enclosure. Shock-resistant and compatible with Mac, Windows, and Android. Drop-tested to 1.8 metres for peace of mind on the go.',
    109.00, 139.00, 'PSSD-1TB', 120, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'Smart Home Hub',
    'smart-home-hub',
    'Central controller compatible with Zigbee, Z-Wave, and Wi-Fi devices, requiring no monthly subscription. Local processing keeps your automations running even without internet. Supports over 2,000 devices from 300+ brands.',
    79.00, NULL, 'SHH-001', 95, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000006',
    'a1000000-0000-0000-0000-000000000001',
    'Webcam 4K Pro',
    'webcam-4k-pro',
    'Sony STARVIS sensor captures 4K at 30 fps or 1080p at 60 fps with autofocus that tracks faces within 0.1 seconds. Dual noise-cancelling microphones deliver clear audio in any environment. Works natively on Mac, Windows, and Chrome OS.',
    149.00, 179.00, 'WC-4K-001', 60, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000007',
    'a1000000-0000-0000-0000-000000000001',
    'Wireless Charging Pad 15W',
    'wireless-charging-pad-15w',
    'Qi2-certified coil charges compatible phones at full 15W without overheating. Slim 6mm profile with non-slip base fits any desk. LED status indicator confirms active charging at a glance.',
    39.99, NULL, 'WCP-15W', 200, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000008',
    'a1000000-0000-0000-0000-000000000001',
    'Laptop Stand Aluminium',
    'laptop-stand-aluminium',
    'Hollow aluminium extrusion elevates your display to a healthy viewing angle while enabling full under-stand ventilation. Six height positions lock with a single lever. Folds flat in seconds for bag-friendly portability.',
    69.00, 89.00, 'LST-ALU', 110, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000009',
    'a1000000-0000-0000-0000-000000000001',
    'Bluetooth Trackpad',
    'bluetooth-trackpad',
    'Multi-touch surface with gesture support for Mac and Windows. Connects to up to three devices simultaneously via Bluetooth 5.1 and switches with a keyboard shortcut. Three-month battery life on a single charge.',
    99.00, NULL, 'BT-PAD-001', 75, FALSE, TRUE
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
  is_featured      = EXCLUDED.is_featured,
  is_active        = EXCLUDED.is_active,
  updated_at       = now();

-- ============================================================
-- SECTION 2: CLOTHING
-- category: a1000000-0000-0000-0000-000000000002
-- IDs: d2000000-0000-0000-0000-000000000011 → ...019
-- ============================================================
INSERT INTO public.products
  (id, category_id, name, slug, description, price, compare_at_price, sku, stock_quantity, is_featured, is_active)
VALUES
  (
    'd2000000-0000-0000-0000-000000000011',
    'a1000000-0000-0000-0000-000000000002',
    'Relaxed Linen Shirt',
    'relaxed-linen-shirt',
    'Stonewashed Belgian linen that softens with every wash and breathes in summer heat. Dropped shoulders and a boxy fit work equally well tucked or untucked. Available in undyed natural and washed slate.',
    79.00, NULL, 'LIN-SH-001', 180, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000012',
    'a1000000-0000-0000-0000-000000000002',
    'Slim-Fit Chinos',
    'slim-fit-chinos',
    'Stretch-cotton twill with 3% elastane moves with you without losing its sharp silhouette. Pre-washed to prevent shrinkage, with a mid-rise and tapered leg. Finished with metal buttons and a concealed zip fly.',
    89.00, 109.00, 'CHN-SLM-001', 140, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000013',
    'a1000000-0000-0000-0000-000000000002',
    'Merino Wool Crewneck',
    'merino-wool-crewneck',
    '18.5-micron extra-fine merino knit regulates temperature across a 10-degree range. Flatlock seams eliminate shoulder bulk under a jacket. Machine washable on a cold, gentle cycle.',
    119.00, NULL, 'MWC-001', 90, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000014',
    'a1000000-0000-0000-0000-000000000002',
    'Organic Denim Jacket',
    'organic-denim-jacket',
    'Selvedge denim woven on shuttle looms from GOTS-certified organic cotton. Rigid 12-oz weight ages beautifully, developing fades unique to the wearer. Copper rivets and a YKK brass zip ensure long-term durability.',
    149.00, 189.00, 'DNM-JKT-001', 65, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000015',
    'a1000000-0000-0000-0000-000000000002',
    'Technical Running Shorts',
    'technical-running-shorts',
    '87% recycled polyester with a 4-way stretch panel and laser-cut ventilation zones. Inner brief with a key pocket, and external zip pouch for cards. 17cm inseam, reflective logo strip.',
    54.00, NULL, 'RUN-SHT-001', 200, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000016',
    'a1000000-0000-0000-0000-000000000002',
    'Oversized Hoodie',
    'oversized-hoodie',
    '400 gsm French terry in 80% organic cotton, 20% recycled fleece. Dropped shoulders, kangaroo pocket, and a ribbed hem that holds its shape wash after wash. Pre-shrunk and Oeko-Tex Standard 100 certified.',
    95.00, 115.00, 'HDD-OVR-001', 120, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000017',
    'a1000000-0000-0000-0000-000000000002',
    'Ribbed Knit Cardigan',
    'ribbed-knit-cardigan',
    'Open-knit rib in a wool-cotton-linen blend that layers over t-shirts or dresses year-round. Dropped shoulders and an open front make it an effortless throw-on layer. Horn-effect buttons sourced from sustainable suppliers.',
    109.00, NULL, 'KNT-CRD-001', 75, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000018',
    'a1000000-0000-0000-0000-000000000002',
    'Wide-Leg Trousers',
    'wide-leg-trousers',
    'Fluid viscose crepe with a high rise and wide leg that photographs beautifully in motion. Elasticated rear waistband for comfort, with front welt pockets and a side zip. Fully lined with TENCEL lining to prevent clinging.',
    99.00, 119.00, 'TRS-WLD-001', 85, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000019',
    'a1000000-0000-0000-0000-000000000002',
    'Piqué Polo Shirt',
    'pique-polo-shirt',
    'Two-ply piqué knit in 100% organic cotton stays crisp under repeated washing. Three-button placket, ribbed collar and cuffs. A wardrobe staple that transitions from weekend to smart-casual effortlessly.',
    65.00, NULL, 'POL-PQ-001', 160, FALSE, TRUE
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
  is_featured      = EXCLUDED.is_featured,
  is_active        = EXCLUDED.is_active,
  updated_at       = now();

-- ============================================================
-- SECTION 3: HOME & GARDEN
-- category: a1000000-0000-0000-0000-000000000003
-- IDs: d2000000-0000-0000-0000-000000000021 → ...029
-- ============================================================
INSERT INTO public.products
  (id, category_id, name, slug, description, price, compare_at_price, sku, stock_quantity, is_featured, is_active)
VALUES
  (
    'd2000000-0000-0000-0000-000000000021',
    'a1000000-0000-0000-0000-000000000003',
    'Linen Duvet Cover Set',
    'linen-duvet-cover-set',
    'Stonewashed French linen that feels cool in summer and warm in winter, pre-softened from the first night. Set includes one duvet cover and two pillowcases with hidden button closure. OEKO-TEX certified, available in natural, dusty rose, and slate.',
    129.00, 159.00, 'LDC-SET-001', 80, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000022',
    'a1000000-0000-0000-0000-000000000003',
    'Cast Iron Dutch Oven 5.5qt',
    'cast-iron-dutch-oven-5qt',
    'Enamelled cast iron retains heat for up to 45 minutes off the hob, perfect for slow braises and sourdough. Sand-coloured enamel interior resists staining and requires no seasoning. Oven-safe to 260°C with loop handles for a secure grip.',
    189.00, NULL, 'DO-CI-5Q', 55, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000023',
    'a1000000-0000-0000-0000-000000000003',
    'Artisan Pour-Over Set',
    'artisan-pour-over-set',
    'Borosilicate glass dripper, handmade walnut collar, and a 600ml server designed for a precise 1:15 brew ratio. Includes 40 unbleached paper filters and a tasting guide. The walnut collar is removable for dishwasher cleaning.',
    69.00, 89.00, 'PO-SET-001', 110, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000024',
    'a1000000-0000-0000-0000-000000000003',
    'Modular Shelving Unit',
    'modular-shelving-unit',
    'Steel uprights with powder-coat finish accept birch-ply shelves in 30cm depth increments. Five heights, three widths — configure 27 combinations from a single unit. All fixings included; no drilling if floor-to-ceiling.',
    249.00, NULL, 'SHV-MOD-001', 30, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000025',
    'a1000000-0000-0000-0000-000000000003',
    'Scented Soy Candle Trio',
    'scented-soy-candle-trio',
    'Three 180ml vessels hand-poured with 100% soy wax and fragrance blends: Wild Fig, Sea Salt & Driftwood, and Bergamot & Cedar. Cotton wicks burn clean for 40 hours per candle. Recycled glass vessels double as small plant pots.',
    49.00, 64.00, 'CNDL-SOY-3', 200, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000026',
    'a1000000-0000-0000-0000-000000000003',
    'Bamboo Cutting Board Set',
    'bamboo-cutting-board-set',
    'Set of three FSC-certified Moso bamboo boards in S, M, and L, with juice grooves on the reverse. Harder than maple but gentler on knife edges. Finished with food-grade mineral oil; hand wash only.',
    44.99, NULL, 'CUT-BMB-S3', 150, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000027',
    'a1000000-0000-0000-0000-000000000003',
    'Handwoven Wool Throw',
    'handwoven-wool-throw',
    'Artisan-woven on traditional floor looms from undyed Churra wool in natural white, grey, and brown. Generous 130×180 cm size drapes a sofa or queen bed. Each throw carries a small variation — the mark of handcraft.',
    139.00, 169.00, 'THR-WL-001', 60, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000028',
    'a1000000-0000-0000-0000-000000000003',
    'Indoor Herb Garden Kit',
    'indoor-herb-garden-kit',
    'Terracotta planter system with five individual pots, coir growing medium, and seeds for basil, thyme, rosemary, flat-leaf parsley, and chives. A jute label kit and care card complete the gift-ready box.',
    59.00, NULL, 'HRB-KIT-001', 90, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000029',
    'a1000000-0000-0000-0000-000000000003',
    'Ceramic Dinner Set 4-piece',
    'ceramic-dinner-set-4pc',
    'Hand-thrown stoneware with a reactive glaze that makes each piece unique. Set of four dinner plates (27 cm), four side plates, four bowls, and four mugs. Microwave and dishwasher safe; not suitable for induction.',
    119.00, 149.00, 'CRM-DN-4PC', 45, FALSE, TRUE
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
  is_featured      = EXCLUDED.is_featured,
  is_active        = EXCLUDED.is_active,
  updated_at       = now();

-- ============================================================
-- SECTION 4: SMARTPHONES
-- category: a1000000-0000-0000-0000-000000000004
-- IDs: d2000000-0000-0000-0000-000000000031 → ...038
-- ============================================================
INSERT INTO public.products
  (id, category_id, name, slug, description, price, compare_at_price, sku, stock_quantity, is_featured, is_active)
VALUES
  (
    'd2000000-0000-0000-0000-000000000031',
    'a1000000-0000-0000-0000-000000000004',
    'ProPhone X2 Ultra',
    'prophone-x2-ultra',
    '6.9" ProMotion LTPO OLED panel with an adaptive 1–120 Hz refresh rate and 2800 nit peak brightness. Periscope telephoto reaches 5× optical zoom alongside a 50MP main and 12MP ultrawide. Titanium frame with Ceramic Shield front.',
    1099.00, 1199.00, 'PPX2-512', 30, TRUE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000032',
    'a1000000-0000-0000-0000-000000000004',
    'NovaPad 11 Tablet',
    'novapad-11-tablet',
    '11" Liquid Retina display with 264 ppi and ProMotion 120 Hz makes scrolling and stylus input feel instantaneous. M-series chip handles video editing and 3D rendering without throttling. Optional cellular keeps you connected anywhere.',
    649.00, NULL, 'NVP-11-128', 45, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000033',
    'a1000000-0000-0000-0000-000000000004',
    'Rugged Case MagSafe',
    'rugged-case-magsafe',
    'Dual-layer design with a soft TPU inner shell and hard polycarbonate back rated to MIL-STD-810H drop protection. Precision-cut openings and raised bezels protect the camera and display. Full MagSafe and Qi2 charging compatibility.',
    49.99, 64.99, 'RGC-MAG-001', 300, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000034',
    'a1000000-0000-0000-0000-000000000004',
    'Tempered Glass Screen Guard',
    'tempered-glass-screen-guard',
    '0.3mm AGC Dragontrail glass with a 9H hardness rating absorbs impacts without shattering. Oleophobic coating reduces fingerprints by 40% versus standard glass. Includes alignment frame for bubble-free, dust-free installation.',
    19.99, NULL, 'SCG-TMP-001', 500, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000035',
    'a1000000-0000-0000-0000-000000000004',
    'MagSafe Wallet Cardholder',
    'magsafe-wallet-cardholder',
    'Full-grain vegetable-tanned leather holds 3 cards and snaps magnetically to any MagSafe phone. RFID-blocking layer protects contactless cards. Develops a personal patina with regular use.',
    39.00, 49.00, 'MGW-CAR-001', 250, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000036',
    'a1000000-0000-0000-0000-000000000004',
    '20W Fast Charger USB-C',
    'fast-charger-20w-usbc',
    'GaN III technology shrinks the adapter to a 38mm cube — smaller than most 5W bricks. Charges a flat phone to 50% in 30 minutes with USB Power Delivery 3.1. Foldable prong, works on any USB-C device.',
    29.99, NULL, 'CHG-20W-001', 400, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000037',
    'a1000000-0000-0000-0000-000000000004',
    'Compact Mirrorless Camera',
    'compact-mirrorless-camera',
    '24.2MP APS-C sensor in a body that fits in a jacket pocket. In-body 5-axis stabilisation delivers sharp handheld shots down to 1/4 second. Compatible with a growing range of native lenses and full-frame via adapter.',
    899.00, 1049.00, 'CAM-MRL-001', 25, FALSE, TRUE
  ),
  (
    'd2000000-0000-0000-0000-000000000038',
    'a1000000-0000-0000-0000-000000000004',
    'ProPhone X1 SE',
    'prophone-x1-se',
    'The power of the X1 platform in a 5.4" flat-glass form factor that one hand can reach entirely. 48MP main camera with sensor-shift OIS and 4K video. Starting at 128GB — ideal for users who want flagship performance without max size.',
    699.00, NULL, 'PPX1-SE-128', 60, FALSE, TRUE
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
  is_featured      = EXCLUDED.is_featured,
  is_active        = EXCLUDED.is_active,
  updated_at       = now();

-- ============================================================
-- PRODUCT IMAGES — 3 per product (105 rows total)
-- Delete first to keep re-runs idempotent (no unique constraint
-- on non-primary rows, so naive re-insert would stack duplicates)
-- ============================================================
DELETE FROM public.product_images
WHERE product_id IN (
  SELECT id FROM public.products WHERE id::text LIKE 'd2000000-%'
);

INSERT INTO public.product_images (product_id, url, alt_text, sort_order, is_primary) VALUES

  -- ── ELECTRONICS ──────────────────────────────────────────────

  -- Mechanical Keyboard TKL
  ('d2000000-0000-0000-0000-000000000001', 'https://picsum.photos/seed/mechanical-keyboard-tkl/1200/1200',   'Mechanical keyboard top view',      0, TRUE),
  ('d2000000-0000-0000-0000-000000000001', 'https://picsum.photos/seed/mechanical-keyboard-tkl-2/1200/1200', 'Mechanical keyboard angle view',    1, FALSE),
  ('d2000000-0000-0000-0000-000000000001', 'https://picsum.photos/seed/mechanical-keyboard-tkl-3/1200/1200', 'Mechanical keyboard keycap detail', 2, FALSE),

  -- 27" 4K USB-C Monitor
  ('d2000000-0000-0000-0000-000000000002', 'https://picsum.photos/seed/monitor-27-4k-usbc/1200/1200',   '4K monitor front',          0, TRUE),
  ('d2000000-0000-0000-0000-000000000002', 'https://picsum.photos/seed/monitor-27-4k-usbc-2/1200/1200', '4K monitor side profile',   1, FALSE),
  ('d2000000-0000-0000-0000-000000000002', 'https://picsum.photos/seed/monitor-27-4k-usbc-3/1200/1200', '4K monitor ports detail',   2, FALSE),

  -- Noise-Isolating Earbuds
  ('d2000000-0000-0000-0000-000000000003', 'https://picsum.photos/seed/noise-isolating-earbuds/1200/1200',   'Earbuds with case',        0, TRUE),
  ('d2000000-0000-0000-0000-000000000003', 'https://picsum.photos/seed/noise-isolating-earbuds-2/1200/1200', 'Earbuds close-up',         1, FALSE),
  ('d2000000-0000-0000-0000-000000000003', 'https://picsum.photos/seed/noise-isolating-earbuds-3/1200/1200', 'Earbuds tip detail',       2, FALSE),

  -- Portable SSD 1TB
  ('d2000000-0000-0000-0000-000000000004', 'https://picsum.photos/seed/portable-ssd-1tb/1200/1200',   'Portable SSD top view',     0, TRUE),
  ('d2000000-0000-0000-0000-000000000004', 'https://picsum.photos/seed/portable-ssd-1tb-2/1200/1200', 'Portable SSD in hand',      1, FALSE),
  ('d2000000-0000-0000-0000-000000000004', 'https://picsum.photos/seed/portable-ssd-1tb-3/1200/1200', 'Portable SSD connector',    2, FALSE),

  -- Smart Home Hub
  ('d2000000-0000-0000-0000-000000000005', 'https://picsum.photos/seed/smart-home-hub/1200/1200',   'Smart home hub front',      0, TRUE),
  ('d2000000-0000-0000-0000-000000000005', 'https://picsum.photos/seed/smart-home-hub-2/1200/1200', 'Smart home hub lifestyle',  1, FALSE),
  ('d2000000-0000-0000-0000-000000000005', 'https://picsum.photos/seed/smart-home-hub-3/1200/1200', 'Smart home hub ports',      2, FALSE),

  -- Webcam 4K Pro
  ('d2000000-0000-0000-0000-000000000006', 'https://picsum.photos/seed/webcam-4k-pro/1200/1200',   'Webcam front view',         0, TRUE),
  ('d2000000-0000-0000-0000-000000000006', 'https://picsum.photos/seed/webcam-4k-pro-2/1200/1200', 'Webcam mounted on monitor', 1, FALSE),
  ('d2000000-0000-0000-0000-000000000006', 'https://picsum.photos/seed/webcam-4k-pro-3/1200/1200', 'Webcam lens detail',        2, FALSE),

  -- Wireless Charging Pad 15W
  ('d2000000-0000-0000-0000-000000000007', 'https://picsum.photos/seed/wireless-charging-pad-15w/1200/1200',   'Charging pad top view',    0, TRUE),
  ('d2000000-0000-0000-0000-000000000007', 'https://picsum.photos/seed/wireless-charging-pad-15w-2/1200/1200', 'Phone charging on pad',    1, FALSE),
  ('d2000000-0000-0000-0000-000000000007', 'https://picsum.photos/seed/wireless-charging-pad-15w-3/1200/1200', 'Charging pad LED detail',  2, FALSE),

  -- Laptop Stand Aluminium
  ('d2000000-0000-0000-0000-000000000008', 'https://picsum.photos/seed/laptop-stand-aluminium/1200/1200',   'Laptop stand front',       0, TRUE),
  ('d2000000-0000-0000-0000-000000000008', 'https://picsum.photos/seed/laptop-stand-aluminium-2/1200/1200', 'Laptop on stand',          1, FALSE),
  ('d2000000-0000-0000-0000-000000000008', 'https://picsum.photos/seed/laptop-stand-aluminium-3/1200/1200', 'Stand hinge detail',       2, FALSE),

  -- Bluetooth Trackpad
  ('d2000000-0000-0000-0000-000000000009', 'https://picsum.photos/seed/bluetooth-trackpad/1200/1200',   'Trackpad top view',        0, TRUE),
  ('d2000000-0000-0000-0000-000000000009', 'https://picsum.photos/seed/bluetooth-trackpad-2/1200/1200', 'Trackpad lifestyle',        1, FALSE),
  ('d2000000-0000-0000-0000-000000000009', 'https://picsum.photos/seed/bluetooth-trackpad-3/1200/1200', 'Trackpad side profile',     2, FALSE),

  -- ── CLOTHING ─────────────────────────────────────────────────

  -- Relaxed Linen Shirt
  ('d2000000-0000-0000-0000-000000000011', 'https://picsum.photos/seed/relaxed-linen-shirt/1200/1200',   'Linen shirt front',        0, TRUE),
  ('d2000000-0000-0000-0000-000000000011', 'https://picsum.photos/seed/relaxed-linen-shirt-2/1200/1200', 'Linen shirt back',         1, FALSE),
  ('d2000000-0000-0000-0000-000000000011', 'https://picsum.photos/seed/relaxed-linen-shirt-3/1200/1200', 'Linen shirt fabric close', 2, FALSE),

  -- Slim-Fit Chinos
  ('d2000000-0000-0000-0000-000000000012', 'https://picsum.photos/seed/slim-fit-chinos/1200/1200',   'Slim chinos front',        0, TRUE),
  ('d2000000-0000-0000-0000-000000000012', 'https://picsum.photos/seed/slim-fit-chinos-2/1200/1200', 'Slim chinos back',         1, FALSE),
  ('d2000000-0000-0000-0000-000000000012', 'https://picsum.photos/seed/slim-fit-chinos-3/1200/1200', 'Chinos hem detail',        2, FALSE),

  -- Merino Wool Crewneck
  ('d2000000-0000-0000-0000-000000000013', 'https://picsum.photos/seed/merino-wool-crewneck/1200/1200',   'Merino crewneck front',    0, TRUE),
  ('d2000000-0000-0000-0000-000000000013', 'https://picsum.photos/seed/merino-wool-crewneck-2/1200/1200', 'Merino crewneck folded',   1, FALSE),
  ('d2000000-0000-0000-0000-000000000013', 'https://picsum.photos/seed/merino-wool-crewneck-3/1200/1200', 'Merino knit texture',      2, FALSE),

  -- Organic Denim Jacket
  ('d2000000-0000-0000-0000-000000000014', 'https://picsum.photos/seed/organic-denim-jacket/1200/1200',   'Denim jacket front',       0, TRUE),
  ('d2000000-0000-0000-0000-000000000014', 'https://picsum.photos/seed/organic-denim-jacket-2/1200/1200', 'Denim jacket back',        1, FALSE),
  ('d2000000-0000-0000-0000-000000000014', 'https://picsum.photos/seed/organic-denim-jacket-3/1200/1200', 'Denim selvedge detail',    2, FALSE),

  -- Technical Running Shorts
  ('d2000000-0000-0000-0000-000000000015', 'https://picsum.photos/seed/technical-running-shorts/1200/1200',   'Running shorts front',     0, TRUE),
  ('d2000000-0000-0000-0000-000000000015', 'https://picsum.photos/seed/technical-running-shorts-2/1200/1200', 'Running shorts back',      1, FALSE),
  ('d2000000-0000-0000-0000-000000000015', 'https://picsum.photos/seed/technical-running-shorts-3/1200/1200', 'Shorts waistband detail',  2, FALSE),

  -- Oversized Hoodie
  ('d2000000-0000-0000-0000-000000000016', 'https://picsum.photos/seed/oversized-hoodie/1200/1200',   'Oversized hoodie front',   0, TRUE),
  ('d2000000-0000-0000-0000-000000000016', 'https://picsum.photos/seed/oversized-hoodie-2/1200/1200', 'Oversized hoodie back',    1, FALSE),
  ('d2000000-0000-0000-0000-000000000016', 'https://picsum.photos/seed/oversized-hoodie-3/1200/1200', 'Hoodie pocket detail',     2, FALSE),

  -- Ribbed Knit Cardigan
  ('d2000000-0000-0000-0000-000000000017', 'https://picsum.photos/seed/ribbed-knit-cardigan/1200/1200',   'Cardigan front open',      0, TRUE),
  ('d2000000-0000-0000-0000-000000000017', 'https://picsum.photos/seed/ribbed-knit-cardigan-2/1200/1200', 'Cardigan draped',          1, FALSE),
  ('d2000000-0000-0000-0000-000000000017', 'https://picsum.photos/seed/ribbed-knit-cardigan-3/1200/1200', 'Cardigan knit texture',    2, FALSE),

  -- Wide-Leg Trousers
  ('d2000000-0000-0000-0000-000000000018', 'https://picsum.photos/seed/wide-leg-trousers/1200/1200',   'Wide-leg trousers front',  0, TRUE),
  ('d2000000-0000-0000-0000-000000000018', 'https://picsum.photos/seed/wide-leg-trousers-2/1200/1200', 'Wide-leg trousers back',   1, FALSE),
  ('d2000000-0000-0000-0000-000000000018', 'https://picsum.photos/seed/wide-leg-trousers-3/1200/1200', 'Trousers fabric detail',   2, FALSE),

  -- Piqué Polo Shirt
  ('d2000000-0000-0000-0000-000000000019', 'https://picsum.photos/seed/pique-polo-shirt/1200/1200',   'Polo shirt front',         0, TRUE),
  ('d2000000-0000-0000-0000-000000000019', 'https://picsum.photos/seed/pique-polo-shirt-2/1200/1200', 'Polo shirt back',          1, FALSE),
  ('d2000000-0000-0000-0000-000000000019', 'https://picsum.photos/seed/pique-polo-shirt-3/1200/1200', 'Polo collar detail',       2, FALSE),

  -- ── HOME & GARDEN ────────────────────────────────────────────

  -- Linen Duvet Cover Set
  ('d2000000-0000-0000-0000-000000000021', 'https://picsum.photos/seed/linen-duvet-cover-set/1200/1200',   'Linen duvet on bed',       0, TRUE),
  ('d2000000-0000-0000-0000-000000000021', 'https://picsum.photos/seed/linen-duvet-cover-set-2/1200/1200', 'Duvet cover folded',       1, FALSE),
  ('d2000000-0000-0000-0000-000000000021', 'https://picsum.photos/seed/linen-duvet-cover-set-3/1200/1200', 'Linen fabric close-up',    2, FALSE),

  -- Cast Iron Dutch Oven 5.5qt
  ('d2000000-0000-0000-0000-000000000022', 'https://picsum.photos/seed/cast-iron-dutch-oven-5qt/1200/1200',   'Dutch oven with lid',      0, TRUE),
  ('d2000000-0000-0000-0000-000000000022', 'https://picsum.photos/seed/cast-iron-dutch-oven-5qt-2/1200/1200', 'Dutch oven interior',      1, FALSE),
  ('d2000000-0000-0000-0000-000000000022', 'https://picsum.photos/seed/cast-iron-dutch-oven-5qt-3/1200/1200', 'Dutch oven handles',       2, FALSE),

  -- Artisan Pour-Over Set
  ('d2000000-0000-0000-0000-000000000023', 'https://picsum.photos/seed/artisan-pour-over-set/1200/1200',   'Pour-over set complete',   0, TRUE),
  ('d2000000-0000-0000-0000-000000000023', 'https://picsum.photos/seed/artisan-pour-over-set-2/1200/1200', 'Coffee brewing close-up',  1, FALSE),
  ('d2000000-0000-0000-0000-000000000023', 'https://picsum.photos/seed/artisan-pour-over-set-3/1200/1200', 'Walnut collar detail',     2, FALSE),

  -- Modular Shelving Unit
  ('d2000000-0000-0000-0000-000000000024', 'https://picsum.photos/seed/modular-shelving-unit/1200/1200',   'Shelving unit assembled',  0, TRUE),
  ('d2000000-0000-0000-0000-000000000024', 'https://picsum.photos/seed/modular-shelving-unit-2/1200/1200', 'Shelving unit detail',     1, FALSE),
  ('d2000000-0000-0000-0000-000000000024', 'https://picsum.photos/seed/modular-shelving-unit-3/1200/1200', 'Shelf bracket close-up',   2, FALSE),

  -- Scented Soy Candle Trio
  ('d2000000-0000-0000-0000-000000000025', 'https://picsum.photos/seed/scented-soy-candle-trio/1200/1200',   'Candle trio styled',       0, TRUE),
  ('d2000000-0000-0000-0000-000000000025', 'https://picsum.photos/seed/scented-soy-candle-trio-2/1200/1200', 'Candle flame close-up',    1, FALSE),
  ('d2000000-0000-0000-0000-000000000025', 'https://picsum.photos/seed/scented-soy-candle-trio-3/1200/1200', 'Candle label detail',      2, FALSE),

  -- Bamboo Cutting Board Set
  ('d2000000-0000-0000-0000-000000000026', 'https://picsum.photos/seed/bamboo-cutting-board-set/1200/1200',   'Cutting boards stacked',   0, TRUE),
  ('d2000000-0000-0000-0000-000000000026', 'https://picsum.photos/seed/bamboo-cutting-board-set-2/1200/1200', 'Cutting board in use',     1, FALSE),
  ('d2000000-0000-0000-0000-000000000026', 'https://picsum.photos/seed/bamboo-cutting-board-set-3/1200/1200', 'Bamboo grain detail',      2, FALSE),

  -- Handwoven Wool Throw
  ('d2000000-0000-0000-0000-000000000027', 'https://picsum.photos/seed/handwoven-wool-throw/1200/1200',   'Wool throw on sofa',       0, TRUE),
  ('d2000000-0000-0000-0000-000000000027', 'https://picsum.photos/seed/handwoven-wool-throw-2/1200/1200', 'Throw folded detail',      1, FALSE),
  ('d2000000-0000-0000-0000-000000000027', 'https://picsum.photos/seed/handwoven-wool-throw-3/1200/1200', 'Wool weave close-up',      2, FALSE),

  -- Indoor Herb Garden Kit
  ('d2000000-0000-0000-0000-000000000028', 'https://picsum.photos/seed/indoor-herb-garden-kit/1200/1200',   'Herb garden kit packaged', 0, TRUE),
  ('d2000000-0000-0000-0000-000000000028', 'https://picsum.photos/seed/indoor-herb-garden-kit-2/1200/1200', 'Herb seedlings growing',   1, FALSE),
  ('d2000000-0000-0000-0000-000000000028', 'https://picsum.photos/seed/indoor-herb-garden-kit-3/1200/1200', 'Terracotta pots detail',   2, FALSE),

  -- Ceramic Dinner Set 4-piece
  ('d2000000-0000-0000-0000-000000000029', 'https://picsum.photos/seed/ceramic-dinner-set-4pc/1200/1200',   'Dinner set table styled',  0, TRUE),
  ('d2000000-0000-0000-0000-000000000029', 'https://picsum.photos/seed/ceramic-dinner-set-4pc-2/1200/1200', 'Ceramic plate close-up',   1, FALSE),
  ('d2000000-0000-0000-0000-000000000029', 'https://picsum.photos/seed/ceramic-dinner-set-4pc-3/1200/1200', 'Glaze texture detail',     2, FALSE),

  -- ── SMARTPHONES ──────────────────────────────────────────────

  -- ProPhone X2 Ultra
  ('d2000000-0000-0000-0000-000000000031', 'https://picsum.photos/seed/prophone-x2-ultra/1200/1200',   'ProPhone X2 Ultra front',  0, TRUE),
  ('d2000000-0000-0000-0000-000000000031', 'https://picsum.photos/seed/prophone-x2-ultra-2/1200/1200', 'ProPhone X2 Ultra back',   1, FALSE),
  ('d2000000-0000-0000-0000-000000000031', 'https://picsum.photos/seed/prophone-x2-ultra-3/1200/1200', 'ProPhone X2 camera array', 2, FALSE),

  -- NovaPad 11 Tablet
  ('d2000000-0000-0000-0000-000000000032', 'https://picsum.photos/seed/novapad-11-tablet/1200/1200',   'NovaPad 11 front',         0, TRUE),
  ('d2000000-0000-0000-0000-000000000032', 'https://picsum.photos/seed/novapad-11-tablet-2/1200/1200', 'NovaPad 11 with keyboard', 1, FALSE),
  ('d2000000-0000-0000-0000-000000000032', 'https://picsum.photos/seed/novapad-11-tablet-3/1200/1200', 'NovaPad 11 side profile',  2, FALSE),

  -- Rugged Case MagSafe
  ('d2000000-0000-0000-0000-000000000033', 'https://picsum.photos/seed/rugged-case-magsafe/1200/1200',   'Rugged case front',        0, TRUE),
  ('d2000000-0000-0000-0000-000000000033', 'https://picsum.photos/seed/rugged-case-magsafe-2/1200/1200', 'Rugged case on phone',     1, FALSE),
  ('d2000000-0000-0000-0000-000000000033', 'https://picsum.photos/seed/rugged-case-magsafe-3/1200/1200', 'Case drop-test angle',     2, FALSE),

  -- Tempered Glass Screen Guard
  ('d2000000-0000-0000-0000-000000000034', 'https://picsum.photos/seed/tempered-glass-screen-guard/1200/1200',   'Screen guard packaging',   0, TRUE),
  ('d2000000-0000-0000-0000-000000000034', 'https://picsum.photos/seed/tempered-glass-screen-guard-2/1200/1200', 'Screen guard applied',     1, FALSE),
  ('d2000000-0000-0000-0000-000000000034', 'https://picsum.photos/seed/tempered-glass-screen-guard-3/1200/1200', 'Alignment frame detail',   2, FALSE),

  -- MagSafe Wallet Cardholder
  ('d2000000-0000-0000-0000-000000000035', 'https://picsum.photos/seed/magsafe-wallet-cardholder/1200/1200',   'Wallet cardholder front',  0, TRUE),
  ('d2000000-0000-0000-0000-000000000035', 'https://picsum.photos/seed/magsafe-wallet-cardholder-2/1200/1200', 'Wallet on phone',          1, FALSE),
  ('d2000000-0000-0000-0000-000000000035', 'https://picsum.photos/seed/magsafe-wallet-cardholder-3/1200/1200', 'Leather wallet detail',    2, FALSE),

  -- 20W Fast Charger USB-C
  ('d2000000-0000-0000-0000-000000000036', 'https://picsum.photos/seed/fast-charger-20w-usbc/1200/1200',   'Charger front view',       0, TRUE),
  ('d2000000-0000-0000-0000-000000000036', 'https://picsum.photos/seed/fast-charger-20w-usbc-2/1200/1200', 'Charger plugged in',       1, FALSE),
  ('d2000000-0000-0000-0000-000000000036', 'https://picsum.photos/seed/fast-charger-20w-usbc-3/1200/1200', 'GaN chip size comparison', 2, FALSE),

  -- Compact Mirrorless Camera
  ('d2000000-0000-0000-0000-000000000037', 'https://picsum.photos/seed/compact-mirrorless-camera/1200/1200',   'Camera front with lens',   0, TRUE),
  ('d2000000-0000-0000-0000-000000000037', 'https://picsum.photos/seed/compact-mirrorless-camera-2/1200/1200', 'Camera back display',      1, FALSE),
  ('d2000000-0000-0000-0000-000000000037', 'https://picsum.photos/seed/compact-mirrorless-camera-3/1200/1200', 'Camera in hand',           2, FALSE),

  -- ProPhone X1 SE
  ('d2000000-0000-0000-0000-000000000038', 'https://picsum.photos/seed/prophone-x1-se/1200/1200',   'ProPhone X1 SE front',     0, TRUE),
  ('d2000000-0000-0000-0000-000000000038', 'https://picsum.photos/seed/prophone-x1-se-2/1200/1200', 'ProPhone X1 SE back',      1, FALSE),
  ('d2000000-0000-0000-0000-000000000038', 'https://picsum.photos/seed/prophone-x1-se-3/1200/1200', 'ProPhone X1 SE in hand',   2, FALSE);

-- ============================================================
-- CLOTHING SIZE VARIANTS — XS / S / M / L / XL for all 9 items
-- Delete before re-insert: handles removed sizes cleanly and
-- avoids UNIQUE (product_id, size) conflicts on re-runs
-- ============================================================
DELETE FROM public.product_variants
WHERE product_id IN (
  'd2000000-0000-0000-0000-000000000011',
  'd2000000-0000-0000-0000-000000000012',
  'd2000000-0000-0000-0000-000000000013',
  'd2000000-0000-0000-0000-000000000014',
  'd2000000-0000-0000-0000-000000000015',
  'd2000000-0000-0000-0000-000000000016',
  'd2000000-0000-0000-0000-000000000017',
  'd2000000-0000-0000-0000-000000000018',
  'd2000000-0000-0000-0000-000000000019'
);

INSERT INTO public.product_variants (product_id, size, sku, stock_qty, sort_order) VALUES
  -- Relaxed Linen Shirt
  ('d2000000-0000-0000-0000-000000000011', 'XS', 'LIN-SH-XS', 20, 1),
  ('d2000000-0000-0000-0000-000000000011', 'S',  'LIN-SH-S',  40, 2),
  ('d2000000-0000-0000-0000-000000000011', 'M',  'LIN-SH-M',  55, 3),
  ('d2000000-0000-0000-0000-000000000011', 'L',  'LIN-SH-L',  45, 4),
  ('d2000000-0000-0000-0000-000000000011', 'XL', 'LIN-SH-XL', 20, 5),
  -- Slim-Fit Chinos
  ('d2000000-0000-0000-0000-000000000012', 'XS', 'CHN-XS', 15, 1),
  ('d2000000-0000-0000-0000-000000000012', 'S',  'CHN-S',  35, 2),
  ('d2000000-0000-0000-0000-000000000012', 'M',  'CHN-M',  50, 3),
  ('d2000000-0000-0000-0000-000000000012', 'L',  'CHN-L',  30, 4),
  ('d2000000-0000-0000-0000-000000000012', 'XL', 'CHN-XL', 10, 5),
  -- Merino Wool Crewneck
  ('d2000000-0000-0000-0000-000000000013', 'XS', 'MWC-XS', 10, 1),
  ('d2000000-0000-0000-0000-000000000013', 'S',  'MWC-S',  25, 2),
  ('d2000000-0000-0000-0000-000000000013', 'M',  'MWC-M',  30, 3),
  ('d2000000-0000-0000-0000-000000000013', 'L',  'MWC-L',  20, 4),
  ('d2000000-0000-0000-0000-000000000013', 'XL', 'MWC-XL',  5, 5),
  -- Organic Denim Jacket
  ('d2000000-0000-0000-0000-000000000014', 'XS', 'DNM-JKT-XS', 8,  1),
  ('d2000000-0000-0000-0000-000000000014', 'S',  'DNM-JKT-S',  18, 2),
  ('d2000000-0000-0000-0000-000000000014', 'M',  'DNM-JKT-M',  22, 3),
  ('d2000000-0000-0000-0000-000000000014', 'L',  'DNM-JKT-L',  12, 4),
  ('d2000000-0000-0000-0000-000000000014', 'XL', 'DNM-JKT-XL',  5, 5),
  -- Technical Running Shorts
  ('d2000000-0000-0000-0000-000000000015', 'XS', 'RUN-SHT-XS', 30, 1),
  ('d2000000-0000-0000-0000-000000000015', 'S',  'RUN-SHT-S',  50, 2),
  ('d2000000-0000-0000-0000-000000000015', 'M',  'RUN-SHT-M',  65, 3),
  ('d2000000-0000-0000-0000-000000000015', 'L',  'RUN-SHT-L',  40, 4),
  ('d2000000-0000-0000-0000-000000000015', 'XL', 'RUN-SHT-XL', 15, 5),
  -- Oversized Hoodie
  ('d2000000-0000-0000-0000-000000000016', 'XS', 'HDD-OVR-XS', 15, 1),
  ('d2000000-0000-0000-0000-000000000016', 'S',  'HDD-OVR-S',  30, 2),
  ('d2000000-0000-0000-0000-000000000016', 'M',  'HDD-OVR-M',  40, 3),
  ('d2000000-0000-0000-0000-000000000016', 'L',  'HDD-OVR-L',  25, 4),
  ('d2000000-0000-0000-0000-000000000016', 'XL', 'HDD-OVR-XL', 10, 5),
  -- Ribbed Knit Cardigan
  ('d2000000-0000-0000-0000-000000000017', 'XS', 'KNT-CRD-XS', 10, 1),
  ('d2000000-0000-0000-0000-000000000017', 'S',  'KNT-CRD-S',  20, 2),
  ('d2000000-0000-0000-0000-000000000017', 'M',  'KNT-CRD-M',  25, 3),
  ('d2000000-0000-0000-0000-000000000017', 'L',  'KNT-CRD-L',  15, 4),
  ('d2000000-0000-0000-0000-000000000017', 'XL', 'KNT-CRD-XL',  5, 5),
  -- Wide-Leg Trousers
  ('d2000000-0000-0000-0000-000000000018', 'XS', 'TRS-WLD-XS', 12, 1),
  ('d2000000-0000-0000-0000-000000000018', 'S',  'TRS-WLD-S',  25, 2),
  ('d2000000-0000-0000-0000-000000000018', 'M',  'TRS-WLD-M',  28, 3),
  ('d2000000-0000-0000-0000-000000000018', 'L',  'TRS-WLD-L',  15, 4),
  ('d2000000-0000-0000-0000-000000000018', 'XL', 'TRS-WLD-XL',  5, 5),
  -- Piqué Polo Shirt
  ('d2000000-0000-0000-0000-000000000019', 'XS', 'POL-PQ-XS', 20, 1),
  ('d2000000-0000-0000-0000-000000000019', 'S',  'POL-PQ-S',  40, 2),
  ('d2000000-0000-0000-0000-000000000019', 'M',  'POL-PQ-M',  50, 3),
  ('d2000000-0000-0000-0000-000000000019', 'L',  'POL-PQ-L',  35, 4),
  ('d2000000-0000-0000-0000-000000000019', 'XL', 'POL-PQ-XL', 15, 5)
ON CONFLICT (product_id, size) DO UPDATE SET
  sku       = EXCLUDED.sku,
  stock_qty = EXCLUDED.stock_qty,
  is_active = TRUE,
  updated_at = now();

COMMIT;
