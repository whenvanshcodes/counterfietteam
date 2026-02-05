import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import json

# Configuration
DATASET_DIR = 'dataset'
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
MODEL_PATH = 'final_model.h5'

def evaluate():
    if not os.path.exists(MODEL_PATH):
        print(f"Error: Model file {MODEL_PATH} not found.")
        return

    print("Loading model...")
    model = load_model(MODEL_PATH)
    
    print("Preparing test data...")
    test_datagen = ImageDataGenerator(rescale=1./255)
    
    test_generator = test_datagen.flow_from_directory(
        os.path.join(DATASET_DIR, 'test'),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary',
        shuffle=False  # Important for correct label mapping
    )
    
    # Get True Labels
    y_true = test_generator.classes
    class_indices = test_generator.class_indices
    # Invert class_indices to get label names
    label_map = {v: k for k, v in class_indices.items()}
    
    print("Running predictions...")
    y_pred_prob = model.predict(test_generator)
    y_pred = (y_pred_prob > 0.5).astype(int).reshape(-1)
    
    print("\nClassification Report:")
    report = classification_report(y_true, y_pred, target_names=[label_map[0], label_map[1]])
    print(report)
    
    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_true, y_pred)
    print(cm)
    
    # Save results
    with open('evaluation_results.txt', 'w') as f:
        f.write("Classification Report:\n")
        f.write(report)
        f.write("\n\nConfusion Matrix:\n")
        f.write(str(cm))
        
    print("Evaluation complete. Results saved to evaluation_results.txt")

if __name__ == '__main__':
    evaluate()
