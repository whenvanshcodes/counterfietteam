from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify, Response
from werkzeug.security import check_password_hash
import os
import json
import csv
import io
from functools import wraps
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Configuration (In a real app, use environment variables)
ADMIN_CREDENTIALS = {
    'username': 'admin',
    # Hash for 'admin123'
    'password_hash': 'scrypt:32768:8:1$r9FyRksSCXmRR9SG$fa789d55866a1e9889a7c386a8469db76670e32fca59725874f45e411ac2a620b850fef19b4147c4e302aa465a17e8e18e44162bef655570078f3eba989e1af7'
}

HISTORY_FILE = 'scan_history.json'
AUDIT_FILE = 'audit_logs.json'

# --- Helpers ---

def load_history_data():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            try:
                return json.load(f)
            except:
                return []
    return []

def save_history_data(data):
    with open(HISTORY_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def log_audit(action, details, user='admin'):
    logs = []
    if os.path.exists(AUDIT_FILE):
        with open(AUDIT_FILE, 'r') as f:
            try:
                logs = json.load(f)
            except:
                logs = []
    
    entry = {
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'user': user,
        'action': action,
        'details': details
    }
    
    logs.insert(0, entry) # Prepend
    # Keep last 1000 logs
    logs = logs[:1000]
    
    with open(AUDIT_FILE, 'w') as f:
        json.dump(logs, f, indent=2)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('admin.login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

# --- Auth Routes ---

@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_CREDENTIALS['username'] and \
           check_password_hash(ADMIN_CREDENTIALS['password_hash'], password):
            session['admin_logged_in'] = True
            session.permanent = True  # Uses config PERMANENT_SESSION_LIFETIME
            log_audit('LOGIN', 'Admin logged in successfully')
            flash('Logged in successfully.', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('admin.dashboard'))
        else:
            log_audit('LOGIN_FAIL', f'Failed login attempt for user: {username}')
            flash('Invalid username or password.', 'danger')
            
    return render_template('admin/login.html')

@admin_bp.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    log_audit('LOGOUT', 'Admin logged out')
    flash('Logged out successfully.', 'info')
    return redirect(url_for('admin.login'))

# --- Dashboard & Features ---

@admin_bp.route('/dashboard')
@login_required
def dashboard():
    history = load_history_data()
    
    # Stats Calculation
    total_scans = len(history)
    real_count = sum(1 for item in history if item.get('result') == 'REAL')
    fake_count = sum(1 for item in history if item.get('result') == 'FAKE')
    
    real_percent = (real_count / total_scans * 100) if total_scans > 0 else 0
    fake_percent = (fake_count / total_scans * 100) if total_scans > 0 else 0
    
    confidences = [item.get('confidence', 0) for item in history]
    avg_confidence = (sum(confidences) / total_scans) if total_scans > 0 else 0
    
    # Recent scans (last 5)
    recent_scans = history[:5]
    
    # Notifications Logic
    notifications = []
    
    # 1. Fake Spike: Check if > 3 fakes in last 10 scans
    last_10 = history[:10]
    fake_in_last_10 = sum(1 for h in last_10 if h.get('result') == 'FAKE')
    if fake_in_last_10 >= 3:
        notifications.append({
            'type': 'danger',
            'message': f'High Volume of Fakes Detected: {fake_in_last_10} in last 10 scans.'
        })
        
    # 2. Low Confidence: Check if average confidence of last 5 is < 85%
    if recent_scans:
        recent_confs = [h.get('confidence', 0) for h in recent_scans]
        avg_recent = sum(recent_confs) / len(recent_confs)
        if avg_recent < 85:
            notifications.append({
                'type': 'warning',
                'message': f'Recent scans showing low confidence ({avg_recent:.1f}% avg).'
            })

    # Model Info
    model_path = 'final_model.h5'
    model_info = {'status': 'Not Found', 'size': 'N/A', 'date': 'N/A'}
    
    if os.path.exists(model_path):
        size_mb = os.path.getsize(model_path) / (1024 * 1024)
        mtime = datetime.fromtimestamp(os.path.getmtime(model_path)).strftime('%Y-%m-%d %H:%M')
        model_info = {
            'status': 'Active', 
            'size': f"{size_mb:.1f} MB", 
            'date': mtime
        }
    
    return render_template('admin/dashboard.html', 
                           total_scans=total_scans,
                           real_count=real_count,
                           fake_count=fake_count,
                           real_percent=round(real_percent, 1),
                           fake_percent=round(fake_percent, 1),
                           avg_confidence=round(avg_confidence, 1),
                           recent_scans=recent_scans,
                           model_info=model_info,
                           notifications=notifications)

@admin_bp.route('/history')
@login_required
def history():
    history_data = load_history_data()
    
    # Filtering
    search = request.args.get('search', '').lower()
    result_filter = request.args.get('result', '')
    
    filtered_data = history_data
    
    if search:
        filtered_data = [h for h in filtered_data if search in h.get('filename', '').lower()]
    
    if result_filter:
        filtered_data = [h for h in filtered_data if h.get('result') == result_filter]
        
    # Sorting (default by timestamp desc)
    # Assuming data is already sorted by save_history, but let's ensure
    # For now, relying on list order which is "newest first" from app.py
    
    # Pagination
    page = int(request.args.get('page', 1))
    per_page = 20
    total = len(filtered_data)
    start = (page - 1) * per_page
    end = start + per_page
    
    paginated_data = filtered_data[start:end]
    total_pages = (total + per_page - 1) // per_page
    
    return render_template('admin/history.html', 
                           history=paginated_data, 
                           page=page, 
                           total_pages=total_pages, 
                           search=search, 
                           result_filter=result_filter)

@admin_bp.route('/export/<format_type>')
@login_required
def export_history(format_type):
    history_data = load_history_data()
    log_audit('EXPORT', f'History exported as {format_type.upper()}')
    
    if format_type == 'json':
        return jsonify(history_data)
        
    elif format_type == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow(['Timestamp', 'Filename', 'Result', 'Confidence', 'Reasons'])
        
        for item in history_data:
            reasons = "; ".join(item.get('reasons', []))
            writer.writerow([
                item.get('timestamp'),
                item.get('filename'),
                item.get('result'),
                f"{item.get('confidence', 0):.2f}",
                reasons
            ])
            
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=scan_history.csv"}
        )
    
    return redirect(url_for('admin.history'))

@admin_bp.route('/delete_scan', methods=['POST'])
@login_required
def delete_scan():
    timestamp = request.form.get('timestamp')
    history_data = load_history_data()
    
    # Filter out the item with the matching timestamp
    # Note: Using timestamp as ID is risky if duplicates exist, but sufficient for this scope
    new_history = [h for h in history_data if h.get('timestamp') != timestamp]
    
    save_history_data(new_history)
    log_audit('DELETE', f'Deleted scan from {timestamp}')
    flash('Scan record deleted.', 'success')
    return redirect(url_for('admin.history'))

@admin_bp.route('/clear_history', methods=['POST'])
@login_required
def clear_all_history():
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)
    log_audit('CLEAR_HISTORY', 'Cleared all scan history')
    flash('All history cleared.', 'warning')
    return redirect(url_for('admin.dashboard'))

