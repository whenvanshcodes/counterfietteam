import tensorflow as tf
import os

MODEL_PATH = 'final_model.h5'

def load_currency_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Please run train_model.py first.")
    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        return model
    except Exception as e:
        print(f"Error loading model: {e}")
        return None
