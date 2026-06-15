import { Search } from 'lucide-react';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  className = '',
}: SearchInputProps) {
  return (
    <div className={`ws-search-input ${className}`.trim()}>
      <Search size={16} className="ws-search-input__icon" />
      <input
        type="search"
        className="ws-search-input__field"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}
