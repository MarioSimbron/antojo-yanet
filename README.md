# Antojo de Yanet

Plataforma de pedidos y encargos para una panadería artesanal mexicana. Incluye tienda web pública, chatbot con IA (DulceBot), seguimiento de pedidos en tiempo real via WebSockets, dashboard operativo por rol, notificaciones in-app y push, y sistema de puntos de lealtad.

---

## Arranque rápido

Requisito único: **Docker Desktop** corriendo.

```bash
git clone <url-del-repo>
cd antojo-yanet
./dev.sh
```

Eso es todo. El script levanta los 4 contenedores. La primera vez tarda ~60 segundos mientras Docker construye las imágenes y MySQL termina de iniciar. Al terminar verás:

```
[dev] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[dev]  Web     → http://localhost:5173
[dev]  API     → http://localhost:4000/graphql
[dev]  Adminer → http://localhost:8080
[dev] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> **Windows:** usa Git Bash para correr `./dev.sh`, no PowerShell ni CMD.

### Detener el stack

```bash
./stop.sh
```

Los datos de MySQL se conservan entre reinicios.

---

## Qué hace el arranque automáticamente

Cada vez que se levanta la API, ejecuta en orden:

1. `prisma migrate deploy` — aplica cualquier migración pendiente.
2. `seed.ts` — carga 143 productos (pan, pasteles, bebidas, encargos) y 5 usuarios de prueba con upsert, por lo que es seguro correr múltiples veces.
3. `generateMenu.ts` — genera `api/docs/menu.md` desde la BD real, que es el documento que DulceBot usa como fuente de conocimiento (RAG).
4. `npm run dev` — levanta la API con hot reload via nodemon.

El frontend se sirve como build estático compilado con Vite y servido por nginx.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 |
| Lenguaje | TypeScript 5.6 (API y Web) |
| API | Express 4.21 + Apollo Server 4.11 (GraphQL) + Socket.IO 4.8 |
| ORM / BD | Prisma 5.22 + MySQL 8.0 |
| Frontend | React 18.3 + Vite 5.4 + Material UI v9 + Apollo Client 3.11 |
| Estado global | Zustand 5.0 |
| Formularios | Formik 2.4 + Yup 1.7 |
| IA / LLM | Groq SDK (function calling) + RAG sobre `api/docs/menu.md` |
| Push | Web Push VAPID |
| Auth | JWT (access 15min + refresh 7d) + bcryptjs |
| Infraestructura | Docker Compose (mysql, adminer, api, web) |
| Servidor web | nginx:alpine (sirve el build de React) |
| Tests | Vitest 2.1 + @testing-library/react |

---

## Arquitectura del proyecto

```
antojo-yanet/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos y relaciones de la BD
│   │   ├── migrations/         # Migraciones generadas por Prisma
│   │   ├── seed.ts             # 143 productos + 5 usuarios de prueba
│   │   └── init.sql            # SQL ejecutado al iniciar el contenedor MySQL
│   ├── scripts/
│   │   └── generateMenu.ts     # Genera menu.md desde la BD al arrancar
│   ├── src/
│   │   ├── graphql/            # typeDefs y resolvers por módulo
│   │   ├── lib/                # JWT, Groq, RAG, web-push
│   │   ├── middleware/         # buildContext (extrae usuario o guest del JWT)
│   │   └── services/           # Lógica de negocio y máquina de estados
│   ├── docs/
│   │   └── menu.md             # Generado automáticamente al arrancar — fuente del chatbot
│   └── tests/
├── web/
│   ├── src/
│   │   ├── components/         # Layout, ChatWidget, EstatusChip, etc.
│   │   ├── hooks/
│   │   ├── lib/                # Apollo Client con auto-refresh de JWT
│   │   ├── pages/              # Home, Menu, Checkout, Dashboard, etc.
│   │   └── store/              # Zustand (sesión de usuario)
│   ├── Dockerfile              # Build multi-stage + nginx
│   └── nginx.conf
├── docker-compose.yml
├── dev.sh                      # Levanta el stack completo
├── stop.sh                     # Detiene y elimina los contenedores
├── .env                        # Variables de entorno (incluido en el repo con valores de dev)
└── .env.example                # Referencia comentada de cada variable
```

### Servicios Docker

| Servicio | Puerto | Descripción |
|---|---|---|
| `mysql` | 3306 | Base de datos principal con healthcheck |
| `adminer` | 8080 | Explorador web de la BD |
| `api` | 4000 | API GraphQL + Socket.IO en modo desarrollo |
| `web` | 5173 | Frontend servido por nginx |

---

## Variables de entorno

El proyecto incluye un `.env` con valores funcionales para desarrollo. No necesitas configurar nada para arrancarlo.

Si quieres usar tu propia API key de Groq (para el chatbot DulceBot), edita `.env` y reemplaza `GROQ_API_KEY`. Sin una key válida el chatbot muestra un mensaje de error, pero el resto del sistema funciona normal.

El archivo `.env.example` documenta cada variable con comentarios.

---

## Usuarios de prueba

El seed crea estos usuarios listos para usar:

| Rol | Email | Contraseña |
|---|---|---|
| ADMIN | admin@antojo.mx | Admin123! |
| MAESTRO_PANADERO | panadero@antojo.mx | Pan123! |
| CAJERO | cajero@antojo.mx | Cajero123! |
| REPARTIDOR | repartidor@antojo.mx | Rep123! |
| CLIENTE | cliente@antojo.mx | Cliente123! |

También se pueden hacer pedidos **sin cuenta** — el sistema genera un `guestToken` automático.

---

## Roles y permisos

| Rol | Acceso |
|---|---|
| `ADMIN` | Acceso total: pedidos, historial, reportes, productos, empleados, tareas |
| `CAJERO` | Pedidos activos, historial, asignación de repartidores |
| `MAESTRO_PANADERO` | Sus tareas de producción, avance a estado LISTO |
| `REPARTIDOR` | Pedidos asignados, transiciones EN_CAMINO y ENTREGADO |
| `CLIENTE` | Sus pedidos, puntos de lealtad |

### Máquina de estados del pedido

```
PENDIENTE / ESPERANDO_CONFIRMACION
    → EN_PREPARACION
        → LISTO
            → EN_CAMINO  (solo entrega a domicilio)
                → ENTREGADO ✓
            → ENTREGADO ✓  (recogida en mostrador)
    → SOLICITUD_CANCELACION
        → CANCELADO ✓  |  → estatus anterior (si el staff rechaza)
