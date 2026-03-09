# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Rust backend ───────────────────────────────────────────────
FROM rust:1.85-slim AS backend-builder

WORKDIR /app

# Cache dependency compilation separately from source changes
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release --bin stacktris
RUN rm -rf src

# Build the real source
COPY backend/src ./src
# Touch main.rs so cargo sees the source as changed
RUN touch src/main.rs
RUN cargo build --release --bin stacktris

# ── Stage 3: Minimal runtime image ───────────────────────────────────────────
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-builder /app/target/release/stacktris ./stacktris
COPY --from=frontend-builder /app/frontend/dist ./dist

EXPOSE 3000

ENV RUST_LOG=info

CMD ["./stacktris"]
