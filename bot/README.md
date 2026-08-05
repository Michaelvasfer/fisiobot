# Agente de WhatsApp — Consultorio Dr. Michael Vásquez

Bot de WhatsApp que atiende pacientes del consultorio de Ortopedia y Traumatología del Dr. Michael Vásquez (Cajamarca). Usa la **Meta WhatsApp Cloud API** para recibir y enviar mensajes, y **OpenAI** para responder siguiendo el prompt maestro del consultorio (calificación de pacientes, agenda, derivación a recepción, protocolo de urgencias).

## Estructura

```
config/clinica.json      → Datos editables del consultorio (horarios, cupos, precios, pagos)
prompts/system-prompt.md → Prompt maestro del agente (no editar salvo cambios de reglas)
src/server.js            → Webhook de Meta + comandos de recepción
src/agent.js             → Llamada a OpenAI con historial y herramientas
src/tools.js             → consultar_disponibilidad, solicitar_cita, registrar_lead, derivar_recepcion
src/agenda.js            → Agenda (modo manual; punto de extensión para agenda real)
src/store.js             → Persistencia JSON en ./data (conversaciones, citas, leads)
src/whatsapp.js          → Cliente de la Cloud API
scripts/simular.js       → Simulación local de conversaciones sin Meta
test/                    → Pruebas con node:test
```

## Requisitos

- Node.js 18 o superior.
- Una app en [Meta for Developers](https://developers.facebook.com/) con WhatsApp Cloud API configurada (número de prueba o número propio).
- Una API key de OpenAI.

## Instalación

```bash
npm install
cp .env.example .env   # completa las variables
```

Variables de `.env`:

| Variable | Qué es |
|---|---|
| `OPENAI_API_KEY` | API key de OpenAI |
| `OPENAI_MODEL` | Modelo (por defecto `gpt-4o-mini`) |
| `WHATSAPP_TOKEN` | Token de acceso de la Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID del número del consultorio |
| `WEBHOOK_VERIFY_TOKEN` | Texto secreto que tú defines para verificar el webhook |
| `RECEPCION_WHATSAPP` | Número de recepción, formato internacional sin `+` (ej. `51987654321`) |
| `PORT` | Puerto del servidor (por defecto `3000`) |
| `MODO_AGENDA` | `manual` (cupos en `clinica.json`) o `automatico` |

## Probar en local (sin Meta)

1. Completa solo `OPENAI_API_KEY` en `.env`.
2. Ejecuta `npm run simular`: envía conversaciones de prueba al webhook (saludo + agendar, urgencia, intento de inyección de prompt, derivación) y muestra las respuestas del bot como `[whatsapp:simulado]` en consola.
3. Ejecuta `npm test` para las pruebas unitarias.

## Conectar con Meta WhatsApp Cloud API

1. En Meta for Developers, crea una app tipo **Empresa** y agrega el producto **WhatsApp**.
2. En *WhatsApp → Configuración de API* copia el **Phone Number ID** y genera un **token de acceso** (para producción, crea un System User con token permanente).
3. Expón tu servidor con HTTPS (en desarrollo, `ngrok http 3000`).
4. En *WhatsApp → Configuración → Webhook*:
   - URL: `https://tu-dominio/webhook`
   - Token de verificación: el mismo `WEBHOOK_VERIFY_TOKEN` de tu `.env`
   - Suscríbete al campo **messages**.
5. Agrega el número de recepción (y los números de prueba) como destinatarios permitidos si usas el número de prueba de Meta.
6. Arranca el bot: `npm start`.

## Uso diario

- **Editar horarios y cupos**: modifica `config/clinica.json` (`horarioGeneral`, `cuposDisponibles`, precios, medios de pago). Reinicia el servidor después de editar.
- **Confirmar una cita**: cuando el bot registra una solicitud, recepción recibe un mensaje. Para confirmarla, recepción envía al número del bot:
  - `#confirmar <telefono>` → confirma la cita pendiente y avisa al paciente.
  - `#tomar <telefono>` → pausa al agente y recepción atiende manualmente.
  - `#soltar <telefono>` → el agente vuelve a responder.
  - `#decir <telefono> <mensaje>` → recepción envía un mensaje libre al paciente desde el número del bot (útil mientras está en modo `#tomar`).
- **Derivaciones**: cuando el bot deriva un caso (paciente operado, presupuesto, queja, urgencia, etc.), recepción recibe el resumen completo y el chat queda en pausa hasta `#soltar`.

Los datos (conversaciones, citas, leads, derivaciones) se guardan en `./data/*.json`.

## Modo de agenda

- **Manual (actual)**: el bot solo ofrece los cupos de `clinica.json` y registra la cita como *pendiente de confirmación*. Recepción confirma con `#confirmar`.
- **Automático**: implementa `consultarDisponibilidad` y el registro en `src/agenda.js` contra tu agenda real (Google Calendar, sistema de citas, etc.) y pon `MODO_AGENDA=automatico`. El resto del bot no cambia.

## Límites conocidos

- No transcribe audios ni analiza imágenes: responde con los mensajes previstos y pide que escriban.
- Persistencia en archivos JSON: suficiente para un consultorio; para múltiples sedes o varios operadores, migrar `store.js` a una base de datos.
- Un solo proceso: si crece el volumen, agregar una cola de mensajes.
