#!/usr/bin/python3
"""Disposable-container service simulator. Not a production systemd replacement."""
import configparser
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import time

if not Path('/run/trafficease-disposable-test').exists():
    raise SystemExit('Disposable test marker required; never install this as production systemctl')
state=Path('/tmp/trafficease-service-test');state.mkdir(exist_ok=True)
action=sys.argv[1]
names=[name.removesuffix('.service') for name in sys.argv[2:] if not name.startswith('-')]

def active(name):
    try:
        pid=int((state/(name+'.pid')).read_text())
        return Path(f'/proc/{pid}').exists() and '\nState:\tZ' not in Path(f'/proc/{pid}/status').read_text()
    except (FileNotFoundError,ValueError):return False

def stop(name):
    if active(name):
        pid=int((state/(name+'.pid')).read_text());os.kill(pid,signal.SIGTERM)
        for _ in range(100):
            if not active(name):break
            time.sleep(.1)
        if active(name):raise SystemExit('Test service failed to stop: '+name)

def start(name):
    stop(name)
    if name=='mysql':
        Path('/run/mysqld').mkdir(exist_ok=True)
        import pwd;user=pwd.getpwnam('mysql');os.chown('/run/mysqld',user.pw_uid,user.pw_gid)
        subprocess.run(['/usr/sbin/mysqld','--user=mysql','--daemonize'],check=True)
        return
    config=configparser.ConfigParser(interpolation=None)
    config.read('/etc/systemd/system/'+name+'.service')
    service=config['Service'];environment=dict(os.environ)
    for line in Path(service['EnvironmentFile']).read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key,value=line.split('=',1);environment[key]=' '.join(shlex.split(value))
    log=open(state/(name+'.log'),'ab')
    process=subprocess.Popen(shlex.split(service['ExecStart']),cwd=service['WorkingDirectory'],env=environment,user=service['User'],group=service['Group'],stdout=log,stderr=log,start_new_session=True)
    (state/(name+'.pid')).write_text(str(process.pid))

if action=='is-active':sys.exit(0 if all(active(name) for name in names) else 1)
elif action=='stop':
    for name in names:stop(name)
elif action=='restart':
    for name in names:start(name)
elif action=='enable':pass
else:raise SystemExit('Unsupported test-only service action: '+action)
