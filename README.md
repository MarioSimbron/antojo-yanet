# Antojo de Yanet

Plataforma de pedidos y encargos para una panadería artesanal mexicana. Incluye tienda web pública, chatbot con IA (DulceBot), seguimiento de pedidos en tiempo real via WebSockets, dashboard operativo por rol, notificaciones in-app y push, y sistema de puntos de lealtad.

**En línea:** [antojo-yanet.pages.dev](https://antojo-yanet.pages.dev/) · API: `https://antojo-yanet.onrender.com/graphql`

> La API corre en el plan gratuito de Render y se duerme tras 15 minutos sin tráfico. La primera petición puede tardar ~50 segundos.

---

## Hackathon Módulo 1 — Decisiones técnicas

DulceBot es el asistente inteligente de este proyecto. Esta tabla resume cómo combina las cuatro piezas del Módulo 1 y dónde está la evidencia de cada una.

| Pieza | Decisión | Evidencia |
|---|---|---|
| **Masterclass 1: LLMs y Llama** | En producción, `openai/gpt-oss-20b` en Groq. El plan gratuito de Groq ya no ofrece modelos Llama conversacionales, y el propio curso usa este modelo en la Clase 4. La familia Llama se usa en el fine-tuning (TinyLlama-1.1B). | [`api/src/lib/groq.ts`](api/src/lib/groq.ts) |
| **Masterclass 2: Prompt engineering** | System prompt con persona y 6 reglas, construido por rol (5 roles). Incluye ejemplos de respuesta correcta, la fecha de hoy para resolver fechas relativas y un recordatorio inyectado cuando hay ambigüedad. | [`construirSystemPrompt`](api/src/services/asistente.service.ts) |
| **Masterclass 2: RAG** | 4 documentos del negocio (`api/docs/`), con el menú regenerado desde la BD en cada cambio. Embeddings `paraphrase-multilingual-MiniLM-L12-v2` (umbral coseno 0.25), con fallback por palabras clave. | [`api/src/lib/rag.ts`](api/src/lib/rag.ts) |
| **Masterclass 3: Fine-tuning con LoRA** | TinyLlama ajustado con LoRA para la voz y las políticas de DulceBot, con contexto RAG en el prompt. El menú no se usa para entrenar porque cambia a diario. | [`notebooks/dulcebot_lora_tinyllama.ipynb`](notebooks/dulcebot_lora_tinyllama.ipynb) |
| **Masterclass 3: Evaluación** | (1) Precisión de recuperación RAG. (2) Ruteo mensaje → herramienta con matriz de confusión. (3) Modelo base vs. LoRA con métrica objetiva y LLM-como-juez. | [Evaluación](#evaluación) |
| **E-learning: pipeline completo** | mensaje → RAG → prompt por rol → Groq decide la herramienta (el "clasificador") → ejecución en BD → respuesta → evaluación. Desplegado en Cloudflare Pages + Render + Neon. | [Despliegue](#despliegue) |

**Por qué RAG + function calling en producción y no el modelo ajustado:** precios, stock y pedidos cambian a diario, y DulceBot necesita *acciones* (agregar al carrito, cambiar estatus) que requieren function calling fiable. El fine-tuning sirve para fijar tono y formato. Los datos vivos se obtienen con RAG y herramientas.

---

## Arranque rápido

Requisito único: **Docker Desktop** corriendo.

```bash
git clone https://github.com/MarioSimbron/antojo-yanet.git
cd antojo-yanet
./dev.sh
```

La primera vez, `dev.sh` crea `.env` a partir de `.env.example`. Para activar DulceBot, pon tu `GROQ_API_KEY` en `.env` ([consola de Groq](https://console.groq.com/keys)) y vuelve a correr `./dev.sh`.

El script levanta los 4 contenedores. La primera vez tarda ~60 segundos mientras Docker construye las imágenes y PostgreSQL inicializa. Al terminar verás:

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

Los datos de PostgreSQL se conservan entre reinicios (volumen `pg_data`).

---

## Qué hace el arranque automáticamente

Cada vez que se levanta la API, ejecuta en orden:

1. `prisma db push`: sincroniza el esquema con la BD, igual que en producción.
2. `seed.ts`: carga el catálogo (pan, pasteles, bebidas, encargos) y 5 usuarios de prueba con upsert, así que es seguro correrlo varias veces.
3. `generateMenu.ts`: genera `api/docs/menu.md` desde la BD real. Es el documento del menú que DulceBot usa como fuente de conocimiento (RAG).
4. `npm run dev`: levanta la API con hot reload via nodemon.

El frontend se sirve como build estático compilado con Vite y servido por nginx.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 |
| Lenguaje | TypeScript 5.6 (API y Web) |
| API | Express 4.21 + Apollo Server 4.11 (GraphQL) + Socket.IO 4.8 |
| ORM / BD | Prisma 5.22 + PostgreSQL 16 (local) / Neon (producción) |
| Frontend | React 18.3 + Vite 5.4 + Material UI v9 + Apollo Client 3.11 |
| Estado global | Zustand 5.0 |
| Formularios | Formik 2.4 + Yup 1.7 |
| IA / LLM | Groq `openai/gpt-oss-20b` (function calling) + RAG con embeddings MiniLM (`@xenova/transformers`) |
| Fine-tuning | TinyLlama-1.1B-Chat + LoRA (`transformers`, `peft`) en Google Colab |
| Push | Web Push VAPID |
| Auth | JWT (access 15min + refresh 7d) + bcryptjs |
| Infraestructura | Docker Compose (postgres, adminer, api, web) |
| Servidor web | nginx:alpine (sirve el build de React) |
| Tests | Vitest 2.1 + @testing-library/react |

---

## Arquitectura del proyecto

```
antojo-yanet/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos y relaciones de la BD
│   │   ├── seed.ts             # Catálogo + 5 usuarios de prueba
│   │   └── init.sql            # Crea la BD de tests al iniciar PostgreSQL
│   ├── scripts/
│   │   └── generateMenu.ts     # Genera menu.md desde la BD al arrancar
│   ├── src/
│   │   ├── graphql/            # typeDefs y resolvers por módulo
│   │   ├── lib/                # JWT, Groq, RAG, web-push
│   │   ├── middleware/         # buildContext (extrae usuario o guest del JWT)
│   │   └── services/           # Lógica de negocio, DulceBot y máquina de estados
│   ├── docs/                   # Base de conocimiento RAG (faq, horarios, políticas, menú)
│   └── tests/
│       ├── unit/               # Tests unitarios + evaluación RAG (npm test)
│       ├── integration/        # Tests contra BD real
│       └── eval/               # Evaluaciones con el LLM real (npm run eval)
├── notebooks/
│   └── dulcebot_lora_tinyllama.ipynb   # Fine-tuning LoRA + evaluación (Colab)
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
└── .env.example                # Referencia comentada de cada variable (copiar a .env)
```

### Servicios Docker

| Servicio | Puerto | Descripción |
|---|---|---|
| `postgres` | 5432 | Base de datos principal con healthcheck |
| `adminer` | 8080 | Explorador web de la BD (sistema: PostgreSQL, servidor: `postgres`, usuario: `postgres`) |
| `api` | 4000 | API GraphQL + Socket.IO en modo desarrollo |
| `web` | 5173 | Frontend servido por nginx |

---

## Variables de entorno

`.env` no se versiona porque contiene secretos. `dev.sh` lo crea desde `.env.example` la primera vez, con valores funcionales para desarrollo.

La única variable que tienes que poner tú es `GROQ_API_KEY` (para DulceBot). Sin una key válida el chatbot muestra un mensaje de error controlado, pero el resto del sistema funciona normal.

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

También se pueden hacer pedidos **sin cuenta**: el sistema genera un `guestToken` automático.

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
- Programa de puntos de lealtad: acumulación automática y canje como descuento
- Pedidos sin cuenta (guest) con posibilidad de migrar historial a una cuenta registrada
- Factura CFDI: captura de RFC, razón social y uso tras crear el pedido
- **DulceBot**: chatbot IA que conoce el menú real, puede agregar productos al carrito, consultar pedidos e iniciar encargos

### Staff (Dashboard)

- Vista de pedidos activos en tiempo real con botones de transición filtrados por rol
- Asignación de repartidores a pedidos LISTO para entrega a domicilio
- Historial de pedidos (entregados y cancelados)
- Reportes de ventas: ingresos totales, ticket promedio, productos más vendidos (solo ADMIN)
- Gestión de productos: CRUD con subida de imágenes
- Gestión de empleados: creación y edición de usuarios staff (solo ADMIN)
- Tareas de producción: ADMIN crea, MAESTRO_PANADERO actualiza; notificación push al asignar
- Centro de notificaciones en tiempo real (Socket.IO), persistido en BD para autenticados y guests
- **DulceBot para staff**: cada rol tiene su propio conjunto de herramientas (pedidos activos, entregas asignadas, tareas, reporte de ventas)

---

## DulceBot — Cómo funciona

DulceBot es el asistente de IA de Antojo de Yanet. Usa un pipeline RAG + Groq function calling para responder preguntas del negocio, consultar el menú, agregar productos al carrito e iniciar encargos, y adapta su comportamiento al rol del usuario.

### Pipeline por mensaje

1. **RAG**: se recuperan hasta 5 chunks de `api/docs/` por similitud coseno con `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (umbral ≥ 0.25). Los chunks relevantes se inyectan en el system prompt como contexto. En hosts con poca memoria (`DISABLE_EMBEDDINGS=true`, como en producción) se usa scoring por palabras clave, que obtiene la misma precisión en el benchmark.
2. **Primera llamada a Groq** (`openai/gpt-oss-20b`, temperatura 0.2): el modelo decide qué herramienta llamar, si es que necesita una. Las herramientas disponibles dependen del rol (ver tabla abajo).
3. **Ejecución del tool**: si el modelo llama una herramienta, se ejecuta en el servidor (búsqueda en menú, carrito, consulta a la BD, etc.).
4. **Segunda llamada a Groq**: el modelo recibe el resultado del tool y genera la respuesta final en texto natural.

### Reglas del system prompt

| Regla | Propósito |
|---|---|
| REGLA #1 — No inventar datos | El modelo no puede inventar precios, stock ni características. Sí puede reconocer categorías si el RAG lo confirma. Las variaciones de nombre con "de" (`galleta de jamoncillo` = `galleta jamoncillo`) se manejan en el servidor. |
| REGLA #1B — Carrito directo | Llama a `agregar_al_carrito` directamente solo cuando hay intención explícita de compra (verbos: "quiero", "dame", "agrega"). Las preguntas de disponibilidad (`¿vendes pan?`) siempre van a `buscar_en_menu`. |
| REGLA #2 — Herramientas dinámicas | Solo lista las herramientas que el rol actual tiene asignadas. La construye `buildRegla2(tools)` en tiempo de ejecución para que el modelo no llame tools que Groq rechazaría. |
| REGLA #3 — Ambigüedad (crítica) | Cuando `agregar_al_carrito` devuelve una lista de opciones, el modelo debe listar TODOS los nombres, uno por línea con guion, antes de preguntar cuál quiere el cliente, porque el cliente no ve el resultado interno del tool. |
| REGLA #4 — Encargos | Llamar a `iniciar_encargo` en cuanto se conoce el producto, convirtiendo fechas relativas ("el sábado") con la fecha de hoy que va en el prompt. No confirmar encargos como "registrados". |
| REGLA #5 — Formato | Respuestas en texto plano, máximo 6 elementos por lista, sin emojis ni markdown. |
| REGLA #6 — Límites de rol | Si el usuario pide algo que requiere un tool que su rol no tiene, o un tema ajeno al negocio, el modelo responde brevemente y redirige. |

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

## Evaluación

Siguiendo la idea de la Masterclass 3 ("misma prueba, mismos criterios"), DulceBot se evalúa en tres niveles:

| Nivel | Qué mide | Cómo correrlo | Resultado |
|---|---|---|---|
| **Recuperación RAG** | ¿El documento correcto aparece en el top-3? 14 preguntas reales (horarios, encargos, FAQ, menú). | `npm test` (desde `api/`) | 14/14 (100 %), tanto con embeddings como con palabras clave |
| **Ruteo** | ¿El modelo elige la herramienta correcta? 21 mensajes de los 5 roles. Reporta precisión y matriz de confusión, como el clasificador de la Clase 4. | `npm run eval` (desde `api/`, requiere `GROQ_API_KEY`) | 20/21 (95 %). Antes de las correcciones: 17/21 (81 %) |
| **Fine-tuning** | TinyLlama base vs. LoRA en 14 preguntas no vistas: % de datos clave + LLM-como-juez (exactitud, tono, formato). | [Notebook en Colab](https://colab.research.google.com/github/MarioSimbron/antojo-yanet/blob/main/notebooks/dulcebot_lora_tinyllama.ipynb) | Ver la sección 6 del notebook |

El eval de ruteo ya demostró su valor. La primera corrida (81 %) reveló tres problemas que se corrigieron:
- **Ruteo aleatorio:** el mismo mensaje iba a herramientas distintas en cada corrida porque Groq usa temperatura 1.0 por defecto. Ahora es 0.2.
- **Fechas relativas:** el modelo pedía "la fecha exacta en formato YYYY-MM-DD" porque no sabía qué día es hoy. Ahora la fecha va en el prompt.
- **Encargos:** el modelo pedía todos los datos antes de iniciar el encargo. La REGLA #4 ahora indica cuándo llamar `iniciar_encargo`.

El fallo que queda ("Agrega una galleta a mi carrito" → `buscar_en_menu`) es un producto genérico: el modelo prefiere mostrar las opciones buscando en el menú en vez de dejar que el carrito devuelva la lista ambigua.

`npm run eval` hace una llamada a Groq por caso (~3,000 tokens cada una) y respeta el límite del plan gratuito (8,000 tokens/min) con reintentos, así que tarda ~5 minutos. Por eso no forma parte de `npm test`.

---

## Fine-tuning con LoRA (Llama)

[![Abrir en Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/MarioSimbron/antojo-yanet/blob/main/notebooks/dulcebot_lora_tinyllama.ipynb)

El notebook [`notebooks/dulcebot_lora_tinyllama.ipynb`](notebooks/dulcebot_lora_tinyllama.ipynb) ajusta **TinyLlama-1.1B-Chat** (arquitectura Llama 2) con LoRA para que responda con la voz y las reglas de DulceBot:

1. Descarga la base de conocimiento real de este repositorio y la indexa con el mismo modelo de embeddings y el mismo umbral que la API.
2. Construye un dataset de 14 temas (horarios, envío, encargos, depósito, cancelación, pagos, puntos, factura, fuera de área). Cada tema tiene 4 paráfrasis de entrenamiento y 1 pregunta de prueba no vista.
3. Entrena LoRA (r=16 sobre `q/k/v/o_proj`) con la pérdida calculada solo sobre la respuesta, como en la Clase 3.
4. Compara modelo base vs. ajustado con el mismo prompt (DulceBot + contexto RAG): % de datos clave mencionados y LLM-como-juez (`gpt-oss-20b`) sobre exactitud, tono y formato.
5. Guarda el adaptador (opcionalmente lo sube a Hugging Face).

Requisitos: GPU T4 de Colab y el secret `GROQ_API_KEY` (para el juez). `HF_TOKEN` es opcional.

---

## Despliegue

| Componente | Servicio | Notas |
|---|---|---|
| Frontend | Cloudflare Pages | Build de Vite con `VITE_API_URL` apuntando a Render |
| API | Render (Docker, [`api/Dockerfile`](api/Dockerfile)) | `DISABLE_EMBEDDINGS=true` para caber en 512 MB de RAM. La imagen incluye `api/docs/` |
| Base de datos | Neon (PostgreSQL serverless) | El esquema se sincroniza con `prisma db push` al arrancar |
| LLM | Groq (plan gratuito) | `openai/gpt-oss-20b`, límite diario de tokens por cuenta |

---

## URLs locales

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
npm run test          # Tests unitarios + evaluación de recuperación RAG
npm run eval          # Evaluación de ruteo de DulceBot contra Groq (~5 min)

# Desde web/
npm run typecheck     # Verificación de tipos TypeScript
npm run test          # Tests unitarios
```

---

## Limitaciones actuales

- Sin pasarela de pago real: solo se registra el método elegido
- Sin envío de emails ni SMS al cambiar el estatus de un pedido
- Los cupones existen en BD pero no hay interfaz de canje para el cliente
- El chatbot no mantiene historial entre sesiones de navegador
- Los encargos iniciados desde DulceBot no se guardan: el chat recopila los datos, pero el equipo no recibe la solicitud (el formulario de encargo de la tienda sí funciona)
- Sin geolocalización ni asignación automática de repartidores
- El plan gratuito de Groq limita los tokens diarios: con mucho uso, DulceBot puede responder "En este momento no puedo responder" hasta que se reinicie la cuota
