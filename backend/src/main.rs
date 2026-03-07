mod game;
mod lightning;
mod ws;

use axum::{
    Router,
    routing::get,
};
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::game::GameRegistry;

#[derive(Clone)]
pub struct AppState {
    pub games: Arc<GameRegistry>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "stacktris=debug,info".parse().unwrap()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState {
        games: Arc::new(GameRegistry::new()),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws::ws_handler))
        .layer(cors)
        .with_state(state);

    let addr = "0.0.0.0:3000";
    tracing::info!("Stacktris listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "ok"
}
