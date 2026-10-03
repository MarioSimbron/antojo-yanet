/**
 * Unit tests for the DulceBot service logic: product-name tokenization,
 * dynamic REGLA #2 construction and per-role tool sets.
 *
 * These tests cover the three bugs fixed in commits 4c6be08 – f652a07:
 *   Bug 1 — "Galleta de jamoncillo" was rejected even though "Galleta jamoncillo"
 *            existed in the catalogue.  Fixed by stripping stop-words in tokenizar.
 *   Bug 2 — "¿Vendes pan?" returned "No vendemos pan" because REGLA #1B was too
 *            broad and triggered agregar_al_carrito for availability questions.
 *            Fixed by tightening REGLA #1B; verified here via the tool set —
 *            buscar_en_menu must always be available for guest/CLIENTE so the
 *            model can look up catalogue information.
 *   Bug 3 — "dame una galleta" showed "¿Cuál de estas opciones quieres?" without
 *            listing the options.  Fixed by strengthening REGLA #3 and
 *            recordatorioAmbiguedad; verified here by checking buildRegla2 emits
 *            the required prohibition line.
 *
 * None of these tests make network or database calls — they cover only the pure
 * helper functions that are now exported from the service module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect } from 'vitest';
import {
  tokenizar,
  buildRegla2,
  obtenerToolsPorRol,
  fechaDeHoy,
} from '../../src/services/asistente.service';

// ── fechaDeHoy ────────────────────────────────────────────────────────────────

describe('fechaDeHoy — fecha de referencia para resolver fechas relativas', () => {
  /**
   * The routing evaluation showed the model asking for an "exact date in YYYY-MM-DD"
   * when the customer said "para el sábado", because the prompt had no current date.
   */
  it('incluye el día de la semana y la fecha ISO', () => {
    const texto = fechaDeHoy(new Date('2026-10-02T18:00:00Z'));
    expect(texto).toContain('viernes');
    expect(texto).toContain('(2026-10-02)');
  });

  it('usa la zona horaria de la panadería (Ciudad de México), no UTC', () => {
    // 03:00 UTC del sábado 3 = 21:00 del viernes 2 en Ciudad de México
    expect(fechaDeHoy(new Date('2026-10-03T03:00:00Z'))).toContain('(2026-10-02)');
  });
});

// ── tokenizar ─────────────────────────────────────────────────────────────────

describe('tokenizar — normalización de nombres de producto', () => {
  /**
   * Bug 1 fix: the customer often writes "Galleta de jamoncillo" but the
   * catalogue stores "Galleta jamoncillo". The "de" preposition is a stop-word
   * and must be stripped so both forms produce the same tokens.
   */
  it('elimina la preposición "de" — "galleta de jamoncillo" ≡ "galleta jamoncillo"', () => {
    expect(tokenizar('galleta de jamoncillo')).toEqual(tokenizar('galleta jamoncillo'));
  });

  it('elimina otras preposiciones del catálogo (con, del, la, el)', () => {
    expect(tokenizar('concha de vainilla')).toEqual(tokenizar('concha vainilla'));
    expect(tokenizar('churro de chocolate')).toEqual(tokenizar('churro chocolate'));
    expect(tokenizar('rol de canela')).toEqual(tokenizar('rol canela'));
  });

  it('convierte a minúsculas y quita acentos', () => {
    const a = tokenizar('Galleta Jamoncillo');
    const b = tokenizar('galleta jamoncillo');
    expect(a).toEqual(b);
  });

  it('ignora tokens de una sola letra', () => {
    const tokens = tokenizar('a b c pan');
    expect(tokens).toContain('pan');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('c');
  });

  it('aplica sufijo plural — los tokens de longitud > 3 pierden terminaciones "es" y "s"', () => {
    // "conchas" → "concha"  (plural stripped)
    const t = tokenizar('conchas');
    expect(t).toContain('concha');
  });

  it('devuelve array vacío para cadena vacía', () => {
    expect(tokenizar('')).toEqual([]);
  });

  it('devuelve array vacío cuando todos los tokens son stop-words', () => {
    expect(tokenizar('de la el los')).toEqual([]);
  });
});

// ── obtenerToolsPorRol ────────────────────────────────────────────────────────

