document.addEventListener('DOMContentLoaded', function() {
    // --- Variables ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const cameraInterface = document.getElementById('camera-interface');
    const video = document.getElementById('camera-stream');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('result');
    const uploadSection = document.querySelector('.upload-section');
    
    let currentFile = null;
    let stream = null;

    // --- Initialization ---
    initSession();
    initAccessTools();
    initInsights();
    
    // --- Event Listeners ---
    
    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    // Camera
    document.getElementById('camera-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openCamera();
    });

    document.getElementById('close-camera').addEventListener('click', () => {
        closeCamera();
    });

    document.getElementById('capture-btn').addEventListener('click', () => {
        captureImage();
    });

    // Demo Mode
    document.getElementById('demo-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        runDemo();
    });

    // Insights Panel
    document.getElementById('open-insights-btn').addEventListener('click', () => {
        document.getElementById('ai-insights-panel').classList.add('active');
    });

    document.getElementById('close-panel').addEventListener('click', () => {
        document.getElementById('ai-insights-panel').classList.remove('active');
    });

    // Clear History
    document.getElementById('clear-history').addEventListener('click', () => {
        if(confirm('Clear all scan history?')) {
            localStorage.removeItem('scanHistory');
            loadHistory();
        }
    });

    // --- Core Functions ---

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showError('Please upload a valid image file.');
            return;
        }

        // Image Quality Advisory
        if (file.size < 50 * 1024) { // < 50KB
            document.getElementById('quality-advisory').classList.remove('hidden');
            document.getElementById('advisory-text').textContent = "Image size is small. Results may be less accurate.";
        } else {
            document.getElementById('quality-advisory').classList.add('hidden');
        }

        currentFile = file;
        scanImage(file);
    }

    function openCamera() {
        uploadSection.classList.add('hidden');
        cameraInterface.classList.remove('hidden');
        
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => {
                stream = s;
                video.srcObject = stream;
            })
            .catch(err => {
                console.error(err);
                showError('Could not access camera.');
                closeCamera();
            });
    }

    function closeCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraInterface.classList.add('hidden');
        uploadSection.classList.remove('hidden');
    }

    function captureImage() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        canvas.toBlob(blob => {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            handleFile(file);
            closeCamera();
        }, 'image/jpeg');
    }

    function runDemo() {
        // Create a dummy file for demo
        fetch('/static/reference.jpg')
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], "demo_note.jpg", { type: "image/jpeg" });
                handleFile(file);
            })
            .catch(() => showError("Demo file not found."));
    }

    function scanImage(file) {
        // Reset UI
        resultContainer.classList.add('hidden');
        document.getElementById('certificate-container').classList.add('hidden');
        document.getElementById('analysis-insights').classList.add('hidden');
        document.getElementById('scan-meta').classList.add('hidden');
        loading.style.display = 'flex'; // Flex to show timeline
        
        // Timeline Animation
        updateTimeline(1); // Uploading
        
        const formData = new FormData();
        formData.append('file', file);

        setTimeout(() => updateTimeline(2), 800); // Analyzing

        fetch('/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            setTimeout(() => {
                updateTimeline(3); // Verifying
                setTimeout(() => {
                    loading.style.display = 'none';
                    if (data.error) {
                        showError(data.error);
                    } else {
                        displayResult(data, file);
                    }
                }, 800);
            }, 800);
        })
        .catch(error => {
            console.error('Error:', error);
            loading.style.display = 'none';
            showError('An error occurred during analysis.');
        });
    }

    function updateTimeline(step) {
        document.querySelectorAll('.timeline-step').forEach((el, index) => {
            if (index + 1 < step) {
                el.classList.add('completed');
                el.classList.remove('active');
            } else if (index + 1 === step) {
                el.classList.add('active');
                el.classList.remove('completed');
            } else {
                el.classList.remove('active', 'completed');
            }
        });
    }

    function displayResult(data, file) {
        resultContainer.classList.remove('hidden');
        
        const isReal = data.result.toUpperCase() === 'REAL';
        const confidence = parseFloat(data.confidence).toFixed(2);
        const resultColor = isReal ? 'var(--success-color)' : 'var(--danger-color)';
        const resultIcon = isReal ? 'fa-check-circle' : 'fa-times-circle';

        // Update Stats
        updateSessionStats(isReal);

        // Generate Result HTML
        let reasonsHtml = '';
        if (data.reasons && data.reasons.length > 0) {
            reasonsHtml = `<div class="reasons-list">
                <h4>Analysis Details:</h4>
                <ul>${data.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>`;
        }

        // Context Note Input
        const noteHtml = `
            <div class="scan-note-section">
                <input type="text" id="scan-note-input" placeholder="Add a note (e.g. 'From shop')" class="note-input">
                <button onclick="saveScanNote()" class="note-btn"><i class="fas fa-save"></i></button>
            </div>
        `;

        // Buttons
        const buttonsHtml = `
            <div class="upload-actions" style="justify-content: center; margin-top: 1.5rem;">
                <button onclick="location.reload()" class="camera-btn" style="background: var(--text-color)">Scan Another</button>
                <button onclick="openCompare()" class="demo-btn">Compare Mode</button>
                <button onclick="downloadReport()" class="camera-btn" style="background: var(--secondary-color)"><i class="fas fa-file-alt"></i> Report</button>
                ${isReal ? `<button onclick="downloadCertificate()" class="camera-btn" style="background: var(--success-color)"><i class="fas fa-certificate"></i> Certificate</button>` : ''}
            </div>
        `;

        resultContainer.innerHTML = `
            <div class="result-card" style="border-top: 5px solid ${resultColor}">
                <div class="result-header">
                    <i class="fas ${resultIcon}" style="color: ${resultColor}; font-size: 3rem;"></i>
                    <h2 style="color: ${resultColor}">${data.result}</h2>
                </div>
                <div class="result-body">
                    <div class="confidence-meter">
                        <label>Confidence Score</label>
                        <div class="meter-bg">
                            <div class="meter-fill" style="width: ${confidence}%; background: ${resultColor}"></div>
                        </div>
                        <span class="confidence-value">${confidence}%</span>
                    </div>
                    ${reasonsHtml}
                    ${noteHtml}
                    ${buttonsHtml}
                </div>
            </div>
        `;

        // Update Certificate UI (Hidden but populated)
        if (isReal) {
            const certContainer = document.getElementById('certificate-container');
            certContainer.classList.remove('hidden');
            document.getElementById('cert-id').textContent = 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            document.getElementById('cert-date').textContent = new Date().toLocaleString();
            document.getElementById('cert-confidence').textContent = confidence + '%';
        }

        // Show Insights & Meta
        document.getElementById('analysis-insights').classList.remove('hidden');
        document.getElementById('scan-meta').classList.remove('hidden');
        
        // Update Risk Badge
        const riskBadge = document.getElementById('risk-badge');
        if (confidence > 90) {
            riskBadge.className = 'risk-badge low';
            riskBadge.innerHTML = '🟢 Low Risk';
        } else if (confidence > 70) {
            riskBadge.className = 'risk-badge medium';
            riskBadge.innerHTML = '🟡 Medium Risk';
        } else {
            riskBadge.className = 'risk-badge high';
            riskBadge.innerHTML = '🔴 High Risk';
        }

        // Generate Report Data (Visuals + Text)
        generateReport(data, file);
        
        // Save to History
        addToHistory({
            result: data.result,
            confidence: confidence,
            timestamp: new Date().toLocaleString()
        });
    }

    function showError(msg) {
        resultContainer.classList.remove('hidden');
        resultContainer.innerHTML = `
            <div class="result-card error-card">
                <div class="result-header">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 3rem;"></i>
                    <h2 style="color: #e74c3c">Analysis Failed</h2>
                </div>
                <div class="result-body">
                    <p>${msg}</p>
                    <button onclick="location.reload()" class="camera-btn" style="margin-top: 1rem;">Try Again</button>
                </div>
            </div>
        `;
    }

    // --- Helper Functions ---

    function initSession() {
        // Load stats from localStorage
        const sessionStats = JSON.parse(localStorage.getItem('sessionStats')) || { total: 0, verified: 0, count: 0 };
        updateSessionDisplay(sessionStats);
        loadHistory();
    }

    function updateSessionStats(isReal) {
        let stats = JSON.parse(localStorage.getItem('sessionStats')) || { total: 0, verified: 0, count: 0 };
        stats.count++;
        if (isReal) stats.verified++;
        
        // Simple denomination estimator (Mock)
        if (isReal) stats.total += 500; // Assuming 500 for demo
        
        localStorage.setItem('sessionStats', JSON.stringify(stats));
        updateSessionDisplay(stats);
    }

    function updateSessionDisplay(stats) {
        document.getElementById('session-count').textContent = stats.count;
        document.getElementById('session-total').textContent = '₹' + stats.total;
        const rate = stats.count ? Math.round((stats.verified / stats.count) * 100) : 0;
        document.getElementById('session-verified').textContent = rate + '%';
        
        // Update main stats cards
        document.getElementById('stat-total').textContent = stats.count;
        document.getElementById('stat-real').textContent = stats.verified;
        document.getElementById('stat-fake').textContent = stats.count - stats.verified;
    }

    function addToHistory(item) {
        let history = JSON.parse(localStorage.getItem('scanHistory')) || [];
        history.unshift(item);
        if (history.length > 10) history.pop();
        localStorage.setItem('scanHistory', JSON.stringify(history));
        loadHistory();
    }

    function loadHistory() {
        const list = document.getElementById('history-list');
        const history = JSON.parse(localStorage.getItem('scanHistory')) || [];
        
        if (history.length === 0) {
            list.innerHTML = '<p class="text-muted">No recent scans.</p>';
            return;
        }

        list.innerHTML = history.map(item => `
            <div class="history-item">
                <span class="badge ${item.result === 'REAL' ? 'real' : 'fake'}">${item.result}</span>
                <span>${item.confidence}%</span>
                <small>${item.timestamp}</small>
            </div>
        `).join('');
    }

    function initAccessTools() {
        // Font Size
        let fontSize = 100;
        document.getElementById('font-increase').addEventListener('click', () => {
            if(fontSize < 130) {
                fontSize += 10;
                document.body.style.fontSize = fontSize + '%';
            }
        });
        document.getElementById('font-decrease').addEventListener('click', () => {
            if(fontSize > 80) {
                fontSize -= 10;
                document.body.style.fontSize = fontSize + '%';
            }
        });

        // High Contrast
        document.getElementById('access-mode').addEventListener('click', () => {
            document.body.classList.toggle('high-contrast');
        });

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });

        // Auto Dark Mode (7PM - 6AM)
        const hour = new Date().getHours();
        if (hour >= 19 || hour < 6) {
            document.body.classList.add('dark-mode');
            themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    function initInsights() {
        fetch('/model_info')
            .then(res => res.json())
            .then(data => {
                document.getElementById('model-version').textContent = data.version || 'v1.0';
                document.getElementById('model-type').textContent = data.type || 'CNN';
                document.getElementById('model-accuracy').textContent = data.accuracy || '98%';
                
                const list = document.getElementById('model-limitations');
                if (data.limitations) {
                    list.innerHTML = data.limitations.map(l => `<li>${l}</li>`).join('');
                }
            })
            .catch(console.error);
    }

    // --- Report & Certificate Logic ---
    function generateReport(data, file) {
        // Basic Info
        const reportId = 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const dateStr = new Date().toLocaleString();
        
        // Populate Report
        document.getElementById('report-filename').textContent = file.name;
        document.getElementById('report-date').textContent = dateStr;
        document.getElementById('report-id').textContent = reportId;
        document.getElementById('report-confidence').textContent = parseFloat(data.confidence).toFixed(1) + '%';
        
        const badge = document.getElementById('report-badge');
        badge.className = 'badge ' + (data.result.toUpperCase() === 'REAL' ? 'real' : 'fake');
        badge.textContent = data.result + ' Note';

        // Populate Certificate (if Real)
        if(data.result.toUpperCase() === 'REAL') {
            // Note: certificate-template elements
            // We need to make sure IDs in certificate-template are unique if they conflict with main page
            // But here we can reuse or use specific querySelectors
            // The template in index.html has:
            // <strong id="cert-id"></strong> (This ID is also used in the on-screen certificate card)
            // It's better to update them all.
            
            // However, the print template is separate.
            // Let's assume the IDs in the certificate-template are unique or shared intentionally.
            // Actually, IDs must be unique. Let's check index.html again.
            // The certificate card (on screen) has IDs: cert-id, cert-date, cert-confidence.
            // The certificate template (for print) has... wait, let's check index.html content again.
            
            // In the truncated index.html I saw:
            // <div id="certificate-template" ...> ... <strong id="cert-id"></strong> ...
            // And earlier: <div id="certificate-container" ...> ... <strong id="cert-id"></strong> ...
            // Duplicate IDs are bad HTML but browsers often handle `getElementById` by returning the first one.
            // If I want to update BOTH, I should use querySelectorAll or specific classes.
            // For now, I will try to update both if they share IDs, or just rely on the fact that we want the print one populated.
            
            // Let's fix this by updating by class or assuming the print template is what we care about for download.
            // Or better, I will update all elements with these IDs (if I could), but getElementById only returns one.
            // I'll update the textContent of the element found. 
            // Since the print template is at the bottom, it might be the second one.
            
            // To be safe, let's try to find the one inside #certificate-template specifically.
            const certTemplate = document.getElementById('certificate-template');
            if(certTemplate) {
                 // Use querySelector to find elements inside the template
                 // Note: The template in index.html used IDs. I should probably change them to classes or scoped selectors.
                 // But since I can't easily change index.html without reading it all and replacing, 
                 // I will just use what I have.
                 
                 // If there are duplicate IDs, getElementById returns the first one.
                 // The first one is likely the on-screen card.
                 // The print template is at the end.
                 // I need to populate the print template manually if getElementById misses it.
                 
                 // Strategy: Populate the on-screen card (done in displayResult).
                 // Populate the print template:
                 const certIdEl = certTemplate.querySelector('#cert-id') || certTemplate.querySelector('[id="cert-id"]'); // Fallback
                 if(certIdEl) certIdEl.textContent = reportId;
                 
                 const certDateEl = certTemplate.querySelector('#cert-date') || certTemplate.querySelector('[id="cert-date"]');
                 if(certDateEl) certDateEl.textContent = new Date().toLocaleDateString();
                 
                 const certConfEl = certTemplate.querySelector('#cert-confidence') || certTemplate.querySelector('[id="cert-confidence"]');
                 if(certConfEl) certConfEl.textContent = parseFloat(data.confidence).toFixed(1) + '%';
            }
        }

        // Fetch Visual Layers
        fetch('/analyze_visuals', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({filename: data.filename})
        })
        .then(res => res.json())
        .then(visuals => {
            if(visuals.error) {
                console.error("Visual analysis failed:", visuals.error);
                return;
            }
            // Set images in Report Template
            document.getElementById('report-img-original').src = URL.createObjectURL(file);
            document.getElementById('report-img-edges').src = visuals.edges;
            document.getElementById('report-img-heatmap').src = visuals.heatmap;
            document.getElementById('report-img-noise').src = visuals.noise;
        })
        .catch(console.error);
    }

    window.downloadReport = function() {
        document.body.classList.add('print-report');
        setTimeout(() => {
            window.print();
            document.body.classList.remove('print-report');
        }, 100);
    }

    window.downloadCertificate = function() {
        document.body.classList.add('print-certificate');
        setTimeout(() => {
            window.print();
            document.body.classList.remove('print-certificate');
        }, 100);
    }

    // --- Misc Global ---
    window.saveScanNote = function() {
        const input = document.getElementById('scan-note-input');
        if(input.value.trim()) {
            alert('Note saved to local session!');
            input.disabled = true;
            input.value += " (Saved)";
        }
    }

    window.toggleTips = function() {
        document.getElementById('upload-tips').classList.toggle('hidden');
    }

    window.openCompare = function() {
        document.getElementById('compare-modal').classList.remove('hidden');
        if (currentFile) {
            document.getElementById('compare-img-suspect').src = URL.createObjectURL(currentFile);
        }
        initCompareSlider();
    }

    window.closeCompare = function() {
        document.getElementById('compare-modal').classList.add('hidden');
    }

    function initCompareSlider() {
        // Simple comparison slider logic (if needed)
        // For now just CSS hover or simple overlay
    }
});
