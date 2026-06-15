import type { Product } from '../entities/product.entity';
import type { ProductVariant } from '../entities/product-variant.entity';

export interface ResolvedInstallment {
  installmentEnabled: boolean;
  installmentMinDeposit: number | null;
  installmentDurationDays: number | null;
  installmentPolicy: string | null;
  installmentRequiresApproval: boolean;
  allowInstallmentWhenOutOfStock: boolean;
}

type InstallmentSource = Pick<
  Product,
  | 'installmentEnabled'
  | 'installmentMinDeposit'
  | 'installmentDurationDays'
  | 'installmentPolicy'
  | 'installmentRequiresApproval'
  | 'allowInstallmentWhenOutOfStock'
>;

type VariantInstallmentSource = Pick<
  ProductVariant,
  | 'installmentEnabled'
  | 'installmentMinDeposit'
  | 'installmentDurationDays'
  | 'installmentPolicy'
  | 'installmentRequiresApproval'
  | 'allowInstallmentWhenOutOfStock'
>;

function productInstallmentBase(product: InstallmentSource): ResolvedInstallment {
  return {
    installmentEnabled: product.installmentEnabled === true,
    installmentMinDeposit: product.installmentMinDeposit,
    installmentDurationDays: product.installmentDurationDays,
    installmentPolicy: product.installmentPolicy,
    installmentRequiresApproval: product.installmentRequiresApproval === true,
    allowInstallmentWhenOutOfStock: product.allowInstallmentWhenOutOfStock === true,
  };
}

/** Per-variant effective installment (variant override when enabled, else product defaults). */
export function resolveVariantInstallment(
  variant: VariantInstallmentSource,
  product: InstallmentSource,
): ResolvedInstallment {
  const base = productInstallmentBase(product);
  if (variant.installmentEnabled !== true) {
    return base;
  }

  return {
    installmentEnabled: true,
    installmentMinDeposit: variant.installmentMinDeposit ?? base.installmentMinDeposit,
    installmentDurationDays: variant.installmentDurationDays ?? base.installmentDurationDays,
    installmentPolicy: variant.installmentPolicy?.trim() || base.installmentPolicy,
    installmentRequiresApproval:
      variant.installmentRequiresApproval === true || base.installmentRequiresApproval,
    allowInstallmentWhenOutOfStock:
      variant.allowInstallmentWhenOutOfStock === true || base.allowInstallmentWhenOutOfStock,
  };
}

/** Product row for AI search — product defaults plus any variant-level enablement. */
export function resolveProductInstallmentForAgent(
  product: InstallmentSource,
  variants: VariantInstallmentSource[],
): ResolvedInstallment {
  const base = productInstallmentBase(product);
  const enabledVariants = variants.filter(v => v.installmentEnabled === true);
  if (!enabledVariants.length) {
    return base;
  }

  return {
    installmentEnabled: base.installmentEnabled || enabledVariants.length > 0,
    installmentMinDeposit: base.installmentMinDeposit,
    installmentDurationDays: base.installmentDurationDays,
    installmentPolicy: base.installmentPolicy,
    installmentRequiresApproval:
      base.installmentRequiresApproval ||
      enabledVariants.some(v => v.installmentRequiresApproval === true),
    allowInstallmentWhenOutOfStock:
      base.allowInstallmentWhenOutOfStock ||
      enabledVariants.some(v => v.allowInstallmentWhenOutOfStock === true),
  };
}