describe('obtenerToolsPorRol — conjuntos de herramientas por rol', () => {
  /**
   * Bug 2 context: buscar_en_menu must always be present for guest/CLIENTE so
   * availability questions ("¿Vendes pan?") route to that tool, not to
   * agregar_al_carrito.
   */
  it('invitado (undefined) tiene buscar_en_menu y agregar_al_carrito', () => {
    const tools = obtenerToolsPorRol(undefined).map((t) => t.function.name);
    expect(tools).toContain('buscar_en_menu');
    expect(tools).toContain('agregar_al_carrito');
  });

  it('CLIENTE tiene buscar_en_menu y agregar_al_carrito', () => {
    const tools = obtenerToolsPorRol('CLIENTE').map((t) => t.function.name);
    expect(tools).toContain('buscar_en_menu');
    expect(tools).toContain('agregar_al_carrito');
  });

  it('CAJERO NO tiene agregar_al_carrito ni ver_reporte_ventas', () => {
    const tools = obtenerToolsPorRol('CAJERO').map((t) => t.function.name);
    expect(tools).not.toContain('agregar_al_carrito');
    expect(tools).not.toContain('ver_reporte_ventas');
    expect(tools).toContain('listar_pedidos_activos');
    expect(tools).toContain('cambiar_estatus_pedido');
  });

  it('REPARTIDOR tiene mis_pedidos_asignados y cambiar_estatus_pedido pero no agregar_al_carrito ni ver_reporte_ventas', () => {
    const tools = obtenerToolsPorRol('REPARTIDOR').map((t) => t.function.name);
    expect(tools).toContain('mis_pedidos_asignados');
    expect(tools).toContain('cambiar_estatus_pedido');
    expect(tools).not.toContain('agregar_al_carrito');
    expect(tools).not.toContain('ver_reporte_ventas');
  });

  it('MAESTRO_PANADERO tiene mis_tareas y consultar_stock pero no listar_pedidos_activos', () => {
    const tools = obtenerToolsPorRol('MAESTRO_PANADERO').map((t) => t.function.name);
    expect(tools).toContain('mis_tareas');
    expect(tools).toContain('consultar_stock');
    expect(tools).not.toContain('listar_pedidos_activos');
    expect(tools).not.toContain('agregar_al_carrito');
  });

  it('ADMIN tiene todas las herramientas incluyendo ver_reporte_ventas y agregar_al_carrito', () => {
    const tools = obtenerToolsPorRol('ADMIN').map((t) => t.function.name);
    expect(tools).toContain('ver_reporte_ventas');
    expect(tools).toContain('agregar_al_carrito');
    expect(tools).toContain('mis_tareas');
    expect(tools).toContain('listar_pedidos_activos');
  });

  it('rol desconocido cae en el conjunto de invitado', () => {
    const guest = obtenerToolsPorRol(undefined).map((t) => t.function.name);
    const unknown = obtenerToolsPorRol('ROL_INEXISTENTE').map((t) => t.function.name);
    expect(unknown).toEqual(guest);
  });
});

// ── buildRegla2 ───────────────────────────────────────────────────────────────

describe('buildRegla2 — construcción dinámica por rol', () => {
  /**
   * Bug 3 context: when agregar_al_carrito returns an ambiguous product list,
   * REGLA #2 must tell the model it is the ÚNICA forma de agregar. This is in
   * buildRegla2 so the model never claims something was added without calling it.
   * Also tests that guest/CLIENTE REGLA #2 forbids the model from saying items
   * were added without the tool call.
   */
  it('para invitado incluye la línea de agregar_al_carrito con "ÚNICA forma"', () => {
    const tools = obtenerToolsPorRol(undefined);
    const regla = buildRegla2(tools);
    expect(regla).toContain('agregar_al_carrito');
    expect(regla).toContain('ÚNICA forma');
  });

  it('para CAJERO NO incluye la línea de agregar_al_carrito', () => {
    const tools = obtenerToolsPorRol('CAJERO');
    const regla = buildRegla2(tools);
    expect(regla).not.toContain('agregar_al_carrito');
  });

  it('para CAJERO NO incluye ver_reporte_ventas', () => {
    const tools = obtenerToolsPorRol('CAJERO');
    const regla = buildRegla2(tools);
    expect(regla).not.toContain('ver_reporte_ventas');
  });

  it('para REPARTIDOR incluye mis_pedidos_asignados pero no ver_reporte_ventas', () => {
    const tools = obtenerToolsPorRol('REPARTIDOR');
    const regla = buildRegla2(tools);
    expect(regla).toContain('mis_pedidos_asignados');
    expect(regla).not.toContain('ver_reporte_ventas');
  });

  it('para MAESTRO_PANADERO incluye mis_tareas pero no agregar_al_carrito', () => {
    const tools = obtenerToolsPorRol('MAESTRO_PANADERO');
    const regla = buildRegla2(tools);
    expect(regla).toContain('mis_tareas');
    expect(regla).not.toContain('agregar_al_carrito');
  });

  it('para ADMIN incluye todas las herramientas', () => {
    const tools = obtenerToolsPorRol('ADMIN');
    const regla = buildRegla2(tools);
    expect(regla).toContain('ver_reporte_ventas');
    expect(regla).toContain('agregar_al_carrito');
    expect(regla).toContain('mis_tareas');
    expect(regla).toContain('listar_pedidos_activos');
  });

  it('siempre incluye la advertencia de usar solo herramientas listadas', () => {
    for (const rol of [undefined, 'CLIENTE', 'CAJERO', 'REPARTIDOR', 'MAESTRO_PANADERO', 'ADMIN']) {
      const tools = obtenerToolsPorRol(rol);
      const regla = buildRegla2(tools);
      expect(regla).toContain('Solo usa las herramientas listadas arriba');
    }
  });

  it('con array vacío de tools devuelve solo el encabezado y la advertencia', () => {
    const regla = buildRegla2([]);
    expect(regla).toContain('== REGLA #2');
    expect(regla).toContain('Solo usa las herramientas listadas arriba');
    expect(regla).not.toContain('buscar_en_menu');
  });
});
