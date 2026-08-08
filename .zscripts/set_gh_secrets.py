import json, os, subprocess, sys, urllib.request, base64
from nacl import public, encoding

REPO = "Michaelvasfer/fisiobot"
API = f"https://api.github.com/repos/{REPO}"

token = subprocess.run(
    ["git", "credential", "fill"],
    input="protocol=https\nhost=github.com\n\n",
    capture_output=True, text=True,
).stdout
token = [l.split("=", 1)[1] for l in token.splitlines() if l.startswith("password=")][0]

def req(method, url, data=None):
    r = urllib.request.Request(url, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Accept", "application/vnd.github+json")
    body = json.dumps(data).encode() if data is not None else None
    with urllib.request.urlopen(r, body) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}

key_info = req("GET", f"{API}/actions/secrets/public-key")
repo_key = public.PublicKey(key_info["key"].encode(), encoding.Base64Encoder())
sealed = public.SealedBox(repo_key)

secrets = {
    "SSH_HOST": "159.89.86.181",
    "SSH_USER": "root",
    "SSH_PASSWORD": os.environ["SRV_PASSWORD"],
}
for name, value in secrets.items():
    encrypted = sealed.encrypt(value.encode(), encoder=encoding.Base64Encoder).decode()
    req("PUT", f"{API}/actions/secrets/{name}",
        {"encrypted_value": encrypted, "key_id": key_info["key_id"]})
    print(f"secret {name}: OK")

check = req("GET", f"{API}/actions/secrets")
print("secrets en el repo:", [s["name"] for s in check.get("secrets", [])])
