import { CSSProperties } from 'react';

interface DividerProps {
  color: string;       // Tailwind color name (e.g. 'bitcoin', 'teal') or raw CSS value (e.g. '#f7931a')
  height?: number;     // px, defaults to 4
  className?: string;
  style?: CSSProperties;
}

function resolveColor(color: string): string {
  const isRaw = color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl') || color.startsWith('var(');
  return isRaw ? color : `var(--color-${color})`;
}

export function Divider({ color, height = 4, className, style }: DividerProps) {
  const resolved = resolveColor(color);
  return (
    <div
      className={className}
      style={{
        backgroundColor: resolved,
        height: `${height}px`,
        boxShadow: `0 0 6px ${resolved}, 0 0 18px color-mix(in srgb, ${resolved} 50%, transparent)`,
        ...style,
      }}
    />
  );
}
