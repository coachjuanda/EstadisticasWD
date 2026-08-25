# Brief técnico para construcción de app — Plataforma de gestión y estadísticas para club de hockey

**Uso de este documento:** este brief está escrito para ser entregado directamente a una herramienta de generación de apps con IA (Base44 o equivalente). Contiene el alcance, los roles, el modelo de datos y los flujos funcionales necesarios para construir el MVP. Está redactado de forma explícita y sin ambigüedad para minimizar iteraciones.

---

## 1. Resumen del proyecto

Construir una aplicación web (accesible desde un subdominio propio, ej. `app.clubname.com`, apuntado por CNAME desde WordPress) que sea el canal central de información entre la dirección deportiva de un club de hockey, sus entrenadores, un encargado de estadísticas ("scorekeeper") y sus deportistas.

El núcleo del MVP es un **módulo de estadísticas de partidos en vivo**, operado desde un iPad/tablet por un scorekeeper, que alimenta el perfil estadístico histórico de cada deportista y se refleja en una **vista pública en vivo sin login**.

Sobre esa base se construyen dos módulos adicionales: **evaluaciones técnicas + DOFA bimestrales** por deportista (hechas por los entrenadores) y **encuestas** de padres/deportistas.

Es un piloto interno de un solo club, pero el modelo de datos debe quedar preparado para evolucionar a multi-club (SaaS) en una fase posterior — sin necesidad de reescribir el esquema.

## 2. Alcance del MVP (explícito)

**Incluido en el MVP, en este orden de prioridad:**
1. Gestión de equipos, nóminas, divisiones/categorías y horario de partidos (lo mínimo necesario para poder anclar estadísticas a jugador + equipo + torneo).
2. Módulo de estadísticas en vivo (scorekeeper) + vista pública en vivo + perfil estadístico del deportista.
3. Evaluaciones técnicas bimestrales + DOFA por deportista (hechas por entrenadores).
4. Encuestas de seguimiento a padres y deportistas (formato exacto pendiente de definir — construir con estructura genérica configurable, ver sección 9).

**Explícitamente fuera de alcance del MVP:**
- Un "módulo de partidos" administrativo complejo (marcador de faltas, expulsiones, hojas de juego oficiales para la liga, etc.). Solo se necesita lo mínimo: equipo local, equipo visitante, torneo, fecha/hora/cancha, y el estado del partido (programado / en vivo / finalizado).
- Gestión de nóminas de equipos rivales. El club solo administra su propia información; los rivales solo aparecen como nombre de equipo contrincante en el marcador.
- Pagos, facturación o cualquier lógica de suscripción SaaS (eso es fase 2, cuando se abra a otros clubes).
- Módulo de video/scouting en vivo (se descartó — el nombre "scout" se refería originalmente al perfil scorekeeper, no a un módulo de video).
- Macrociclos de entrenamiento (mencionados en el acta de entrenadores, pero no forman parte de este MVP).

## 3. Roles de usuario y permisos

| Rol | Puede hacer |
|---|---|
| **Administrador** | Todo. Crea/edita equipos, nóminas, divisiones, torneos, horarios. Configura qué estadísticas se toman por torneo. Crea usuarios de todos los roles. Puede editar cualquier estadística de cualquier partido, incluso después de finalizado (con registro de auditoría). Ve todos los reportes de evaluación y encuestas de todo el club. |
| **Coach (entrenador)** | Solo consulta — **no edita** — las estadísticas de los jugadores de su(s) categoría(s)/equipo(s) asignado(s). La edición de estadísticas de partido es exclusiva de scorekeeper (mientras el partido está en vivo) y administrador (en cualquier momento). El coach sí redacta y edita los reportes de evaluación técnica + DOFA de sus jugadores (bimestral/trimestral). |
| **Scorekeeper** | Ve la lista de partidos programados que le fueron asignados o que están disponibles. Abre un partido, lo pone en estado "en vivo", registra estadísticas de cada jugador de ambos equipos en tiempo real durante el partido, puede corregir una anotación mientras el partido está en vivo, y al finalizar lo cierra ("finalizado"), lo que dispara el guardado consolidado en el perfil histórico de cada jugador. Puede llevar **un partido a la vez**, pero pueden existir múltiples usuarios scorekeeper simultáneos llevando partidos distintos en paralelo. |
| **Deportista** | Un solo usuario por deportista, compartido/usado indistintamente por el deportista y su padre/acudiente (no hay separación de cuentas por edad). Ve sus partidos jugados, torneos/categorías/ligas en las que participa, sus estadísticas (filtrables por torneo, categoría, liga, o sumadas/agregadas), sus reportes de evaluación bimestral, y responde encuestas asignadas. Puede subir/cambiar su propia foto de perfil. |
| **Público (sin login)** | Accede a la vista en vivo de un partido (marcador + estadísticas del club, sin necesidad de cuenta) mediante un link que se embebe en la página web del club (WordPress). Solo ve información del club propio, no de nóminas rivales. |

