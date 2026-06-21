# CommerceJet — Security & Functional Audit

**Data:** Giugno 2026
**Ambito:** Frontend (React 19 + Vite + TS), backend Supabase (Postgres + RLS, Edge Functions Deno),
integrazione pagamenti Stripe, email Resend.
**Esito sintetico:** impianto solido. Risolta **1 vulnerabilità critica** (manomissione prezzi) e
applicato hardening (CORS, logging, pulizia). Restano alcune voci di verifica/operatività pre-go-live.

---

## 1. Cosa è già sicuro (verificato)

- **Row Level Security (RLS)** completa e ben progettata su tutte le tabelle (`supabase/rls.sql`,
  `migrations/002_rls_hardening.sql`): owner-scoping, lettura admin via `is_admin()` (SECURITY DEFINER
  con `search_path` fisso), prevenzione **self-promotion** ad admin (`profiles` UPDATE con `get_my_role()`).
- **Ordini blindati lato DB**: i clienti possono inserire ordini solo in stato `pending`; l'INSERT su
  `order_items` lato cliente è revocato (solo service role scrive dopo il pagamento). Trigger di
  **transizione di stato** e **immutabilità post-pagamento** (`migrations/003_payment_hardening.sql`).
- **Webhook Stripe**: verifica firma (`constructEventAsync`) e **idempotenza** via tabella
  `processed_stripe_events` (`supabase/functions/stripe-webhook/index.ts`).
- **Autorizzazione Edge Functions**: ogni funzione valida il JWT (`auth.getUser`) e i ruoli admin via
  `profiles.role` prima di refund/tracking/deliver.
- **Segreti**: `.env` correttamente ignorato da git (`.gitignore`) e non tracciato. Stripe/Resend/service-role
  vivono solo come secret delle Edge Functions.
- **Pagamenti PCI**: nessun dato di carta transita o è conservato sui nostri server; tutto via Stripe (PCI-DSS L1).

---

## 2. Vulnerabilità risolte in questo intervento

### 2.1 🔴 CRITICO — Manomissione dei prezzi nel checkout (price tampering) — RISOLTO
- **Problema:** `create-checkout-session` usava `price` e `shipping_cost` inviati dal browser
  (`src/features/checkout/pages/CheckoutPage.tsx`) sia per il totale dell'ordine sia per le line items
  Stripe. Un utente poteva chiamare la Edge Function con prezzi arbitrari (es. $0,01) e pagare meno del dovuto.
- **Fix:** la funzione ora ignora i prezzi del client e li ricava **dal database** (service role):
  - prezzi/`name`/disponibilità letti da `products` (`select id, name, price, is_active, stock_quantity`);
  - rifiuto di prodotti inesistenti, non attivi, quantità non valide o stock insufficiente;
  - `shipping_cost` letto da `shipping_methods` per `shipping_method_id` (non più dal client);
  - `subtotal`, `tax` e `total` ricalcolati interamente lato server.
- **File:** `supabase/functions/create-checkout-session/index.ts`.

### 2.2 🟠 MEDIO — CORS aperto a tutte le origini — RISOLTO
- **Problema:** tutte le Edge Functions browser-facing rispondevano con `Access-Control-Allow-Origin: *`.
- **Fix:** allowlist configurabile via secret **`ALLOWED_ORIGINS`** (CSV); l'origine viene riflessa solo se
  in elenco. Fallback a `*` solo se la variabile non è impostata (per non rompere il dev locale).
- **File:** `create-checkout-session`, `handle-order-action`, `update-tracking`.
  (`stripe-webhook` è server-to-server, nessun CORS necessario.)
- **Azione richiesta al deploy:** impostare `ALLOWED_ORIGINS` con il/i dominio/i reali del frontend.

