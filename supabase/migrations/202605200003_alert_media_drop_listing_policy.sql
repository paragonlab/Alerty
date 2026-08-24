-- El bucket alert-media es público; la URL directa funciona sin policy de
-- SELECT. La policy amplia permitía listar todo el bucket — se elimina.
drop policy if exists "alert-media public read" on storage.objects;