No hay gestión de menores de edad diferenciada dentro de la app: todos los miembros firman un waiver de manejo de datos por fuera del sistema; la app no necesita lógica de consentimiento parental.

## 4. Modelo de datos (entidades)

> Diseñar el esquema con un campo `club_id` en las entidades raíz (Club, Torneo, Equipo, Usuario) aunque en el MVP solo exista un club — esto habilita multi-tenant sin migración de esquema en el futuro.

**Club**
- nombre, logo, dominio/subdominio asignado.

**Usuario**
- nombre, email, rol (admin / coach / scorekeeper / deportista), club_id, estado (activo/inactivo).

**Deportista** (perfil, 1:1 con Usuario cuando el rol es deportista)
- nombre completo, fecha de nacimiento, foto de perfil (editable por admin y por el propio usuario), posición (jugador de campo / portero).

**Division** (categoría de edad)
- nombre (Sub 7, 8U, 10U, 12U, 14U, 18U, Femenino, Senior A, Senior B, etc.), deporte (hockey en línea / hockey en hielo).

**Liga**
- nombre (Fedepatín, Fedehockey, Narch, SW, Torhs, Wish Cup, etc.). El club no controla el calendario de estas ligas — se copian y configuran manualmente dentro de la app.

**Torneo**
- nombre, liga_id, división(es) que participan, fecha de inicio/fin.
- **Configuración de estadísticas del torneo**: al crear el torneo, el administrador define qué estadísticas se van a tomar en los partidos de ese torneo (ver catálogo en el Anexo A). Esto significa que la lista de estadísticas capturables **no es fija a nivel de app, sino configurable por torneo**.

**Equipo**
- nombre, división_id, deporte.

**Nomina** (roster de un equipo dentro de un torneo específico)
- equipo_id, torneo_id, lista de deportista_id asignados con su número de camiseta.
- *Importante*: un mismo deportista puede pertenecer a múltiples nóminas simultáneamente (distintos torneos y/o distintas divisiones), como el caso de un portero de 13 años jugando U12 y U14 en dos ligas diferentes al mismo tiempo. El modelo debe soportar esta relación muchos-a-muchos sin conflicto.

**Partido**
- torneo_id, equipo_local_id, equipo_visitante_id (el visitante puede ser un equipo externo sin nómina cargada en el sistema, solo un nombre), fecha/hora, cancha/ubicación, estado (programado / en_vivo / finalizado), scorekeeper_id asignado.

**EstadisticaPartidoJugador** (registro editable, uno por jugador por partido)
- partido_id, deportista_id, equipo_id, y un campo por cada estadística configurada en el torneo (disparos, disparos al arco, faceoffs ganados/perdidos, goles, asistencias, +/-, disparos bloqueados, offsides, icings, PP/PK, etc. — ver Anexo A).
- Debe soportar edición **incluso después de que el partido esté finalizado**, restringida exclusivamente a scorekeeper (mientras el partido está en vivo) y administrador (en cualquier momento). El coach tiene acceso de solo lectura a esta entidad. Cada edición debe quedar en un log de auditoría (usuario, timestamp, valor anterior, valor nuevo).
- Para porteros: shots_on_goal_recibidos, goals_recibidos → save% se calcula automáticamente (tapadas/disparos recibidos), no se ingresa manualmente.
- El `+/-` es la única estadística que se registra tomando en cuenta quién estaba en cancha en ese momento (no requiere modelar líneas/shifts completos, solo este campo puntual).

