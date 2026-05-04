import os
from PIL import Image

in_path = r'c:\Users\yigit\OneDrive\Desktop\Warrior_sprite_pack'
out_path = r'c:\Users\yigit\OneDrive\Desktop\realmofechoes-main\client\public\sprites\warrior'
os.makedirs(out_path, exist_ok=True)

configs = {
    'attack.png': (4, 2, 100), # 100ms per frame
    'dead.png': (3, 2, 150),
    'idle.png': (3, 2, 150),
    'walk.png': (8, 2, 100)
}

for fname, (cols, rows, duration) in configs.items():
    try:
        img = Image.open(os.path.join(in_path, fname)).convert("RGBA")
        w, h = img.size
        frame_w = w // cols
        frame_h = h // rows
        
        frames = []
        for y in range(rows):
            for x in range(cols):
                box = (x * frame_w, y * frame_h, (x + 1) * frame_w, (y + 1) * frame_h)
                frame = img.crop(box)
                # Keep transparency
                frames.append(frame)
        
        out_name = fname.replace('.png', '.gif')
        out_file = os.path.join(out_path, out_name)
        
        # Save as animated GIF with transparency support
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
