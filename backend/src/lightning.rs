/// Lightning Network integration stubs.
///
/// Replace these with a real LN implementation using:
/// - LDK (Lightning Development Kit) for self-custodial
/// - lnd gRPC client (tonic)
/// - CLN via grpc-plugin
/// - Or a hosted API like Strike / Voltage / OpenNode

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub bolt11: String,
    pub payment_hash: String,
    pub amount_sats: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    Pending,
    Paid,
    Expired,
}

/// Create a Lightning invoice for the given amount.
/// Returns a BOLT-11 encoded invoice string and payment hash.
pub async fn create_invoice(amount_sats: u64, memo: &str) -> anyhow::Result<Invoice> {
    // TODO: integrate with your Lightning node
    // Example with LND via tonic:
    //   lnd_client.add_invoice(Invoice { value: amount_sats as i64, memo: memo.to_string(), ..Default::default() }).await?
    tracing::warn!("create_invoice: STUB returning fake invoice for {} sats ({})", amount_sats, memo);
    Ok(Invoice {
        bolt11: format!("lnbc{}n1stub_invoice_replace_with_real_implementation", amount_sats),
        payment_hash: format!("stub_hash_{}", uuid::Uuid::new_v4()),
        amount_sats,
    })
}

/// Poll / check whether an invoice has been paid.
pub async fn check_invoice(payment_hash: &str) -> anyhow::Result<InvoiceStatus> {
    // TODO: query your Lightning node for payment status
    tracing::warn!("check_invoice: STUB, hash={}", payment_hash);
    Ok(InvoiceStatus::Pending)
}

/// Send a payment to a BOLT-11 invoice (pay winner).
pub async fn pay_invoice(bolt11: &str) -> anyhow::Result<String> {
    // TODO: call send_payment on your LN node
    tracing::warn!("pay_invoice: STUB, invoice={}", bolt11);
    Ok("stub_preimage".to_string())
}
