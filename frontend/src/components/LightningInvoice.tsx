import React from 'react';

interface Props {
  invoice: string;
  amountSats: number;
  onPaid?: () => void;
}

export const LightningInvoice: React.FC<Props> = ({ invoice, amountSats }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(invoice).catch(() => {});
  };

  const truncated = invoice.length > 40
    ? `${invoice.slice(0, 20)}...${invoice.slice(-20)}`
    : invoice;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.bolt}>⚡</span>
        <span style={styles.amount}>{amountSats.toLocaleString()} sats</span>
      </div>
      <p style={styles.label}>Pay this Lightning invoice to join:</p>
      <div style={styles.invoiceBox}>
        <code style={styles.invoice}>{truncated}</code>
      </div>
      <div style={styles.actions}>
        <button style={styles.copyBtn} onClick={handleCopy}>
          Copy Invoice
        </button>
        <a
          href={`lightning:${invoice}`}
          style={styles.walletBtn}
        >
          Open in Wallet
        </a>
      </div>
      <p style={styles.waiting}>Waiting for payment confirmation...</p>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    maxWidth: '400px',
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  bolt: {
    fontSize: '1.5rem',
  },
  amount: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#f7931a',
  },
  label: {
    color: '#888',
    fontSize: '0.85rem',
  },
  invoiceBox: {
    background: '#0a0a0a',
    border: '1px solid #222',
    borderRadius: '4px',
    padding: '0.75rem',
    width: '100%',
    overflowX: 'hidden',
  },
  invoice: {
    color: '#aaa',
    fontSize: '0.75rem',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
  },
  copyBtn: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f0f0f0',
    padding: '0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  walletBtn: {
    flex: 1,
    background: '#f7931a',
    color: '#000',
    padding: '0.5rem',
    borderRadius: '4px',
    textDecoration: 'none',
    textAlign: 'center',
    fontWeight: 'bold',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
  },
  waiting: {
    color: '#555',
    fontSize: '0.8rem',
    animation: 'pulse 2s infinite',
  },
};
