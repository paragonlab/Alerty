# Product Marketing Context

*Last updated: 2026-09-06*

## Product Overview
**One-liner:** Pulso te dice si es seguro salir, con el mapa de tu zona y los pulsos de la comunidad y los noticieros.
**What it does:** Mapa en vivo de Culiacán. El calor y los pines muestran dónde hay peligro. Los pulsos mezclan reportes ciudadanos, X y RSS de noticieros. Compartes el veredicto de tu zona por WhatsApp.
**Product category:** App de seguridad ciudadana / mapa de alertas
**Product type:** App móvil Expo + web (Vercel) + Supabase
**Business model:** Gratis (mapa, calor, pulsos, SOS). Círculo $39/mes: más zonas vigiladas. Aliado $499/mes: pin útil en el mapa. Noticieros: link e insignia del medio, gratis.

## Target Audience
**Target companies:** N/A (B2C)
**Decision-makers:** Personas que viven o se mueven en Culiacán
**Primary use case:** Antes de salir, ver si la zona está tranquila
**Jobs to be done:**
- ¿Puedo salir / ir a esta colonia?
- Enterarme de lo que está pasando cerca (comunidad + noticieros)
- Avisar a familia o al grupo de WhatsApp
**Use cases:**
- Checar la colonia antes de ir al trabajo, escuela o un mandado
- Seguir un pulso de X/noticia y verlo en el mapa
- Reportar con GPS cuando algo pasa frente a ti

## Problems & Pain Points
**Core problem:** WhatsApp y X avisan tarde, sin mapa, y no responden “¿esta zona está bien ahora?”
**Why alternatives fall short:**
- Grupos de WhatsApp: ruido, sin geo, se pierde el hilo
- X/noticieros: ciudad entera, no tu cuadra
- Apps de news: no son herramienta de salida diaria
**What it costs them:** Tiempo, miedo, rutas malas, salir a una zona caliente
**Emotional tension:** Ansiedad de “¿estará pesado por allá?”

## Competitive Landscape
**Direct:** Grupos de WhatsApp de la colonia — caóticos, no hay mapa
**Secondary:** X + noticieros locales — informan, no deciden si sales
**Indirect:** No checar y preguntar a un conocido — hábito, no herramienta

## Differentiation
**Key differentiators:**
- Respuesta en 2 segundos: Puedes salir / Sal con precaución / Mejor evítala
- Pulsos = ciudadanos + comunidad + noticieros, en el mismo mapa
- Share nativo a WhatsApp (el canal donde ya vive la conversación)
**How we do it differently:** El mapa es el producto, no el feed
**Why that's better:** Decides con zona + recencia, no con un screenshot suelto
**Why customers choose us:** Es el check diario antes de salir

## Objections
| Objection | Response |
|-----------|----------|
| “Hay pocas alertas” | Los pulsos de X/RSS llenan el mapa; el calor usa esa densidad |
| “¿Y si el pin está mal?” | Preferimos colonia del texto; sin geo no entra al mapa |
| “¿Otra app que pedir login?” | Login para reportar y trust; el valor es ver la zona |

**Anti-persona:** Quien busca cobertura nacional o “Instagram de stories”. Pulso es Culiacán primero, mapa primero.

## Switching Dynamics
**Push:** Cansancio de cadenas de WhatsApp y rumores
**Pull:** Veredicto de zona + mapa de calor en vivo
**Habit:** Abrir el grupo de la colonia
**Anxiety:** “¿Y si Pulso se equivoca y salgo / no salgo?”

## Customer Language
**How they describe the problem:**
- "¿Está pesado por allá?"
- "¿Puedo salir?"
- "¿Qué está pasando en [colonia]?"
**How they describe us:**
- "El mapa de las alertas"
- "Instagram de alertas pero en mapa"
**Words to use:** zona, pulso, salir, cerca, comunidad, noticieros, Culiacán
**Words to avoid:** heatmap Plus, demo, Instagram (como feed de stories), México entero
**Glossary:**
| Term | Meaning |
|------|---------|
| Pulso | Señal en el mapa: reporte, post de comunidad o noticia |
| Zona | Radio ~800 m alrededor de ti o de un punto tocado |
| Calor | Densidad reciente de pulsos |

## Brand Voice
**Tone:** Directo, local, serio sin dramatizar
**Style:** Frases cortas. Respuesta primero.
**Personality:** Útil, cercana, urgente cuando toca

## Proof Points
**Metrics:** En construcción (Culiacán, cron X/RSS ~10 min)
**Customers:** Residentes y gente que se mueve en Culiacán
**Value themes:**
| Theme | Proof |
|-------|-------|
| Diario | Veredicto de zona al abrir el mapa |
| Informado | Pulsos comunidad + noticieros |
| Compartible | Un tap a WhatsApp |

## Goals
**Business goal:** Hábito diario en Culiacán; el share de zona es el loop viral
**Conversion action:** Abrir el mapa + compartir “¿puedo salir?”
**Current metrics:** App en producción (alerty-two.vercel.app); login requerido
