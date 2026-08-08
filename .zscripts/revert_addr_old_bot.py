import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("159.89.86.181", username="root",
               password=os.environ["SRV_PASSWORD"], timeout=15)
sftp = client.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), "remote_revert_addr.py"),
         "/tmp/remote_revert_addr.py")
sftp.close()
cmd = (
    "python3 /tmp/remote_revert_addr.py && sleep 2 && "
    "cd /var/www/agenteconsultorio-admin/bot && "
    "timeout 15 node -e \"const {construirSystemPrompt}=require('./src/promptBuilder');"
    "const p=construirSystemPrompt();"
    "console.log('Mario Urteaga presente:',p.includes('Mario Urteaga'));"
    "console.log('Jr. Del Comercio presente:',p.includes('Jr. Del Comercio'));"
    "console.log('Placeholder sin reemplazar:',p.includes('{{DIRECCION}}'));\" 2>/dev/null; true"
)
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
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
