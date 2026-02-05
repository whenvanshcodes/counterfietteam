from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
import json
import numpy as np
import datetime
from model_loader import load_currency_model
from preprocess import preprocess_image
from explainability import analyze_image_quality
from werkzeug.utils import secure_filename
import cv2

app = Flask(__name__)
app.secret_key = 'dev_secret_key_123' # Required for sessions
CORS(app)

# Configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
HISTORY_FILE = os.path.join(BASE_DIR, 'scan_history.json')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['TEMPLATES_AUTO_RELOAD'] = True
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load Model
model = load_currency_model()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            try:
                return json.load(f)
            except:
                return []
    return []

def save_history(entry):
    history = load_history()
    history.insert(0, entry)  # Add new entry to top
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Preprocess
        img_array = preprocess_image(filepath)
        if img_array is None:
            return jsonify({'error': 'Error processing image'}), 500
        
        # Predict
        if model:
            prediction = model.predict(img_array)
            score = float(prediction[0][0]) # Probability of being class 1
            
            if score > 0.5:
                result = "REAL"
                confidence = score * 100
                is_fake = False
            else:
                result = "FAKE"
                confidence = (1 - score) * 100
                is_fake = True
            
            reasons = []
            if is_fake:
                reasons = analyze_image_quality(filepath)
            
            response_data = {
                'result': result,
                'confidence': confidence, # Send as float number
                'raw_score': float(score), # Send as float number
                'reasons': reasons,
                'timestamp': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'filename': filename
            }
            
            save_history(response_data)
            return jsonify(response_data)
        else:
            return jsonify({'error': 'Model not loaded'}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/history', methods=['GET'])
def get_history():
    return jsonify(load_history())

@app.route('/clear_history', methods=['POST'])
def clear_history_route():
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)
    return jsonify({'status': 'success'})

import base64

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/analyze_visuals', methods=['POST'])
def analyze_visuals():
    data = request.json
    filename = data.get('filename')
    print(f"DEBUG: Analyzing visuals for {filename}") # Debug Log
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    print(f"DEBUG: Filepath: {filepath}") # Debug Log
    
    if not os.path.exists(filepath):
        print(f"DEBUG: File not found at {filepath}") # Debug Log
        return jsonify({'error': 'File not found'}), 404

    try:
        # Read image
        img = cv2.imread(filepath)
        if img is None:
            print("DEBUG: Failed to read image with cv2") # Debug Log
            return jsonify({'error': 'Failed to read image'}), 500
            
        print("DEBUG: Image read successfully, processing...") # Debug Log
        
        # 1. Edge Detection (Canny)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        
        # 2. Texture/Noise Analysis (Laplacian)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian = np.uint8(np.absolute(laplacian))
        
        # 3. Contrast Enhanced (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        contrast = clahe.apply(gray)
        
        # 4. Color Heatmap (HSV Saturation) - Good for spotting fake ink
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        saturation = hsv[:,:,1]
        heatmap_img = cv2.applyColorMap(saturation, cv2.COLORMAP_JET)

        def encode_image(image_array):
            _, buffer = cv2.imencode('.jpg', image_array)
            return base64.b64encode(buffer).decode('utf-8')

        response = {
            'edges': f"data:image/jpeg;base64,{encode_image(edges)}",
            'noise': f"data:image/jpeg;base64,{encode_image(laplacian)}",
            'contrast': f"data:image/jpeg;base64,{encode_image(contrast)}",
            'heatmap': f"data:image/jpeg;base64,{encode_image(heatmap_img)}"
        }
        print("DEBUG: Analysis complete, returning response") # Debug Log
        return jsonify(response)
        
    except Exception as e:
        print(f"DEBUG: Error in analyze_visuals: {str(e)}") # Debug Log
        return jsonify({'error': str(e)}), 500

# Register Admin Blueprint
from admin.routes import admin_bp
app.register_blueprint(admin_bp)

if __name__ == '__main__':
    app.run(debug=False, port=5000)
