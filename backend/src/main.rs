mod game;
mod protocol;
mod room;
mod session;

use axum::{extract::State, routing::get, Json, Router};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use room::RoomRegistry;
use session::SessionRegistry;

#[derive(Clone)]
pub struct AppState {
    pub sessions: Arc<SessionRegistry>,
    pub rooms: Arc<RoomRegistry>,
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
        sessions: Arc::new(SessionRegistry::new()),
        rooms: Arc::new(RoomRegistry::new()),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let static_files = ServeDir::new("dist")
        .not_found_service(ServeFile::new("dist/index.html"));

    let app = Router::new()
        .route("/health", get(health))
        .route("/rooms", get(list_rooms))
        .route("/ws", get(session::ws_handler))
        .fallback_service(static_files)
        .layer(cors)
        .with_state(state);

    let addr = "0.0.0.0:3000";
    tracing::info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "ok"
}

async fn list_rooms(State(state): State<AppState>) -> Json<Vec<room::LobbyEntry>> {
    let mut rooms = state.rooms.list_open();
    // Newest first.
    rooms.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Json(rooms)
}
