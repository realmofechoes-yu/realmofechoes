import os
from PIL import Image

in_dir = r'c:\Users\yigit\OneDrive\Desktop\Hollow_Knight_sprite_pack'
out_dir = r'c:\Users\yigit\OneDrive\Desktop\realmofechoes-main\client\public\sprites\hollow_knight'
os.makedirs(out_dir, exist_ok=True)

configs = {
    'idle.gif': (['character-idle-0.png', 'character-idle-1.png', 'character-idle-2.png', 'character-idle-3.png', 'character-idle-4.png'], 150),
    'walk.gif': (['character-run-0.png', 'character-run-1.png', 'character-run-2.png', 'character-run-3.png'], 100),
    'attack.gif': (['character-jump-0.png'], 100),
    'dead.gif': (['character-fall-0.png'], 100)
}

for out_name, (files, duration) in configs.items():
    frames = []
    for f in files:
        path = os.path.join(in_dir, f)
        if os.path.exists(path):
            img = Image.open(path).convert("RGBA")
            # Resize from 64x64 to 128x128 for better visibility using Nearest Neighbor
            img = img.resize((128, 128), Image.Resampling.NEAREST)
            frames.append(img)
            
    if len(frames) > 0:
        out_file = os.path.join(out_dir, out_name)
        frames[0].save(
            out_file, 
            save_all=True if len(frames) > 1 else False, 
            append_images=frames[1:] if len(frames) > 1 else [], 
            duration=duration, 
            loop=0,
            disposal=2,
            transparency=0
        )
        print(f"Created {out_name} with {len(frames)} frames.")
