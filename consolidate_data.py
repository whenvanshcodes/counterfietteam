import os
import shutil
import hashlib
import random
from PIL import Image
from tqdm import tqdm

# Configuration
DEST_DIR = 'dataset_final'
SOURCES = [
    'dataset',
    'archive',
    'Indian Currency Dataset'
]
IMG_SIZE = (224, 224)

def get_file_hash(filepath):
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def is_valid_image(filepath):
    try:
        with Image.open(filepath) as img:
            img.verify()
        return True
    except:
        return False

def consolidate():
    print("Starting Dataset Consolidation...")
    
    # 1. Collect Paths
    image_paths = {'real': [], 'fake': []}
    
    # Existing 'dataset'
    print("Scanning 'dataset'...")
    for root, dirs, files in os.walk('dataset'):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                path = os.path.join(root, file)
                if 'fake' in root.lower():
                    image_paths['fake'].append(path)
                elif 'real' in root.lower():
                    image_paths['real'].append(path)

    # 'archive'
    print("Scanning 'archive'...")
    for root, dirs, files in os.walk('archive'):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                path = os.path.join(root, file)
                if 'fake' in root.lower():
                    image_paths['fake'].append(path)
                elif 'real' in root.lower():
                    image_paths['real'].append(path)
                    
    # 'Indian Currency Dataset' (Assume REAL)
    print("Scanning 'Indian Currency Dataset'...")
    for root, dirs, files in os.walk('Indian Currency Dataset'):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                path = os.path.join(root, file)
                # Assume all here are REAL
                image_paths['real'].append(path)
                
    print(f"Found Raw Images -> Real: {len(image_paths['real'])}, Fake: {len(image_paths['fake'])}")
    
    # 2. Deduplicate
    print("Deduplicating...")
    unique_hashes = set()
    final_images = {'real': [], 'fake': []}
    
    for label in ['real', 'fake']:
        for path in tqdm(image_paths[label], desc=f"Processing {label}"):
            file_hash = get_file_hash(path)
            if file_hash not in unique_hashes:
                unique_hashes.add(file_hash)
                # Verify image integrity
                if is_valid_image(path):
                    final_images[label].append(path)
                    
    print(f"Unique Valid Images -> Real: {len(final_images['real'])}, Fake: {len(final_images['fake'])}")
    
    # 3. Balance (Downsample majority class if needed, but prefer keeping data if close)
    # User said "Ensure Class balance".
    # If imbalance is huge (e.g., 5000 vs 100), we should balance.
    # If it's 200 vs 180, it's fine.
    
    min_count = min(len(final_images['real']), len(final_images['fake']))
    # Let's cap the difference. If one is > 1.5x the other, trim it? 
    # Or just use class_weights in training (Better approach for "Reliability > Accuracy").
    # User asked to "Ensure Class balance" in dataset structure. I will simply balance them to be equal for the cleanest dataset.
    
    # Actually, balancing by dropping data is bad if we have class_weights. 
    # But user explicit instruction: "Ensure Class balance".
    # I will balance strictly to the minimum count to satisfy the "Clean" requirement.
    
    random.shuffle(final_images['real'])
    random.shuffle(final_images['fake'])
    
    final_images['real'] = final_images['real'][:min_count]
    final_images['fake'] = final_images['fake'][:min_count]
    
    print(f"Balanced to: {min_count} per class")
    
    # 4. Split and Copy
    if os.path.exists(DEST_DIR):
        shutil.rmtree(DEST_DIR)
        
    for split in ['train', 'val', 'test']:
        for label in ['real', 'fake']:
            os.makedirs(os.path.join(DEST_DIR, split, label))
            
    # Split Ratios: 70% Train, 20% Val, 10% Test
    train_count = int(min_count * 0.7)
    val_count = int(min_count * 0.2)
    test_count = min_count - train_count - val_count
    
    splits = {
        'train': (0, train_count),
        'val': (train_count, train_count + val_count),
        'test': (train_count + val_count, min_count)
    }
    
    for label in ['real', 'fake']:
        imgs = final_images[label]
        for split, (start, end) in splits.items():
            split_imgs = imgs[start:end]
            for img_path in tqdm(split_imgs, desc=f"Copying {label} to {split}"):
                fname = os.path.basename(img_path)
                # Handle name collision if any (unlikely due to dedupe, but possible names)
                dest_path = os.path.join(DEST_DIR, split, label, fname)
                if os.path.exists(dest_path):
                    fname = f"{random.randint(1000,9999)}_{fname}"
                    dest_path = os.path.join(DEST_DIR, split, label, fname)
                shutil.copy2(img_path, dest_path)
                
    print("Consolidation Complete.")

if __name__ == '__main__':
    consolidate()