**ReporteEvaluacion** (evaluación técnica + DOFA, bimestral/trimestral)
- deportista_id, coach_id (autor), fecha, categoría al momento de la evaluación.
- Bloques de habilidades técnicas, cada ítem calificado 1–5 más un campo de observaciones libre, agrupados en las categorías del Anexo B (Habilidades de patín, Control de puck, Tipos de pases, Disparos, Contacto con el cuerpo, Velocidad, Ataque, Defensa). El promedio por bloque se calcula automáticamente.
- Bloque DOFA: Fortalezas, Oportunidades, Debilidades, Amenazas — cada uno desglosado en sub-secciones de texto libre: Defensivo, Ofensivo, General, Trabajo en equipo, Comunicación, Autoconfianza.

**Encuesta** (fase incluida en MVP, formato final pendiente — construir de forma configurable)
- Entidad `PlantillaEncuesta` (admin define preguntas, tipo de pregunta: escala/opción múltiple/texto libre, dirigida a deportistas o a padres) + `RespuestaEncuesta` (usuario, plantilla_id, respuestas, fecha). No asumir un formato fijo de preguntas — dejar el constructor de encuestas simple y genérico, ya que Rinos publicará el formato definitivo después.

## 5. Flujos funcionales clave

**5.1 Configuración inicial (Administrador)**
Crea divisiones → crea equipos → crea torneos (definiendo qué estadísticas se capturan en ese torneo) → crea nóminas asociando deportistas a equipo+torneo → carga el horario de partidos → crea usuarios de coach y scorekeeper y los asigna a equipos/partidos.

**5.2 Partido en vivo (Scorekeeper)**
Entra a su lista de partidos programados → abre uno → lo marca "en vivo" → por cada jugador en cancha, incrementa/corrige contadores de las estadísticas configuradas para ese torneo (interfaz tipo botones +/- por jugador y por estadística, según el mockup de referencia) → el marcador y las estadísticas se reflejan en tiempo real (o casi real, ver sección 7) en la vista pública → al terminar, marca el partido "finalizado", lo que consolida y guarda las estadísticas en el historial de cada deportista.

**5.3 Corrección post-partido (Administrador)**
Puede reabrir cualquier estadística de un partido ya finalizado y corregirla; el sistema recalcula automáticamente los totales agregados del deportista y deja registro de auditoría.

**5.4 Consulta del deportista/padre**
El usuario deportista ve: lista de partidos jugados, torneos activos, estadísticas filtrables (por torneo / por categoría / por liga / agregadas de todos), reportes de evaluación bimestral recibidos, encuestas pendientes de responder.

**5.5 Reporte de evaluación (Coach)**
El coach selecciona un jugador de su categoría, completa el formulario de habilidades (1–5 por ítem) y el DOFA, lo guarda; queda visible para el administrador y para el deportista/padre correspondiente.

**5.6 Vista pública en vivo**
Cualquier persona con el link (embebido en la web del club en WordPress) ve el marcador del partido en curso y las estadísticas del equipo del club (no las del rival, salvo el marcador general), sin necesidad de crear cuenta.

## 6. Requisitos de interfaz

- El módulo de scorekeeper debe funcionar bien en tablet (iPad), con botones grandes tipo +/- por estadística y por jugador, marcador visible arriba con período/tiempo (ver imagen de referencia adjunta al brief original).
- El resto de la app (vista deportista, vista coach, vista pública) debe ser responsive para celular, ya que padres y deportistas la usarán principalmente desde el teléfono.
- La vista pública debe poder embeberse o enlazarse fácilmente desde una página existente en WordPress.

## 7. Requisitos no funcionales

- **Actualización en vivo**: la vista pública y las vistas de coach/admin deben reflejar los cambios del scorekeeper con la menor latencia posible. Si la herramienta elegida no soporta websockets/push real (ver sección 8), usar refresco automático por polling cada pocos segundos — es aceptable para este caso de uso (similar a como funcionan Regystra/GameSheet).
- **Auditoría**: toda edición de estadística post-registro debe dejar rastro (quién, cuándo, valor anterior).
- **Multi-torneo simultáneo**: un deportista puede estar activo en 4+ torneos/categorías/ligas al mismo tiempo; el modelo de datos y las vistas de estadísticas deben soportar esto sin fricción (ejemplo real: portero de 13 años jugando U12 y U14 en dos ligas distintas simultáneamente).
- **Dominio propio**: la app debe quedar accesible en un subdominio del dominio del club (ej. `app.clubname.com`), no en el subdominio genérico de la herramienta constructora.
- **Portabilidad de datos**: aunque el MVP se construya en una herramienta low-code/IA, el modelo de datos y la exportación deben permitir migrar a infraestructura propia si el proyecto escala a SaaS multi-club (ver sección 8).
- **Manejo de datos de menores**: el club ya cuenta con consentimiento firmado (waiver) de los padres para el manejo de datos; la app no necesita construir flujo de consentimiento, pero sí debe seguir buenas prácticas básicas de seguridad (acceso por rol, no exponer datos personales en la vista pública más allá de nombre y estadísticas deportivas).

