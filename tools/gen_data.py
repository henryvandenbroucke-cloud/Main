"""Generate src/data/mcdata.js from PrismarineJS/minecraft-data (MIT) and misode/mcmeta (loot tables and
painting sizes), both extracted from Java Edition 1.21.1.

The numbers in the game (block hardness and blast resistance, harvest tools, light levels, stack sizes,
durability, every crafting recipe, food values, enchantment costs, mob drops) come from this data, which
is extracted from the real game.

Usage:  python3 tools/gen_data.py <folder with the downloaded json files>
        python3 tools/gen_data.py --fetch      (downloads the files into a temporary folder first)
"""
import json, os, sys, tempfile, urllib.request

FILES = {
    'blocks': 'pc/1.21.1/blocks', 'items': 'pc/1.21.1/items', 'recipes': 'pc/1.21.1/recipes', 'foods': 'pc/1.21.1/foods',
    'entities': 'pc/1.20.5/entities', 'biomes': 'pc/1.20.5/biomes', 'enchantments': 'pc/1.21.1/enchantments',
    'effects': 'pc/1.20.5/effects', 'blockLoot': 'pc/1.20/blockLoot', 'entityLoot': 'pc/1.20/entityLoot',
}
BASE = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/'
# the game's own loot tables and painting variants, from the summary branch of misode/mcmeta
META = {'loot': 'data/loot_table/data.min.json', 'paintings': 'data/painting_variant/data.min.json',
        'recipe': 'data/recipe/data.min.json', 'itemtags': 'data/tag/item/data.min.json',
        'enchant': 'data/enchantment/data.min.json', 'enchtags': 'data/tag/enchantment/data.min.json'}
META_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/1.21.1-summary/'


def load(folder, key):
    path = FILES.get(key, key)
    for name in (path.replace('/', '_') + '.json', key + '.json', 'mcmeta_' + key + '.json'):
        p = os.path.join(folder, name)
        if os.path.exists(p):
            return json.load(open(p))
    raise SystemExit('missing ' + path + ' in ' + folder)


