# SGS Social: Supabase + Google

## 1. Base de datos
1. Crea un proyecto en https://supabase.com
2. SQL Editor → ejecuta primero `schema.sql` y después `schema_v2.sql`. Crean las tablas, activan RLS (cada usuaria solo ve y modifica sus propias filas), la papelera, el registro de actividad, los accesos compartidos y el almacenamiento privado de documentos.

## 2. Login con Google
1. Google Cloud Console → APIs y servicios → Credenciales → Crear ID de cliente OAuth (Aplicación web).
2. En "URI de redirección autorizados" agrega: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google: activa y pega Client ID y Client Secret.
4. Supabase → Authentication → URL Configuration: Site URL `http://localhost:5173`; agrega también la URL de producción cuando publiques.

## 3. Ejecutar
```
cp .env.example .env     # pega URL y anon key (Project Settings → API)
npm install
npm run dev
```
Usa solo la clave `anon`. Nunca pongas la `service_role` en el frontend.

## 4. Publicar
`npm run build` y sube `dist/` a Vercel, Netlify o Cloudflare Pages (define las dos variables VITE_* allí).