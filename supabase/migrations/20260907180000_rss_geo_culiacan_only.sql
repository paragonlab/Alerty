-- Noticias RSS: quitar pines inventados (ciudad aproximada / otra ciudad).
-- El feed sigue mostrando el post; el mapa solo conserva colonia clara de Culiacán.

update public.community_posts
set
  lat = null,
  lng = null,
  geo_source = 'none',
  place_label = case
    when place_label ilike '%aproximad%' then 'Culiacán (noticia)'
    else place_label
  end
where source = 'rss'
  and (
    place_label ilike '%aproximad%'
    or geo_source = 'place_bbox'
    or text !~* '\mculiac[áa]n\M'
    or (
      text ~* '\m(mazatl[áa]n|los mochis|navolato|guam[úu]chil|escuinapa|guasave)\M'
      and text !~* '\mculiac[áa]n\M'
    )
  );
