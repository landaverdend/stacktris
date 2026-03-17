import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface NervModalProps {
  open: boolean;
  title: string;
  titleJp: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export function NervModal({ open, title, titleJp, onClose, children }: NervModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {

    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
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
      <div
        className={cn(
          'relative bg-black w-full max-w-lg flex flex-col gap-5',
          'nerv-border nerv-border-teal',
          'transition-all duration-300 ease-out',
          animating ? 'nerv-modal-in' : 'nerv-modal-out',
        )}
      >
        {/* Scan sweep */}
        {animating && <div className="nerv-modal-sweep" />}

        {/* Title */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="w-full flex flex-col gap-0.5 items-center">
            <h2 className="font-display text-6xl leading-none text-teal font-bold tracking-[0.05em]" style={{ textShadow: '0 0 8px rgba(0,170,85,0.7), 0 0 24px rgba(0,170,85,0.3)' }}>
              {title}
            </h2>
            <span className="font-jp text-[20px] text-teal tracking-[0.05em] font-bold">{titleJp}</span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center self-start text-teal font-display text-xl font-bold hover:border-[rgba(0,255,180,0.8)] hover:text-[rgba(0,255,180,1)] transition-all duration-150 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Divider */}
        {/* <div className="mx-6 mb-5 mt-3 h-[2px] bg-teal" /> */}
        <div className="self-center w-8/10 bg-bitcoin" style={{ height: '4px', boxShadow: '0 0 6px rgba(247,147,26,0.9), 0 0 18px rgba(247,147,26,0.5)' }} />

        {/* Content */}
        <div className="px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
