import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface NervModalProps {
  open: boolean;
  title: string;
  titleJp: string;
  onClose: () => void;
  children?: React.ReactNode;
}

/** Evangelion-style NERV tactical modal */
export function NervModal({ open, title, titleJp, onClose, children }: NervModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Manage mount/unmount with animation phases
  useEffect(() => {
    if (open) {
      setVisible(true);
      // Tiny delay so CSS transition fires after mount
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className={cn(
        'fixed inset-0 flex items-center justify-center px-4',
        'transition-all duration-300',
        animating ? 'nerv-modal-backdrop-in' : 'nerv-modal-backdrop-out',
      )}
      style={{ zIndex: 50 }}
    >
      {/* Modal box */}
      <div
        className={cn(
          'relative bg-black w-full max-w-lg min-h-[420px]',
          'nerv-modal-box flex flex-col',
          'transition-all duration-300 ease-out',
          animating ? 'nerv-modal-in' : 'nerv-modal-out',
        )}
      >
        {/* Animated scan sweep on open */}
        {animating && <div className="nerv-modal-sweep" />}

        {/* Top status bar */}
        <div className="nerv-modal-statusbar flex items-center justify-between px-4 py-1.5 border-b border-[rgba(0,255,180,0.2)]">
          <div className="flex items-center gap-3">
            <span className="nerv-modal-indicator" />
            <span className="font-mono text-[9px] tracking-[0.25em] text-[rgba(0,255,180,0.5)]">
              SYS:ACTIVE // NERV-NET
            </span>
          </div>
          <span className="font-mono text-[9px] tracking-widest text-[rgba(247,147,26,0.4)]">
            MAGI AUTH OK
          </span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex flex-col gap-0.5">
            {/* Corner tag */}
            <span className="font-mono text-[8px] tracking-[0.3em] text-[rgba(0,255,180,0.35)] mb-1">
              ◈ TERMINAL INPUT
            </span>
            <h2 className="font-display text-[2.8rem] leading-none text-[#f7931a] nerv-modal-title-glow tracking-[0.05em]">
              {title}
            </h2>
            <span className="font-jp text-[13px] text-[rgba(0,255,180,0.45)] tracking-[0.05em] mt-0.5">
              {titleJp}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-1 w-9 h-9 flex items-center justify-center border border-[rgba(0,255,180,0.3)] text-[rgba(0,255,180,0.5)] font-display text-xl tracking-widest hover:border-[rgba(0,255,180,0.8)] hover:text-[rgba(0,255,180,1)] hover:bg-[rgba(0,255,180,0.06)] transition-all duration-150 cursor-pointer nerv-modal-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Divider */}
        <div className="mx-6 mb-5 h-px bg-gradient-to-r from-[rgba(0,255,180,0.6)] via-[rgba(0,255,180,0.15)] to-transparent" />

        {/* Content */}
        <div className="flex-1 px-6 pb-6">
          {children ?? (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-10">
              <span className="font-mono text-[10px] tracking-[0.3em] text-[rgba(0,255,180,0.25)]">
                // AWAITING INPUT
              </span>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="nerv-modal-statusbar flex items-center justify-between px-4 py-1.5 border-t border-[rgba(0,255,180,0.2)]">
          <span className="font-mono text-[8px] tracking-[0.2em] text-[rgba(247,147,26,0.3)]">
            STACKTRIS // ライトニングネットワーク
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-[rgba(0,255,180,0.3)] nerv-modal-blink">
            ◌ STANDBY
          </span>
        </div>

        {/* Corner brackets */}
        <span className="nerv-modal-corner nerv-modal-corner-tl" />
        <span className="nerv-modal-corner nerv-modal-corner-tr" />
        <span className="nerv-modal-corner nerv-modal-corner-bl" />
        <span className="nerv-modal-corner nerv-modal-corner-br" />
      </div>
    </div>
  );
}
