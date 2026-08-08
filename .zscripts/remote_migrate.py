import json, os, shutil, sys, datetime

VIEJO = "/var/www/agenteconsultorio-admin"
NUEVO = "/var/www/fisiobot"
BK = "/root/migracion-fisiobot-" + datetime.datetime.now().strftime("%Y%m%d-%H%M")
os.makedirs(BK, exist_ok=True)

# Claves que deben pasar del viejo (produccion) al nuevo
CLAVES = [
    "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WEBHOOK_VERIFY_TOKEN",
    "RECEPCION_WHATSAPP", "KAMINAR_API_URL", "KAMINAR_API_TOKEN",
    "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY",
]

def leer_env(p):
    d = {}
    for line in open(p, encoding="utf-8"):
        line = line.rstrip("\n")
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            d[k] = v
    return d

env_viejo = leer_env(VIEJO + "/bot/.env")
env_nuevo_path = NUEVO + "/bot/.env"

# 1. Backups
shutil.copy(env_nuevo_path, BK + "/env.nuevo.bak")
shutil.copy(VIEJO + "/bot/.env", BK + "/env.viejo.bak")
shutil.copytree(NUEVO + "/bot/data", BK + "/data.nuevo.bak")
shutil.copytree(VIEJO + "/bot/data", BK + "/data.viejo.bak")
shutil.copy("/etc/nginx/sites-enabled/asistente.kaminar.pe", BK + "/nginx-asistente.bak")
print("backups en", BK)

# 2. .env del nuevo: inyectar credenciales de produccion del viejo
lineas = open(env_nuevo_path, encoding="utf-8").read().splitlines()
presentes = {l.split("=", 1)[0] for l in lineas if l and not l.startswith("#") and "=" in l}
actualizadas, agregadas = [], []
for i, l in enumerate(lineas):
    if l and not l.startswith("#") and "=" in l:
        k = l.split("=", 1)[0]
        if k in CLAVES and k in env_viejo:
            lineas[i] = k + "=" + env_viejo[k]
            actualizadas.append(k)
for k in CLAVES:
    if k in env_viejo and k not in presentes:
        lineas.append(k + "=" + env_viejo[k])
        agregadas.append(k)
open(env_nuevo_path, "w", encoding="utf-8").write("\n".join(lineas) + "\n")
print("env actualizadas:", actualizadas)
print("env agregadas:", agregadas)

# 3. Datos: conversaciones/citas/leads del viejo -> nuevo
for f in ["citas.json", "conversaciones.json", "leads.json", "derivaciones.json",
          "lista-espera.json", "push.json", "resumen-state.json"]:
    src = os.path.join(VIEJO, "bot", "data", f)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(NUEVO, "bot", "data", f))
        print("dato copiado:", f)
media_src = os.path.join(VIEJO, "bot", "data", "media")
if os.path.isdir(media_src):
    dst = os.path.join(NUEVO, "bot", "data", "media")
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    shutil.copytree(media_src, dst)
    print("dato copiado: media/")

# 4. nginx: asistente.kaminar.pe -> puertos del nuevo (3201 bot, 3210 dashboard)
p = "/etc/nginx/sites-enabled/asistente.kaminar.pe"
s = open(p, encoding="utf-8").read()
assert "127.0.0.1:3101" in s and "127.0.0.1:3010" in s
s = s.replace("127.0.0.1:3101", "127.0.0.1:3201").replace("127.0.0.1:3010", "127.0.0.1:3210")
open(p, "w", encoding="utf-8").write(s)
print("nginx asistente.kaminar.pe -> 3201/3210")
print("MIGRACION_ARCHIVOS_OK")
