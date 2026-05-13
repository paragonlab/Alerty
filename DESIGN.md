# DESIGN.md — Alerty

> App de alertas comunitarias en tiempo real para Culiacán, Sinaloa.
> El diseño comunica urgencia sin pánico, comunidad sin caos, información sin ruido.

---

## 1. Visual Theme & Atmosphere

**Nombre del sistema:** *Tierra Alerta*

Dos modos de personalidad opuesta que coexisten:

| Modo | Cuándo | Sensación |
|------|--------|-----------|
| **Luz Cálida** (light) | Día, navegación tranquila | Periódico de barrio impreso en papel crema. Cercano, legible, local. |
| **Alta Visibilidad** (dark) | Noche, emergencias activas | Pantalla de control de tráfico aéreo. Neon sobre negro total. Cada píxel importa. |

El diseño nunca grita innecesariamente. La urgencia se comunica con **color e intensidad**, no con tamaño o cantidad de elementos. Menos elementos, más peso por elemento.

---

## 2. Color Palette & Roles

### Modo Luz Cálida

| Nombre semántico | Hex | Rol |
|---|---|---|
| `background` | `#F6F2EA` | Papel crema — superficie base, cálida |
| `surface` | `#FFFFFF` | Tarjetas, modales, inputs |
| `surfaceAlt` | `#EFE6D7` | Fondos secundarios, chips |
| `border` | `#E1D4C2` | Separadores, bordes de tarjetas |
| `text` | `#1B1A17` | Texto principal — casi negro, no frío |
| `textMuted` | `#6A6257` | Metadatos, marcas de tiempo, labels |
| `accent` | `#D9552B` | CTA principal, acento terracota |
| `accentSoft` | `#F3B8A4` | Backgrounds de badges accent |
| `success` | `#1F9D6E` | Zona segura, capturas, verificación |
| `warning` | `#D79A24` | Alertas moderadas, advertencias |
| `danger` | `#B6402F` | Errores, alertas críticas UI |
| `reportAction` | `#E53935` | Botón SOS, acción de reporte |

### Modo Alta Visibilidad

| Nombre semántico | Hex | Rol |
|---|---|---|
| `background` | `#000000` | Negro absoluto — sin grises |
| `surface` | `#121212` | Tarjetas sobre el negro |
| `surfaceAlt` | `#1A1A1A` | Superficies secundarias |
| `border` | `#333333` | Bordes casi invisibles, estructura mínima |
| `text` | `#FFFFFF` | Blanco puro |
| `textMuted` | `#999999` | Metadatos, timestamp |
| `accent` | `#FF4500` | Neon naranja-rojo — identidad de emergencia |
| `success` | `#00FF41` | Neon verde — zona segura, captura |
| `warning` | `#FFEA00` | Neon amarillo — peligro moderado |
| `danger` | `#FF0000` | Neon rojo — peligro máximo |
| `mapVerified` | `#00E0FF` | Neon cyan — alertas verificadas en mapa |
| `mapMedia` | `#FF00FF` | Neon magenta — alertas con foto/video |
| `reportAction` | `#FF3131` | SOS button core |

### Sistema de intensidad de alertas (compartido)

La edad de una alerta define su color — no su categoría. Esto es central en la personalidad de Alerty.

| Franja temporal | Color | Hex | Significado |
|---|---|---|---|
| 0–20 min | Rojo | `#D9342B` / `#FF0000` | Activo ahora mismo |
| 20–60 min | Naranja | `#E9792F` / `#FF8C00` | Reciente, monitorear |
| 60+ min | Amarillo | `#E5C548` / `#FFFF00` | Historial, puede haber evolucionado |

---

## 3. Typography Rules

**Fuente única:** [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk)

Space Grotesk es geométrica y tiene carácter propio. No es la sans-serif corporativa de siempre. Tiene "dientes" — personalidad técnica con calidez.

| Rol | Weight | Uso |
|---|---|---|
| `heading` | 700 Bold | Títulos, categorías, valores de stat, labels de botón |
| `body` | 500 Medium | Descripción de alertas, texto de tarjetas |
| `mono` | 400 Regular | Timestamps, coordenadas, badges de metadata |

