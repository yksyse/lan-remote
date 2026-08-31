import paramiko
import json
import time
import urllib.request

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.143', port=22, username='pasha-server', password='111')

print("Adding inbound Windows Firewall rule...")
cmd = r'netsh advfirewall firewall add rule name="LAN-Remote" dir=in action=allow protocol=TCP localport=8080,8090,8085'
stdin, stdout, stderr = ssh.exec_command(cmd)
print('Firewall Result:\n', stdout.read().decode('cp866', errors='ignore'))

time.sleep(1)

print("Checking remote netstat for port 8090...")
stdin, stdout, stderr = ssh.exec_command('netstat -ano | findstr 8090')
print('Netstat:\n', stdout.read().decode('cp866', errors='ignore'))

print("Testing curl inside remote machine...")
stdin, stdout, stderr = ssh.exec_command('powershell -Command "Invoke-RestMethod -Uri http://localhost:8090/api/status | ConvertTo-Json"')
print('Remote curl:\n', stdout.read().decode('cp866', errors='ignore'))

ssh.close()

print("\nTesting HTTP request from our local PC...")
for i in range(1, 4):
    try:
        with urllib.request.urlopen('http://192.168.1.143:8090/api/status', timeout=5) as res:
            data = json.loads(res.read().decode())
            print(f'*** SUCCESSFUL RESPONSE ON ATTEMPT {i} ***')
            print(json.dumps(data, indent=2, ensure_ascii=False))
            break
    except Exception as e:
        print(f'Attempt {i} from local PC error: {e}')
        time.sleep(1)
