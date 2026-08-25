-- La lista de nombres exactos pedida usa "PP"/"PK" sin sufijo -- el label
-- traía "(ventaja numérica)"/"(desventaja numérica)" de cuando se diseñó el
-- desglose de 4 campos.
update public.stat_definitions set label = 'PP' where key = 'pp';
update public.stat_definitions set label = 'PK' where key = 'pk';
