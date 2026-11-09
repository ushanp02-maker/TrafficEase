"""Small, serial, cached OSRM smoke check. Not geocoding or nationwide coverage proof."""
import argparse
import json
import math
import time
import urllib.request
from pathlib import Path

PAIRS = [
    ('Western', 'Colombo–Negombo', (79.8612,6.9271), (79.8358,7.2083)),
    ('Central', 'Kandy–Matale', (80.6337,7.2906), (80.6234,7.4675)),
    ('Southern', 'Galle–Matara', (80.2170,6.0329), (80.5353,5.9549)),
    ('Northern', 'Jaffna–Point Pedro', (80.0255,9.6615), (80.2333,9.8167)),
    ('Eastern', 'Trincomalee–Batticaloa', (81.2330,8.5874), (81.6924,7.7170)),
    ('North Western', 'Kurunegala–Puttalam', (80.3647,7.4863), (79.8283,8.0362)),
    ('North Central', 'Anuradhapura–Polonnaruwa', (80.4037,8.3114), (81.0000,7.9403)),
    ('Uva', 'Badulla–Bandarawela', (81.0557,6.9934), (80.9870,6.8290)),
    ('Sabaragamuwa', 'Ratnapura–Kegalle', (80.3992,6.6828), (80.3466,7.2513)),
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='/tmp/trafficease-coverage.json')
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        print(f'Reusing previous results at {output}; choose a new output path for an intentional fresh run.')
        return
    results = []
    for province, name, origin, destination in PAIRS:
        coordinates = f'{origin[0]},{origin[1]};{destination[0]},{destination[1]}'
        url = f'https://router.project-osrm.org/route/v1/driving/{coordinates}?overview=false&alternatives=true&generate_hints=false'
        row = {'province': province, 'journey': name, 'inputCoordinates': [origin, destination]}
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'TrafficEase-Coursework/0.2 (+https://github.com/ushanp02-maker/TrafficEase)'})
            with urllib.request.urlopen(request, timeout=20) as response:
                data = json.load(response)
                row['httpStatus'] = response.status
            row['code'] = data.get('code')
            row['snapMeters'] = [round(p['distance'], 1) for p in data.get('waypoints', [])]
            row['acceptedAt300m'] = data.get('code') == 'Ok' and len(row['snapMeters']) == 2 and max(row['snapMeters']) <= 300
            row['routes'] = [{'distanceMeters': r['distance'], 'durationSeconds': r['duration']} for r in data.get('routes', [])]
            assert all(math.isfinite(r['distanceMeters']) and r['distanceMeters'] > 0 for r in row['routes'])
        except Exception as error:
            row['error'] = type(error).__name__ + ': ' + str(error)
        results.append(row)
        print(province, row.get('code', row.get('error')), row.get('snapMeters'), flush=True)
        time.sleep(1.1)  # OSRM demo maximum one request per second, never parallelize.
    output.write_text(json.dumps({'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'source': 'OSRM baseline road routing', 'coordinateSource': 'Manually selected approximate town coordinates; not geocoded',
        'limitations': 'Nine sampled journeys do not establish complete nationwide coverage or current traffic conditions.',
        'results': results}, indent=2) + '\n')

if __name__ == '__main__':
    main()
