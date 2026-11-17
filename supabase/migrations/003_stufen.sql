-- Stufen: neue Rolle „superadmin“ (Stufe 1 · Inhaber) über admin (Stufe 2 · Geschäftsführung).
-- Nach schema.sql einspielen (idempotent).
alter type app_rolle add value if not exists 'superadmin' before 'admin';
