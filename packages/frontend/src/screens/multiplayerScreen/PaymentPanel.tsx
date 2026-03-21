import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { launchPaymentModal } from "@getalby/bitcoin-connect-react";

interface PaymentPanelProps {
  bolt11: string;
}

export function PaymentPanel({ bolt11 }: PaymentPanelProps) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(bolt11).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const pay = () => {
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
          <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">PAY INVOICE</span>
          <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">支払い</span>
        </div>
        <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/40">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Drawer body */}
      {open && (
        <div className="flex flex-col items-center gap-3 px-5 pb-4">
          {/* QR code */}
          <div className="p-2 bg-white">
            <QRCodeSVG value={`lightning:${bolt11}`} size={180} />
          </div>

          {/* Copy invoice */}
          <button
            onClick={copy}
            className="w-full py-2 font-display font-bold text-xl tracking-[0.02em] border border-[rgba(0,255,180,0.2)] text-phosphor/60 hover:border-teal hover:text-teal transition-colors cursor-pointer"
          >
            {copied ? '✓ COPIED' : 'COPY INVOICE'}
          </button>

          {/* Pay with wallet */}
          <button
            onClick={pay}
            className="w-full py-2 font-display font-bold text-xl tracking-[0.02em] border border-bitcoin/40 text-bitcoin/80 hover:border-bitcoin hover:text-bitcoin transition-colors cursor-pointer"
          >
            ⚡ PAY WITH WALLET
          </button>
        </div>
      )}
    </div>
  );
}
