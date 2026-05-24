import { notFound } from 'next/navigation';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { ProductForm } from '@/components/admin/ProductForm';
import { VariantsSection } from '@/components/admin/VariantsSection';
import { ProductInventoryHistory } from '@/components/admin/ProductInventoryHistory';
import type { Product, ProductAttribute, AttributeValue, ProductVariant, Vendor } from '@/types';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

async function loadAttributesAndVariants(productId: string): Promise<{
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
}> {
  // Attributes + values: load every global attribute so the admin can pick.
  const [{ data: attrRows }, { data: valRows }, { data: variantRows }] = await Promise.all([
    supabase.from('product_attributes').select('id, slug, name, visible_on_pdp, usable_in_filter, sort_order').order('sort_order'),
    supabase.from('attribute_values').select('id, attribute_id, slug, value, color_hex, image_url, sort_order').order('sort_order'),
    supabase
      .from('product_variants')
      .select('id, product_id, sku, price, compare_at_price, stock, image_url, weight_grams, enabled, sort_order')
      .eq('product_id', productId)
      .order('sort_order'),
  ]);

  const attributes: AttributeWithValues[] = ((attrRows ?? []) as ProductAttribute[]).map(a => ({
    ...a,
    values: ((valRows ?? []) as AttributeValue[]).filter(v => v.attribute_id === a.id),
  }));

  const variants = (variantRows ?? []) as ProductVariant[];
  const variantIds = variants.map(v => v.id);
  const optionMap = new Map<string, string[]>();
  if (variantIds.length) {
    const { data: vavRows } = await supabase
      .from('variant_attribute_values')
      .select('variant_id, attribute_value_id')
      .in('variant_id', variantIds);
    for (const r of (vavRows ?? []) as Array<{ variant_id: string; attribute_value_id: string }>) {
      const arr = optionMap.get(r.variant_id) ?? [];
      arr.push(r.attribute_value_id);
      optionMap.set(r.variant_id, arr);
    }
  }
  const variantsWithOptions: VariantWithOptions[] = variants.map(v => ({
    ...v,
    option_value_ids: optionMap.get(v.id) ?? [],
  }));

  return { attributes, variants: variantsWithOptions };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Products" />;
  }
  const { id } = await params;
  const { data: rawProduct } = await supabase.from('products').select('*').eq('id', id).single();
  if (!rawProduct) notFound();
  const product = rawProduct as Product;

  const { attributes, variants } = await loadAttributesAndVariants(product.id);
  // vendors RLS has no policy — read with the service role.
  const { data: vendorData } = await supabaseAdmin().from('vendors').select('*').order('name');

  return (
    <>
      <ProductForm product={product} vendors={(vendorData ?? []) as Vendor[]} />
      <div className="adm-page" style={{ padding: '0 36px 32px' }}>
        <VariantsSection
          productId={product.id}
          productKind={product.kind ?? 'simple'}
          attributes={attributes}
          variants={variants}
        />
        <ProductInventoryHistory productId={product.id} />
      </div>
    </>
  );
}
