"""Build src/sounds.js: real recorded sounds, trimmed, loudness-matched and packed as small mono MP3s.

Sources (all openly licensed, see SOUND_CREDITS.md):
  vl   VoxeLibre            git clone --depth 1 --filter=blob:none --sparse https://github.com/VoxeLibre/VoxeLibre
                            (then: git sparse-checkout set --no-cone '/mods/**/sounds/*')
  bk   OLPC Berklee library  from https://github.com/Tonejs/audio (folder berklee/)
  sal  Salamander Grand Piano from https://github.com/Tonejs/audio (folder salamander/)

Usage: python3 tools/build_sounds.py <folder that holds the clones above>
Needs ffmpeg (with libmp3lame) and numpy.
"""
import base64, json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
DIRS = {'vl': 'vl/mods', 'bk': 'tj/berklee', 'sal': 'tj/salamander'}
SR = 32000

# id: (sources, options). Sources are 'repo:filename'. Options:
#   max   longest kept length in seconds (a fade is added when cut)
#   loop  make a seamless loop (crossfades the end into the start)
#   db    loudness target (RMS of the active part, dBFS)
#   keep  don't trim the start (for loops and long beds)
#   br    MP3 bitrate
S = {
    # ---- footsteps, by material
    'step_grass': (['vl:default_grass_footstep.1.ogg', 'vl:default_grass_footstep.2.ogg', 'vl:default_grass_footstep.3.ogg'], {'max': 0.45}),
    'step_dirt': (['vl:default_dirt_footstep.1.ogg', 'vl:default_dirt_footstep.2.ogg'], {'max': 0.45}),
    'step_gravel': (['vl:default_gravel_footstep.1.ogg', 'vl:default_gravel_footstep.2.ogg', 'vl:default_gravel_footstep.3.ogg', 'vl:default_gravel_footstep.4.ogg'], {'max': 0.4}),
    'step_sand': (['vl:default_sand_footstep.1.ogg', 'vl:default_sand_footstep.2.ogg', 'vl:default_sand_footstep.3.ogg'], {'max': 0.35}),
    'step_snow': (['vl:pedology_snow_soft_footstep.1.ogg', 'vl:pedology_snow_soft_footstep.2.ogg', 'vl:pedology_snow_soft_footstep.3.ogg', 'vl:pedology_snow_soft_footstep.4.ogg'], {'max': 0.5}),
    'step_stone': (['vl:default_hard_footstep.1.ogg', 'vl:default_hard_footstep.2.ogg', 'vl:default_hard_footstep.3.ogg'], {'max': 0.3}),
    'step_wood': (['vl:default_wood_footstep.1.ogg', 'vl:default_wood_footstep.2.ogg'], {'max': 0.3}),
    'step_glass': (['vl:default_glass_footstep.ogg'], {'max': 0.3}),
    'step_metal': (['vl:default_metal_footstep.1.ogg', 'vl:default_metal_footstep.2.ogg', 'vl:default_metal_footstep.3.ogg'], {'max': 0.35}),
    'step_cloth': (['vl:mcl_sounds_cloth.1.ogg', 'vl:mcl_sounds_cloth.2.ogg', 'vl:mcl_sounds_cloth.3.ogg', 'vl:mcl_sounds_cloth.4.ogg'], {'max': 0.45}),
    'step_water': (['vl:default_water_footstep.1.ogg', 'vl:default_water_footstep.2.ogg', 'vl:default_water_footstep.3.ogg'], {'max': 0.9}),
    'step_ice': (['vl:default_ice_footstep.1.ogg', 'vl:default_ice_footstep.2.ogg', 'vl:default_ice_footstep.3.ogg'], {'max': 0.3}),
    'step_mud': (['vl:mud_footsteps.ogg'], {'max': 0.3}),
    # ---- hitting a block while mining
    'dig_stone': (['vl:default_dig_cracky.1.ogg', 'vl:default_dig_cracky.2.ogg', 'vl:default_dig_cracky.3.ogg'], {'max': 0.3}),
    'dig_wood': (['vl:default_dig_choppy.1.ogg', 'vl:default_dig_choppy.2.ogg', 'vl:default_dig_choppy.3.ogg'], {'max': 0.3}),
    'dig_dirt': (['vl:default_dig_crumbly.ogg'], {'max': 0.32}),
    'dig_leaf': (['vl:default_dig_snappy.ogg'], {'max': 0.3}),
    'dig_gravel': (['vl:default_gravel_dig.1.ogg', 'vl:default_gravel_dig.2.ogg'], {'max': 0.3}),
    'dig_metal': (['vl:default_dig_metal.ogg'], {'max': 0.25}),
    'dig_ice': (['vl:default_ice_dig.1.ogg', 'vl:default_ice_dig.2.ogg', 'vl:default_ice_dig.3.ogg'], {'max': 0.35}),
    'dig_hand': (['vl:default_dig_oddly_breakable_by_hand.ogg'], {'max': 0.3}),
    # ---- a block breaking (other materials reuse their footstep, louder)
    'brk_glass': (['vl:default_break_glass.1.ogg', 'vl:default_break_glass.2.ogg', 'vl:default_break_glass.3.ogg'], {'max': 0.85}),
    'brk_metal': (['vl:default_dug_metal.1.ogg', 'vl:default_dug_metal.2.ogg'], {'max': 0.5}),
    'brk_gravel': (['vl:default_gravel_dug.1.ogg', 'vl:default_gravel_dug.2.ogg', 'vl:default_gravel_dug.3.ogg'], {'max': 0.3}),
    'brk_ice': (['vl:default_ice_dug.ogg'], {'max': 0.5}),
    'brk_node': (['vl:default_dug_node.1.ogg', 'vl:default_dug_node.2.ogg'], {'max': 0.3}),
    # ---- placing
    'place_soft': (['vl:default_place_node.1.ogg', 'vl:default_place_node.2.ogg', 'vl:default_place_node.3.ogg'], {'max': 0.4}),
    'place_hard': (['vl:default_place_node_hard.1.ogg', 'vl:default_place_node_hard.2.ogg'], {'max': 0.3}),
    'place_metal': (['vl:default_place_node_metal.1.ogg', 'vl:default_place_node_metal.2.ogg'], {'max': 0.5}),
    'place_water': (['vl:mcl_sounds_place_node_water.ogg'], {'max': 1.2}),
    'place_lava': (['vl:default_place_node_lava.ogg'], {'max': 1.2}),
    # ---- you
    'punch': (['vl:default_punch.ogg'], {'max': 0.4}),
    'crit': (['vl:mcl_criticals_hit.0.ogg', 'vl:mcl_criticals_hit.1.ogg', 'vl:mcl_criticals_hit.2.ogg'], {'max': 0.7}),
    'hurt': (['vl:player_damage.ogg'], {'max': 0.3}),
    'fall': (['vl:player_falling_damage.ogg'], {'max': 0.4}),
    'pickup': (['vl:item_drop_pickup.ogg'], {}),
    'bite': (['vl:mcl_hunger_bite.1.ogg', 'vl:mcl_hunger_bite.2.ogg'], {'max': 0.35}),
    'drink': (['vl:mcl_potions_drinking.ogg'], {'max': 0.5}),
    'bow': (['vl:mcl_bows_bow_shoot.ogg'], {'max': 0.35}),
    'arrow_hit': (['vl:mcl_bows_hit_other.ogg'], {'max': 0.5}),
    'throw': (['vl:mcl_throwing_throw.ogg'], {'max': 0.25}),
    'chest_open': (['vl:default_chest_open.ogg'], {'max': 0.6}),
    'chest_close': (['vl:default_chest_close.ogg'], {'max': 0.65}),
    'barrel_open': (['vl:mcl_barrels_default_barrel_open.ogg'], {'max': 0.9}),
    'shears': (['vl:mcl_tools_shears_cut.ogg'], {'max': 0.5}),
    'enchant': (['vl:mcl_enchanting_enchant.0.ogg', 'vl:mcl_enchanting_enchant.1.ogg', 'vl:mcl_enchanting_enchant.2.ogg'], {'max': 2.2}),
    'tele': (['vl:mobs_mc_enderman_teleport_src.ogg', 'vl:mobs_mc_enderman_teleport_dst.ogg'], {'max': 0.75}),
    'portal': (['vl:mcl_portals_teleport.ogg'], {'max': 2.2}),
    'explode': (['vl:tnt_explode.ogg'], {'max': 1.5}),
    'fuse': (['vl:tnt_ignite.ogg'], {'max': 1.6}),
    'thunder': (['vl:lightning_thunder.3.ogg'], {'max': 3.2}),
    'splash': (['vl:watersplash.ogg'], {'max': 1.0}),
    'award': (['vl:awards_got_generic.ogg'], {'max': 1.6}),
    'bell': (['vl:mcl_bells_bell_stroke.ogg'], {'max': 2.5, 'db': -22}),
    'poof': (['vl:mcl_mobs_mob_poof.ogg'], {'max': 0.7}),
    'click': (['vl:mesecons_button_push.ogg'], {}),
    'armor': (['vl:mcl_armor_equip_iron.ogg', 'vl:mcl_armor_equip_leather.ogg'], {'max': 0.45}),
    'eat_animal': (['vl:mobs_mc_animal_eat_generic.ogg'], {'max': 0.8}),
    # ---- ambience
    'amb_fire': (['vl:fire_fire.1.ogg'], {'loop': True, 'keep': True}),
    'amb_water': (['vl:env_sounds_water.1.ogg'], {'loop': True, 'keep': True}),
    'amb_lava': (['vl:env_sounds_lava.1.ogg'], {'loop': True, 'keep': True}),
    'amb_birds': (['bk:birds_outside1.mp3'], {'loop': True, 'keep': True, 'db': -24}),
    'bird': (['bk:bird1.mp3', 'bk:bird2.mp3', 'bk:bird3.mp3', 'bk:bird4.mp3', 'bk:bird5.mp3'], {'max': 2.6}),
    'cave': (['vl:cave1.ogg', 'vl:cave2.ogg', 'vl:cave4.ogg', 'vl:cave5.ogg'], {'max': 6.0, 'db': -22}),
    'drip': (['vl:drippingwater_drip.1.ogg', 'vl:drippingwater_drip.2.ogg', 'vl:drippingwater_drip.3.ogg'], {'max': 0.4}),
    # ---- creatures: idle (say), hurt and death
    'cow_say': (['vl:mobs_mc_cow.ogg'], {'max': 1.7}),
    'cow_hurt': (['vl:mobs_mc_cow_hurt.ogg'], {'max': 0.6}),
    'pig_say': (['vl:mobs_pig.ogg'], {'max': 0.7}),
    'pig_hurt': (['vl:mobs_pig_angry.ogg'], {'max': 0.8}),
    'sheep_say': (['vl:mobs_sheep.ogg', 'vl:mobs_mc_sheep_random.1.ogg', 'vl:mobs_mc_sheep_random.2.ogg'], {'max': 1.2}),
    'sheep_hurt': (['vl:mobs_mc_sheep_damage.ogg'], {'max': 0.8}),
    'chicken_say': (['vl:mobs_mc_chicken_buck.1.ogg', 'vl:mobs_mc_chicken_buck.2.ogg', 'vl:mobs_mc_chicken_buck.3.ogg'], {'max': 0.9}),
    'chicken_hurt': (['vl:mobs_mc_chicken_hurt.ogg'], {'max': 0.5}),
    'rabbit_say': (['vl:mobs_mc_rabbit_random.1.ogg', 'vl:mobs_mc_rabbit_random.2.ogg', 'vl:mobs_mc_rabbit_random.4.ogg'], {'max': 0.35}),
    'rabbit_hurt': (['vl:mobs_mc_rabbit_hurt.1.ogg', 'vl:mobs_mc_rabbit_hurt.2.ogg', 'vl:mobs_mc_rabbit_hurt.3.ogg'], {'max': 0.4}),
    'horse_say': (['vl:mobs_mc_horse_random.1.ogg', 'vl:mobs_mc_horse_random.2.ogg'], {'max': 1.6}),
    'horse_hurt': (['vl:mobs_mc_horse_hurt.ogg'], {'max': 0.6}),
    'horse_death': (['vl:mobs_mc_horse_death.ogg'], {'max': 1.0}),
    'donkey_say': (['vl:mobs_mc_donkey_random.1.ogg', 'vl:mobs_mc_donkey_random.2.ogg', 'vl:mobs_mc_llama.ogg'], {'max': 1.2}),
    'donkey_hurt': (['vl:mobs_mc_donkey_hurt.ogg'], {'max': 0.6}),
    'wolf_bark': (['vl:mobs_mc_wolf_bark.1.ogg', 'vl:mobs_mc_wolf_bark.2.ogg', 'vl:mobs_mc_wolf_bark.3.ogg'], {'max': 0.6}),
    'wolf_growl': (['vl:mobs_mc_wolf_growl.ogg'], {'max': 1.4}),
    'wolf_hurt': (['vl:mobs_mc_wolf_hurt.1.ogg', 'vl:mobs_mc_wolf_hurt.2.ogg', 'vl:mobs_mc_wolf_hurt.3.ogg'], {'max': 0.4}),
    'wolf_death': (['vl:mobs_mc_wolf_death.ogg'], {'max': 0.8}),
    'wolf_happy': (['vl:mobs_mc_wolf_take_bone.ogg'], {'max': 0.6}),
    'cat_say': (['vl:mobs_mc_cat_idle.1.ogg', 'vl:mobs_mc_cat_idle.2.ogg'], {'max': 1.1}),
    'cat_hiss': (['vl:mobs_mc_cat_hiss.ogg'], {'max': 0.75}),
    'cat_hurt': (['vl:mobs_mc_ocelot_hurt.ogg'], {'max': 0.6}),
    'bear_say': (['vl:mobs_mc_bear_random.1.ogg', 'vl:mobs_mc_bear_random.2.ogg', 'vl:mobs_mc_bear_random.3.ogg'], {'max': 1.2}),
    'bear_growl': (['vl:mobs_mc_bear_growl.1.ogg', 'vl:mobs_mc_bear_growl.2.ogg', 'vl:mobs_mc_bear_growl.3.ogg'], {'max': 2.2}),
    'bear_hurt': (['vl:mobs_mc_bear_hurt.1.ogg'], {'max': 0.6}),
    'bear_death': (['vl:mobs_mc_bear_death.1.ogg'], {'max': 1.2}),
    'bat_say': (['vl:mobs_mc_bat_idle.ogg'], {'max': 0.25}),
    'bat_hurt': (['vl:mobs_mc_bat_hurt.1.ogg', 'vl:mobs_mc_bat_hurt.2.ogg', 'vl:mobs_mc_bat_hurt.3.ogg'], {'max': 0.2}),
    'villager_say': (['vl:mobs_mc_villager.1.ogg', 'vl:mobs_mc_villager.2.ogg', 'vl:mobs_mc_villager.3.ogg', 'vl:mobs_mc_villager.4.ogg', 'vl:mobs_mc_villager.5.ogg', 'vl:mobs_mc_villager.6.ogg', 'vl:mobs_mc_villager.7.ogg'], {'max': 0.6}),
    'villager_hurt': (['vl:mobs_mc_villager_hurt.1.ogg', 'vl:mobs_mc_villager_hurt.2.ogg'], {'max': 0.35}),
    'villager_trade': (['vl:mobs_mc_villager_trade.1.ogg', 'vl:mobs_mc_villager_trade.2.ogg', 'vl:mobs_mc_villager_trade.3.ogg', 'vl:mobs_mc_villager_trade.4.ogg'], {'max': 0.7}),
    'villager_yes': (['vl:mobs_mc_villager_accept.1.ogg', 'vl:mobs_mc_villager_accept.2.ogg'], {'max': 0.65}),
    'zombie_say': (['vl:mobs_mc_zombie_growl.ogg'], {'max': 1.5}),
    'zombie_hurt': (['vl:mobs_mc_zombie_hurt.ogg'], {'max': 0.6}),
    'zombie_death': (['vl:mobs_mc_zombie_death.ogg'], {'max': 0.9}),
    'skeleton_say': (['vl:mobs_mc_skeleton_random.1.ogg', 'vl:mobs_mc_skeleton_random.2.ogg'], {'max': 0.95}),
    'skeleton_hurt': (['vl:mobs_mc_skeleton_hurt.ogg'], {'max': 0.6}),
    'skeleton_death': (['vl:mobs_mc_skeleton_death.ogg'], {'max': 1.0}),
    'spider_say': (['vl:mobs_mc_spider_random.ogg', 'vl:mobs_spider.ogg'], {'max': 0.85}),
    'spider_hurt': (['vl:mobs_mc_spider_hurt.1.ogg', 'vl:mobs_mc_spider_hurt.2.ogg', 'vl:mobs_mc_spider_hurt.3.ogg'], {'max': 0.6}),
    'spider_death': (['vl:mobs_mc_spider_death.ogg'], {'max': 1.1}),
    'stalker_say': (['vl:mobs_mc_enderman_random.1.ogg'], {'max': 0.6}),
    'stalker_hurt': (['vl:mobs_mc_enderman_hurt.1.ogg', 'vl:mobs_mc_enderman_hurt.2.ogg', 'vl:mobs_mc_enderman_hurt.3.ogg'], {'max': 0.7}),
    'stalker_death': (['vl:mobs_mc_enderman_death.ogg'], {'max': 1.2}),
    'witch_say': (['vl:vl_witch_laugh.ogg', 'vl:vl_witch_laugh.2.ogg'], {'max': 1.8}),
    'witch_hurt': (['vl:vl_witch_hit.1.ogg', 'vl:vl_witch_hit.2.ogg'], {'max': 0.8}),
    'witch_death': (['vl:vl_witch_death.ogg'], {'max': 1.5}),
    'slime_say': (['vl:green_slime_jump.ogg', 'vl:green_slime_land.ogg'], {'max': 0.25}),
    'slime_hurt': (['vl:green_slime_damage.ogg'], {'max': 0.25}),
    'slime_death': (['vl:green_slime_death.ogg'], {'max': 0.6}),
    'magma_say': (['vl:mobs_mc_magma_cube_small.ogg', 'vl:mobs_mc_magma_cube_big.ogg'], {'max': 1.2}),
    'ghost_say': (['vl:mobs_mc_guardian_random.1.ogg', 'vl:mobs_mc_guardian_random.3.ogg'], {'max': 2.2}),
    'ghost_hurt': (['vl:mobs_mc_vex_hurt.ogg'], {'max': 0.25}),
    'ghost_death': (['vl:mobs_mc_vex_death.ogg'], {'max': 0.25}),
    'glider_say': (['vl:mobs_mc_parrot_random.1.ogg', 'vl:mobs_mc_parrot_random.2.ogg'], {'max': 1.0}),
    'golem_say': (['vl:mobs_mc_iron_golem_random.1.ogg', 'vl:mobs_mc_iron_golem_random.2.ogg'], {'max': 1.3}),
    'golem_hurt': (['vl:mobs_mc_iron_golem_clank_damage.1.ogg', 'vl:mobs_mc_iron_golem_clank_damage.2.ogg', 'vl:mobs_mc_iron_golem_clank_damage.3.ogg'], {'max': 0.6}),
    'golem_death': (['vl:mobs_mc_iron_golem_death.ogg'], {'max': 0.5}),
    'fire_say': (['vl:vl_elemental_fire_breath.ogg'], {'max': 1.6}),
    'fire_hurt': (['vl:vl_elemental_fire_hurt.ogg'], {'max': 0.5}),
    'fire_death': (['vl:vl_elemental_fire_died.ogg'], {'max': 1.6}),
    'mite_say': (['vl:mobs_mc_silverfish_idle.ogg'], {'max': 0.35}),
    'flop': (['vl:mobs_mc_squid_flop.1.ogg', 'vl:mobs_mc_squid_flop.2.ogg', 'vl:mobs_mc_squid_flop.3.ogg', 'vl:mobs_mc_squid_flop.4.ogg'], {'max': 0.6}),
}
# real grand piano notes (sampled every minor third) for the music
for n in ['A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5']:
    S['piano_' + n] = (['sal:' + n + '.mp3'], {'max': 4.5, 'fadeout': 1.6, 'keep': True, 'br': '56k', 'db': -20})