## 8. Recomendación de herramienta de construcción

**Recomendación principal: Base44.**
- Genera base de datos, lógica y frontend desde un prompt, sin necesidad de que el equipo tenga desarrolladores dedicados — encaja con el perfil de este piloto.
- Soporta conectar un dominio/subdominio propio (`app.clubname.com`) vía registro CNAME, en su plan "Builder" (de pago; es un requisito para poder usar dominio propio, no está disponible en el plan gratuito).
- **Limitación a tener en cuenta**: Base44 no ofrece websockets/actualización push nativa como Supabase; el "en vivo" se logra con refresco automático (polling) cada pocos segundos, lo cual es suficiente para un marcador de partido, pero no es instantáneo al milisegundo. Si esto resulta insuficiente en pruebas, la alternativa es reconstruir el backend sobre Supabase (que sí soporta tiempo real nativo vía websockets) usando un frontend generado con Lovable u otra herramienta IA compatible con Supabase.
- Existen herramientas de migración de Base44 hacia Supabase self-hosted si más adelante se necesita independencia total de la plataforma — esto reduce el riesgo de quedar "atado" a Base44 si el proyecto crece a SaaS multi-club.

**Alternativa a evaluar en paralelo si el polling no da la experiencia deseada:** Lovable (o similar) + Supabase como backend, lo cual da tiempo real nativo y mayor portabilidad desde el día uno, a cambio de una curva de configuración un poco mayor.

## Anexo A — Catálogo de estadísticas configurables por torneo

*(Definido en el acta de entrenadores; sirve como catálogo base que el administrador activa/desactiva por torneo. Puede diferir entre hockey en línea y hockey en hielo.)*

**Jugadores de campo (ambos deportes):**
Disparos realizados · Disparos al arco · Faceoffs ganados/perdidos · Goles · Asistencias · +/- · Efectividad en power play (PP) · Efectividad en penalty kill (PK)

**Solo hockey en línea:**
Disparos bloqueados por defensa · Offsides · Icings

**Solo hockey en hielo:**
2-1 a favor/en contra · 3-2 a favor/en contra

**Porteros (ambos deportes):**
Disparos recibidos · Goles recibidos · % de tapadas (calculado automáticamente = tapadas / disparos recibidos)

## Anexo B — Estructura del formulario de evaluación bimestral

Escala de calificación (1–5) para todos los ítems:
1. No lo ha aprendido — 2. En proceso de aprendizaje — 3. Aprendido — 4. Lo controla conscientemente — 5. Lo maneja al 100%

Bloques (cada uno con sus ítems, promedio automático, y campo de observaciones):
- **Habilidades de patín**: freno controlado (dos pies / un pie, frontal y atrás), giros controlados, crossover frontal y atrás, patinaje hacia atrás, pivots frente/atrás.
- **Control de puck**: stickhandling (lateral, diagonal, adelante-atrás, toe drag), puck protection, acelerar con el puck a una mano, control de disco en velocidad (de frente, de espaldas).
- **Tipos de pases**: forehand, backhand, saucer, recepción correcta del pase.
- **Disparos**: wrist shot, backhand, deflect/tipping, snap shot, slap shot, one-timer.
- **Contacto con el cuerpo**: stick on puck, stick lift, amarrar en bandas, estabilidad al recibir contacto.
- **Velocidad**: arranques (frontal/crossover/espalda), zig-zag, one lap, 40 mts lineales.
- **Ataque**: pases largos, give and go, ocupar espacios vacíos, pases cruzados.
- **Defensa**: marcas, evitar pases cruzados, control del gap, salir de la presión.

DOFA (texto libre), cruzando cada cuadrante con sub-áreas: Defensivo, Ofensivo, General, Trabajo en equipo, Comunicación, Autoconfianza.
- Fortalezas / Debilidades (dependen del jugador)
- Oportunidades / Amenazas (dependen del contexto externo)

---

*Pregunta abierta pendiente para el cliente: formato final de las encuestas de padres/deportistas (se construye con motor genérico configurable mientras tanto, ver sección 4).*
