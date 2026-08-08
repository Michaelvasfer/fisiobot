import os, shutil

VIEJO = "/var/www/agenteconsultorio-admin"
NUEVO = "/var/www/fisiobot"
BK = "/root/migracion-fisiobot-20260808-1840"

# 1. La data actual del nuevo (= data de produccion + lo recibido durante la
#    migracion) vuelve al viejo, que es quien atiende el numero de produccion.
for f in ["citas.json", "conversaciones.json", "leads.json", "derivaciones.json",
          "lista-espera.json", "resumen-state.json"]:
    src = os.path.join(NUEVO, "bot", "data", f)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(VIEJO, "bot", "data", f))
        print("viejo <- data actual:", f)

# 2. El nuevo recupera su .env original (segundo numero) y su propia data.
shutil.copy(BK + "/env.nuevo.bak", NUEVO + "/bot/.env")
print("nuevo: .env restaurado")
for f in os.listdir(BK + "/data.nuevo.bak"):
    src = os.path.join(BK + "/data.nuevo.bak", f)
    dst = os.path.join(NUEVO, "bot", "data", f)
    if os.path.isdir(src):
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    else:
        shutil.copy(src, dst)
print("nuevo: data restaurada")
# Quitar del nuevo los archivos que solo eran del viejo
for f in ["derivaciones.json", "lista-espera.json"]:
    p = os.path.join(NUEVO, "bot", "data", f)
    if os.path.exists(p) and not os.path.exists(os.path.join(BK, "data.nuevo.bak", f)):
        os.remove(p)
        print("nuevo: removido", f)

# 3. nginx: asistente.kaminar.pe vuelve a los puertos del viejo (3101/3010)
shutil.copy(BK + "/nginx-asistente.bak", "/etc/nginx/sites-enabled/asistente.kaminar.pe")
print("nginx restaurado")
print("RESTAURACION_ARCHIVOS_OK")
