import os
from PIL import Image

def convert_pack(in_dir, out_dir, configs):
    os.makedirs(out_dir, exist_ok=True)
    for fname, (cols, rows, duration) in configs.items():
        try:
            in_file = os.path.join(in_dir, fname)
            if not os.path.exists(in_file):
                print(f"Skipping {fname}, not found.")
                continue
                
            img = Image.open(in_file).convert("RGBA")
            w, h = img.size
            frame_w = w // cols
            frame_h = h // rows
            
            frames = []
            for y in range(rows):
                for x in range(cols):
                    box = (x * frame_w, y * frame_h, (x + 1) * frame_w, (y + 1) * frame_h)
                    frame = img.crop(box)
                    frames.append(frame)
            
            # Map specific names to standard names
            out_name = fname.lower()
            if 'atk' in out_name or 'attack' in out_name: out_name = 'attack.gif'
            elif 'hit' in out_name or 'death' in out_name or 'dead' in out_name: out_name = 'dead.gif'
            elif 'idle' in out_name: out_name = 'idle.gif'
            elif 'walk' in out_name or 'march' in out_name or 'fly' in out_name: out_name = 'walk.gif'
            else: out_name = out_name.replace('.png', '.gif')
            
            out_file = os.path.join(out_dir, out_name)
            
            # Use loop=0 for idle/walk, loop=1 for attack/dead (to play once? GIF loop=1 means play 2 times. 
            # Actually we usually don't want to stop dead. We just loop it or let React handle it. Let's just loop=0 for all)
            frames[0].save(
                out_file, 
                save_all=True, 
                append_images=frames[1:], 
                duration=duration, 
                loop=0,
                disposal=2,
                transparency=0
            )
            print(f"Successfully converted {fname} to {out_name} ({len(frames)} frames)")
        except Exception as e:
            print(f"Error processing {fname}: {e}")

# Archer configs (Frame size 38x38)
archer_in = r'c:\Users\yigit\OneDrive\Desktop\Archer_sprite_demo'
archer_out = r'c:\Users\yigit\OneDrive\Desktop\realmofechoes-main\client\public\sprites\ranger'
archer_configs = {
    'Archer-atk-spritesheet.png': (3, 2, 80),
    'Archer-hit-spritesheet.png': (3, 2, 120),
    'Archer-Idle-spritesheet.png': (3, 3, 150),
    'Archer-walk-spritesheet.png': (3, 3, 100)
}

# Wizard configs
wizard_in = r'c:\Users\yigit\OneDrive\Desktop\Wizard_sprite_pack'
wizard_out = r'c:\Users\yigit\OneDrive\Desktop\realmofechoes-main\client\public\sprites\mage'
wizard_configs = {
    'wizard_attack.png': (4, 1, 100),
    'wizard_death.png': (10, 1, 120),
    'wizard_idle.png': (10, 1, 150),
    'wizard_fly_forward.png': (6, 1, 100)
}

print("Converting Archer...")
convert_pack(archer_in, archer_out, archer_configs)

print("\nConverting Wizard...")
convert_pack(wizard_in, wizard_out, wizard_configs)
