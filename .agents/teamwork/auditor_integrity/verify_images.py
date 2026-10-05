import os
import sys
from PIL import Image

def verify_all_images():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    dirs_to_check = [
        os.path.join(base_dir, "public"),
        os.path.join(base_dir, "dist")
    ]
    
    total_checked = 0
    errors = []

    for d in dirs_to_check:
        print(f"\n[Verifying directory: {d}]")
        if not os.path.exists(d):
            errors.append(f"Directory not found: {d}")
            continue

        for root, _, files in os.walk(d):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in [".webp", ".png", ".jpg", ".jpeg", ".ico"]:
                    fpath = os.path.join(root, f)
                    total_checked += 1
                    try:
                        # 1. Open and verify integrity
                        with Image.open(fpath) as im:
                            format_detected = im.format
                            size_detected = im.size
                            im.verify()

                        # 2. Re-open and decode full bitmap
                        with Image.open(fpath) as im:
                            im.load()
                            w, h = im.size
                            mode = im.mode
                            assert w > 0 and h > 0, "Dimensions are zero"

                        rel_path = os.path.relpath(fpath, base_dir)
                        file_size = os.path.getsize(fpath)
                        print(f"  [OK] {rel_path} -> {format_detected} {size_detected} {mode} ({file_size} B)")
                    except Exception as e:
                        errors.append(f"Failed decoding {fpath}: {str(e)}")

    print(f"\nTotal image assets checked: {total_checked}")
    if errors:
        print("ERRORS DETECTED:")
        for err in errors:
            print("  - " + err)
        sys.exit(1)
    else:
        print("ALL IMAGES DECODED PERFECTLY WITHOUT ERRORS!")
        sys.exit(0)

if __name__ == "__main__":
    verify_all_images()
