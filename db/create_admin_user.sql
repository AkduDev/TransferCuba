-- create_admin_user.sql
-- Crea un usuario administrador para desarrollo.
-- PIN: admin123 | Phone: 5350000000 | Rol: ADMIN
-- Ejecutar una sola vez. Idempotente (ON CONFLICT DO NOTHING).

INSERT INTO users (phone, name, pin_hash, role, status)
VALUES (
  '5350000000',
  'Administrador',
  'scrypt$9dcfa5d83f515f71ade9565258f1d1f9$eb06cea7413e680d58b0ea6f2fa76b0ad55d7102c639719cfb06881f388d0d484a9210d442fe4379453bf8815182fe291979ee50d8ec099d98a5ef68892ccbc5',
  'ADMIN',
  'active'
)
ON CONFLICT (phone) DO NOTHING;