def find(spec):
    repo, name = spec.split(':', 1)
    base = os.path.join(SRC, DIRS[repo])
    for d, _, files in os.walk(base):
        if name in files:
            return os.path.join(d, name)
    raise SystemExit('missing source: ' + spec)


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def process(x, o):
    peak = float(np.max(np.abs(x))) or 1.0
    # trim quiet lead-in and tail
    if not o.get('keep'):
        on = np.nonzero(np.abs(x) > peak * 10 ** (-30 / 20))[0]
        if len(on):
            x = x[max(0, on[0] - int(0.004 * SR)):]
    tail = np.nonzero(np.abs(x) > peak * 10 ** (-48 / 20))[0]
    if len(tail) and not o.get('loop'):
        x = x[:min(len(x), tail[-1] + int(0.03 * SR))]
    mx = o.get('max')
    if mx and len(x) > mx * SR:
        x = x[:int(mx * SR)]
        f = int(min(o.get('fadeout', 0.08), mx * 0.4) * SR)
        x[-f:] *= np.linspace(1, 0, f) ** 2
    if o.get('loop'):  # crossfade the last half second into the start so it loops without a seam
        xf = int(min(0.5, len(x) / 4) * SR)
        head, body, end = x[:xf], x[xf:len(x) - xf], x[len(x) - xf:]
        t = np.linspace(0, 1, xf)
        x = np.concatenate([body, end * np.cos(t * np.pi / 2) + head * np.sin(t * np.pi / 2)])
    else:
        f = min(int(0.003 * SR), len(x) // 4)
        if f: x[:f] *= np.linspace(0, 1, f)
        f = min(int(0.012 * SR), len(x) // 4)
        if f: x[-f:] *= np.linspace(1, 0, f)
    # loudness: RMS of the active part to a common level, never clipping
    act = x[np.abs(x) > np.max(np.abs(x)) * 0.05]
    rms = float(np.sqrt(np.mean(act ** 2))) if len(act) else 1e-6
    g = 10 ** (o.get('db', -18) / 20) / max(rms, 1e-6)
    g = min(g, 10 ** (-1 / 20) / max(float(np.max(np.abs(x))), 1e-6))
    return (x * g).astype(np.float32)


def encode(x, br):
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', br, '-f', 'mp3', '-'],
                          input=x.tobytes(), capture_output=True, check=True).stdout


out, total = {}, 0
for sid, (srcs, o) in S.items():
    out[sid] = []
    for s in srcs:
        mp3 = encode(process(decode(find(s)), o), o.get('br', '48k'))
        total += len(mp3)
        out[sid].append(base64.b64encode(mp3).decode())
js = ("'use strict';\n/* Recorded sounds as small MP3s (see SOUND_CREDITS.md). Generated by tools/build_sounds.py; do not edit by hand. */\n"
      'const SOUND_FILES = ' + json.dumps(out, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'src', 'sounds.js'), 'w').write(js)
print(len(S), 'sounds,', sum(len(v) for v in out.values()), 'files,', total // 1024, 'KB of MP3,', len(js) // 1024, 'KB as src/sounds.js')
