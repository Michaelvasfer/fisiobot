import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

token = os.environ["GH_TOKEN"]
cmd = (
    "cd /var/www/agenteconsultorio-admin && "
    "git add bot/prompts/system-prompt.md bot/src/promptBuilder.js && "
    "git -c user.name='Michael Vasquez' -c user.email='maikelvasfer@gmail.com' "
    "commit -m 'fix(bot): direccion del prompt sale de la configuracion, no fija en la plantilla' && "
    "git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f' "
    "push origin main && "
    "git status --short | grep -v '^??' ; git log --oneline -1"
)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("159.89.86.181", username="root",
               password=os.environ["SRV_PASSWORD"], timeout=15)
stdin, stdout, stderr = client.exec_command(
    f"export GH_TOKEN='{token}'; {cmd}", timeout=120)
for line in iter(stdout.readline, ""):
    print(line, end="", flush=True)
rc = stdout.channel.recv_exit_status()
err = stderr.read().decode()
if err.strip():
    print("--- STDERR ---", file=sys.stderr)
    print(err.replace(token, "***"), file=sys.stderr)
print(f"\n[exit_code={rc}]")
client.close()
sys.exit(rc)
