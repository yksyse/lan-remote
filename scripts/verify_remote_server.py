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

def verify():
    print(f"1. Checking local binary: {LOCAL_EXE}")
    exe_size_mb = os.path.getsize(LOCAL_EXE) / (1024 * 1024)
    print(f"   Size: {exe_size_mb:.2f} MB")

    print(f"\n2. Connecting to Windows 10 server ({SERVER_IP})...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS, timeout=5)
    print("   SSH connection established.")

    print("\n3. Stopping old processes and uploading new binary...")
    ssh.exec_command('taskkill /f /im LAN-Remote.exe')
    time.sleep(1)

    sftp = ssh.open_sftp()
    try:
        sftp.mkdir(REMOTE_DIR.replace('\\', '/'))
    except Exception:
        pass

    # Ensure config uses port 8090 (or auto-fallback)
    cfg = {"server": {"port": 8090, "allow_remote_input": True}}
    with sftp.file(f"{REMOTE_DIR}/config.json".replace('\\', '/'), 'w') as f:
        f.write(json.dumps(cfg, indent=2))

    sftp.put(LOCAL_EXE, f"{REMOTE_DIR}/LAN-Remote.exe".replace('\\', '/'))
    sftp.close()
    print("   SFTP upload completed successfully!")

    # Configure firewall
    ssh.exec_command(r'netsh advfirewall firewall add rule name="LAN-Remote-8090" dir=in action=allow protocol=TCP localport=8090,8085')

    print("\n4. Starting LAN-Remote.exe detached on Windows 10 server...")
    wmic_cmd = r'wmic process call create "C:\LAN-Remote\LAN-Remote.exe --port 8090", "C:\LAN-Remote"'
    stdin, stdout, stderr = ssh.exec_command(wmic_cmd)
    print("   WMIC response:\n", stdout.read().decode('cp866', errors='ignore'))
    time.sleep(4)

    # Verify tasklist
    stdin, stdout, stderr = ssh.exec_command('tasklist /fi "IMAGENAME eq LAN-Remote.exe"')
    print("   Remote tasklist:\n", stdout.read().decode('cp866', errors='ignore'))

    print("\n5. Testing HTTP API endpoints from Local PC to Remote PC...")
    test_endpoints = [
        f"http://{SERVER_IP}:8090/api/status",
        f"http://{SERVER_IP}:8090/api/monitors",
        f"http://{SERVER_IP}:8090/api/config",
        f"http://{SERVER_IP}:8090/api/system/metrics"
    ]

    all_passed = True
    for ep in test_endpoints:
        try:
            req = urllib.request.Request(ep, headers={'User-Agent': 'RemoteVerifier/1.0'})
            with urllib.request.urlopen(req, timeout=5) as res:
                data = json.loads(res.read().decode())
                print(f"   [PASS 200 OK] {ep}")
                if "status" in ep:
                    print(f"     Host IP: {SERVER_IP}, Monitor: {data.get('stream', {}).get('monitor_index')}, FPS: {data.get('stream', {}).get('real_fps')}")
        except Exception as e:
            print(f"   [FAIL] {ep}: {e}")
            all_passed = False

    ssh.close()
    return all_passed

if __name__ == "__main__":
    success = verify()
    print("\n" + "="*65)
    if success:
        print("  ALL VERIFICATION CHECKS PASSED ON REMOTE WINDOWS 10 SERVER!")
    else:
        print("  Verification had failures, check log.")
    print("="*65)
