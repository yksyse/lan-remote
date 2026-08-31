import paramiko
import json
import time
import urllib.request

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.143', port=22, username='pasha-server', password='111')

print("Stopping previous instances on remote server...")
ssh.exec_command('taskkill /f /im LAN-Remote.exe')
time.sleep(1)

print("Starting detached process via wmic...")
cmd = r'wmic process call create "C:\LAN-Remote\LAN-Remote.exe", "C:\LAN-Remote"'
stdin, stdout, stderr = ssh.exec_command(cmd)
wmic_out = stdout.read().decode('cp866', errors='ignore')
print('WMIC Output:\n', wmic_out)

time.sleep(4)

print("Checking remote processes...")
stdin, stdout, stderr = ssh.exec_command('tasklist /fi "IMAGENAME eq LAN-Remote.exe"')
print('Tasklist:\n', stdout.read().decode('cp866', errors='ignore'))

print("Querying http://192.168.1.143:8090/api/status...")
try:
    with urllib.request.urlopen('http://192.168.1.143:8090/api/status', timeout=5) as res:
        data = json.loads(res.read().decode())
        print('\n*** SUCCESSFUL RESPONSE FROM WINDOWS 10 SERVER ***')
        print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print('HTTP Request Error:', e)

ssh.close()
