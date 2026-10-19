import { ICON_PATHS, type IconName } from './icons/iconPaths';

interface IconProps {
  name: IconName;
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
  /** Accessible label; omit for decorative icons next to visible text. */
  label?: string;
}

/** Renders one Material Symbols glyph as inline SVG using the current text colour. */
export function Icon({ name, size = 24, className, label }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