**Reglas tipográficas:**
- Headings de mapa y stat: 18px mínimo, siempre Bold
- Timestamps: 12px Regular — nunca compiten con el contenido
- Category pills: 11px Bold, siempre uppercase implied by weight
- Hint text (SOS): letra-espaciado +1px, ALL CAPS, 9–10px
- Nunca usar italic. Nunca mezclar pesos en la misma línea.

---

## 4. Component Styling

### AlertCard
- Barra izquierda de 4px de ancho con el color de intensidad de la alerta
- Border radius: `xl` (18px), borde sutil `border` color
- Padding interno: 14px
- Category pill: border + background ambos derivados del color de intensidad con opacidad (60% y 12%)
- Footer: votePill y mediaPill en `surfaceAlt` con borde, pill radius, 9px horizontal padding
- Estado pressed: `opacity: 0.75` — feedback inmediato, sin animación costosa

### GlowMarker (mapa)
- Círculo pulsante animado — frecuencia de pulso proporcional a la edad de la alerta
- Alertas recientes pulsan rápido, alertas viejas lento
- Con media: punto central más grande + ícono de cámara
- Verificado: checkmark superpuesto en `mapVerified`
- En modo `lowConnection`: animación desactivada, render estático

### SOSButton
- Botón circular 72px, rojo sólido `#FF0000`, borde blanco 20% opacity
- Anillo SVG de progreso: se llena en 2 segundos de press sostenido
- Glow exterior pulsante siempre activo (escala 1→1.4→1, 1500ms loop)
- Press: escala a 1.5x con spring friction 3
- Al completar: flash blanco instantáneo (50ms) + haptic success
- Haptic progresivo: Light hasta 60% progreso, Medium desde 60% — frecuencia aumenta de 250ms a 80ms
- Texto: "REPORTAR" en 12px Bold, ALL CAPS

### Map Header Card
- Glass effect (`expo-glass-effect`) sobre gradiente lineal
- Posición: `top: 54`, margins 16px horizontal
- Stats (Activas / Críticas) en view con `surfaceAlt` background y borde
- Separador vertical 1px entre stats
- Botón de ubicación: circular 36px, fondo con 5% opacidad

### Live Ticker
- Pill glass en la parte inferior del mapa (`bottom: 120`)
- Ícono `pulse` en `reportAction` color
- Texto truncado a 1 línea — velocidad sobre completitud

### Sponsor/Refugio Markers
- 28px círculos con borde blanco 2px
- Refugio: color `success`, ícono `shield-checkmark`
- Anuncio: color `accent`, ícono `star`

### Reputation Badges
| Nivel | Color | Icono | Desde |
|---|---|---|---|
| Ciudadano | `#666666` | person | 0 pts |
| Vigía | `#2E7D32` | eye | 20 pts |
| Protector | `#1565C0` | shield | 50 pts |
| Héroe Local | `#C62828` | star | 80 pts |

Badge: 4px radius, color + 18% opacity background, 8px icon, 9px text uppercase.

---

## 5. Layout Principles

- **Grid base:** 16px márgenes horizontales en todas las pantallas
- **Gap entre cards en feed:** 12px
- **Spacing entre elementos dentro de tarjetas:** 9px (gap interno)
- **Padding de tarjeta:** 14px
- **Padding de pills/chips:** 9px horizontal, 4–5px vertical
- **Safe area:** siempre respetar con `SafeAreaView`
- El mapa ocupa `flex: 1` completo — los controles flotan sobre él como overlays absolutos

**Overlays del mapa (orden vertical):**
1. Gradiente top fade (height: 160)
2. Header card (top: 54)
3. Heatmap toggle (top: 96, left: 16)
4. Empty state (centrado, bottom: 160)
5. Live ticker (bottom: 120)
6. SOS button (tab bar area)

---

## 6. Depth & Elevation

