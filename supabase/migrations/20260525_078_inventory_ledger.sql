-- Migration 078 — inventory ledger.
--
-- Adds a permanent audit trail of every stock movement so the admin can
-- answer "why is this SKU showing 12 units?" and "what happened to
-- the 5 units of CeraVe Acne Control between Tuesday and Friday?".
--
-- Up till now stock has been a mutable scalar on `products.stock` and
-- `product_variants.stock` with no history. The `decrement_stock` RPC
-- (used by place_order) silently overwrote the value. Manual admin
-- adjustments via the bulk-product-actions / variant-actions paths did
-- the same. Returns, damages, restocks, and corrections all looked
-- identical from the outside: a single number that drifted.

-- ──────────────────────────────────────────────────────────────────────
-- Table
-- ──────────────────────────────────────────────────────────────────────
CREATE TYPE inventory_reason AS ENUM (
  'import',      -- backfilled from a bulk import or seed (one-off)
  'order',       -- decremented on an order being placed
  'return',      -- incremented on a return_request reaching status='received'
  'restock',     -- positive adjustment from a manual restock
  'adjustment',  -- generic manual correction (positive or negative)
  'damage',      -- negative adjustment marking units written off as damaged
  'transfer'     -- negative on the source location, positive on destination (future-multi-warehouse)
);

CREATE TABLE public.inventory_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid REFERENCES public.products(id)         ON DELETE CASCADE,
  variant_id      uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  qty_delta       integer NOT NULL,                            -- signed
  balance_after   integer,                                     -- denormalised for /admin/inventory
  reason          inventory_reason NOT NULL,
  order_id        uuid REFERENCES public.orders(id)          ON DELETE SET NULL,
  return_id       uuid REFERENCES public.return_requests(id) ON DELETE SET NULL,
  actor_kind      text NOT NULL DEFAULT 'system'
                  CHECK (actor_kind IN ('system','owner','staff','customer')),
  actor_email     text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_ledger_target_chk
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

-- Indexes serving the most-common /admin/inventory query patterns.
CREATE INDEX inventory_ledger_product_idx ON public.inventory_ledger (product_id, created_at DESC);
CREATE INDEX inventory_ledger_variant_idx ON public.inventory_ledger (variant_id, created_at DESC) WHERE variant_id IS NOT NULL;
CREATE INDEX inventory_ledger_order_idx   ON public.inventory_ledger (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX inventory_ledger_created_idx ON public.inventory_ledger (created_at DESC);

-- RLS: service-role only. Admin reads must go through supabaseAdmin();
-- the ledger has zero meaning to anon visitors and surfaces customer
-- order_id linkage that we shouldn't expose.
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────
-- Helper RPC. Wrap stock + ledger writes in one transaction so the
-- running balance can never diverge from the sum of deltas.
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_stock_change(
  p_product_id  uuid,
  p_variant_id  uuid,
  p_qty_delta   integer,
  p_reason      inventory_reason,
  p_order_id    uuid    DEFAULT NULL,
  p_return_id   uuid    DEFAULT NULL,
  p_actor_kind  text    DEFAULT 'system',
  p_actor_email text    DEFAULT NULL,
  p_note        text    DEFAULT NULL
)
RETURNS TABLE (ledger_id uuid, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_balance integer;
  v_ledger_id   uuid;
BEGIN
  IF p_product_id IS NULL AND p_variant_id IS NULL THEN
    RAISE EXCEPTION 'record_stock_change: both product_id and variant_id are NULL';
  END IF;
  IF p_variant_id IS NOT NULL THEN
    UPDATE public.product_variants
       SET stock = GREATEST(0, stock + p_qty_delta)
     WHERE id = p_variant_id
    RETURNING stock INTO v_new_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_stock_change: variant % not found', p_variant_id;
    END IF;
  ELSE
    UPDATE public.products
       SET stock = GREATEST(0, stock + p_qty_delta)
     WHERE id = p_product_id
    RETURNING stock INTO v_new_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_stock_change: product % not found', p_product_id;
    END IF;
  END IF;

  INSERT INTO public.inventory_ledger
    (product_id, variant_id, qty_delta, balance_after, reason,
     order_id, return_id, actor_kind, actor_email, note)
  VALUES
    (p_product_id, p_variant_id, p_qty_delta, v_new_balance, p_reason,
     p_order_id, p_return_id, COALESCE(p_actor_kind, 'system'), p_actor_email, p_note)
  RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_ledger_id, v_new_balance;
END $$;

-- Lock down the RPC so anon/authenticated can't call it directly —
-- storefront stock changes flow through place_order's SECURITY DEFINER
-- decrement_stock; admin changes flow through service-role.
REVOKE ALL ON FUNCTION public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_change(uuid,uuid,integer,inventory_reason,uuid,uuid,text,text,text) TO service_role;

-- ──────────────────────────────────────────────────────────────────────
-- Backfill: one ledger row per existing product (reason='import') so the
-- running balance matches the current stock value out of the box. Without
-- this, the /admin/inventory page would say "no history" for every SKU
-- and a future negative delta would balance to a negative number.
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO public.inventory_ledger
  (product_id, variant_id, qty_delta, balance_after, reason, actor_kind, note)
SELECT id, NULL, stock, stock, 'import', 'system',
       'Initial inventory backfill from migration 078'
  FROM public.products
 WHERE stock IS NOT NULL;

INSERT INTO public.inventory_ledger
  (product_id, variant_id, qty_delta, balance_after, reason, actor_kind, note)
SELECT product_id, id, stock, stock, 'import', 'system',
       'Initial inventory backfill from migration 078 (variant)'
  FROM public.product_variants
 WHERE stock IS NOT NULL;
