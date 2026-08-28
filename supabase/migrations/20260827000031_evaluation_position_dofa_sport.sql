-- ============================================================================
-- Ajustes al módulo de evaluaciones:
--   1) evaluation_blocks gana "aplica_a" (jugador_de_campo/portero/ambos),
--      mismo patrón que stat_definitions.applies_to, + is_active para poder
--      desactivar bloques/ítems desde el editor de plantillas del admin.
--      Los 8 bloques existentes (Anexo B) son de jugador de campo; se agrega
--      un catálogo inicial de portero (propuesta razonable, ajustable luego
--      desde el editor).
--   2) evaluation_dofa se duplica por deporte (línea/hielo): ambos DOFA
--      completos y siempre visibles en el formulario, distinguidos por una
--      columna "sport".
--
-- Toda la data de evaluation_reports hasta ahora es de prueba -- se borra
-- (cascada a evaluation_scores/evaluation_dofa/evaluation_block_notes) para
-- poder endurecer evaluation_dofa a NOT NULL sin arrastrar filas viejas sin
-- deporte asignado. El catálogo (evaluation_blocks/evaluation_items) NO se
-- borra: es Anexo B real, se altera in-place.
-- ============================================================================

delete from public.evaluation_reports;

-- ----------------------------------------------------------------------------
-- 1) Posición: evaluation_blocks.applies_to + is_active (blocks e items)
-- ----------------------------------------------------------------------------

create type public.evaluation_applies_to as enum ('jugador_de_campo', 'portero', 'ambos');

alter table public.evaluation_blocks
  add column applies_to public.evaluation_applies_to not null default 'jugador_de_campo',
  add column is_active boolean not null default true;

alter table public.evaluation_blocks alter column applies_to drop default;

alter table public.evaluation_items
  add column is_active boolean not null default true;

-- Catálogo inicial de portero -- propuesta razonable de bloques/ítems típicos
-- de evaluación de arquero de hockey, misma escala 1-5 y estructura que el
-- Anexo B. El admin lo puede ajustar después con el editor de plantillas.
insert into public.evaluation_blocks (key, label, sort_order, applies_to) values
  ('portero_posicionamiento', 'Posicionamiento', 9, 'portero'),
  ('portero_atajadas', 'Atajadas', 10, 'portero'),
  ('portero_manejo_rebote', 'Manejo de rebote', 11, 'portero'),
  ('portero_salida_arco', 'Salida de arco', 12, 'portero'),
  ('portero_juego_stick', 'Juego con el stick', 13, 'portero'),
  ('portero_comunicacion', 'Comunicación con la defensa', 14, 'portero');

insert into public.evaluation_items (block_id, key, label, sort_order)
select b.id, i.key, i.label, i.sort_order
from public.evaluation_blocks b
join (values
  ('portero_posicionamiento', 'angulo_juego', 'Ángulo de juego (cierre del ángulo)', 1),
  ('portero_posicionamiento', 'profundidad_arco', 'Profundidad en el arco (challenge)', 2),
  ('portero_posicionamiento', 'balance_postura', 'Balance y postura básica', 3),
  ('portero_posicionamiento', 'desplazamiento_lateral', 'Desplazamiento lateral (shuffle / T-push)', 4),
  ('portero_posicionamiento', 'recovery_post_atajada', 'Recovery tras la primera atajada', 5),

  ('portero_atajadas', 'atajada_guante', 'Atajada con guante', 1),
  ('portero_atajadas', 'atajada_bloqueador', 'Atajada con bloqueador', 2),
  ('portero_atajadas', 'atajada_cuerpo_pads', 'Atajada con el cuerpo/pads', 3),
  ('portero_atajadas', 'butterfly', 'Butterfly / medio butterfly', 4),
  ('portero_atajadas', 'atajada_baja_paddle', 'Atajadas bajas (paddle down)', 5),
  ('portero_atajadas', 'atajada_desvios_rebotes', 'Atajadas en desvíos y rebotes rápidos', 6),

  ('portero_manejo_rebote', 'control_rebote', 'Control de rebote (rebote controlado vs. libre)', 1),
  ('portero_manejo_rebote', 'cubrir_disco', 'Cubrir el disco (cobertura del rebote)', 2),
  ('portero_manejo_rebote', 'redirigir_rebote', 'Redirigir el rebote a zonas seguras', 3),
  ('portero_manejo_rebote', 'reaccion_rebote_secundario', 'Reacción a rebotes secundarios', 4),

  ('portero_salida_arco', 'lectura_para_salir', 'Lectura de la jugada para decidir salir', 1),
  ('portero_salida_arco', 'manejo_puck_fuera_arco', 'Manejo de puck fuera del arco', 2),
  ('portero_salida_arco', 'pase_salida_defensa', 'Pase de salida al defensa', 3),
  ('portero_salida_arco', 'cobertura_arco_vacio', 'Cobertura del arco vacío tras salir', 4),

  ('portero_juego_stick', 'poke_check', 'Poke check', 1),
  ('portero_juego_stick', 'detener_controlar_pases_stick', 'Detener y controlar pases con el stick', 2),
  ('portero_juego_stick', 'pases_breakout', 'Pases con el stick (breakout)', 3),
  ('portero_juego_stick', 'cobertura_5_hole', 'Cobertura de la parte baja del arco (5-hole)', 4),

  ('portero_comunicacion', 'comunicacion_marcas', 'Comunicación de marcas y coberturas', 1),
  ('portero_comunicacion', 'organizacion_defensa', 'Organización de la defensa en jugadas de bloqueo', 2),
  ('portero_comunicacion', 'comunicacion_pp_pk', 'Comunicación en power play / penalty kill', 3),
  ('portero_comunicacion', 'liderazgo_voz', 'Liderazgo y voz durante el partido', 4)
) as i(block_key, key, label, sort_order) on i.block_key = b.key;

-- El admin ahora también puede escribir el catálogo desde el editor de
-- plantillas (antes solo tenía SELECT para cualquier autenticado).
create policy "evaluation_blocks: admin writes"
  on public.evaluation_blocks for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "evaluation_items: admin writes"
  on public.evaluation_items for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant insert, update, delete on public.evaluation_blocks to authenticated;
grant insert, update, delete on public.evaluation_items to authenticated;

-- ----------------------------------------------------------------------------
-- 2) DOFA duplicado por deporte
-- ----------------------------------------------------------------------------

-- evaluation_reports ya se vació arriba (cascada a evaluation_dofa), así que
-- la columna se puede agregar NOT NULL sin default que arrastre filas viejas.
alter table public.evaluation_dofa
  add column sport public.sport not null;

alter table public.evaluation_dofa
  drop constraint if exists evaluation_dofa_report_id_quadrant_subarea_key;

alter table public.evaluation_dofa
  add constraint evaluation_dofa_report_id_sport_quadrant_subarea_key
  unique (report_id, sport, quadrant, subarea);
