import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("159.89.86.181", username="root",
               password=os.environ["SRV_PASSWORD"], timeout=15)

sftp = client.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), "remote_migrate.py"),
         "/tmp/remote_migrate.py")
sftp.close()

cmd = (
    "python3 /tmp/remote_migrate.py && "
    "pm2 restart fisiobot --update-env && sleep 3 && "
    "curl -sf http://localhost:3201/health && echo ' NUEVO BOT OK' && "
    "VERIFY=$(grep '^WEBHOOK_VERIFY_TOKEN=' /var/www/fisiobot/bot/.env | cut -d= -f2-) && "
    "R=$(curl -sf \"http://localhost:3201/webhook?hub.mode=subscribe&hub.verify_token=$VERIFY&hub.challenge=OK123\") && "
    "[ \"$R\" = 'OK123' ] && echo 'WEBHOOK LOCAL OK' && "
    "nginx -t && systemctl reload nginx && echo 'NGINX RELOAD OK' && "
    "sleep 1 && "
    "curl -sf https://asistente.kaminar.pe/health && echo ' DOMINIO HEALTH OK' && "
    "R2=$(curl -sf \"https://asistente.kaminar.pe/webhook?hub.mode=subscribe&hub.verify_token=$VERIFY&hub.challenge=OK456\") && "
    "[ \"$R2\" = 'OK456' ] && echo 'DOMINIO WEBHOOK OK' && "
    "curl -sf -o /dev/null -w 'dashboard HTTP %{http_code}\\n' https://asistente.kaminar.pe/"
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
