import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import type { SettingsSection } from './settings-nav-registry';
import { useRegisterSettingsShellActions } from './settings-shell-actions';
import { SettingsFormPage } from './shell/SettingsFormPrimitives';
import { SettingsAskAiButton, settingsAskAiPromptForPanel } from './SettingsAskAiButton';
import './settings-integration-shell.css';

type Props = {
  onBack: () => void;
  /** Sidebar section shown in the breadcrumb back link. Defaults to integrations. */
  backSection?: SettingsSection;
  title: string;
  description?: string;
  status?: ReactNode;
  headerActions?: ReactNode;
  /** When set, prepends an Ask AI deep link using SETTINGS_ASK_AI_PROMPTS. */
  askAiPanelId?: string;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  /** Hide breadcrumb toolbar + hero; use outer SettingsShell chrome instead. */
  chromeless?: boolean;
  /** Wrap chromeless children in wide form layout. Default true. */
  formLayout?: boolean;
  formTitle?: string;
  formIcon?: string;
  formIntro?: ReactNode;
  children: ReactNode;
};

export function SettingsIntegrationShell({
  onBack,
  backSection = 'integrations',
  title,
  description,
  status,
  headerActions,
  askAiPanelId,
  onSave,
  saveLabel,
  saveDisabled,
  isSaving,
  isDirty,
  chromeless = false,
  formLayout = true,
  formTitle,
  formIcon,
  formIntro,
  children,
}: Props) {
  const { t } = useTranslation();

  const askAiPrompt = askAiPanelId ? settingsAskAiPromptForPanel(askAiPanelId) : undefined;
  const mergedHeaderActions =
    askAiPrompt || headerActions ? (
      <>
        {askAiPrompt ? <SettingsAskAiButton prompt={askAiPrompt} /> : null}
        {headerActions}
      </>
    ) : undefined;

  const handleCancel = () => {
    if (isDirty && !window.confirm(t('ai.settings.unsavedConfirm'))) return;
    onBack();
  };

  useRegisterSettingsShellActions(
    chromeless && onSave
      ? {
          showSaveBar: true,
          onSave,
          onCancel: handleCancel,
          saving: isSaving,
          saveDisabled: saveDisabled || isDirty === false,
          saveLabel: saveLabel ?? t('settings.shell.saveChanges'),
        }
      : null,
  );

  if (chromeless) {
    return (
      <div className="settings-int-shell settings-int-shell--chromeless">
        {mergedHeaderActions ? (
          <div className="settings-int-shell__inline-actions">{mergedHeaderActions}</div>
        ) : null}
        {status ? <div className="settings-int-shell__status">{status}</div> : null}
        <div className="settings-embed-scroll">
          {formLayout !== false ? (
            <SettingsFormPage wide title={formTitle} icon={formIcon} intro={formIntro}>
              {children}
            </SettingsFormPage>
          ) : (
            children
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="settings-int-shell">
      <div className="settings-int-toolbar">
        <div className="settings-int-toolbar__crumb">
          <button type="button" className="settings-int-toolbar__parent" onClick={handleCancel}>
            {t(`settings.sections.${backSection}`)}
          </button>
          <MaterialSymbol name="chevron_right" size={16} />
          <span className="settings-int-toolbar__current">{title}</span>
        </div>
        <div className="settings-int-toolbar__actions">
          {mergedHeaderActions}
          <button type="button" className="fu-btn fu-btn--ghost fu-btn--sm" onClick={handleCancel}>
            {t('common.cancel')}
          </button>
          {onSave && (
            <button
              type="button"
              className="fu-btn fu-btn--primary fu-btn--sm"
              disabled={saveDisabled || isSaving || isDirty === false}
              onClick={onSave}
            >
              {isSaving ? <Loader2 className="animate-spin" size={14} /> : null}
              {saveLabel ?? t('ai.settings.saveAll')}
            </button>
          )}
        </div>
      </div>

      <section className="settings-int-hero">
        <div className="settings-int-hero__text">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {status}
      </section>

      {children}
    </div>
  );
}

export function SettingsIntegrationStatusCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="settings-int-status">
      <div className="settings-int-status__icon">
        <MaterialSymbol name={icon} size={20} filled />
      </div>
      <div>
        <div className="settings-int-status__label">{label}</div>
        <div className="settings-int-status__value">{value}</div>
      </div>
    </div>
  );
}

export function SettingsIntField({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`settings-int-field${full ? ' settings-int-form-grid__full' : ''}`}>
      <label className="settings-int-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function SettingsIntegrationCard({
  title,
  icon,
  actions,
  children,
  className,
}: {
  title?: string;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const showHead = title || actions;
  return (
    <div
      className={`settings-int-card settings-form-card${showHead ? '' : ' settings-int-card--solo'}${className ? ` ${className}` : ''}`}
    >
      {showHead ? (
        <header className="settings-int-card__head settings-form-card__head">
          {title ? (
            <h3 className="settings-int-card__title settings-form-card__title">
              {icon ? <MaterialSymbol name={icon} size={22} filled /> : null}
              {title}
            </h3>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      <div className="settings-int-card__body">{children}</div>
    </div>
  );
}
