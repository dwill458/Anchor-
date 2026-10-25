import argparse
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('log')
parser.add_argument('--filter', default='')
parser.add_argument('--output')
args = parser.parse_args()
players = {}
run = None
for line in Path(args.log).read_text(encoding='utf-8', errors='replace').splitlines():
    if '[SESSION_AUDIO_' not in line:
        continue
    start, end = line.find('{'), line.rfind('}')
    if start < 0 or end <= start:
        continue
    try:
        event = json.loads(line[start:end + 1])
    except json.JSONDecodeError:
        continue
    if event.get('event') == 'mounted':
        run = event.get('runId')
    if event.get('event') == 'received_url':
        surface = parse_qs(urlsplit(event.get('url', '')).query).get('surface', [None])[0]
        if surface and surface.startswith('audio-'):
            run = surface
    player_id = event.get('playerId')
    if event.get('event') == 'created':
        players[player_id] = {'run': run, 'uri': event.get('uri', event.get('asset')), 'states': []}
    if 'status' in event and player_id in players:
        players[player_id]['states'].append(event['status'])
evidence = []
for player_id, player in players.items():
    if args.filter and args.filter not in str(player):
        continue
    states = player['states']
    item = {'player': player_id, 'run': player['run'], 'uri': player['uri'], 'statusCount': len(states),
            'first': states[:3], 'last': states[-3:], 'errors': [state['error'] for state in states if state.get('error')]}
    evidence.append(item)
    print(json.dumps(item))
if args.output:
    Path(args.output).write_text(json.dumps(evidence, indent=2), encoding='utf-8')
