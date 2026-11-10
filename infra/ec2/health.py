#!/usr/bin/env python3
"""Internal readiness only; never calls public geocoding/routing services."""
import argparse
import json
import subprocess
import sys
import time
import urllib.request


def require(value, message='Readiness condition failed'):
    if not value: raise RuntimeError(message)


def request(port, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=10) as response:
        return json.load(response)


def check():
    backend = request(8080, '/api/health')
    require(backend.get('status') == 'ok' and backend.get('service') == 'trafficease-backend', 'Backend unhealthy')
    ai = request(8000, '/health')
    require(ai.get('model_status') == 'ready', 'AI model unavailable; train before activation')
    catalog = request(8080, '/api/forecasts/catalog')
    require(catalog['modelStatus'] == 'ready' and catalog['dataSource'] == 'SYNTHETIC' and catalog['experimental'] is True)
    forecast = request(8080, '/api/forecasts', {'targetId': 'region-uva', 'forecastAt': None, 'weather': 'CLEAR', 'isHoliday': False})
    require(forecast['congestion'] in ['LOW', 'MODERATE', 'HIGH'] and forecast['experimental'] is True)
    require(not forecast['supportsJourneyDuration'] and forecast['dataSource'] == 'SYNTHETIC')
    sockets = subprocess.check_output(['ss', '-H', '-ltn'], text=True)
    for line in sockets.splitlines():
        address = line.split()[3]
        host, port = address.rsplit(':', 1)
        if port in ['8000', '8080', '3306', '33060']:
            require(host in ['127.0.0.1', '[::1]'], f'Internal port {port} is not loopback-only')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempts', type=int, default=1)
    args = parser.parse_args()
    if not 1 <= args.attempts <= 60:
        raise SystemExit('attempts must be 1–60')
    for attempt in range(args.attempts):
        try:
            check()
            print('PASS: backend, trained synthetic model, bridged inference and internal listener isolation')
            sys.exit(0)
        except Exception as error:
            if attempt == args.attempts - 1:
                print(f'Health failed: {error}', file=sys.stderr)
                sys.exit(1)
            time.sleep(2)
