import json

BASE = "/var/www/agenteconsultorio-admin"
p = BASE + "/bot/config/clinica.json"
bak = json.load(open(BASE + "/.bak-fix-direccion/clinica.json", encoding="utf-8"))
d = json.load(open(p, encoding="utf-8"))
print("actual:  ", d["identidad"]["direccion"])
d["identidad"]["direccion"] = bak["identidad"]["direccion"]
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("restaurada:", d["identidad"]["direccion"])
