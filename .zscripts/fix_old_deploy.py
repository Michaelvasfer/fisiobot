import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("159.89.86.181", username="root",
               password=os.environ["SRV_PASSWORD"], timeout=15)

sftp = client.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), "remote_fix_old_deploy.py"),
         "/tmp/remote_fix_old_deploy.py")
sftp.close()

cmd = (
    "cd /var/www/agenteconsultorio-admin && "
    "mkdir -p .bak-fix-direccion && "
    "cp bot/prompts/system-prompt.md bot/src/promptBuilder.js bot/config/clinica.json .bak-fix-direccion/ && "
    "echo 'backup OK' && "
    "python3 /tmp/remote_fix_old_deploy.py && "
    "pm2 restart bot && sleep 2 && "
    "curl -sf http://localhost:3101/health && echo ' BOT VIEJO OK'"
)
stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
for line in iter(stdout.readline, ""):
    print(line, end="", flush=True)
rc = stdout.channel.recv_exit_status()
err = stderr.read().decode()
if err.strip():
    print("--- STDERR ---", file=sys.stderr)
    print(err, file=sys.stderr)
print(f"\n[exit_code={rc}]")
client.close()
sys.exit(rc)
