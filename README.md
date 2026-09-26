# Antojo de Yanet

Plataforma completa de pedidos y encargos para una panadería artesanal. Incluye tienda web pública, chatbot con IA (DulceBot), seguimiento de pedidos en tiempo real via WebSockets, dashboard de operaciones por rol, notificaciones push y sistema de puntos de lealtad.

---

## Índice

- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura del proyecto](#arquitectura-del-proyecto)
- [Prerrequisitos por sistema operativo](#prerrequisitos-por-sistema-operativo)
- [Configuración inicial (todos los modos)](#configuración-inicial-todos-los-modos)
- [Modo 1 — Docker completo (recomendado para producción / demo)](#modo-1--docker-completo)
- [Modo 2 — Desarrollo local con script dev.sh (recomendado para desarrollo)](#modo-2--desarrollo-local-con-devsh)
- [Modo 3 — Desarrollo manual proceso a proceso](#modo-3--desarrollo-manual-proceso-a-proceso)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [Scripts disponibles](#scripts-disponibles)
- [Usuarios de prueba](#usuarios-de-prueba)
- [Roles y permisos](#roles-y-permisos)
- [Funcionalidades principales](#funcionalidades-principales)
- [URLs del sistema](#urls-del-sistema)
- [Limitaciones actuales (fuera del MVP)](#limitaciones-actuales)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 |
| Lenguaje | TypeScript 5.6 (API y Web) |
| API | Express 4.21 + Apollo Server 4.11 (GraphQL) + Socket.IO 4.8 |
| ORM / BD | Prisma 5.22 + MySQL 8.0 |
| Frontend | React 18.3 + Vite 5.4 + Material UI v9 + Apollo Client 3.11 |
| Estado global | Zustand 5.0 (persistido en localStorage) |
| Formularios | Formik 2.4 + Yup 1.7 |
| IA / LLM | Groq SDK 0.8 (function calling) + RAG sobre documentos .md |
| Push | Web Push VAPID (web-push 3.6) |
| Auth | JWT (access 15min + refresh 7d) + bcryptjs |
| Infraestructura | Docker Compose (mysql, adminer, api, web) |
| Servidor web (prod) | nginx:alpine (sirve el build de React) |
| Tests | Vitest 2.1 + @testing-library/react |

---

## Arquitectura del proyecto

```
antojo-yanet/
├── api/                        # Backend
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos y relaciones de la BD
│   │   ├── migrations/         # Migraciones generadas por Prisma
│   │   ├── seed.ts             # Datos de prueba (productos, usuarios por rol)
│   │   └── init.sql            # SQL ejecutado al iniciar el contenedor MySQL
│   ├── src/
│   │   ├── graphql/            # typeDefs y resolvers por módulo (auth, producto, pedido, etc.)
│   │   ├── lib/                # JWT, bcrypt, Groq, RAG, web-push, menu-generator
│   │   ├── middleware/         # buildContext (extrae usuario o guest del JWT/header)
│   │   └── services/           # Lógica de negocio: máquina de estados, cálculo de totales, etc.
│   ├── docs/                   # Archivos .md cargados en el RAG del chatbot
│   │   └── menu.md             # Generado automáticamente al arrancar el servidor
│   ├── uploads/                # Imágenes de productos subidas via REST
│   ├── tests/                  # Tests unitarios con Vitest
│   ├── Dockerfile.dev          # Imagen de desarrollo (nodemon + tsx)
│   └── nodemon.json            # Configuración de hot reload
├── web/                        # Frontend
│   ├── src/
│   │   ├── components/         # Componentes reutilizables (Layout, ChatWidget, EstatusChip, etc.)
│   │   ├── hooks/              # Custom hooks (usePushNotifications, etc.)
│   │   ├── lib/                # Configuración Apollo Client (con auto-refresh de JWT)
│   │   ├── pages/              # Páginas de la app (Home, Menu, Checkout, Dashboard, etc.)
│   │   └── store/              # Store Zustand (sesión de usuario)
│   ├── public/                 # Assets estáticos
│   ├── Dockerfile              # Imagen de producción (build multi-stage + nginx)
│   └── nginx.conf              # Configuración nginx con SPA fallback y cache de assets
├── docker-compose.yml          # Orquestación de servicios
├── dev.sh                      # Script de arranque para desarrollo local
├── .env.example                # Plantilla de variables de entorno
└── README.md
```

### Servicios Docker

| Servicio | Imagen | Puerto | Descripción |
|---|---|---|---|
| `mysql` | mysql:8.0 | 3306 | Base de datos principal con healthcheck |
| `adminer` | adminer:latest | 8080 | Explorador web de la BD |
| `api` | `./api/Dockerfile.dev` | 4000 | API en modo desarrollo (hot reload) |
| `web` | `./web/Dockerfile` | 5173→80 | Frontend compilado servido por nginx |

---

## Prerrequisitos por sistema operativo

### Prerrequisitos comunes (todos los SO)

- **Docker Desktop** — [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Node.js 20 LTS** — [https://nodejs.org](https://nodejs.org) (necesario para el seed y el modo desarrollo)
- **Git** — [https://git-scm.com](https://git-scm.com)

### Windows

1. Instala **Docker Desktop para Windows** (requiere WSL 2 habilitado).
2. Instala **Git for Windows** — incluye Git Bash, que es necesario para ejecutar `dev.sh`.
3. Instala **Node.js 20** desde nodejs.org.
4. Usa **Git Bash** (no PowerShell ni CMD) para ejecutar el script `dev.sh`.

> Para abrir Git Bash en VS Code: en la barra inferior del terminal, haz clic en el selector de shell y elige "Git Bash".

### macOS

```bash
# Con Homebrew (recomendado)
brew install git node@20
brew install --cask docker
```

Después de instalar Docker Desktop, ábrelo una vez para que complete la configuración.

### Linux (Ubuntu/Debian)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # Añade tu usuario al grupo docker
newgrp docker                   # Aplica el cambio sin reiniciar sesión

# Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20

# Git
sudo apt-get install -y git
```

---

## Configuración inicial (todos los modos)

Estos pasos son necesarios independientemente del modo de arranque que elijas.

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd antojo-yanet
```

### 2. Crear el archivo de entorno

```bash
cp .env.example .env
```

Edita `.env` y configura obligatoriamente:

| Variable | Qué hacer |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Cualquier contraseña segura (ej. `secret`) |
| `JWT_SECRET` | Cadena aleatoria de al menos 32 caracteres |
| `JWT_REFRESH_SECRET` | Otra cadena aleatoria distinta, al menos 32 caracteres |
| `GROQ_API_KEY` | API key de [console.groq.com](https://console.groq.com) — sin esta el chatbot no funciona, pero el resto del sistema sí |

El resto de variables tienen valores por defecto en `.env.example` que funcionan para desarrollo local.

### 3. Instalar dependencias de Node

```bash
# API
cd api && npm install && cd ..

# Frontend
cd web && npm install && cd ..
```

---

## Modo 1 — Docker completo

Levanta los 4 servicios (MySQL, Adminer, API y Web) completamente en Docker. El frontend se sirve como build estático via nginx; **no hay hot reload** — ideal para demo o producción.

```bash
docker compose up --build
```

Espera ~60 segundos mientras:
1. MySQL inicia y pasa el healthcheck.
2. La API construye su imagen y espera a que MySQL esté listo.
3. El frontend construye su bundle y lo sirve con nginx.

### Primera vez: migrar BD y cargar datos de prueba

Con el stack corriendo, ejecuta en otra terminal:

```bash
cd api
npx prisma migrate deploy
npm run seed
```

### Verificar que todo funciona

```bash
curl http://localhost:4000/health
# → {"status":"ok"}
```

### Detener

```bash
docker compose down
```

Para también eliminar los datos de la BD:

```bash
docker compose down -v
```

---

## Modo 2 — Desarrollo local con dev.sh

MySQL y Adminer corren en Docker. La API y el frontend corren localmente con hot reload. Este es el modo recomendado para desarrollar.

**Requisito:** tener Git Bash (Windows) o bash (macOS/Linux).

```bash
# Dar permisos de ejecución (solo la primera vez)
chmod +x dev.sh

# Levantar todo
./dev.sh
```

El script realiza automáticamente:

1. Verifica que `docker`, `node` y `npm` estén en el PATH.
2. Levanta `mysql` y `adminer` via `docker compose up -d`.
3. Espera a que MySQL responda (hasta 30 intentos, 2s entre cada uno).
4. Inicia la API (`npm run dev` en `/api`) en background — los logs aparecen con prefijo `[api]`.
5. Espera hasta 20s a que la API responda en `:4000/graphql`.
6. Inicia el frontend (`npm run dev` en `/web`) en background — los logs aparecen con prefijo `[web]`.
7. Muestra el resumen de URLs.

**Detener todo:** presiona `Ctrl+C`. El script mata la API y el frontend, y detiene los contenedores de Docker.

### Primera vez: migrar BD y cargar datos de prueba

Con el script corriendo (o con MySQL levantado), en otra terminal:

```bash
cd api
npx prisma migrate deploy
npm run seed
```

---

## Modo 3 — Desarrollo manual proceso a proceso

Útil si necesitas control total sobre cada proceso o si no puedes usar `dev.sh`.

### Paso 1: levantar MySQL y Adminer

```bash
docker compose up -d mysql adminer
```

Espera ~30 segundos a que MySQL esté listo. Verifica con:

```bash
docker compose exec mysql mysqladmin ping -h localhost -u root -psecret
# → mysqld is alive
```

### Paso 2: migrar BD y cargar datos (solo la primera vez)

```bash
cd api
npx prisma migrate deploy
npm run seed
cd ..
```

### Paso 3: levantar la API

```bash
cd api
npm run dev
```

La API escucha en `http://localhost:4000`. Verás en la consola:
- `API escuchando en http://localhost:4000`
- `GraphQL en http://localhost:4000/graphql`
- `menu.md generado: N productos`

### Paso 4: levantar el frontend (en otra terminal)

```bash
cd web
npm run dev
```

El frontend estará en `http://localhost:5173`.

### Detener

- API y Web: `Ctrl+C` en cada terminal.
- MySQL y Adminer: `docker compose stop mysql adminer`

---

## Variables de entorno

El archivo `.env` en la raíz del proyecto es leído tanto por Docker Compose como por la API (vía `env_file`). El frontend usa su propio `web/.env` para las variables `VITE_*`.

### Variables de la API

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `DATABASE_URL` | URL de conexión Prisma para la BD principal | `mysql://root:secret@localhost:3306/antojo` |
| `DATABASE_URL_TEST` | URL de conexión Prisma para tests | `mysql://root:secret@localhost:3306/antojo_test` |
| `JWT_SECRET` | Secreto para firmar access tokens (mín. 32 chars) | — (obligatorio) |
| `JWT_REFRESH_SECRET` | Secreto para firmar refresh tokens (distinto del anterior) | — (obligatorio) |
| `JWT_ACCESS_EXPIRES` | Duración del access token | `15m` |
| `JWT_REFRESH_EXPIRES` | Duración del refresh token | `7d` |
| `GROQ_API_KEY` | API key de Groq para el chatbot DulceBot | — (opcional, sin ella el chatbot falla con mensaje amigable) |
| `GROQ_MODEL` | Modelo Groq (debe soportar function calling) | `openai/gpt-oss-120b` |
| `PORT` | Puerto del servidor Express | `4000` |
| `CORS_ORIGIN` | Origen(es) permitidos por CORS | `http://localhost:5173` |
| `VAPID_EMAIL` | Email para notificaciones push VAPID | `mailto:admin@example.com` |
| `VAPID_PUBLIC_KEY` | Clave pública VAPID | — |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID | — |
| `API_URL` | URL base pública de la API (para generar URLs de imágenes) | `http://localhost:4000` |

### Variables de Docker

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | Contraseña root de MySQL | — (obligatorio) |
| `MYSQL_DATABASE` | Nombre del schema principal | `antojo` |

### Variables del frontend (web/.env)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `VITE_API_URL` | URL del endpoint GraphQL | `http://localhost:4000/graphql` |
| `VITE_WS_URL` | URL del servidor Socket.IO | `http://localhost:4000` |

### Generar claves VAPID (push notifications)

Si quieres habilitar las notificaciones push, genera el par de claves una sola vez:

```bash
cd api
node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log(keys);"
```

Copia `publicKey` en `VAPID_PUBLIC_KEY` y `privateKey` en `VAPID_PRIVATE_KEY` del `.env`.

---

## Base de datos

### Modelos principales (Prisma / MySQL)

| Modelo | Tabla | Descripción |
|---|---|---|
| `Usuario` | `usuario` | Usuarios del sistema con rol, puntos de lealtad y hash de contraseña |
| `Producto` | `producto` | Catálogo con SKU, precio, categoría, stock, imagen y flag de encargo |
| `Pedido` | `pedido` | Pedidos de clientes registrados o invitados (guest) |
| `ItemPedido` | `item_pedido` | Líneas de detalle de cada pedido |
| `HistorialEstatusPedido` | `historial_estatus_pedido` | Auditoría de cambios de estatus |
| `FacturaCFDI` | `factura_cfdi` | Datos de facturación asociados a un pedido |
| `TareaProduccion` | `tarea_produccion` | Tareas asignadas al maestro panadero |
| `PushSubscription` | `push_subscription` | Suscripciones Web Push de usuarios |
| `Cupon` | `cupon` | Cupones de descuento con saldo disponible |

### Estatus de pedido (máquina de estados)

```
PENDIENTE / ESPERANDO_CONFIRMACION
    → EN_PREPARACION
        → LISTO
            → EN_CAMINO  (solo si tipoEntrega = DOMICILIO)
                → ENTREGADO  ✓ (terminal)
            → ENTREGADO  ✓ (terminal, si es MOSTRADOR)
    → SOLICITUD_CANCELACION
        → CANCELADO  ✓ (terminal)  |  → estatus anterior (si el staff rechaza)
```

### Comandos Prisma

```bash
cd api

# Aplicar migraciones existentes (primera vez o deploy)
npx prisma migrate deploy

# Crear nueva migración tras cambiar schema.prisma
npx prisma migrate dev --name nombre-del-cambio

# Abrir explorador visual de la BD
npm run prisma:studio

# Regenerar el cliente Prisma tras cambiar schema
npm run prisma:generate

# Cargar datos de prueba
npm run seed
```

---

## Scripts disponibles

### API (`cd api`)

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor en desarrollo con hot reload (nodemon + tsx) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta el build de producción |
| `npm test` | Tests unitarios (una pasada) |
| `npm run test:coverage` | Tests con reporte de cobertura (V8) |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | Análisis estático con ESLint |
| `npm run seed` | Carga datos de prueba en la BD |
| `npm run prisma:generate` | Regenera el cliente Prisma |
| `npm run prisma:migrate` | Crea y aplica nueva migración (dev) |
| `npm run prisma:deploy` | Aplica migraciones sin crear nuevas (producción) |
| `npm run prisma:studio` | Abre Prisma Studio en `http://localhost:5555` |

### Frontend (`cd web`)

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Compila TypeScript y genera bundle de producción en `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm test` | Tests unitarios (una pasada) |
| `npm run test:coverage` | Tests con reporte de cobertura |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | Análisis estático con ESLint |

---

## Usuarios de prueba

El seed crea los siguientes usuarios con datos de ejemplo:

| Rol | Email | Contraseña |
|---|---|---|
| ADMIN | admin@antojo.mx | Admin123! |
| MAESTRO_PANADERO | panadero@antojo.mx | Pan123! |
| CAJERO | cajero@antojo.mx | Cajero123! |
| REPARTIDOR | repartidor@antojo.mx | Rep123! |
| CLIENTE | cliente@antojo.mx | Cliente123! |

También se pueden hacer pedidos **sin cuenta** — el sistema genera un `guestToken` automáticamente y lo guarda en localStorage.

---

## Roles y permisos

### Roles del sistema

| Rol | Acceso |
|---|---|
| `ADMIN` | Acceso total: pedidos, historial, reportes de ventas, gestión de productos, gestión de empleados, creación y cancelación de tareas de producción |
| `CAJERO` | Pedidos activos, historial, asignación de repartidores a pedidos listos para entrega a domicilio |
| `MAESTRO_PANADERO` | Sus tareas de producción asignadas, avance de pedidos a estado LISTO |
| `REPARTIDOR` | Pedidos asignados a él, transiciones EN_CAMINO y ENTREGADO |
| `CLIENTE` | Sus pedidos, seguimiento, acumulación y canje de puntos |

### Transiciones de estatus permitidas por rol

| Rol | Transiciones permitidas |
|---|---|
| ADMIN | EN_PREPARACION, LISTO, EN_CAMINO, ENTREGADO, CANCELADO |
| CAJERO | EN_PREPARACION, EN_CAMINO, ENTREGADO, CANCELADO |
| MAESTRO_PANADERO | EN_PREPARACION, LISTO |
| REPARTIDOR | EN_CAMINO, ENTREGADO |

Las transiciones se validan doblemente: por la tabla de permisos del rol y por la máquina de estados en el backend.

---

## Funcionalidades principales

### Para clientes y guests

- **Catálogo de productos** navegable por categorías, con filtro por disponibilidad
- **Carrito de compras** persistido en localStorage (no se mezclan productos de stock con encargos)
- **Checkout** con dos modalidades:
  - `MOSTRADOR`: recogida en tienda, sin costo de envío
  - `DOMICILIO`: envío a domicilio con costo adicional de $30 MXN
- **Encargos personalizados** para productos hechos a pedido (pasteles, etc.) con fecha estimada, mensaje personalizado y depósito del 50%
- **Seguimiento en tiempo real** del pedido via WebSocket (sin polling)
- **Solicitud de cancelación** desde cualquier estatus no terminal (el staff decide)
- **Programa de puntos de lealtad** — acumulación automática y canje como descuento
- **Pedidos sin cuenta** (guests) con posibilidad de migrar el historial a una cuenta registrada
- **Factura CFDI** — captura de RFC, razón social y uso de CFDI tras crear el pedido
- **Chatbot DulceBot** — asistente IA con acceso al menú real, puede agregar al carrito, consultar pedidos, iniciar encargos y (para staff) gestionar pedidos

### Para staff (Dashboard)

- **Vista de pedidos activos** en tiempo real con botones de transición filtrados por rol
- **Asignación de repartidores** a pedidos listos para entrega a domicilio
- **Historial de pedidos** (entregados y cancelados)
- **Reportes de ventas** con total de ingresos, ticket promedio y productos más vendidos (solo ADMIN)
- **Gestión de productos** — CRUD completo con subida de imágenes
- **Gestión de empleados** — creación y edición de usuarios staff (solo ADMIN)
- **Tareas de producción** — ADMIN crea tareas, MAESTRO_PANADERO las actualiza; notificación push al asignar

---

## URLs del sistema

| URL | Servicio |
|---|---|
| `http://localhost:5173` | Frontend React (tienda web) |
| `http://localhost:4000/graphql` | API GraphQL (playground incluido) |
| `http://localhost:4000/health` | Health check de la API |
| `http://localhost:8080` | Adminer (explorador de base de datos) |
| `http://localhost:3306` | MySQL (acceso directo) |
| `http://localhost:5555` | Prisma Studio (solo al correr `npm run prisma:studio`) |

---

## Limitaciones actuales

- No hay pasarela de pago real — solo se registra el método elegido (efectivo o tarjeta)
- No hay envío de emails ni SMS al cambiar el estatus de un pedido
- Los cupones se crean en la BD pero no hay interfaz de canje para el cliente aún
- El chatbot no mantiene historial entre sesiones de navegador (se reinicia al limpiar localStorage)
- No hay geolocalización ni asignación automática de repartidores
- No hay sistema de reseñas ni calificaciones de productos
