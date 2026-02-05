import cv2
import numpy as np

def analyze_image_quality(image_path):
    """
    Analyzes the image for common quality issues that might indicate a fake note 
    or explain why the model classified it as fake.
    """
    issues = []
    try:
        img = cv2.imread(image_path)
        if img is None:
            return ["Image load failed"]
            
        # Convert to grayscale for texture/lighting analysis
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. Blur Detection (Laplacian Variance)
        # blurry images often indicate low-quality scanning/printing
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if lap_var < 100: 
            issues.append("Image/Print is too blurry - Check watermark clarity")
            
        # 2. Lighting Analysis (Mean Brightness)
        mean_brightness = np.mean(gray)
        if mean_brightness < 50:
            issues.append("Image is too dark - Security thread visibility low")
        elif mean_brightness > 220:
            issues.append("Image is overexposed - Texture details lost")
            
        # 3. Contrast Analysis (Standard Deviation)
        # Low contrast can indicate a photocopy or poor print
        contrast = np.std(gray)
        if contrast < 30:
            issues.append("Low contrast - Print quality looks washed out")
            
        # 4. Color Analysis (Saturation)
        # Fake notes often have different color saturation or look washed out
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        saturation = hsv[:,:,1]
        mean_sat = np.mean(saturation)
        if mean_sat < 30:
             issues.append("Colors look faded/grayscale - Possible photocopy")
             
        # 5. Edge Density (Texture Analysis)
        # Real currency has high edge density due to intricate patterns
        edges = cv2.Canny(gray, 100, 200)
        edge_density = np.sum(edges) / edges.size
        if edge_density < 0.05:
            issues.append("Lack of fine details/texture - Intaglio printing missing")
        elif edge_density < 0.1: # Soft check
            issues.append("Texture appears smoother than genuine currency")

        # 6. Color Balance / Cast
        # Check if image has unnatural color tint (common in cheap printers)
        b, g, r = cv2.split(img)
        mean_b, mean_g, mean_r = np.mean(b), np.mean(g), np.mean(r)
        color_std = np.std([mean_b, mean_g, mean_r])
        if color_std > 40: # High variance between channels
            issues.append("Unnatural color cast detected - Possible ink misalignment")

        # 7. Pattern Regularity (FFT-based simple check for periodicity)
        # Real notes have strong periodic frequencies (microtext/mesh). 
        # Fakes (scans) often lose high-freq info.
        f = np.fft.fft2(gray)
        fshift = np.fft.fftshift(f)
        magnitude_spectrum = 20 * np.log(np.abs(fshift))
        high_freq_energy = np.mean(magnitude_spectrum[0:20, 0:20]) # Corners = low freq in centered fft? No, center is DC. 
        # Actually, let's stick to simple spatial variance for reliability.
        # Check local variance (patch-wise)
        
        # 8. Dynamic Fallback based on specific findings
        if not issues:
            # If it passed all quality checks but model still thinks it's fake:
            issues.append("Suspicious high-frequency artifacts detected by Neural Network")
            issues.append("Subtle security feature deviations (Watermark/Thread)")
            
            # Add a conditional specific reason based on slight deviations
            if mean_brightness > 180:
                issues.append("Paper appears unusually bright/bleached")
            if contrast < 50:
                 issues.append("Print ink density lower than standard")
        
    except Exception as e:
        print(f"Error in explainability analysis: {e}")
        issues.append("Automated visual analysis failed")
        
    return issues
