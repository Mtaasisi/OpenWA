import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';

type FileItem = { path: string; size?: number; updatedAt?: string };

type SearchHit = { path: string; snippet: string };

type Props = {
  files: FileItem[];
  filesLoading?: boolean;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  content: string;
  onChangeContent: (value: string) => void;
  fileLoading?: boolean;
  loadError?: string | null;
  onSave: () => void;
  saving?: boolean;
  variant?: 'default' | 'split';
  searchQ?: string;
  onSearchChange?: (value: string) => void;
  searchFetching?: boolean;
  searchResults?: SearchHit[];
  onClearSearch?: () => void;
  lastEditedLabel?: string | null;
  filesGroupLabel?: string;
  markdownBadgeLabel?: string;
};

export function SettingsDocumentEditor({
  files,
  filesLoading,
  selectedPath,
  onSelectPath,
  content,
  onChangeContent,
  fileLoading,
  loadError,
  onSave,
  saving,
  variant = 'default',
  searchQ = '',
  onSearchChange,
  searchFetching,
  searchResults = [],
  onClearSearch,
  lastEditedLabel,
  filesGroupLabel,
  markdownBadgeLabel,
}: Props) {
  const { t } = useTranslation();

  const filteredFiles = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q || q.length < 2) return files;
    return files.filter(f => f.path.toLowerCase().includes(q));
  }, [files, searchQ]);

  if (variant === 'split') {
    return (
      <div className="settings-doc-editor settings-doc-editor--split">
        <aside className="settings-doc-sidebar">
          {onSearchChange ? (
            <div className="settings-doc-sidebar__search">
              <div className="settings-doc-sidebar__search-wrap">
                <MaterialSymbol name="search" size={18} />
                <input
                  id="ai-knowledge-search"
                  type="search"
                  value={searchQ}
                  onChange={e => onSearchChange(e.target.value)}
                  placeholder={t('ai.knowledge.searchPlaceholder')}
                />
              </div>
            </div>
          ) : null}
          {searchFetching ? (
            <p className="settings-hint settings-doc-sidebar__hits" style={{ padding: '0.5rem 1rem' }}>
              <Loader2 className="animate-spin" size={14} /> …
            </p>
          ) : null}
          {searchQ.trim().length >= 2 && searchResults.length > 0 ? (
            <ul className="settings-doc-search-hits settings-doc-sidebar__hits">
              {searchResults.map(r => (
                <li key={r.path}>
                  <button
                    type="button"
                    className="settings-doc-search-hit"
                    onClick={() => {
                      onSelectPath(r.path);
                      onClearSearch?.();
                    }}
                  >
                    <strong>{r.path}</strong> — {r.snippet}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="settings-doc-sidebar__scroll">
            <div className="settings-doc-sidebar__group-label">
              {filesGroupLabel ?? t('ai.knowledge.documentationGroup')}
            </div>
            {filesLoading ? (
              <Loader2 className="animate-spin" size={20} style={{ margin: '1rem' }} />
            ) : (
              <ul className="settings-doc-files">
                {filteredFiles.map(f => (
                  <li key={f.path}>
                    <button
                      type="button"
                      className={`settings-doc-file${selectedPath === f.path ? ' is-active' : ''}`}
                      onClick={() => onSelectPath(f.path)}
                    >
                      <MaterialSymbol
                        name="article"
                        size={18}
                        filled={selectedPath === f.path}
                      />
                      <span>{f.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        <div className="settings-doc-main settings-doc-main--split">
          <div className="settings-doc-main__toolbar">
            <div className="settings-doc-main__toolbar-left">
              <MaterialSymbol name="description" size={20} />
              <span className="settings-doc-main__filename">{selectedPath}</span>
              <span className="settings-doc-main__badge">
                {markdownBadgeLabel ?? t('ai.knowledge.markdownBadge')}
              </span>
            </div>
            <div className="settings-doc-main__toolbar-right">
              {lastEditedLabel ? (
                <span className="settings-doc-main__edited">{lastEditedLabel}</span>
              ) : null}
              <button
                type="button"
                className="settings-doc-main__save"
                disabled={saving || fileLoading}
                onClick={onSave}
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <MaterialSymbol name="save" size={18} />}
                {t('common.save')}
              </button>
            </div>
          </div>
          <div className="settings-doc-main__content">
            {fileLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : loadError ? (
              <p className="settings-hint settings-hint--err">{loadError}</p>
            ) : (
              <textarea
                className="settings-int-field settings-doc-textarea"
                value={content}
                onChange={e => onChangeContent(e.target.value)}
                spellCheck={false}
                placeholder={
                  content.trim().length === 0 ? t('ai.knowledge.emptyFileHint') : undefined
                }
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-doc-editor">
      <aside>
        {filesLoading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <ul className="settings-doc-files">
            {files.map(f => (
              <li key={f.path}>
                <button
                  type="button"
                  className={`settings-doc-file${selectedPath === f.path ? ' is-active' : ''}`}
                  onClick={() => onSelectPath(f.path)}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="settings-doc-main">
        <div className="settings-doc-main__bar">
          <span className="settings-doc-main__path">{selectedPath}</span>
          <button
            type="button"
            className="fu-btn fu-btn--primary fu-btn--sm"
            disabled={saving || fileLoading}
            onClick={onSave}
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <MaterialSymbol name="save" size={14} />}
            {t('common.save')}
          </button>
        </div>
        {fileLoading ? (
          <Loader2 className="animate-spin" size={24} />
        ) : loadError ? (
          <p className="settings-hint settings-hint--err">{loadError}</p>
        ) : (
          <textarea
            className="settings-int-field settings-doc-textarea"
            value={content}
            onChange={e => onChangeContent(e.target.value)}
            spellCheck={false}
            placeholder={
              content.trim().length === 0 ? t('ai.knowledge.emptyFileHint') : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
