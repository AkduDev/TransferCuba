# TransferCuba Frontend V2 — Plan de Implementación

## Tesis Central

**Vender el problema, no la funcionalidad.**

El usuario no busca "un mapa". Busca: **"¿Dónde puedo pagar por transferencia?"**

Posicionamiento objetivo:
> **Encuentra dónde pagar. Compra. Pida. Reciba.**
> TransferCuba conecta personas, negocios y mensajeros en un solo lugar.

---

## Fases

### Fase 1 — Copy y texto (impacto inmediato, 0 cambio visual)
Cambiar textos en componentes existentes sin tocar layouts.

### Fase 2 — TopBar simplificada (protagonista: el buscador)
Reducir ruido, hacer el buscador el elemento central.

### Fase 3 — BusinessCard orientada a conversión
Rediseñar la tarjeta de negocio para vender confianza y CTA.

### Fase 4 — Ficha de negocio (detail view) con delivery integrado
Separar "encontrar" de "recibir". Delivery visible en la ficha.

### Fase 5 — Bottom sheet móvil mejorada
Experiencia mobile más comercial y decision-oriented.

### Fase 6 — Empty states y microcopy
Estados vacíos que conviertan, no que frustren.

### Fase 7 — Delivery visible desde el mapa
Solicitudes de delivery como feature de discovery, no escondido.

### Fase 8 — Renombrar componentes (identidad propia)
De GoogleMaps* a TransferCuba*/Business*.

---

## Fase 1 — Copy y Texto

**Objetivo:** Cambiar la percepción del producto sin tocar layouts.

### Archivos a modificar

#### `components/GoogleMapsSideDrawer.tsx`
| Línea actual | Cambio |
|---|---|
| `"Donde Pago? Cuba"` | `"TransferCuba"` |
| `"Negocios cerca de mi"` | `"Explorar cerca de ti"` |
| `"+ Registrar mi negocio"` | `"+ Agregar mi negocio"` |
| `"Pedir un envio"` | `"Solicitar delivery"` |
| `"Mensajeria"` | `"Mis entregas"` |
| `"Sobre los pagos digitales en Cuba"` | `"¿Por qué TransferCuba?"` |
| `"Donde Pago? Cuba"` (footer) | `"TransferCuba"` |

#### `components/GoogleMapsTopBar.tsx`
| Línea actual | Cambio |
|---|---|
| Placeholder `"Buscar negocios, direcciones…"` | `"¿Qué estás buscando?"` |
| Chip `"Activo ahora"` | `"🟢 Transferencia activa"` |

#### `components/GoogleMapsPlaceCard.tsx`
| Línea actual | Cambio |
|---|---|
| Badge `"Transferencia activa"` | `"🟢 Activa"` (código existente) |
| Badge `"Sin transfer"` | `"⚠ Sin transferencia"` |

#### `components/GoogleMapsDesktopPanel.tsx`
| Línea actual | Cambio |
|---|---|
| Empty state `"No se encontraron negocios"` | `"No encontramos negocios cerca"` + subtítulo + CTA |
| Detail header `"Resultados"` | `"← Volver a resultados"` |
| `"Confirmaciones de la comunidad"` | `"La comunidad confirma"` |

#### `components/GoogleMapsMobileBottomSheet.tsx`
| Línea actual | Cambio |
|---|---|
| Empty state text | `"No encontramos negocios cerca"` + CTA |

#### `components/GoogleMapsFiltersModal.tsx`
| Línea actual | Cambio |
|---|---|
| Title `"Filtros de Busqueda"` | `"Filtros"` |
| Button `"Ver N resultados"` | `"Ver negocios"` |

#### `components/GoogleMapsMessengerModal.tsx`
| Línea actual | Cambio |
|---|---|
| `"Carreras"` tab | `"Solicitudes"` |
| `"Stats"` tab | `"Resumen"` |
| Empty `"No hay carreras pendientes"` | `"No hay solicitudes disponibles ahora"` + subtítulo |
| `"Ganancias totales"` | `"Ingresos"` |

#### `components/RegisterBusinessModal.tsx`
| Línea actual | Cambio |
|---|---|
| Title/CTA (verificar texto exacto) | `"¿Tienes un negocio? Haz que te encuentren."` |

