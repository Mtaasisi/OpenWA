import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  aiApi,
  productsApi,
  type BranchPaymentAccount,
  type CreateBranchPaymentAccountInput,
} from '../../services/api';
import { useToast } from '../Toast';
import { SettingsIntField } from './SettingsIntegrationShell';
import {
  SettingsFormCard,
  SettingsFormCardHeadButton,
  SettingsFormIntro,
  SettingsFormGrid,
  SettingsFormSection,
  SettingsFormDisplayField,
  SettingsFormEditField,
} from './shell/SettingsFormPrimitives';
import { formatPhoneNumbersForTextarea } from '../../lib/phone-numbers';

export function AiBranchProfilePanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });

  const { data: profileList = [] } = useQuery({
    queryKey: ['ai-profile', 'list'],
    queryFn: () => aiApi.listBranchProfiles(),
  });

  const defaultBranchId =
    inauzwaStatus?.preferences?.branchId ?? inauzwaStatus?.branchId ?? '';
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const branchId =
    selectedBranchId || defaultBranchId || profileList[0]?.branchId || '';

  const { data, isLoading } = useQuery({
    queryKey: ['ai-profile', branchId],
    queryFn: () => aiApi.getBranchProfile(branchId),
    enabled: !!branchId,
  });

  useEffect(() => {
    if (selectedBranchId) return;
    if (defaultBranchId) {
      setSelectedBranchId(defaultBranchId);
      return;
    }
    if (profileList[0]?.branchId) setSelectedBranchId(profileList[0].branchId);
  }, [defaultBranchId, selectedBranchId, profileList]);

  const [businessName, setBusinessName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [aiDisplayName, setAiDisplayName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [nearbyLandmarks, setNearbyLandmarks] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [deliveryPolicy, setDeliveryPolicy] = useState('');
  const [warrantyPolicy, setWarrantyPolicy] = useState('');
  const [installmentPolicyDefault, setInstallmentPolicyDefault] = useState('');
  const [aiTone, setAiTone] = useState('boss_friendly_mtaani');

  const accountNumberRef = useRef<HTMLInputElement>(null);

  const [newPayment, setNewPayment] = useState<CreateBranchPaymentAccountInput>({
    methodType: 'mobile_money',
    providerName: 'M-Pesa',
    accountName: '',
    accountNumber: '',
    instructions: '',
    isActive: true,
    isDefault: true,
  });

  const hydrateFromProfile = () => {
    const profile = data?.profile;
    if (!profile) return;
    const name = profile.businessName ?? '';
    setBusinessName(name);
    setBranchName(profile.branchName ?? '');
    setAiDisplayName(profile.aiDisplayName ?? '');
    setLocationDescription(profile.locationDescription ?? '');
    setGoogleMapsUrl(profile.googleMapsUrl ?? '');
    setNearbyLandmarks(profile.nearbyLandmarks ?? '');
    setOpeningHours(profile.openingHours ?? '');
    setPhoneNumbers(formatPhoneNumbersForTextarea(profile.phoneNumbers));
    setDeliveryPolicy(profile.deliveryPolicy ?? '');
    setWarrantyPolicy(profile.warrantyPolicy ?? '');
    setInstallmentPolicyDefault(profile.installmentPolicyDefault ?? '');
    setAiTone(profile.aiTone ?? 'boss_friendly_mtaani');
    if (!data.paymentAccounts?.length && name) {
      setNewPayment(p => ({
        ...p,
        accountName: p.accountName || name,
        providerName: p.providerName || 'M-Pesa',
      }));
    }
  };

  useEffect(() => {
    hydrateFromProfile();
  }, [data?.profile, data?.paymentAccounts]);

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      aiApi.upsertBranchProfile(branchId, {
        businessName: businessName || null,
        branchName: branchName || null,
        aiDisplayName: aiDisplayName || null,
        locationDescription: locationDescription || null,
        googleMapsUrl: googleMapsUrl || null,
        nearbyLandmarks: nearbyLandmarks || null,
        openingHours: openingHours || null,
        phoneNumbers: phoneNumbers
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean),
        deliveryPolicy: deliveryPolicy || null,
        warrantyPolicy: warrantyPolicy || null,
        installmentPolicyDefault: installmentPolicyDefault || null,
        aiTone,
      }),
    onSuccess: () => {
      toast.success(t('ai.branchProfile.saved'));
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['ai-profile'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addPaymentMutation = useMutation({
    mutationFn: () => aiApi.createPaymentAccount(branchId, newPayment),
    onSuccess: () => {
      toast.success(t('ai.branchProfile.paymentAdded'));
      void qc.invalidateQueries({ queryKey: ['ai-profile', branchId] });
      setNewPayment({
        methodType: 'mobile_money',
        providerName: 'M-Pesa',
        accountName: '',
        accountNumber: '',
        instructions: '',
        isActive: true,
        isDefault: false,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: (account: BranchPaymentAccount) =>
      aiApi.updatePaymentAccount(account.id, {
        isActive: account.isActive,
        isDefault: account.isDefault,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ai-profile', branchId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => aiApi.deletePaymentAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-profile', branchId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const paymentAccounts = data?.paymentAccounts ?? [];
  const phoneDisplay = phoneNumbers
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');
  const notSpecified = t('ai.branchProfile.notSpecified');
  const notLinked = t('ai.branchProfile.notLinked');

  if (!branchId) {
    return (
      <SettingsFormIntro>
        {t('ai.branchProfile.noBranch')} {t('ai.branchProfile.restartHint')}
      </SettingsFormIntro>
    );
  }

  const branchOptions = [
    ...(defaultBranchId && !profileList.some(p => p.branchId === defaultBranchId)
      ? [{ branchId: defaultBranchId, label: `${defaultBranchId} (Inauzwa)` }]
      : []),
    ...profileList.map(p => ({
      branchId: p.branchId,
      label: p.branchName ?? p.businessName ?? p.branchId,
    })),
  ];

  return (
    <>
      {isLoading ? (
        <div className="settings-integration-loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <>
          <SettingsFormCard
            icon="domain"
            title={t('ai.branchProfile.sectionBusiness')}
            actions={
              editing ? (
                <>
                  <SettingsFormCardHeadButton
                    icon="close"
                    onClick={() => {
                      hydrateFromProfile();
                      setEditing(false);
                    }}
                  >
                    {t('common.cancel')}
                  </SettingsFormCardHeadButton>
                  <SettingsFormCardHeadButton
                    icon="save"
                    disabled={saveProfileMutation.isPending}
                    onClick={() => saveProfileMutation.mutate()}
                  >
                    {saveProfileMutation.isPending ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : null}
                    {t('common.save')}
                  </SettingsFormCardHeadButton>
                </>
              ) : (
                <SettingsFormCardHeadButton icon="edit" onClick={() => setEditing(true)}>
                  {t('ai.branchProfile.edit')}
                </SettingsFormCardHeadButton>
              )
            }
          >
            <SettingsFormIntro>{t('ai.branchProfile.locationLearningHint')}</SettingsFormIntro>

            {editing ? (
              <SettingsFormGrid>
                <SettingsFormSection title={t('ai.branchProfile.sectionBranchIdentity')}>
                  <SettingsFormEditField label={t('ai.branchProfile.branchSelector')}>
                    <select
                      id="branch-profile-select"
                      value={branchId}
                      onChange={e => setSelectedBranchId(e.target.value)}
                    >
                      {branchOptions.map(opt => (
                        <option key={opt.branchId} value={opt.branchId}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.businessName')}>
                    <input value={businessName} onChange={e => setBusinessName(e.target.value)} />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.branchName')}>
                    <input value={branchName} onChange={e => setBranchName(e.target.value)} />
                  </SettingsFormEditField>
                </SettingsFormSection>

                <SettingsFormSection title={t('ai.branchProfile.sectionAiProfile')}>
                  <SettingsFormEditField label={t('ai.branchProfile.aiDisplayName')}>
                    <input value={aiDisplayName} onChange={e => setAiDisplayName(e.target.value)} />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.aiTone')}>
                    <input value={aiTone} onChange={e => setAiTone(e.target.value)} />
                  </SettingsFormEditField>
                </SettingsFormSection>

                <SettingsFormSection title={t('ai.branchProfile.sectionLocationHours')}>
                  <SettingsFormEditField label={t('ai.branchProfile.locationDescription')}>
                    <textarea
                      rows={4}
                      value={locationDescription}
                      onChange={e => setLocationDescription(e.target.value)}
                    />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.nearbyLandmarks')}>
                    <textarea
                      rows={2}
                      value={nearbyLandmarks}
                      onChange={e => setNearbyLandmarks(e.target.value)}
                    />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.openingHours')}>
                    <input value={openingHours} onChange={e => setOpeningHours(e.target.value)} />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.googleMapsUrl')}>
                    <input value={googleMapsUrl} onChange={e => setGoogleMapsUrl(e.target.value)} />
                  </SettingsFormEditField>
                </SettingsFormSection>

                <SettingsFormSection title={t('ai.branchProfile.sectionContactPolicies')}>
                  <SettingsFormEditField label={t('ai.branchProfile.phoneNumbers')}>
                    <textarea
                      rows={2}
                      placeholder="0712378850"
                      value={phoneNumbers}
                      onChange={e => setPhoneNumbers(e.target.value)}
                    />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.deliveryPolicy')}>
                    <textarea
                      rows={2}
                      value={deliveryPolicy}
                      onChange={e => setDeliveryPolicy(e.target.value)}
                    />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.warrantyPolicy')}>
                    <textarea
                      rows={2}
                      value={warrantyPolicy}
                      onChange={e => setWarrantyPolicy(e.target.value)}
                    />
                  </SettingsFormEditField>
                  <SettingsFormEditField label={t('ai.branchProfile.installmentPolicyDefault')}>
                    <textarea
                      rows={3}
                      value={installmentPolicyDefault}
                      onChange={e => setInstallmentPolicyDefault(e.target.value)}
                    />
                  </SettingsFormEditField>
                </SettingsFormSection>
              </SettingsFormGrid>
            ) : (
              <SettingsFormGrid>
                <SettingsFormSection title={t('ai.branchProfile.sectionBranchIdentity')}>
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.branchSelector')}
                    value={branchName || branchId}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.businessName')}
                    value={businessName}
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.branchName')}
                    value={branchName}
                    empty={notSpecified}
                  />
                </SettingsFormSection>

                <SettingsFormSection title={t('ai.branchProfile.sectionAiProfile')}>
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.aiDisplayName')}
                    value={aiDisplayName}
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.aiTone')}
                    value={aiTone}
                    variant="pill"
                    empty={notSpecified}
                  />
                </SettingsFormSection>

                <SettingsFormSection title={t('ai.branchProfile.sectionLocationHours')}>
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.locationDescription')}
                    value={locationDescription}
                    variant="body"
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.nearbyLandmarks')}
                    value={nearbyLandmarks}
                    variant="body"
                    empty={t('ai.branchProfile.noLandmarks')}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.openingHours')}
                    value={openingHours}
                    variant="body"
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.googleMapsUrl')}
                    value={googleMapsUrl}
                    variant="body"
                    empty={notLinked}
                  />
                </SettingsFormSection>

                <SettingsFormSection title={t('ai.branchProfile.sectionContactPolicies')}>
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.phoneNumbers')}
                    value={phoneDisplay}
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.deliveryPolicy')}
                    value={deliveryPolicy}
                    variant="body"
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.warrantyPolicy')}
                    value={warrantyPolicy}
                    variant="body"
                    empty={notSpecified}
                  />
                  <SettingsFormDisplayField
                    label={t('ai.branchProfile.installmentPolicyDefault')}
                    value={installmentPolicyDefault}
                    variant="body"
                    empty={notSpecified}
                  />
                </SettingsFormSection>
              </SettingsFormGrid>
            )}
          </SettingsFormCard>

          <SettingsFormCard icon="payments" title={t('ai.branchProfile.paymentAccounts')}>
            <SettingsFormIntro>{t('ai.branchProfile.paymentEmptyHint')}</SettingsFormIntro>

            <button
              type="button"
              className="settings-form-btn-outline"
              onClick={() => {
                setNewPayment(p => ({
                  ...p,
                  methodType: 'mobile_money',
                  providerName: 'M-Pesa',
                  accountName: p.accountName || businessName || 'Inauzwa',
                  instructions: t('ai.branchProfile.mpesaInstructionsDefault'),
                  isActive: true,
                  isDefault: true,
                }));
                accountNumberRef.current?.focus();
              }}
            >
              {t('ai.branchProfile.fillMpesaTemplate')}
            </button>

            <div className="settings-form-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="settings-form-table">
                <thead>
                  <tr>
                    <th>{t('ai.branchProfile.providerName')}</th>
                    <th>{t('ai.branchProfile.accountName')}</th>
                    <th>{t('ai.branchProfile.tableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentAccounts.length === 0 ? (
                    <tr>
                      <td className="settings-form-table__empty" colSpan={2}>
                        {t('ai.branchProfile.noProvidersYet')}
                      </td>
                      <td className="settings-form-table__empty" style={{ textAlign: 'right' }}>
                        —
                      </td>
                    </tr>
                  ) : (
                    paymentAccounts.map((account: BranchPaymentAccount) => (
                      <tr key={account.id}>
                        <td>
                          {account.providerName ?? account.methodType}
                          {account.isDefault ? (
                            <span className="settings-wa__nav-card-admin" style={{ marginLeft: 8 }}>
                              {t('ai.branchProfile.default')}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {account.accountName} — {account.accountNumber}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="settings-form-payment-row" style={{ padding: 0, border: 0, justifyContent: 'flex-end' }}>
                            <label className="settings-form-field__value--body">
                              <input
                                type="checkbox"
                                checked={account.isActive}
                                onChange={e =>
                                  updatePaymentMutation.mutate({ ...account, isActive: e.target.checked })
                                }
                              />{' '}
                              {t('ai.branchProfile.active')}
                            </label>
                            <label className="settings-form-field__value--body">
                              <input
                                type="checkbox"
                                checked={account.isDefault}
                                onChange={e =>
                                  updatePaymentMutation.mutate({ ...account, isDefault: e.target.checked })
                                }
                              />{' '}
                              {t('ai.branchProfile.setDefault')}
                            </label>
                            <button
                              type="button"
                              className="settings-form-table__link"
                              onClick={() => deletePaymentMutation.mutate(account.id)}
                              aria-label={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="settings-form-add-grid">
              <SettingsIntField label={t('ai.branchProfile.providerName')}>
                <input
                  value={newPayment.providerName ?? ''}
                  onChange={e => setNewPayment(p => ({ ...p, providerName: e.target.value }))}
                />
              </SettingsIntField>
              <SettingsIntField label={t('ai.branchProfile.accountName')}>
                <input
                  value={newPayment.accountName}
                  onChange={e => setNewPayment(p => ({ ...p, accountName: e.target.value }))}
                />
              </SettingsIntField>
              <SettingsIntField label={t('ai.branchProfile.accountNumber')}>
                <input
                  ref={accountNumberRef}
                  value={newPayment.accountNumber}
                  onChange={e => setNewPayment(p => ({ ...p, accountNumber: e.target.value }))}
                  placeholder={t('ai.branchProfile.accountNumberPlaceholder')}
                />
              </SettingsIntField>
            </div>

            <div className="settings-form-toolbar">
              <button
                type="button"
                className="settings-form-btn-outline"
                disabled={
                  addPaymentMutation.isPending ||
                  !newPayment.accountName ||
                  !newPayment.accountNumber
                }
                onClick={() => addPaymentMutation.mutate()}
              >
                <Plus size={14} />
                {t('ai.branchProfile.addPayment')}
              </button>
            </div>
          </SettingsFormCard>
        </>
      )}
    </>
  );
}
