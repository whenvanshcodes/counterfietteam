import os
import shutil

# Files to KEEP (Safe List)
KEEP_FILES = [
    'app.py',
    'train_model.py',
    'preprocess.py',
    'model_loader.py',
    'requirements.txt',
    'final_model.h5',
    'class_indices.json',
    'training_history.json',
    'scan_history.json',
    'cleanup_project.py', # Self
    'consolidate_data.py', # Next step
    'dataset', # Folder
    'archive', # Folder
    'Indian Currency Dataset', # Folder
    'templates', # Folder
    'static', # Folder
    '.venv', # Folder
    '__pycache__', # Folder
    '.git', # Folder
    'Fake-Currency-Detection-System-main' # Reference Project
]

# Candidates for deletion (known temp/old scripts)
DELETE_CANDIDATES = [
    'audit_dataset.py',
    'fix_dataset.py',
    'evaluate_model.py', # Will be recreated/merged into train
    'find_best_test_images.py',
    'validate_system.py', # Will be merged into final validation
    'test_api.py',
    'check_gpu.py'
]

def cleanup():
    root_dir = os.getcwd()
    trash_dir = os.path.join(root_dir, '_trash')
    
    if not os.path.exists(trash_dir):
        os.makedirs(trash_dir)
        
    files_moved = []
    
    for filename in os.listdir(root_dir):
        if filename in KEEP_FILES or filename in ['.trae', '.vscode', '.idea']:
            continue
            
        # Check if it's a file to delete or unknown
        file_path = os.path.join(root_dir, filename)
        
        # Skip directories that are not explicitly in delete list (safety)
        if os.path.isdir(file_path):
            if filename == '_trash': continue
            # Don't touch other directories unless sure
            continue
            
        # Move to trash
        shutil.move(file_path, os.path.join(trash_dir, filename))
        files_moved.append(filename)
            
    print("Cleanup Complete.")
    print(f"Files moved to _trash: {len(files_moved)}")
    for f in files_moved:
        print(f" - {f}")

if __name__ == '__main__':
    cleanup()
