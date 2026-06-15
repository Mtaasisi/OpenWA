interface Props {
  name: string;
  className?: string;
  size?: number;
  filled?: boolean;
  weight?: number;
  spin?: boolean;
  style?: React.CSSProperties;
}

/** Google Material Symbols Outlined (loaded in index.html). */
export function MaterialSymbol({
  name,
  className,
  size = 20,
  filled = false,
  weight = 400,
  spin = false,
  style,
}: Props) {
  const iconWeight = filled ? Math.max(weight, 400) : weight;

  return (
    <span
      className={[
        'material-symbols-outlined',
        'inakt-mat-icon',
        spin ? 'inakt-mat-icon--spin' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${iconWeight}, 'GRAD' 0, 'opsz' 20`,
        ...style,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
