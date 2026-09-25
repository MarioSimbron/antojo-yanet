# Antojo de Yanet

Sistema de pedidos y encargos para una panadería artesanal. Incluye tienda web, asistente IA (Yanet), seguimiento en tiempo real vía WebSockets, y dashboard de operaciones para staff.

## Stack

| Capa | Tecnología |
|---|---|
| API | Node.js 20 + Express + Apollo Server (GraphQL) + Socket.IO |
| Base de datos | MySQL 8 + Prisma ORM |
| Frontend | React 18 + Vite + Material UI + Zustand + Apollo Client |
| IA | Groq API (llama-3.3-70b-versatile) + RAG con docs .md |
| Infraestructura | Docker Compose (mysql, adminer, api, web) |

## Levantamiento rápido

### Prerrequisitos

- Docker Desktop instalado y corriendo
- Node.js 20+ (para el seed y las herramientas de desarrollo)

### 1. Clonar y configurar

```bash
git clone <repo>
cd antojo-yanet
cp .env.example .env
```

Edita `.env` y configura al menos:
- `MYSQL_ROOT_PASSWORD` (cualquier valor, ej. `secret`)
- `GROQ_API_KEY` (obtén una en [groq.com](https://console.groq.com) — si la omites, el chatbot Yanet no funcionará pero el resto del sistema sí)

### 2. Levantar el stack

```bash
docker compose up -d
```

Espera ~30 segundos para que MySQL inicie. Los 4 servicios quedan en pie:

| Servicio | URL |
|---|---|
| Web (frontend) | http://localhost:5173 |
| API (GraphQL Playground) | http://localhost:4000/graphql |
| Adminer (BD) | http://localhost:8080 |

### 3. Migrar la base de datos y cargar datos de prueba

```bash
cd api
npm install
npx prisma migrate deploy
npm run seed
```

Esto crea todas las tablas, carga 60+ productos y crea usuarios de prueba para cada rol.

### 4. Verificar

```bash
curl http://localhost:4000/health
# → {"status":"ok"}
```

## Usuarios de prueba (seed)

| Rol | Email | Contraseña |
|---|---|---|
| ADMIN | admin@antojo.mx | Admin123! |
| MAESTRO_PANADERO | panadero@antojo.mx | Pan123! |
| CAJERO | cajero@antojo.mx | Cajero123! |
| REPARTIDOR | repartidor@antojo.mx | Rep123! |
| CLIENTE | cliente@antojo.mx | Cliente123! |

## Comandos útiles

```bash
# Desarrollo local de la API (fuera de Docker, con hot reload)
cd api && npm run dev

# Desarrollo local del frontend
cd web && npm install && npm run dev

# Tests unitarios (API)
cd api && npm test

# Tests con cobertura
cd api && npm run test:coverage

# Prisma Studio (explorador visual de la BD)
cd api && npm run prisma:studio
```

## Flujo demo (hackathon ~6 min)

1. **Guest compra pan**: ir a `/menu` → agregar conchas al carrito → checkout como invitado
2. **Chat con Yanet**: abrir el widget 💬 → preguntar "¿qué encargos tienen?" o "quiero encargar un pastel"
3. **Seguimiento en tiempo real**: con la URL del folio, abrir en otra pestaña
4. **Staff actualiza estatus**: login como `cajero@antojo.mx` → Dashboard → mover el pedido
5. **El seguimiento se actualiza solo** (WebSocket)
6. **Cancelación con revisión**: el cliente solicita cancelar → staff aprueba/rechaza desde Dashboard
7. **Reporte de ventas**: login como admin → Dashboard → Reportes

## Limitaciones (fuera de scope del MVP)

- No hay pasarela de pago real (solo selección de método)
- No hay envío de emails/SMS al cambiar estatus
- Los cupones se generan en BD pero no hay UI de canje aún
- El asistente Yanet no tiene memoria persistente entre sesiones de navegador (se reinicia al limpiar localStorage)
- No hay subida de imágenes para productos
- No hay gestión de repartidores múltiples con geolocalización
- No hay sistema de reseñas ni calificaciones