```

---

## Funcionalidades principales

### Clientes y guests

- Catálogo navegable por categorías con filtro de disponibilidad
- Carrito con dos modalidades: MOSTRADOR (recogida en tienda) y DOMICILIO ($30 MXN envío)
- Encargos personalizados para pasteles con fecha estimada, mensaje y depósito del 50%
- Seguimiento en tiempo real del pedido via WebSocket
- Solicitud de cancelación desde cualquier estatus no terminal
- Programa de puntos de lealtad — acumulación automática y canje como descuento
- Pedidos sin cuenta (guest) con posibilidad de migrar historial a una cuenta registrada
- Factura CFDI — captura de RFC, razón social y uso tras crear el pedido
- **DulceBot** — chatbot IA que conoce el menú real, puede agregar productos al carrito, consultar pedidos e iniciar encargos

### Staff (Dashboard)

- Vista de pedidos activos en tiempo real con botones de transición filtrados por rol
- Asignación de repartidores a pedidos LISTO para entrega a domicilio
- Historial de pedidos (entregados y cancelados)
- Reportes de ventas: ingresos totales, ticket promedio, productos más vendidos (solo ADMIN)
- Gestión de productos — CRUD con subida de imágenes
- Gestión de empleados — creación y edición de usuarios staff (solo ADMIN)
- Tareas de producción — ADMIN crea, MAESTRO_PANADERO actualiza; notificación push al asignar
- Centro de notificaciones en tiempo real (Socket.IO), persistido en BD para autenticados y guests

---

## DulceBot — Cómo funciona

DulceBot es el asistente de IA de Antojo de Yanet. Usa un pipeline RAG + Groq function calling para responder preguntas sobre el menú, agregar productos al carrito e iniciar encargos, adaptando su comportamiento al rol del usuario.

### Pipeline por mensaje

1. **RAG**: Se recuperan hasta 5 chunks del índice semántico (`api/docs/`) con el modelo `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (umbral coseno ≥ 0.25). Los chunks relevantes se inyectan en el system prompt como contexto de conocimiento.
2. **Primera llamada a Groq** (`openai/gpt-oss-120b`): El modelo decide qué herramienta llamar (si es que necesita una). Las herramientas disponibles dependen del rol del usuario (ver tabla abajo).
3. **Ejecución del tool**: Si el modelo llama una herramienta, se ejecuta en el servidor (búsqueda en menú, agregar al carrito, consultar BD, etc.).
4. **Segunda llamada a Groq**: El modelo recibe el resultado del tool y genera la respuesta final en texto natural.