# --- New Admin Routes ---

@admin_bp.route('/audit')
@login_required
def audit_logs():
    logs = []
    if os.path.exists(AUDIT_FILE):
        with open(AUDIT_FILE, 'r') as f:
            try:
                logs = json.load(f)
            except:
                logs = []
    return render_template('admin/audit.html', logs=logs)

@admin_bp.route('/performance')
@login_required
def performance():
    # Load Model Metadata
    model_data = {}
    if os.path.exists('model_info.json'):
        with open('model_info.json', 'r') as f:
            model_data = json.load(f)
    
    # Calculate Dynamic Stats from History
    history = load_history_data()
    
    real_confs = [h.get('confidence', 0) for h in history if h.get('result') == 'REAL']
    fake_confs = [h.get('confidence', 0) for h in history if h.get('result') == 'FAKE']
    
    avg_real = sum(real_confs) / len(real_confs) if real_confs else 0
    avg_fake = sum(fake_confs) / len(fake_confs) if fake_confs else 0
    
    all_confs = [h.get('confidence', 0) for h in history]
    min_conf = min(all_confs) if all_confs else 0
    max_conf = max(all_confs) if all_confs else 0
    
    # Health Status Logic
    # Healthy: Avg confidence > 80%
    # Monitor: Avg confidence < 80%
    # Degraded: Avg confidence < 65%
    
    health_status = "Healthy"
    health_color = "success"
    health_icon = "fa-check-circle"
    
    overall_avg = sum(all_confs) / len(all_confs) if all_confs else 0
    
    if overall_avg < 65:
        health_status = "Degraded"
        health_color = "danger"
        health_icon = "fa-exclamation-triangle"
    elif overall_avg < 80:
        health_status = "Monitor"
        health_color = "warning"
        health_icon = "fa-stethoscope"
        
    # Live Stats Calculation
    total_scans = len(history)
    real_count = sum(1 for h in history if h.get('result') == 'REAL')
    fake_count = sum(1 for h in history if h.get('result') == 'FAKE')
    
    dynamic_stats = {
        'total_scans': total_scans,
        'real_count': real_count,
        'fake_count': fake_count,
        'real_pct': round((real_count / total_scans * 100), 1) if total_scans > 0 else 0,
        'fake_pct': round((fake_count / total_scans * 100), 1) if total_scans > 0 else 0,
        'avg_conf': round(overall_avg, 1),
        'avg_real': round(avg_real, 1),
        'avg_fake': round(avg_fake, 1),
        'min_conf': round(min_conf, 1),
        'max_conf': round(max_conf, 1),
        'health_status': health_status,
        'health_color': health_color,
        'health_icon': health_icon
    }
    
    return render_template('admin/performance.html', 
                           data=model_data, 
                           stats=dynamic_stats)