#### `components/GoogleMapsDeliveryModal.tsx`
| Línea actual | Cambio |
|---|---|
| Title | `"Solicitar delivery"` |
| Empty history | `"Aún no has solicitado deliveries"` |

---

## Fase 2 — TopBar Simplificada

**Objetivo:** Reducir la fila de chips a lo esencial. El buscador es el protagonista.

### `components/GoogleMapsTopBar.tsx` (376 líneas → ~320)

#### Layout actual (2 filas):
```
Row 1: [☰ Logo] [🔎 Buscar negocios, direcciones…] [📍 Provincia]
Row 2: [Activo ahora] [Tiendas] [Comida] [Farmacias] [Cafeterías] [Servicios] [Ferretería] [Ropa] [Provincia] [Verificados] [Pendientes] [Reportados] [Cuenta] [Admin]
```

#### Layout objetivo (2 filas, más limpio):
```
Row 1: [☰] [TransferCuba] [🔎 ¿Qué estás buscando?] [📍]
Row 2: [Cerca de mí] [🍔 Comer] [🛒 Comprar] [💊 Salud] [👕 Vestir] [🔧 Servicios] [🏠 Hogar] [📱 Tecno] [🟢 Transferencia activa] [+ Admin] [👤]
```

#### Cambios específicos:

1. **Renombrar categorías** en `lib/cuba-data.ts` CATEGORIES array:
   | Actual | Nuevo |
   |---|---|
   | `Tiendas & Mercados` | `🛒 Comprar` |
   | `Comida & Restaurantes` | `🍔 Comer` |
   | `Farmacias & Salud` | `💊 Salud` |
   | `Cafeterías & Bakeries` | `☕ Cafeterías` |
   | `Servicios` | `🔧 Servicios` |
   | `Ferretería & Construcción` | `🏠 Hogar` |
   | `Ropa & Accesorios` | `👕 Vestir` |
   | `Tecnología` | `📱 Tecnología` |

2. **Mover filtros de verificación** al FiltersModal (no en la barra de chips). Solo quedan:
   - "Cerca de mí" (nuevo chip con ícono de ubicación)
   - Categorías (emojis)
   - "Transferencia activa" (ya existe)
   - "Verificados" → se mueve a filtros avanzados

3. **Provincia** se mantiene como chip colapsable (actual behavior está bien).

4. **Account y Admin** se mantienen pero más compactos (iconos sin texto en mobile).

---

## Fase 3 — BusinessCard Orientada a Conversión

**Objetivo:** La tarjeta debe vender: "¿Puedo pagar aquí?" → "¿Puedo confiar?" → "¿Qué hago?"

### `components/GoogleMapsPlaceCard.tsx` (174 líneas → ~200)

#### Layout actual:
```
[Nombre ✓] [ thumbnail 72x72]
📍 800m · Vedado · Centro
⭐ 4.8 (12) · Restaurantes
───
🟢 Transferencia activa  TM EZ QR  [🗺 📱 ☎]
```

#### Layout objetivo:
```
La Esquina Market  ✓ Verificado
📍 800m · Vedado              🟢 Activa

🛒 Comer  ·  ⭐ 4.8 (12)

Transfermóvil  EnZona  QR

[Cómo llegar]              [🚚 Delivery]
```

#### Cambios específicos:

1. **Fila superior:** Nombre + badge verificación a la izquierda. Badge transferencia a la derecha (más protagonismo).

2. **Distancia + ubicación:** Debajo del nombre, línea limpia.

3. **Categoría + rating:** Línea separada con emoji de categoría (no el label largo).

4. **Payment badges:** Con labels completos, no solo siglas:
   - `"Transfermóvil"` (no "TM")
   - `"EnZona"` (no "EZ")
   - `"QR"` (se mantiene)

5. **Acciones visibles:** Dos CTA explícitos:
   - `"Cómo llegar"` → OSRM route (ícono Navigation)
   - `"🚚 Delivery"` → solo si el negocio tiene delivery habilitado (nuevo campo)

6. **Quitar action icons pequeños** (MessageCircle, Phone) de la tarjeta. Se muestran en la ficha detail.

### `lib/cuba-data.ts` — campo `hasDelivery`
Agregar campo `hasDelivery: boolean` al tipo Business y al schema SQL.

---