- **Sombras:** usadas solo en elementos interactivos y markers del mapa
- SOS glow: `shadowColor: mapRed`, `shadowRadius: 15`, `shadowOpacity: 0.8`
- Sponsor markers: `elevation: 4`, shadow offset (0, 2)
- Header card: borde 1.5px — la profundidad viene del glass effect, no de sombras
- No usar `elevation` en tarjetas de feed — el borde y el color hacen el trabajo

---

## 7. Do's and Don'ts

**Hacer:**
- Comunicar urgencia con COLOR, no con tamaño de texto ni cantidad de iconos
- Usar el sistema de intensidad (rojo→naranja→amarillo) para toda visualización temporal de alertas
- Mantener el mapa limpio — cada marker debe justificar su presencia
- Glass effect solo en overlays sobre mapa — no en tarjetas de feed
- Haptic feedback en todas las acciones de usuario críticas (reporte, SOS, location)
- En modo Alta Visibilidad: fondo absolutamente negro, sin grises de superficie más oscuros de #1A1A1A

**No hacer:**
- No usar más de 2 elementos en el mismo nivel de jerarquía visual
- No animar en modo `lowConnection` — rendimiento sobre estética
- No usar colores neon fuera del modo Alta Visibilidad
- No usar más de un typeface — Space Grotesk en todos sus pesos es suficiente
- No mostrar timestamps en formato absoluto — siempre relativo ("hace 3 min")
- No usar gradientes de más de 2 stops en componentes de feed
- No poner texto blanco sobre `accent` o `warning` — verificar contraste

---

## 8. Responsive & Platform Behavior

- **iOS / Android:** experiencia completa — mapa, markers, haptics, glass
- **Web:** mapa reemplazado por placeholder con ícono `map` — no intentar renderizar mapa en web
- Touch targets mínimos: 44×44px (botones de acción secundaria), 72px para SOS
- En pantallas pequeñas (< 375px): reducir padding de header a 10px, stat font a 14px

---

## 9. Animation Principles

Alerty usa animación para comunicar estado, no para decorar.

| Elemento | Animación | Propósito |
|---|---|---|
| GlowMarker | Pulso escala (loop) | Indica que la alerta está viva |
| SOSButton glow | Respiración escala 1→1.4 (1500ms loop) | Invita a la acción sin urgir |
| SOSButton press | Spring scale 1→1.5 (friction 3) | Feedback físico de "cargando" |
| SOSButton flash | Timing 50ms→400ms opacity | Confirmación visual de envío |
| Card press | opacity 0.75 | Feedback inmediato, sin latencia |
| Progress ring | Timing 2000ms, dashoffset interpolation | Tiempo visible de confirmación |

**Velocidades de pulso de GlowMarker por edad:**
- 0–20 min: 800ms
- 20–60 min: 1400ms
- 60+ min: 2200ms

---

## 10. Agent Prompt Guide

Colores de referencia rápida:
- Emergencia: `#FF0000` / `#E53935`
- Seguro: `#00FF41` / `#1F9D6E`
- Moderado: `#FFEA00` / `#D79A24`
- Identidad: `#D9552B` (light) / `#FF4500` (dark)
- Base: `#F6F2EA` (light bg) / `#000000` (dark bg)

Prompts listos para usar:
- *"Crea una pantalla de detalle de alerta siguiendo el DESIGN.md de Alerty. Usa la barra lateral de color de intensidad, Space Grotesk Bold para el título, metadata en textMuted, y un mapa miniatura en la parte superior."*
- *"Diseña el onboarding de Alerty. Tono: informativo, no alarmante. Fondo crema #F6F2EA, ícono de alerta en accent #D9552B, tipografía Space Grotesk."*
- *"Construye un modal de confirmación de reporte con el sistema de colores Alta Visibilidad: fondo #000000, texto #FFFFFF, acción primaria en #FF4500, SOS en #FF3131."*
- *"Crea un perfil de usuario con el sistema de reputación: badge de nivel con color y ícono, Trust Score como barra de progreso, historial de alertas en lista."*
