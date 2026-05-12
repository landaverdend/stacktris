export function NervButton({ onClick, children, disabled }: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-full py-3 border border-[rgba(0,255,180,0.4)] text-phosphor font-display font-bold text-4xl tracking-[0.02em] hover:border-[rgba(0,255,180,0.8)] hover:text-teal transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer">
      {children}
    </button>
  );
}
