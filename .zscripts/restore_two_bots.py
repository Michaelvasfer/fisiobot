import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("159.89.86.181", username="root",
               password=os.environ["SRV_PASSWORD"], timeout=15)

sftp = client.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), "remote_restore.py"),
         "/tmp/remote_restore.py")
sftp.close()

cmd = (
    "python3 /tmp/remote_restore.py && "
    "pm2 restart fisiobot --update-env && sleep 2 && "
    "cd /var/www/agenteconsultorio-admin && pm2 startOrRestart ecosystem.config.cjs && pm2 save && sleep 3 && "
    "nginx -t 2>/dev/null && systemctl reload nginx && echo 'NGINX OK' && sleep 1 && "
    "echo '--- asistente (viejo):' && "
    "curl -sf https://asistente.kaminar.pe/health && echo ' health OK' && "
    "V1=$(grep '^WEBHOOK_VERIFY_TOKEN=' /var/www/agenteconsultorio-admin/bot/.env | cut -d= -f2-) && "
    "R1=$(curl -sf \"https://asistente.kaminar.pe/webhook?hub.mode=subscribe&hub.verify_token=$V1&hub.challenge=VIEJO1\") && "
    "[ \"$R1\" = 'VIEJO1' ] && echo 'webhook OK' && "
    "curl -sf -o /dev/null -w 'panel HTTP %{http_code}\\n' https://asistente.kaminar.pe/ && "
    "echo '--- fisiobot (nuevo):' && "
    "curl -sf https://fisiobot.kaminar.pe/health && echo ' health OK' && "
    "V2=$(grep '^WEBHOOK_VERIFY_TOKEN=' /var/www/fisiobot/bot/.env | cut -d= -f2-) && "
    "R2=$(curl -sf \"https://fisiobot.kaminar.pe/webhook?hub.mode=subscribe&hub.verify_token=$V2&hub.challenge=NUEVO1\") && "
    "[ \"$R2\" = 'NUEVO1' ] && echo 'webhook OK' && "
    "curl -sf -o /dev/null -w 'panel HTTP %{http_code}\\n' https://fisiobot.kaminar.pe/"
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
