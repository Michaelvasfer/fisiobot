import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

host = "159.89.86.181"
user = "root"
password = os.environ["SRV_PASSWORD"]

cmd = (
    "set -e; "
    "PROJECT_DIR=$(find /root /home /opt /srv /var/www -maxdepth 3 "
    "-name deploy-agenteconsultorio.sh 2>/dev/null | head -1 | xargs -r dirname); "
    "if [ -z \"$PROJECT_DIR\" ]; then echo 'NO PROJECT DIR'; exit 1; fi; "
    "echo \"PROJECT_DIR=$PROJECT_DIR\"; cd \"$PROJECT_DIR\"; "
    "git pull --autostash origin main && bash deploy-agenteconsultorio.sh \"$PROJECT_DIR\""
)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)
stdin, stdout, stderr = client.exec_command(cmd, timeout=1500)
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
