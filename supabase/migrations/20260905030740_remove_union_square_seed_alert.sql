-- Retira el seed "Bloqueo Vial · Union Square" sin tocar la cuenta @MrParagon.
-- Las FK ON DELETE CASCADE eliminan media, updates, follows y verificaciones ligadas.
delete from public.alerts
where id = '3f48b0d9-1f6b-4f06-a1ef-505817fb94ee';
