import os, sys, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("159.89.86.181", username="root",
               password=os.environ["SRV_PASSWORD"], timeout=15)
stdin, stdout, stderr = client.exec_command(sys.argv[1], timeout=300)
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
