import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, Input
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, Callback
from tensorflow.keras.preprocessing.image import load_img, img_to_array
# from sklearn.utils.class_weight import compute_class_weight # Removed as dataset is balanced
from sklearn.metrics import confusion_matrix, classification_report

# Configuration
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 30
LEARNING_RATE = 1e-5 # Reduced from 1e-4
DATASET_DIR = 'dataset'
FINAL_MODEL_PATH = 'final_model.h5'
CLASS_INDICES_PATH = 'class_indices.json'
HISTORY_PATH = 'training_metrics.json'

class SanityCheckCallback(Callback):
    def on_epoch_end(self, epoch, logs=None):
        try:
            # Test one Real and one Fake image
            real_path = os.path.join(DATASET_DIR, 'train', 'real', '1.jpg')
            fake_path = os.path.join(DATASET_DIR, 'train', 'fake', 'fake1.png')
            
            if os.path.exists(real_path):
                img = load_img(real_path, target_size=IMG_SIZE)
                arr = img_to_array(img) / 255.0
                arr = np.expand_dims(arr, axis=0)
                score = self.model.predict(arr, verbose=0)[0][0]
                print(f"\n[Sanity Check] Real Image Score: {score:.4f} (Target: > 0.5)")
                
            if os.path.exists(fake_path):
                img = load_img(fake_path, target_size=IMG_SIZE)
                arr = img_to_array(img) / 255.0
                arr = np.expand_dims(arr, axis=0)
                score = self.model.predict(arr, verbose=0)[0][0]
                print(f"[Sanity Check] Fake Image Score: {score:.4f} (Target: < 0.5)\n")
        except Exception as e:
            print(f"\n[Sanity Check] Failed: {e}\n")

def build_generators():
    print("Building Data Generators...")
    
    # 1. Define explicit class names to force mapping
    # fake -> 0, real -> 1
    classes = ['fake', 'real']
    
    # 2. Augmentation for training
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.1,
        zoom_range=0.1,
        horizontal_flip=True,
        fill_mode='nearest'
    )
    
    # 3. Rescale only for validation/test
    val_test_datagen = ImageDataGenerator(rescale=1./255)
    
    # 4. Create generators
    train_gen = train_datagen.flow_from_directory(
        os.path.join(DATASET_DIR, 'train'),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary',
        classes=classes,  # FORCE ORDER
        shuffle=True
    )
    
    val_gen = val_test_datagen.flow_from_directory(
        os.path.join(DATASET_DIR, 'val'),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary',
        classes=classes, # FORCE ORDER
        shuffle=False
    )
    
    test_gen = val_test_datagen.flow_from_directory(
        os.path.join(DATASET_DIR, 'test'),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary',
        classes=classes, # FORCE ORDER
        shuffle=False
    )
    
    return train_gen, val_gen, test_gen

def build_model():
    print("Building MobileNetV2 Model...")
    # Transfer Learning with MobileNetV2
    base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=IMG_SIZE + (3,))
    
    # Unfreeze the top layers for fine-tuning
    base_model.trainable = True
    # Freeze the bottom layers (e.g., first 100)
    for layer in base_model.layers[:100]:
        layer.trainable = False
        
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dropout(0.2)(x) # Reduced dropout from 0.4 to 0.2
    predictions = Dense(1, activation='sigmoid')(x)
    
    model = Model(inputs=base_model.input, outputs=predictions)
    return model

def train():
    # 1. Generators
    train_gen, val_gen, test_gen = build_generators()
    
    # 2. Save Class Indices
    print(f"Class Indices: {train_gen.class_indices}")
    with open(CLASS_INDICES_PATH, 'w') as f:
        json.dump(train_gen.class_indices, f)
        
    # 3. Class Weights REMOVED (Balanced Dataset)
    # class_weights = compute_class_weight(...)
    # class_weight_dict = dict(enumerate(class_weights))
    
    # 4. Build Model
    model = build_model()
    
    # 5. Compile
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss='binary_crossentropy',
        metrics=['accuracy', tf.keras.metrics.Precision(name='precision'), tf.keras.metrics.Recall(name='recall')]
    )
    
    # 6. Callbacks
    checkpoint = ModelCheckpoint(FINAL_MODEL_PATH, monitor='val_accuracy', save_best_only=True, verbose=1)
    early_stop = EarlyStopping(monitor='val_loss', patience=8, restore_best_weights=True, verbose=1)
    reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, verbose=1)
    sanity_check = SanityCheckCallback()
    
    # 7. Train
    print("Starting Training...")
    history = model.fit(
        train_gen,
        steps_per_epoch=train_gen.samples // BATCH_SIZE,
        validation_data=val_gen,
        validation_steps=val_gen.samples // BATCH_SIZE,
        epochs=EPOCHS,
        callbacks=[checkpoint, early_stop, reduce_lr, sanity_check]
        # class_weight=class_weight_dict # Removed
    )
    
    # 8. Save History
    with open(HISTORY_PATH, 'w') as f:
        # Convert history to standard dict (float32 not serializable)
        hist_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
        json.dump(hist_dict, f)
        
    # 9. Evaluate
    print("\nEvaluating on Test Set...")
    # Reload best model
    model = tf.keras.models.load_model(FINAL_MODEL_PATH)
    
    preds = model.predict(test_gen)
    y_pred = (preds > 0.5).astype(int)
    y_true = test_gen.classes
    
    cm = confusion_matrix(y_true, y_pred)
    print("\nConfusion Matrix:")
    print(cm)
    
    print("\nClassification Report:")
    target_names = ['Fake', 'Real'] # 0=Fake, 1=Real
    print(classification_report(y_true, y_pred, target_names=target_names))
    
    # Check for Bias
    tn, fp, fn, tp = cm.ravel()
    if (tn == 0 and fn == 0) or (tp == 0 and fp == 0):
        print("\nCRITICAL: Model is predicting only one class!")
    else:
        print("\nSUCCESS: Model is predicting both classes.")

if __name__ == '__main__':
    train()
