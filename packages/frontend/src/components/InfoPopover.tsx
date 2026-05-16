import { useState } from 'react';

type Props = { description: string };

export function InfoPopover({ description }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-[18px] h-[18px] rounded-full border border-[rgba(0,255,180,0.25)] text-[rgba(0,255,180,0.35)] font-mono text-[10px] flex items-center justify-center hover:border-teal hover:text-teal transition-colors cursor-default select-none">
        ?
      </button>
      {visible && (
        <div className="absolute left-6 bottom-0 z-50 w-56 bg-black border border-[rgba(0,255,180,0.2)] px-3 py-2 pointer-events-none">
          <div className="absolute -left-1.5 top-2 w-2.5 h-px bg-[rgba(0,255,180,0.2)]" />
          <p className="font-mono text-[10px] text-[rgba(0,255,180,0.55)] leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
}