def collapse_tags(recs):
    """The data lists a tag recipe (for example 'any planks' for a crafting table) once per member of the tag.
    Merge each such family back into one recipe whose varying ingredient is a tag ('#a|b|c'), so mixed
    ingredients work like in the game."""
    def key(r):
        return (r['r'], r['n'], 's' if 's' in r else 'i', len(r.get('s', r.get('i'))), len(r['s'][0]) if 's' in r else 0)
    groups = {}
    for r in recs:
        groups.setdefault(key(r), []).append(r)
    out, tags = [], {}
    for g in groups.values():
        if len(g) == 1:
            out.append(g[0]); continue
        flat = [[c for row in r['s'] for c in row] if 's' in r else sorted(r['i']) for r in g]
        n = len(flat[0])
        diff = [k for k in range(n) if len(set(f[k] for f in flat)) > 1]
        # every recipe must use one item at all the varying positions, and agree everywhere else
        ok = diff and all(len(set(f[k] for k in diff)) == 1 for f in flat)
        if not ok:
            out.extend(g); continue
        members = sorted(set(f[diff[0]] for f in flat))
        tag = '#' + '|'.join(members)
        tags[tag] = members
        base = g[0]
        if 's' in base:
            w = len(base['s'][0])
            cells = [c for row in base['s'] for c in row]
            for k in diff:
                cells[k] = tag
            out.append({'r': base['r'], 'n': base['n'], 's': [cells[i:i + w] for i in range(0, len(cells), w)]})
        else:
            cells = sorted(base['i'])
            for k in diff:
                cells[k] = tag
            out.append({'r': base['r'], 'n': base['n'], 'i': cells})
    return out, tags


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    folder = sys.argv[1]
    if folder == '--fetch':
        folder = tempfile.mkdtemp()
        for key, path in FILES.items():
            urllib.request.urlretrieve(BASE + path + '.json', os.path.join(folder, key + '.json'))
        for key, path in META.items():
            urllib.request.urlretrieve(META_BASE + path, os.path.join(folder, 'mcmeta_' + key + '.json'))
    blocks, items = load(folder, 'blocks'), load(folder, 'items')
    item_name = {i['id']: i['name'] for i in items}
    # tool tier from the cheapest pickaxe/axe/shovel/hoe that can harvest the block
    tier_of = {}
    for mat, t in (('wooden', 1), ('golden', 1), ('stone', 2), ('iron', 3), ('diamond', 4), ('netherite', 5)):
        for kind in ('pickaxe', 'axe', 'shovel', 'hoe', 'sword'):
            tier_of[mat + '_' + kind] = t
    tier_of['shears'] = 1

    out_blocks = {}
    for b in blocks:
        mat = b.get('material', 'default')
        tools = [m.split('/')[1] for m in mat.split(';') if m.startswith('mineable/')]
        tool = tools[0] if tools else ''
        if mat == 'coweb':
            tool = 'sword'
        if 'leaves' in mat:
            tool = 'hoe'
        need = 0
        ht = b.get('harvestTools')
        if ht:
            tiers = [tier_of.get(item_name.get(int(k), ''), 9) for k in ht]
            need = min(tiers) if tiers else 0
            if all(item_name.get(int(k), '') == 'shears' for k in ht):
                need = -1  # only shears
        out_blocks[b['name']] = [b['displayName'], b['hardness'] if b['hardness'] is not None else -1, b['resistance'],
                                 b['stackSize'], tool, need, b['emitLight'], b['filterLight'], 1 if b['transparent'] else 0]

    out_items = {}
    for i in items:
        out_items[i['name']] = [i['displayName'], i['stackSize'], i.get('maxDurability', 0), i.get('enchantCategories', []), i.get('repairWith', [])]

    recipes = load(folder, 'recipes')
    out_rec = []
    for rid, lst in recipes.items():
        for r in lst:
            res = r['result']
            rname = item_name[res['id']]
            if 'inShape' in r:
                shape = [[item_name[c] if c is not None else None for c in row] for row in r['inShape']]
                out_rec.append({'r': rname, 'n': res['count'], 's': shape})
            elif 'ingredients' in r:
                out_rec.append({'r': rname, 'n': res['count'], 'i': [item_name[c] for c in r['ingredients']]})

    out_rec, tags = collapse_tags(out_rec)

    foods = {f['name']: [f['foodPoints'], f['saturation']] for f in load(folder, 'foods')}
    ench = {e['name']: {'name': e['displayName'], 'max': e['maxLevel'], 'minA': e['minCost']['a'], 'minB': e['minCost']['b'],
                        'maxA': e['maxCost']['a'], 'maxB': e['maxCost']['b'], 'treasure': e['treasureOnly'], 'curse': e['curse'],
                        'excl': e['exclude'], 'cat': e['category'], 'w': e['weight'], 'disc': e['discoverable']}
            for e in load(folder, 'enchantments')}
    ents = {e['name']: [e['displayName'], e['width'], e['height'], e['category']] for e in load(folder, 'entities')}
    biomes = {b['name']: [b['displayName'], b['temperature'], b['has_precipitation'], b['dimension'], b['category']] for b in load(folder, 'biomes')}
    eloot = {}
    for e in load(folder, 'entityLoot'):
        eloot[e['entity']] = [[d['item'], d['stackSizeRange'][0] if d['stackSizeRange'][0] is not None else 0, d['stackSizeRange'][1], d.get('dropChance', 1), 1 if d.get('playerKill') else 0] for d in e['drops']]

    # loot tables (everything except blocks, whose drops are handled in code): the game's JSON, made smaller
    def compact(o):
        if isinstance(o, dict):
            r = {}
            for k, v in o.items():
                if k == 'bonus_rolls' and v == 0 or k == 'random_sequence':
                    continue
                if k == 'type' and v == 'minecraft:item':
                    continue
                v = compact(v)
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                r[k] = v
            if r.get('type') == 'constant' and 'value' in r and len(r) == 2:
                return r['value']
            return r
        if isinstance(o, list):
            return [compact(v) for v in o]
        if isinstance(o, str):
            return o.replace('minecraft:', '')
        if isinstance(o, float) and o == int(o):
            return int(o)
        return o
    loot = {k: compact(v) for k, v in load(folder, 'loot').items() if not k.startswith('blocks/')}
    paintings = {k: [v['width'], v['height']] for k, v in load(folder, 'paintings').items()}
    # item tags, with nested tags resolved to plain item lists
    raw_tags = load(folder, 'itemtags')
    def resolve(name, seen=()):
        out = []
        for v in raw_tags.get(name, {}).get('values', []):
            v = v['id'] if isinstance(v, dict) else v
            if v.startswith('#'):
                t = v[1:].replace('minecraft:', '')
                if t not in seen:
                    out += resolve(t, seen + (t,))
            else:
                out.append(v.replace('minecraft:', ''))
        return sorted(set(out))
    item_tags = {k: resolve(k) for k in raw_tags}
    # enchantment definitions (1.21 is data driven): anvil cost, the items it can go on (supported) and the
    # items the enchanting table offers it for (primary), and the enchantment tags
    raw_etags = load(folder, 'enchtags')
    def eresolve(name, seen=()):
        out = []
        for v in raw_etags.get(name, {}).get('values', []):
            v = v['id'] if isinstance(v, dict) else v
            if v.startswith('#'):
                t = v[1:].replace('minecraft:', '')
                if t not in seen:
                    out += eresolve(t, seen + (t,))
            else:
                out.append(v.replace('minecraft:', ''))
        return sorted(set(out))
    ench_tags = {k: eresolve(k) for k in raw_etags}
    tagname = lambda v: v.replace('#', '').replace('minecraft:', '') if isinstance(v, str) else None
    ench_defs = {}
    for k, v in load(folder, 'enchant').items():
        ex = v.get('exclusive_set')
        excl = ench_tags.get(tagname(ex), []) if isinstance(ex, str) and ex.startswith('#') else ([tagname(x) for x in ex] if isinstance(ex, list) else ([tagname(ex)] if ex else []))
        ench_defs[k] = [v['anvil_cost'], tagname(v['supported_items']), tagname(v.get('primary_items')), [x for x in excl if x != k]]
    # stonecutter and smithing table recipes, from the game's recipe files
    ing = lambda i: (('#' + i['tag'].replace('minecraft:', '')) if 'tag' in i else i['item'].replace('minecraft:', '')) if isinstance(i, dict) else ing(i[0])
    stonecut, smith, trims = [], [], []
    for k, r in sorted(load(folder, 'recipe').items()):
        t = r.get('type', '').replace('minecraft:', '')
        if t == 'stonecutting':
            stonecut.append([ing(r['ingredient']), r['result']['id'].replace('minecraft:', ''), r['result'].get('count', 1)])
        elif t == 'smithing_transform':
            smith.append([ing(r['template']), ing(r['base']), ing(r['addition']), r['result']['id'].replace('minecraft:', '')])
        elif t == 'smithing_trim':
            trims.append(ing(r['template']))

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(root, 'src', 'data'), exist_ok=True)
    dump = lambda v: json.dumps(v, separators=(',', ':'))
    with open(os.path.join(root, 'src', 'data', 'mcdata.js'), 'w') as f:
        f.write('\'use strict\';\n/* Generated by tools/gen_data.py from PrismarineJS/minecraft-data (MIT) and misode/mcmeta, Java Edition 1.21.1. Do not edit by hand. */\n')
        f.write('const MCDATA = {\n')
        f.write('// block: [name, hardness, blast resistance, stack size, tool, harvest tier (0 any, 1 wood/gold, 2 stone, 3 iron, 4 diamond, -1 shears), light, light filter, transparent]\n')
        f.write('blocks:' + dump(out_blocks) + ',\n')
        f.write('// item: [name, stack size, durability, enchant categories, repair materials]\n')
        f.write('items:' + dump(out_items) + ',\n')
        f.write('recipes:' + dump(out_rec) + ',\n')
        f.write('foods:' + dump(foods) + ',\n')
        f.write('enchantments:' + dump(ench) + ',\n')
        f.write('entities:' + dump(ents) + ',\n')
        f.write('biomes:' + dump(biomes) + ',\n')
        f.write('entityLoot:' + dump(eloot) + ',\n')
        f.write('// loot tables from the game (chests, entities, fishing, bartering, archaeology...)\n')
        f.write('loot:' + dump(loot) + ',\n')
        f.write('// painting variants: [width, height] in blocks\n')
        f.write('paintings:' + dump(paintings) + ',\n')
        f.write('// stonecutter recipes: [input, result, count]\n')
        f.write('stonecutting:' + dump(stonecut) + ',\n')
        f.write('// smithing table: upgrades [template, base, addition, result] and armour trim templates\n')
        f.write('smithing:' + dump(smith) + ',\n')
        f.write('trimTemplates:' + dump(trims) + ',\n')
        f.write('// enchantments: [anvil cost, supported items tag, primary items tag (enchanting table), exclusive with]\n')
        f.write('enchantDefs:' + dump(ench_defs) + ',\n')
        f.write('enchantTags:' + dump(ench_tags) + ',\n')
        f.write('// item tags (nested tags resolved)\n')
        f.write('itemTags:' + dump(item_tags) + ',\n')
        f.write('};\n')
    print('blocks', len(out_blocks), 'items', len(out_items), 'recipes', len(out_rec))


main()
