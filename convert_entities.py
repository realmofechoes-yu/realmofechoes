import os
from PIL import Image

base_dir = r'c:\Users\yigit\OneDrive\Desktop\Entities_sprite_pack'
out_base = r'c:\Users\yigit\OneDrive\Desktop\realmofechoes-main\client\public\sprites'

def convert_sheet(in_path, out_path, frame_w, duration=100, loop=0):
    img = Image.open(in_path).convert("RGBA")
    w, h = img.size
    cols = w // frame_w
    frames = []
    for x in range(cols):
        box = (x * frame_w, 0, (x + 1) * frame_w, h)
        frames.append(img.crop(box))
    if frames:
        frames[0].save(out_path, save_all=True if len(frames)>1 else False, append_images=frames[1:] if len(frames)>1 else [], duration=duration, loop=loop, disposal=2, transparency=0)

def convert_frames(in_dir, files, out_path, duration=100, scale=2):
    frames = []
    for f in files:
        path = os.path.join(in_dir, f)
        if os.path.exists(path):
            img = Image.open(path).convert("RGBA")
            if scale != 1:
                img = img.resize((img.size[0]*scale, img.size[1]*scale), Image.Resampling.NEAREST)
            frames.append(img)
    if frames:
        frames[0].save(out_path, save_all=True if len(frames)>1 else False, append_images=frames[1:] if len(frames)>1 else [], duration=duration, loop=0, disposal=2, transparency=0)

# Echoed Guardian
eg_dir = os.path.join(base_dir, 'echoed_guardian')
eg_out = os.path.join(out_base, 'echoed_guardian')
os.makedirs(eg_out, exist_ok=True)
if os.path.exists(os.path.join(eg_dir, 'idle.png')): convert_sheet(os.path.join(eg_dir, 'idle.png'), os.path.join(eg_out, 'idle.gif'), 277, 150)
if os.path.exists(os.path.join(eg_dir, 'run.png')): convert_sheet(os.path.join(eg_dir, 'run.png'), os.path.join(eg_out, 'attack.gif'), 277, 100) # using run as attack since no attack
# wait, no death for echoed guardian?

# Flame Wraith
fw_dir = os.path.join(base_dir, 'flame_wraith')
fw_out = os.path.join(out_base, 'flame_wraith')
os.makedirs(fw_out, exist_ok=True)
if os.path.exists(os.path.join(fw_dir, 'idle.png')): convert_sheet(os.path.join(fw_dir, 'idle.png'), os.path.join(fw_out, 'idle.gif'), 192, 150)
if os.path.exists(os.path.join(fw_dir, 'attack-2.png')): convert_sheet(os.path.join(fw_dir, 'attack-2.png'), os.path.join(fw_out, 'attack.gif'), 192, 100)
if os.path.exists(os.path.join(fw_dir, 'fall.png')): convert_sheet(os.path.join(fw_dir, 'fall.png'), os.path.join(fw_out, 'dead.gif'), 192, 120, loop=1)

# Shadow Rat
sr_dir = os.path.join(base_dir, 'shadow_rat')
sr_out = os.path.join(out_base, 'shadow_rat')
os.makedirs(sr_out, exist_ok=True)
convert_frames(sr_dir, [f'char-idle-{i}.png' for i in range(3)], os.path.join(sr_out, 'idle.gif'), 150, scale=2)
convert_frames(sr_dir, [f'char-action-{i}.png' for i in range(6)], os.path.join(sr_out, 'attack.gif'), 100, scale=2)
convert_frames(sr_dir, ['char-fall-0.png'], os.path.join(sr_out, 'dead.gif'), 100, scale=2)

# Venom Crawler
vc_dir = os.path.join(base_dir, 'venom_crawler')
vc_out = os.path.join(out_base, 'venom_crawler')
os.makedirs(vc_out, exist_ok=True)
if os.path.exists(os.path.join(vc_dir, 'hit.png')): convert_sheet(os.path.join(vc_dir, 'hit.png'), os.path.join(vc_out, 'idle.gif'), 247, 150) # use hit as idle fallback
if os.path.exists(os.path.join(vc_dir, 'end-Attack 3.png')): convert_sheet(os.path.join(vc_dir, 'end-Attack 3.png'), os.path.join(vc_out, 'attack.gif'), 247, 100)
if os.path.exists(os.path.join(vc_dir, 'death.png')): convert_sheet(os.path.join(vc_dir, 'death.png'), os.path.join(vc_out, 'dead.gif'), 247, 80, loop=1)

print("Entities converted.")
