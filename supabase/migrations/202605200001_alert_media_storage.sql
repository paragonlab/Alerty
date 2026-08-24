-- Bucket público para evidencia multimedia de alertas y comentarios.
-- El bucket es público: los archivos se sirven por URL directa sin necesidad
-- de una policy de SELECT. NO se agrega policy de SELECT amplia para evitar
-- que los clientes puedan LISTAR/enumerar todo el contenido del bucket.
insert into storage.buckets (id, name, public)
values ('alert-media', 'alert-media', true)
on conflict (id) do nothing;

-- Subida permitida a usuarios autenticados
drop policy if exists "alert-media authenticated insert" on storage.objects;
create policy "alert-media authenticated insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'alert-media');
