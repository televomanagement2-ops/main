import { useI18n } from '../../../lib/i18n';
import { sizeLabelKey } from '../../../lib/sizes';
import { colorLabelKey } from '../../../lib/variants';
import type { CartItemLocal } from '../../../types';

/** "Colour: Red · Size: M" under a cart line, in the product's own words. */
export function CartLineOptions({ item }: { item: CartItemLocal }) {
  const { t } = useI18n();
  if (!item.selectedColor && !item.selectedSize) return null;
  return (
    <p className="line-item__meta">
      {item.selectedColor && (
        <>
          {t(colorLabelKey(item.product.color_label))}: {item.selectedColor}
        </>
      )}
      {item.selectedColor && item.selectedSize && ' · '}
      {item.selectedSize && (
        <>
          {t(sizeLabelKey(item.product.size_label))}: {item.selectedSize}
        </>
      )}
    </p>
  );
}
