# Fake Currency Detection System

An advanced Deep Learning-based system to detect counterfeit currency notes using Transfer Learning (MobileNetV2). The system includes a modern web interface, real-time feedback, and explainability features.

## 🚀 Key Features

- **High Accuracy Model**: Uses MobileNetV2 with Transfer Learning for robust classification (Real vs Fake).
- **Explainability**: Provides reasons for "Fake" predictions (e.g., Blur, Low Contrast, Missing Textures).
- **Modern UI**: Clean, professional interface with Dark Mode elements and Drag & Drop support.
- **Confidence Visualization**: Visual confidence bar to show model certainty.
- **Scan History**: Tracks previous scans with results and timestamps.
- **Data Consolidation**: Automatically merges and balances datasets for optimal training.

## 🛠️ Tech Stack

- **Backend**: Flask (Python)
- **Deep Learning**: TensorFlow, Keras, MobileNetV2
- **Image Processing**: OpenCV, PIL
- **Frontend**: HTML5, CSS3, JavaScript (Modern UI)

## 📋 Prerequisites

- Python 3.9+
- Virtual Environment (recommended)

## 📦 Installation

1. **Clone the repository** (if applicable) or navigate to the project folder.
2. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## 🏃 Usage

### 1. Train the Model (Optional)
If you want to retrain the model with new data:
```bash
python train_model.py
```
This will:
- Load data from `dataset/`
- Train MobileNetV2 for 30 epochs (with Early Stopping)
- Save the model to `final_model.h5`

### 2. Run the Web Application
Start the Flask server:
```bash
python app.py
```
Access the application at: `http://localhost:5000`

### 3. Evaluate Performance
Generate classification reports and confusion matrix:
```bash
python evaluate_model.py
```

## 📂 Project Structure

- `app.py`: Main Flask application.
- `train_model.py`: Script to train the Deep Learning model.
- `evaluate_model.py`: Script to evaluate model performance on test data.
- `explainability.py`: Module for rule-based image quality analysis.
- `dataset/`: Contains `train`, `val`, and `test` splits.
- `static/`: CSS, JS, and uploaded images.
- `templates/`: HTML templates.
- `cleanup_project.py`: Utility to clean unused files.
- `consolidate_data.py`: Utility to merge and balance datasets.

## 🛡️ Safety & Reliability
- **Safe Cleanup**: The system includes a safe cleanup script that preserves critical files.
- **Reliability > Accuracy**: The model is tuned for reliability with class weights and strict validation.
- **Privacy**: Uploaded images are processed locally.

---
**Developed for Major Project 2026**
