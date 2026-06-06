# Kapital — Backend

API REST para sistema de gestión de Casa de Cambios. Maneja transacciones de divisas, reportes, colaboradores y notificaciones vía WhatsApp.

## Stack

- **Runtime:** Node.js + TypeScript
- **Base de datos:** Neon (PostgreSQL serverless)
- **Auth:** Firebase Admin
- **WhatsApp:** Evolution API (webhooks)
- **Deploy:** Docker / VPS

## Arquitectura

```
src/
├── handlers/       # Controladores HTTP
├── services/       # Lógica de negocio
├── repositories/   # Acceso a base de datos
├── domain/         # Tipos y modelos
├── middleware/     # Auth y validaciones
└── config/         # Variables de entorno
migrations/         # Migraciones SQL
```

## Setup

```bash
pnpm install
cp .env.example .env  # Configura tus variables
pnpm run migrate      # Ejecuta migraciones
pnpm run dev
```

## Variables de entorno

Ver `.env.example` para la lista completa de variables requeridas.

## Tests

```bash
pnpm test
```
