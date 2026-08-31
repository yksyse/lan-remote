import os
import sys
import time
import urllib.request
import json
import paramiko

SERVER_IP = "192.168.1.143"
SSH_USER = "pasha-server"
SSH_PASS = "111"
REMOTE_DIR = r"C:\LAN-Remote"
LOCAL_EXE = r"H:\lan-remote\dist\LAN-Remote.exe"
PORT = 8090  # Port 8080 is occupied by qBittorrent on the remote server

def test_deploy():
    if not os.path.exists(LOCAL_EXE):
        print(f"Error: {LOCAL_EXE} does not exist.")
        return False

    exe_size_mb = os.path.getsize(LOCAL_EXE) / (1024 * 1024)
    print(f"Local binary found: {LOCAL_EXE} ({exe_size_mb:.2f} MB)")

    print(f"Connecting to {SERVER_IP} via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=5)
    print("SSH connection established.")

    # 1. Kill any existing instance
    print("Stopping existing LAN-Remote instances on remote PC...")
    ssh.exec_command('taskkill /f /im LAN-Remote.exe')
    time.sleep(1)

    # 2. Write config.json for port 8090
    print(f"Configuring remote server port to {PORT}...")
    sftp = ssh.open_sftp()
    try:
        sftp.mkdir(REMOTE_DIR.replace('\\', '/'))
    except Exception:
        pass

    cfg = {
        "server": {
            "port": PORT,
            "pin_code": "",
            "allow_remote_input": True
        }
    }
    with sftp.file(f"{REMOTE_DIR}/config.json".replace('\\', '/'), 'w') as f:
        f.write(json.dumps(cfg, indent=2))
    sftp.close()

    # 3. Start LAN-Remote.exe via Task Scheduler / Start-Process
    print("Starting LAN-Remote.exe on remote server...")
    launch_cmd = f'powershell -Command "Start-Process -FilePath \'{REMOTE_DIR}\\LAN-Remote.exe\' -WorkingDirectory \'{REMOTE_DIR}\'"'
    ssh.exec_command(launch_cmd)
    time.sleep(5)

    # 4. Check tasklist
    q_cmd = 'tasklist /fi ' + chr(34) + 'IMAGENAME eq LAN-Remote.exe' + chr(34)
    stdin, stdout, stderr = ssh.exec_command(q_cmd)
    tasklist_out = stdout.read().decode('cp866', errors='ignore')
    print("Remote Process List:\n", tasklist_out)

    # 5. Test HTTP API endpoint
    remote_url = f"http://{SERVER_IP}:{PORT}/api/status"
    print(f"Testing remote API endpoint: {remote_url}...")
    for attempt in range(1, 6):
        try:
            req = urllib.request.Request(remote_url, headers={'User-Agent': 'RemoteTest/1.0'})
            with urllib.request.urlopen(req, timeout=4) as res:
                data = json.loads(res.read().decode())
                print(f"\n[SUCCESS ATTEMPT {attempt}] Remote Server Status:")
                print(json.dumps(data, indent=2, ensure_ascii=False))
                print("\n" + "="*60)
                print(f"  VERIFICATION SUCCESSFUL on Windows 10 server ({SERVER_IP}:{PORT})!")
                print("="*60)
                ssh.close()
                return True
        except Exception as e:
            print(f"  Attempt {attempt}/5 failed: {e}. Retrying in 2s...")
            time.sleep(2)

    ssh.close()
    return False

if __name__ == "__main__":
    test_deploy()