### Reglas del system prompt

| Regla | Propósito |
|---|---|
| REGLA #1 — No inventar datos | El modelo no puede inventar precios, stock ni características. Sí puede reconocer categorías si el RAG lo confirma. Las variaciones de nombre con "de" (`galleta de jamoncillo` = `galleta jamoncillo`) se manejan en el servidor. |
| REGLA #1B — Carrito directo | Llama a `agregar_al_carrito` directamente solo cuando hay intención explícita de compra (verbos: "quiero", "dame", "agrega"). Las preguntas de disponibilidad (`¿vendes pan?`) siempre van a `buscar_en_menu`. |
| REGLA #2 — Herramientas dinámicas | Solo lista las herramientas que el rol actual tiene asignadas. Construida en tiempo de ejecución por `buildRegla2(tools)` para evitar que el modelo llame tools que Groq rechazaría. |
| REGLA #3 — Ambigüedad (crítica) | Cuando `agregar_al_carrito` devuelve una lista de opciones, el modelo debe listar TODOS los nombres, uno por línea con guión, antes de preguntar cuál quiere el cliente. El cliente no ve el resultado interno del tool. |
| REGLA #4 — Encargos | No confirmar encargos como "registrados"; solo recopilar los datos y avisar que el equipo los revisará. |
| REGLA #5 — Formato | Respuestas en texto plano, máximo 6 elementos por lista, sin emojis ni markdown en la conversación. |
| REGLA #6 — Límites de rol | Si el usuario pide algo que requiere un tool que su rol no tiene, el modelo responde brevemente que esa función no está disponible. |

### Herramientas por rol

| Herramienta | Invitado / CLIENTE | CAJERO | REPARTIDOR | MAESTRO_PANADERO | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| `buscar_en_menu` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `agregar_al_carrito` | ✓ | — | — | — | ✓ |
| `consultar_pedido` | ✓ | ✓ | ✓ | — | ✓ |
| `consultar_stock` | ✓ | ✓ | — | ✓ | ✓ |
| `iniciar_encargo` | ✓ | — | — | — | ✓ |
| `listar_pedidos_activos` | — | ✓ | — | — | ✓ |
| `cambiar_estatus_pedido` | — | ✓ | ✓ | ✓ | ✓ |
| `mis_pedidos_asignados` | — | — | ✓ | — | — |
| `mis_tareas` | — | — | — | ✓ | ✓ |
| `ver_reporte_ventas` | — | — | — | — | ✓ |

### Matching de nombre de producto

El servidor tokeniza los nombres quitando stop-words y normalizando acentos antes de buscar en la BD. Así `galleta de jamoncillo` y `galleta jamoncillo` encuentran el mismo producto. El tokenizador también aplica stemming básico (quita `s`/`es` al final) para manejar plurales.

---

## URLs

| URL | Servicio |
|---|---|
| http://localhost:5173 | Tienda web (React) |
| http://localhost:4000/graphql | API GraphQL (playground incluido) |
| http://localhost:4000/health | Health check de la API |
| http://localhost:8080 | Adminer (explorador de BD) |

---

## Scripts útiles (desarrollo)

```bash
# Desde api/
npm run seed          # Recarga los datos de prueba
npm run prisma:studio # Explorador visual de la BD en localhost:5555
npm run test          # Tests unitarios

# Desde web/
npm run typecheck     # Verificación de tipos TypeScript
npm run test          # Tests unitarios
```

---

## Limitaciones actuales

- Sin pasarela de pago real — solo se registra el método elegido
- Sin envío de emails ni SMS al cambiar el estatus de un pedido
- Los cupones existen en BD pero no hay interfaz de canje para el cliente
- El chatbot no mantiene historial entre sesiones de navegador
- Sin geolocalización ni asignación automática de repartidores