### 2.3 🟡 BASSO — Igiene del codice e dei log — RISOLTO
- Rimosso il logging che stampava `user.id` e la presenza dei segreti in `create-checkout-session`.
- Rimossa la funzione **morta** `createOrder` da `src/lib/api.ts` (non utilizzata; avrebbe comunque
  violato le RLS sull'INSERT di `order_items`).
- Rimosse **due Edge Functions morte** (nessun chiamante): `refund-order` (duplicato di
  `handle-order-action` action `refund`) e `send-tracking-email` (duplicato di `update-tracking`).
  Restano 4 funzioni effettive. Riduce la superficie d'attacco e la confusione di deploy.

### 2.4 🔴 CRITICO — Annullamento cliente senza rimborso — RISOLTO
- **Problema:** l'annullo di un ordine **pagato** da parte del cliente lo portava a `cancelled` **senza**
  emettere alcun refund Stripe → il cliente pagava e non riceveva i soldi. In più, un eventuale refund con
  stato finale `cancelled` avrebbe fatto fallire i webhook `charge.refunded`/`refund.updated`
  (`cancelled → refunded` vietato) in loop.
- **Fix:** in `handle-order-action` l'azione `cancel` su un ordine `paid` ora emette un **refund Stripe
  totale**, imposta `refund_id`/`refund_amount`/`refunded_at` e stato **`refunded`** (idempotente coi
  webhook), ripristina lo stock (trigger) e invia l'email di conferma. Ignora qualsiasi `amount` dal client.

---

## 3. Voci di verifica / raccomandazioni (non bloccanti)

| # | Severità | Tema | Raccomandazione |
|---|----------|------|-----------------|
| 3.1 | 🟡 | **Doppia deduzione stock** | Verificare in DB che il trigger legacy `order_item_deduct_stock` (su INSERT di `order_items`, `schema.sql`) sia stato rimosso: la logica corretta è `manage_stock_on_status_change()` su `status → paid` (`003_payment_hardening.sql`). Se entrambi attivi, lo stock verrebbe scalato due volte. |
| 3.2 | 🟢 | **Finestra di oversell** | Lo stock si scala solo al pagamento confermato; tra creazione ordine e pagamento più utenti possono ordinare l'ultimo pezzo. Accettabile con il limite di 3 ordini pending/utente e la scadenza a 2h; valutare un soft-hold se il volume cresce. |
| 3.3 | 🟢 | **Tax fissa 10%** | `automatic_tax: false` + 10% lato server: coerente con il setup USA attuale. Se attivi vendite UE con IVA, valutare Stripe Tax / aliquote per giurisdizione. |
| 3.4 | 🟢 | **Bundle JS > 1 MB** | `dist` ~1,25 MB (gzip ~349 kB). Non è un problema di sicurezza; per performance valutare code-splitting/lazy-load delle route (incluse quelle legali e admin). |
| 3.5 | 🟢 | **Email HTML** | I nomi cliente sono interpolati in email HTML (`handle-order-action`, `update-tracking`). Rischio basso (destinatario = cliente stesso), ma valutare escaping per igiene. |

---

## 4. Privacy, cookie e dipendenze di terze parti

- **iubenda rimosso completamente** (script CMP da `index.html`, listener, stili, stringhe). Riduce
  l'esposizione a JavaScript di terze parti e il fingerprinting. Il consenso è ora gestito da un
  **banner self-hosted granulare** (`src/components/consent/CookieConsentBanner.tsx`,
  `src/store/cookieConsentStore.ts`) conforme alle linee guida EDPB/Garante (rifiuto facile quanto
  l'accetto, ri-prompt a 12 mesi).
- **Documenti legali riscritti** (Terms, Privacy, Cookie) in 4 lingue, modello **US-primary + sezione UE/EEA**,
  aggiornati a giugno 2026 (ODR UE chiusa il 20/7/2025, GPSR dal 13/12/2024, EAA dal 28/6/2025, CCPA/CPRA + GPC).
  Contengono **placeholder** `[…]` da compilare prima del go-live.

---

## 5. Checklist pre-go-live (operatività — a carico del gestore)

- [ ] Impostare il secret `ALLOWED_ORIGINS` sulle Edge Functions con i domini reali del frontend.
- [ ] Re-deploy delle Edge Functions aggiornate (`create-checkout-session`, `handle-order-action`,
      `update-tracking`, `stripe-webhook`).
- [ ] Applicare le migration `010_reviews_verified_purchase.sql` e `011_product_storage.sql`.
- [ ] Verificare/rimuovere l'eventuale trigger `order_item_deduct_stock` duplicato (punto 3.1).
- [ ] Compilare i placeholder legali: `[SELLER_LEGAL_NAME]`, `[BUSINESS_ADDRESS]`, `[CONTACT_EMAIL]`,
      `[PRIVACY_EMAIL]`, `[GOVERNING_STATE]`, `[ARBITRATION_BODY]`, `[RETURN_WINDOW]`,
      `[EU_RESPONSIBLE_PERSON]`, `[EU_REPRESENTATIVE]`.
- [ ] Prima di vendere a consumatori UE: nominare il **responsabile GPSR UE** e pubblicare la
      **dichiarazione di accessibilità (EAA)**.
- [ ] Confermare in produzione: HTTPS/HSTS, policy di sicurezza Supabase (RLS attive su tutte le tabelle),
      rotazione dei segreti Stripe/Resend.

---

*Documento generato come parte dell'intervento di sicurezza e compliance. Le voci della sezione 5 non sono
modifiche al codice ma azioni operative necessarie prima della messa in produzione.*