## Fase 4 — Ficha de Negocio con Delivery Integrado

**Objetivo:** Separar "encontrar" de "recibir". Delivery como CTA natural dentro de la ficha.

### `components/GoogleMapsDesktopPanel.tsx` (479 líneas → ~550)

#### Layout detail actual:
```
← Resultados           [Compartir] [X]

[ BusinessCover hero ]

🟢 Transferencia activa
✓ Verificado

[WhatsApp] [Como llegar] [Teléfono]

📍 Dirección
🕐 Horario
📝 Descripción

Transfermóvil  EnZona  QR  Efectivo

👍 12  👎 0
[Reportar]
```

#### Layout detail objetivo:
```
← Volver a resultados       [Compartir] [X]

[ BusinessCover hero ]

🟢 TRANSFERENCIA ACTIVA
Confirmado por 18 personas · hace 23 min

📍 Plaza de la Revolución, Vedado
🕐 Abierto hasta las 8:00 PM
✓ Verificado por TransferCuba

Transfermóvil  EnZona  QR

★★★★★ 4.8 (12 reseñas)

[📱 WhatsApp]  [🗺 Cómo llegar]  [📞 Llamar]

───────────────────────────

🚚 ¿Quieres recibir tu compra?

Solicita un mensajero desde TransferCuba.

[Solicitar delivery]

───────────────────────────

La comunidad dice:

👍 18 confirmaciones · 👎 0 reportes

[👍 Confirmar que funciona]  [⚠ Reportar problema]

[Ver en OpenStreetMap]
```

#### Cambios específicos:

1. **Transfer status:** De badge pequeño a bloque prominente. Agregar "Confirmado por X personas · hace Y min" (requiere query a confirmations con timestamp).

2. **Info block:** Dirección + horario + verificación juntos.

3. **Payment methods:** Labels completos con checkmarks.

4. **Rating:** Estrellas visuales + count de reseñas.

5. **CTAs en fila:** WhatsApp, Cómo llegar, Llamar — juntos y visibles.

6. **Bloque de delivery:** Nuevo, solo visible si `business.hasDelivery`. Con copy que invita a solicitar.

7. **Community block:** Reorganizar confirmaciones/reports con copy más comercial.

### `lib/db.ts` — query para confirmaciones recientes
```sql
SELECT COUNT(*) as count,
       MAX(created_at) as last_confirmation
FROM business_confirmations
WHERE business_id = $1
AND created_at > NOW() - INTERVAL '24 hours'
```

---

## Fase 5 — Bottom Sheet Móvil Mejorada

**Objetivo:** En móvil, el bottom sheet es donde se toman decisiones.

### `components/GoogleMapsMobileBottomSheet.tsx` (438 líneas → ~500)

#### Cambios específicos:

1. **Header del sheet (peek):** Cuando no hay selección:
   ```
   ───────────── drag handle ─────────────
   12 negocios cerca de ti
   [Más cercanos ▾]  [Filtros]
   ```

2. **Card en peek (selección activa):**
   ```
   La Esquina Market
   🟢 Activa · 📍 800m · ✓ Verificado
   [Cómo llegar]  [🚚 Delivery]
   ```

3. **Half/Full:** misma lógica que detail view desktop, adaptada a móvil.

4. **Empty state (no selection):**
   ```
   No encontramos negocios cerca
   
   Estamos creciendo. Puedes ayudarnos
   agregando un negocio que conozcas.
   
   [Agregar negocio]
   ```

---

## Fase 6 — Empty States y Microcopy

**Objetivo:** Los estados vacíos deben convertir, no frustrar.

### Todos los componentes con empty states:

| Componente | Estado actual | Estado objetivo |
|---|---|---|
| DesktopPanel (sin resultados) | `"No se encontraron negocios"` | `"No encontramos negocios cerca"` + `"Estamos creciendo. Agrega un negocio que conozcas."` + `[Agregar negocio]` |
| DesktopPanel (sin selección) | Lista vacía | `"Explora el mapa para ver negocios"` |
| BottomSheet (sin resultados) | `"No se encontraron negocios"` | Igual que desktop |
| MessengerModal (sin carreras) | `"No hay carreras pendientes"` | `"No hay solicitudes disponibles ahora"` + `"Las nuevas solicitudes aparecerán aquí automáticamente."` + sub-bloque de marketing |
| DeliveryModal (sin historial) | Texto genérico | `"Aún no has solicitado deliveries"` + `"Solicita tu primer delivery desde un negocio cercano."` + CTA |
| FiltersModal (sin resultados) | `"No hay negocios"` | `"No encontramos negocios con estos filtros"` + `"Prueba ampliar tu búsqueda o cambiar los filtros."` |

