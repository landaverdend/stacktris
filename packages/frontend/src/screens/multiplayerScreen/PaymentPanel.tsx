import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { launchPaymentModal } from "@getalby/bitcoin-connect-react";

interface PaymentPanelProps {
  bolt11: string | undefined;
  paid: boolean;
}

export function PaymentPanel({ bolt11, paid }: PaymentPanelProps) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!bolt11) return;
    navigator.clipboard.writeText(bolt11).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const pay = () => {
    if (!bolt11) return;
    launchPaymentModal({ invoice: bolt11 });
  };

  return (
    <div className="border-b border-[rgba(0,255,180,0.08)]">
      {/* Drawer toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-[rgba(0,255,180,0.03)] transition-colors cursor-pointer"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">
            {paid ? 'PAYMENT' : 'PAY INVOICE'}
          </span>
          <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">支払い</span>
        </div>
        <div className="flex items-center gap-3">
          {paid && (
            <span className="font-display font-bold text-xl tracking-[0.02em] text-magi">CONFIRMED</span>
          )}
          <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/40">
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Drawer body */}
      {open && (
        paid ? (
          <div className="flex flex-col items-center gap-1 px-5 pb-5 pt-2">
            <span className="font-display font-bold text-2xl tracking-[0.02em] text-magi">PAYMENT RECEIVED</span>
            <span className="font-jp text-[13px] text-[rgba(0,255,180,0.3)] mt-0.5">入金確認済み</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-5 pb-4">
            {bolt11 ? (
              <div className="p-2 bg-white">
                <QRCodeSVG value={`lightning:${bolt11}`} size={180} />
              </div>
            ) : (
              <div className="w-[196px] h-[196px] bg-[rgba(0,255,180,0.04)] animate-pulse" />
            )}

            <button
              onClick={copy}
              disabled={!bolt11}
              className="w-full py-2 font-display font-bold text-xl tracking-[0.02em] border border-[rgba(0,255,180,0.2)] text-phosphor/60 hover:border-teal hover:text-teal transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {copied ? '✓ COPIED' : 'COPY INVOICE'}
            </button>

            <button
              onClick={pay}
              disabled={!bolt11}
              className="w-full py-2 font-display font-bold text-xl tracking-[0.02em] border border-bitcoin/40 text-bitcoin/80 hover:border-bitcoin hover:text-bitcoin transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ⚡ PAY WITH WALLET
            </button>
          </div>
        )
      )}
    </div>
  );
}
