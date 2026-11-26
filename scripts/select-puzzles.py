# Selecteert puzzels uit de Lichess-puzzeldatabase (CC0) voor public/puzzles.json.
# Gebruik:
#   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
#   pip install zstandard
#   python3 scripts/select-puzzles.py lichess_db_puzzle.csv.zst public/puzzles.json
# Daarna controleren: npm run check-puzzles
import csv, io, sys, json, heapq, collections, zstandard
src, out = sys.argv[1], sys.argv[2]
THEMES = ["fork", "pin", "skewer", "discoveredAttack", "hangingPiece", "mateIn1", "mateIn2", "backRankMate",
          "deflection", "attraction", "trappedPiece", "intermezzo", "defensiveMove"]
TSET = set(THEMES)
BANDS = list(range(400, 2600, 200))  # 400-599, ..., 2400-2599
PER = 12
buckets = collections.defaultdict(list)  # (thema, band) -> heap van (score, id)
rows_by_id = {}
with open(src, 'rb') as fh:
    rows = csv.reader(io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(fh), encoding='utf-8'))
    next(rows)
    for r in rows:
        pid, fen, moves, rating, rd, pop, plays, themes = r[0], r[1], r[2], int(r[3]), int(r[4]), int(r[5]), int(r[6]), r[7].split()
        if pop < 85 or plays < 500 or rd > 90 or rating < 400 or rating >= 2600: continue
        mine = [t for t in themes if t in TSET]
        if not mine: continue
        band = (rating // 200) * 200
        score = (pop, plays)
        for t in mine:
            h = buckets[(t, band)]
            item = (score, pid)
            if len(h) < PER: heapq.heappush(h, item); rows_by_id[pid] = (fen, moves, rating, mine)
            elif item > h[0]: heapq.heapreplace(h, item); rows_by_id[pid] = (fen, moves, rating, mine)
chosen = {pid for h in buckets.values() for _, pid in h}
puzzles = []
for pid in sorted(chosen, key=lambda p: rows_by_id[p][2]):
    fen, moves, rating, mine = rows_by_id[pid]
    puzzles.append([pid, fen, moves, rating, [THEMES.index(t) for t in mine]])
json.dump({"bron": "Lichess puzzeldatabase (database.lichess.org), CC0", "themes": THEMES, "puzzles": puzzles},
          open(out, 'w'), separators=(',', ':'))
per_theme = collections.Counter(t for p in puzzles for t in p[4])
print('puzzels:', len(puzzles))
for i, t in enumerate(THEMES): print(f'  {t:18s} {per_theme[i]}')
