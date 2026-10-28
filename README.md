<div align="center">

# 🤝 SGS Social

**Sistema de gestión para trabajo social**
Personas, familias, casos, seguimientos e informes en PDF, con datos privados por profesional.

## Contenido

- [Descripción](#descripción)
- [Funciones](#funciones)
- [Tecnología](#tecnología)
- [Instalación](#instalación)
- [Despliegue](#despliegue)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Solución de problemas](#solución-de-problemas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Hoja de ruta](#hoja-de-ruta)

## Descripción

SGS Social es una aplicación web para profesionales de trabajo social. Permite registrar personas y familias, llevar casos, intervenciones, plan de intervención, seguimientos y derivaciones, y emitir informes en PDF con membrete y firma propios.

Cada profesional inicia sesión con Google y **solo ve su propia información**. El aislamiento lo garantiza la base de datos (Row Level Security de Supabase), no solo la interfaz.

## Funciones

| Área | Qué incluye |
|---|---|
| **Registro** | Personas, familias vinculadas, consentimiento informado |
| **Casos** | Estado y prioridad, intervenciones (sesiones) con acuerdos |
| **Plan** | Objetivos por persona con área, plazo y barra de avance |
| **Seguimientos** | Calendario mensual, citas repetidas, recordatorio por WhatsApp |
| **Redes** | Derivaciones a instituciones, genograma y ecomapa |
| **Documentos** | Adjuntos de hasta 10 MB en almacenamiento privado |
| **Panel** | Contadores, alertas y estadísticas |
| **Informes** | PDF con membrete y firma, exportación a CSV |
| **Seguridad** | Papelera, registro de actividad, compartir en solo lectura |

## Tecnología

- **Frontend:** React 18 y Vite
- **Backend:** Supabase (Postgres, autenticación con Google y almacenamiento)
- **PDF:** jsPDF

## Instalación

**Requisitos:** Node.js 18+, una cuenta de Supabase y una de Google Cloud.

```bash
git clone https://github.com/TU-USUARIO/sgs-social.git
cd sgs-social
npm install
cp .env.example .env
```

### 1. Base de datos

En el **SQL Editor** de Supabase ejecuta, completos y en este orden:

1. `schema.sql`
2. `schema_v2.sql`

### 2. Login con Google

1. En Google Cloud crea un **ID de cliente OAuth** (aplicación web).
2. Orígenes autorizados: `http://localhost:5173`
3. URI de redirección: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
4. En Supabase: **Authentication → Sign In / Providers → Google**, actívalo y pega Client ID y Client Secret.
5. En **Authentication → URL Configuration**: Site URL `http://localhost:5173` y Redirect URL `http://localhost:5173/**`.

### 3. Variables de entorno

Completa `.env` con los datos de **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

> Usa solo la clave `anon`. Nunca pongas la `service_role` en el frontend ni la subas al repositorio.

### 4. Ejecutar

```bash
npm run dev
```

Abre http://localhost:5173. Si cambias el `.env`, reinicia el servidor.

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run preview` | Vista previa de la compilación |

## Despliegue

1. Conecta el repositorio a **Vercel**, **Netlify** o **Cloudflare Pages**.
2. Define las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el panel del servicio.
3. Agrega la URL pública en Supabase (**URL Configuration**) y en los orígenes autorizados de Google Cloud.

## Privacidad y seguridad

- Cada fila guarda quién la creó, y las políticas RLS impiden leer o modificar filas ajenas.
- Los documentos están en un bucket privado, con una carpeta por usuaria.
- Compartir en solo lectura se hace por correo de Google y puede revocarse.
- El registro de actividad anota altas, cambios y bajas, pero no las consultas.
- El membrete y la firma de los informes se guardan en el navegador, no en la base de datos.

> ⚠️ **Datos sensibles.** Antes de usarla con casos reales, revisa la normativa de protección de datos personales de tu institución, comprueba con dos cuentas distintas que cada una vea solo lo suyo, y activa los respaldos automáticos de Supabase (planes de pago).

## Solución de problemas

| Síntoma | Solución |
|---|---|
| Página en blanco o "Falta configurar Supabase" | Falta el `.env`, o hay que reiniciar `npm run dev` |
| `Unsupported provider: provider is not enabled` | Activa Google en Supabase (paso 2.4) |
| `permission denied for table ...` | Ejecuta el bloque de permisos al final de `schema_v2.sql` |
| `relation "objetivos" does not exist` | Falta ejecutar `schema_v2.sql` |
| `redirect_uri_mismatch` | La URI de callback no coincide con la de Google Cloud |
| PDF sin membrete | Completa **Informes → Membrete y firma** |

## Estructura del proyecto

```
sgs-social/
├── src/
│   ├── App.jsx        Interfaz y lógica
│   ├── main.jsx       Punto de entrada y avisos de configuración
│   ├── supabase.js    Cliente de Supabase
│   └── styles.css     Estilos
├── schema.sql         Tablas base y reglas RLS
├── schema_v2.sql      Módulos adicionales, auditoría, accesos y permisos
├── .env.example       Plantilla de variables de entorno
└── package.json
```

## Hoja de ruta

- [ ] Versión instalable en el celular (PWA)
- [ ] Informes en Word
- [ ] Datos de membrete sincronizados en la cuenta
- [ ] Vista separada para registros compartidos
- [ ] Registro de consultas en la auditoría