@admin_bp.route('/verify_scan', methods=['POST'])
@login_required
def verify_scan():
    timestamp = request.form.get('timestamp')
    new_status = request.form.get('status') # 'REAL' or 'FAKE'
    
    if not timestamp or not new_status:
        flash('Missing data for verification.', 'danger')
        return redirect(url_for('admin.risk_heatmap'))
        
    history = load_history_data()
    
    # Find and update
    updated = False
    for item in history:
        if item.get('timestamp') == timestamp:
            old_status = item.get('result')
            item['result'] = new_status
            item['verified_by_admin'] = True
            item['admin_verified_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            # Set confidence to 100% since it's human verified
            item['confidence'] = 100.0 
            updated = True
            log_audit('VERIFY', f'Scan {timestamp} verified as {new_status} (was {old_status})')
            break
            
    if updated:
        save_history_data(history)
        flash(f'Scan successfully verified as {new_status}.', 'success')
    else:
        flash('Scan not found.', 'danger')
        
    # Redirect back to referrer (could be risk or history page)
    return redirect(request.referrer or url_for('admin.risk_heatmap'))

@admin_bp.route('/risk')
@login_required
def risk_heatmap():
    history = load_history_data()
    # Filter for High Risk: Low confidence (<85%) or FAKE
    # Exclude if verified by admin and result is REAL (Admin cleared the risk)
    risk_scans = [
        h for h in history 
        if (h.get('confidence', 0) < 85 or h.get('result') == 'FAKE') 
        and not (h.get('verified_by_admin') and h.get('result') == 'REAL')
    ]
    return render_template('admin/risk.html', scans=risk_scans)
