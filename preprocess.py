from tensorflow.keras.preprocessing import image
import numpy as np
from PIL import Image

def preprocess_image(file_storage, target_size=(224, 224)):
    """
    Preprocesses an image file (FileStorage or file path) for model prediction.
    """
    try:
        # Load image from FileStorage object or path
        img = Image.open(file_storage)
        
        # Convert to RGB (in case of RGBA or Grayscale)
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Resize
        img = img.resize(target_size, Image.NEAREST)
        
        # Convert to array
        img_array = image.img_to_array(img)
        
        # Normalize (1./255) - MUST MATCH TRAINING
        img_array = img_array / 255.0
        
        # Expand dims to match batch shape (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    except Exception as e:
        print(f"Error preprocessing image: {e}")
        return None
