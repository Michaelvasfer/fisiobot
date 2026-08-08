import json

BASE = "/var/www/agenteconsultorio-admin"
ADDR = "Jr. Del Comercio 142- A media cuadra del arco del triunfo"

# 1. Plantilla del prompt: direccion fija -> placeholder
p = BASE + "/bot/prompts/system-prompt.md"
s = open(p, encoding="utf-8").read()
a1 = "Dirección: Av. Mario Urteaga 555"
a2 = '"Atendemos en la Av. Mario Urteaga 555, frente al Hospital Simón Bolívar, en Cajamarca."'
assert a1 in s and a2 in s, "no se encontraron las lineas fijas en el prompt"
s = s.replace(a1, "Dirección: {{DIRECCION}}")
s = s.replace(a2, '"Atendemos en {{DIRECCION}}. ¿Le envío la ubicación por aquí?"')
open(p, "w", encoding="utf-8").write(s)
print("system-prompt.md OK")

# 2. promptBuilder.js: reemplazo del placeholder
p = BASE + "/bot/src/promptBuilder.js"
s = open(p, encoding="utf-8").read()
old = ".replace('{{SALUDO}}', textoSaludo(c));"
new = (".replace('{{SALUDO}}', textoSaludo(c))\n"
       "    .replace(/\\{\\{DIRECCION\\}\\}/g, c.identidad.direccion || '');")
assert old in s, "no se encontro el replace de SALUDO"
s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
print("promptBuilder.js OK")

# 3. clinica.json: direccion correcta (la misma del despliegue nuevo)
p = BASE + "/bot/config/clinica.json"
d = json.load(open(p, encoding="utf-8"))
d["identidad"]["direccion"] = ADDR
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("clinica.json OK ->", d["identidad"]["direccion"])
