import {
  resolveProductInstallmentForAgent,
  resolveVariantInstallment,
} from './product-installment.util';

const product = {
  installmentEnabled: true,
  installmentMinDeposit: 100_000,
  installmentDurationDays: 90,
  installmentPolicy: 'Product policy',
  installmentRequiresApproval: false,
  allowInstallmentWhenOutOfStock: false,
};

describe('resolveVariantInstallment', () => {
  it('inherits product settings when variant override is off', () => {
    expect(
      resolveVariantInstallment(
        {
          installmentEnabled: false,
          installmentMinDeposit: null,
          installmentDurationDays: null,
          installmentPolicy: null,
          installmentRequiresApproval: false,
          allowInstallmentWhenOutOfStock: false,
        },
        product,
      ),
    ).toEqual({
      installmentEnabled: true,
      installmentMinDeposit: 100_000,
      installmentDurationDays: 90,
      installmentPolicy: 'Product policy',
      installmentRequiresApproval: false,
      allowInstallmentWhenOutOfStock: false,
    });
  });

  it('uses variant overrides when variant installment is enabled', () => {
    expect(
      resolveVariantInstallment(
        {
          installmentEnabled: true,
          installmentMinDeposit: 50_000,
          installmentDurationDays: null,
          installmentPolicy: 'Variant policy',
          installmentRequiresApproval: true,
          allowInstallmentWhenOutOfStock: true,
        },
        product,
      ),
    ).toEqual({
      installmentEnabled: true,
      installmentMinDeposit: 50_000,
      installmentDurationDays: 90,
      installmentPolicy: 'Variant policy',
      installmentRequiresApproval: true,
      allowInstallmentWhenOutOfStock: true,
    });
  });
});

describe('resolveProductInstallmentForAgent', () => {
  it('keeps product settings when no variant overrides exist', () => {
    expect(resolveProductInstallmentForAgent(product, [])).toEqual({
      installmentEnabled: true,
      installmentMinDeposit: 100_000,
      installmentDurationDays: 90,
      installmentPolicy: 'Product policy',
      installmentRequiresApproval: false,
      allowInstallmentWhenOutOfStock: false,
    });
  });

  it('enables installment when only a variant has it on', () => {
    expect(
      resolveProductInstallmentForAgent(
        { ...product, installmentEnabled: false },
        [
          {
            installmentEnabled: true,
            installmentMinDeposit: null,
            installmentDurationDays: null,
            installmentPolicy: null,
            installmentRequiresApproval: false,
            allowInstallmentWhenOutOfStock: true,
          },
        ],
      ),
    ).toEqual({
      installmentEnabled: true,
      installmentMinDeposit: 100_000,
      installmentDurationDays: 90,
      installmentPolicy: 'Product policy',
      installmentRequiresApproval: false,
      allowInstallmentWhenOutOfStock: true,
    });
  });
});