---

## Fase 7 — Delivery Visible desde el Mapa

**Objetivo:** Delivery como feature de discovery, no escondido en un modal.

### Cambios en `MapLibreMap.tsx`:
- Ya tiene capas de delivery (`delivery-requests`, `delivery-active`). No tocar.

### Cambios en `GoogleMapsDesktopPanel.tsx`:
- En la lista de resultados, mostrar badge `"🚚 Delivery disponible"` en tarjetas que lo tengan.
- En la ficha detail, el bloque de delivery (ya diseñado en Fase 4).

### Cambios en `GoogleMapsMobileBottomSheet.tsx`:
- Misma lógica: badge `"🚚"` en tarjetas + CTA en peek.

### Nuevo campo en Business:
- `hasDelivery: boolean` en schema + DAO + Business type.

---

## Fase 8 — Renombrar Componentes

**Objetivo:** Desacoplar la identidad conceptual de "Google Maps".

| Actual | Nuevo |
|---|---|
| `GoogleMapsTopBar` | `TopBar` |
| `GoogleMapsDesktopPanel` | `ExplorePanel` |
| `GoogleMapsMobileBottomSheet` | `BottomSheet` |
| `GoogleMapsPlaceCard` | `BusinessCard` |
| `GoogleMapsFloatingControls` | `MapControls` |
| `GoogleMapsFiltersModal` | `FiltersModal` |
| `GoogleMapsSideDrawer` | `SideDrawer` |
| `GoogleMapsDeliveryModal` | `DeliveryModal` |
| `GoogleMapsMessengerModal` | `MessengerModal` |
| `GoogleMapsClusterCard` | `ClusterCard` |
| `GoogleMapsPinningControls` | `PinningControls` |
| `GoogleMapsAttribution` | `MapAttribution` |
| `GoogleMapsToast` | `Toast` |

Se hace con renombrado de archivos + update de imports en `page.tsx` y entre sí.

---

## Orden de Ejecución Recomendado

| # | Fase | Esfuerzo | Impacto | Dependencias |
|---|---|---|---|---|
| 1 | Fase 1 — Copy | Bajo | Alto | Ninguna |
| 2 | Fase 2 — TopBar | Medio | Muy alto | Fase 1 |
| 3 | Fase 3 — BusinessCard | Medio | Muy alto | Fase 1 |
| 4 | Fase 6 — Empty states | Bajo | Alto | Fase 1 |
| 5 | Fase 4 — Ficha detail | Alto | Muy alto | Fases 1-3 |
| 6 | Fase 5 — Bottom sheet | Alto | Alto | Fases 3-4 |
| 7 | Fase 7 — Delivery visible | Medio | Alto | Fases 3-4 |
| 8 | Fase 8 — Renombrar | Bajo | Medio | Todas |

---

## No Tocar

- **MapLibreMap.tsx** — La arquitectura del mapa (MVT, PostGIS, clustering, delivery layers) es sólida. No cambiar.
- **Hooks** — La separación de estado en hooks está bien diseñada. No cambiar arquitectura.
- **API routes** — La lógica backend está completa. Solo agregar campos nuevos si es necesario.
- **ModalShell.tsx** — Funciona bien. No cambiar.
- **RegisterBusinessModal.tsx** — Solo copy. No reestructurar el form.

---

## Campos Nuevos Requeridos

### SQL migration:
```sql
-- hasDelivery en businesses
ALTER TABLE businesses ADD COLUMN has_delivery BOOLEAN DEFAULT FALSE;
UPDATE businesses SET has_delivery = FALSE WHERE has_delivery IS NULL;
```

### `lib/cuba-data.ts` — Tipo Business:
```typescript
hasDelivery: boolean;
```

### Confirmaciones con timestamp:
```sql
-- Ya existe business_confirmations. Verificar que tiene created_at.
SELECT created_at FROM business_confirmations LIMIT 1;
```
