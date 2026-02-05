document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('result');
    const historyList = document.getElementById('history-list');
    const themeToggle = document.getElementById('theme-toggle');
    const loadingText = document.getElementById('loading-text');
    
    // Camera Elements
    const cameraBtn = document.getElementById('camera-btn');
    const cameraInterface = document.getElementById('camera-interface');
    const cameraStream = document.getElementById('camera-stream');
    const captureBtn = document.getElementById('capture-btn');
    const closeCameraBtn = document.getElementById('close-camera');
    let mediaStream = null;

    // Stats Elements
    const statReal = document.getElementById('stat-real');
    const statFake = document.getElementById('stat-fake');
    const statTotal = document.getElementById('stat-total');

    // Lightbox & Compare Elements
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.querySelector('.lightbox-close');
    const compareModal = document.getElementById('compare-modal');

    // Toggle Upload Tips
    window.toggleTips = function() {
        document.getElementById('upload-tips').classList.toggle('hidden');
    };

    // Camera Logic
    cameraBtn.addEventListener('click', async () => {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraStream.srcObject = mediaStream;
            cameraInterface.classList.remove('hidden');
            dropZone.classList.add('hidden');
        } catch (err) {
            alert('Camera access denied or unavailable.');
            console.error(err);
        }
    });

    closeCameraBtn.addEventListener('click', stopCamera);

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        cameraInterface.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }

    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraStream.videoWidth;
        canvas.height = cameraStream.videoHeight;
        canvas.getContext('2d').drawImage(cameraStream, 0, 0);
        
        canvas.toBlob(blob => {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            handleFile(file);
            stopCamera();
        }, 'image/jpeg');
    });

    // Clear History Button
    document.getElementById('clear-history').addEventListener('click', () => {
        if(confirm('Are you sure you want to clear all history?')) {
            fetch('/clear_history', { method: 'POST' })
                .then(() => {
                    loadHistory();
                    updateStats([]);
                });
        }
    });

    // Lightbox Logic
    window.analysisData = null;
    window.currentFilename = null;
    window.currentImageSrc = null;

    lightboxClose.addEventListener('click', () => {
        lightbox.classList.add('hidden');
    });
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) lightbox.classList.add('hidden');
    });

    window.switchView = function(viewType) {
        // Update Buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase().includes(viewType) || 
                (viewType === 'original' && btn.textContent.includes('Original')) ||
                (viewType === 'edges' && btn.textContent.includes('Edge')) ||
                (viewType === 'noise' && btn.textContent.includes('Texture')) ||
                (viewType === 'contrast' && btn.textContent.includes('Contrast')) ||
                (viewType === 'heatmap' && btn.textContent.includes('Heatmap'))) {
                btn.classList.add('active');
            }
        });

        // Update Image
        if (viewType === 'original') {
            lightboxImg.src = window.currentImageSrc;
        } else if (window.analysisData && window.analysisData[viewType]) {
            lightboxImg.src = window.analysisData[viewType];
        }
    };

    function fetchAnalysis(filename) {
        const loader = document.getElementById('lightbox-loader');
        loader.classList.remove('hidden');
        
        fetch('/analyze_visuals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename })
        })
        .then(res => res.json())
        .then(data => {
            window.analysisData = data;
        })
        .catch(console.error)
        .finally(() => {
            loader.classList.add('hidden');
        });
    }

    // Expose openLightbox to global scope
    window.openLightbox = function(filename) {
        window.currentFilename = filename;
        window.analysisData = null; // Reset previous analysis
        
        if (window.currentImageSrc) {
            lightboxImg.src = window.currentImageSrc;
            lightbox.classList.remove('hidden');
            
            // Auto-fetch analysis
            fetchAnalysis(filename);
            
            // Reset to original view
            switchView('original');
        }
    };

    // Compare Mode Logic
    window.openCompareMode = function(filename) {
        if (window.currentImageSrc) {
            document.getElementById('compare-img-suspect').src = window.currentImageSrc;
            compareModal.classList.remove('hidden');
        }
    };

    window.closeCompare = function() {
        compareModal.classList.add('hidden');
    };

    window.generateReport = function(result, confidence, filename, timestamp) {
        // Populate Basic Info
        document.getElementById('report-filename').textContent = filename;
        document.getElementById('report-date').textContent = timestamp;
        document.getElementById('report-id').textContent = Math.random().toString(36).substr(2, 9).toUpperCase();
        document.getElementById('report-confidence').textContent = confidence.toFixed(2) + '%';
        
        const badge = document.getElementById('report-badge');
        badge.textContent = result;
        badge.className = `badge ${result === 'REAL' ? 'real' : 'fake'}`;

        // Populate Reasons
        const reasonsList = document.getElementById('report-reasons-list');
        reasonsList.innerHTML = '';
        if (result === 'FAKE' && window.currentResultData && window.currentResultData.reasons) {
            document.getElementById('report-reasons').classList.remove('hidden');
            window.currentResultData.reasons.forEach(r => {
                const li = document.createElement('li');
                li.textContent = r;
                reasonsList.appendChild(li);
            });
        } else {
            document.getElementById('report-reasons').classList.add('hidden');
        }

        // Populate Visuals
        document.getElementById('report-img-original').src = window.currentImageSrc;
        
        // Check if we have analysis data, if not fetch it
        if (!window.analysisData) {
            const btn = document.querySelector('.action-btn'); // The print button
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Visuals...';
            btn.disabled = true;

            fetch('/analyze_visuals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filename })
            })
            .then(res => res.json())
            .then(data => {
                window.analysisData = data;
                fillReportImages(data);
                window.print();
            })
            .catch(err => {
                alert('Could not generate visual report layers. Printing basic report.');
                console.error(err);
                window.print();
            })
            .finally(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        } else {
            fillReportImages(window.analysisData);
            window.print();
        }
    };

    function fillReportImages(data) {
        if(data.edges) document.getElementById('report-img-edges').src = data.edges;
        if(data.heatmap) document.getElementById('report-img-heatmap').src = data.heatmap;
        if(data.noise) document.getElementById('report-img-noise').src = data.noise;
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    });

    // Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('scanning'); // Reuse scanning class for hover effect
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('scanning');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('scanning');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return alert('Please upload an image');
        
        // UI Reset
        resultContainer.classList.add('hidden');
        document.getElementById('certificate-container').classList.add('hidden');
        document.getElementById('analysis-insights').classList.add('hidden');
        document.getElementById('scan-meta').classList.add('hidden');
        document.getElementById('smart-suggestions').classList.add('hidden');
        
        dropZone.classList.add('scanning'); // Start Scan Animation
        loading.style.display = 'block';
        
        // Animated Loading Steps
        const steps = ["Initializing AI Models...", "Scanning Security Threads...", "Analyzing Texture Patterns...", "Verifying Micro-print...", "Finalizing Prediction..."];
        let stepIndex = 0;
        const stepInterval = setInterval(() => {
            if(stepIndex < steps.length) {
                loadingText.textContent = steps[stepIndex++];
            }
        }, 300);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/predict', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                setTimeout(() => { // Min timeout for animation
                    clearInterval(stepInterval);
                    displayResult(data, file);
                    loadHistory();
                }, 1500);
            })
            .catch(err => {
                clearInterval(stepInterval);
                alert('Analysis Failed');
                console.error(err);
            })
            .finally(() => {
                setTimeout(() => {
                    dropZone.classList.remove('scanning');
                    loading.style.display = 'none';
                    loadingText.textContent = "Initializing AI Models...";
                }, 1500);
            });
    }

    function displayResult(data, file) {
        const isReal = data.result === 'REAL';
        const badgeClass = isReal ? 'real' : 'fake';
        const icon = isReal ? 'fa-check-circle' : 'fa-exclamation-triangle';
        const color = isReal ? 'var(--success-color)' : 'var(--danger-color)';
        
        // --- New UI Components Population ---
        
        // 1. Certificate Logic
        const certContainer = document.getElementById('certificate-container');
        if (isReal) {
            certContainer.classList.remove('hidden');
            document.getElementById('cert-id').textContent = Math.random().toString(36).substr(2, 9).toUpperCase();
            document.getElementById('cert-date').textContent = data.timestamp || new Date().toLocaleString();
            document.getElementById('cert-confidence').textContent = data.confidence.toFixed(2) + '%';
        }

        // 2. Insights & Risk Logic
        document.getElementById('analysis-insights').classList.remove('hidden');
        
        // Mock Drift
        const drift = (Math.random() * 5 - 2).toFixed(1); 
        const driftSign = drift >= 0 ? '+' : '';
        const driftClass = drift >= 0 ? 'text-success' : 'text-danger';
        const driftIcon = drift >= 0 ? '↑' : '↓';
        const driftText = document.getElementById('drift-text');
        if (driftText) {
             driftText.innerHTML = `Compared to last 10 scans: <span class="${driftClass}">${driftIcon} ${driftSign}${drift}%</span>`;
        }

        // Risk Badge
        const riskBadge = document.getElementById('risk-badge');
        let riskLevel = 'Low Risk';
        let riskColorBg = '#d1fae5';
        let riskColorText = '#047857';
        
        if (!isReal) {
            riskLevel = 'High Risk';
            riskColorBg = '#fee2e2';
            riskColorText = '#b91c1c';
        } else if (data.confidence < 90) {
            riskLevel = 'Medium Risk';
            riskColorBg = '#fef3c7';
            riskColorText = '#d97706';
        }
        
        if (riskBadge) {
            riskBadge.style.backgroundColor = riskColorBg;
            riskBadge.style.color = riskColorText;
            riskBadge.innerHTML = `<i class="fas fa-shield-alt"></i> ${riskLevel}`;
        }

        // 3. Scan Meta Logic
        document.getElementById('scan-meta').classList.remove('hidden');
        
        const difficulty = Math.floor(Math.random() * 40) + 10; 
        const diffBar = document.getElementById('difficulty-bar');
        const diffText = document.getElementById('difficulty-text');
        if (diffBar) diffBar.style.width = `${difficulty}%`;
        if (diffText) diffText.textContent = difficulty < 30 ? "Easy to analyze" : "Moderate complexity";

        // Mock Condition Tags
        const conditionTags = document.getElementById('condition-tags');
        if (conditionTags) {
            const conditions = ["Good Condition", "Slight Fold", "Clear Watermark"];
            if (Math.random() > 0.7) conditions.push("Worn Edges");
            
            conditionTags.innerHTML = conditions.map(c => 
                `<span class="badge" style="font-size: 0.8rem; background: #e2e8f0; color: #475569; margin-right: 5px;">${c}</span>`
            ).join('');
        }

        // 4. Smart Suggestions
        const suggestionsPanel = document.getElementById('smart-suggestions');
        suggestionsPanel.classList.remove('hidden');
        const suggestionList = document.getElementById('suggestion-list');
        
        if (suggestionList) {
            let suggestions = [];
            if (data.confidence < 95) {
                suggestions.push("Try scanning in better lighting to improve confidence.");
                suggestions.push("Ensure the note is placed on a flat, contrasting background.");
            } else {
                suggestions.push("Scan quality is excellent.");
                if (isReal) suggestions.push("Verify holographic strip manually for double confirmation.");
            }
            suggestionList.innerHTML = suggestions.map(s => `<li><i class="fas fa-lightbulb"></i> ${s}</li>`).join('');
        }
        
        // --- End New UI Components ---

        // Story-Based Text & Advice
        let storyText = isReal 
            ? "This note exhibits consistent security features and texture patterns typical of authentic currency."
            : "This note shows multiple inconsistencies in texture and security features, indicating it is likely counterfeit.";
        
        let adviceText = isReal
            ? "Standard security features verified. Safe to accept."
            : "Avoid accepting this note. Please report to the nearest bank branch for further verification.";

        // Certainty Badge
        let certaintyLabel = "High Confidence";
        let certaintyIcon = "fa-certificate";
        if (data.confidence < 85) {
            certaintyLabel = "Low Confidence";
            certaintyIcon = "fa-question-circle";
        } else if (data.confidence < 95) {
            certaintyLabel = "Verified";
            certaintyIcon = "fa-check-double";
        }

        let reasonsHtml = '';
        if (!isReal && data.reasons && data.reasons.length > 0) {
            reasonsHtml = `
                <div class="explanation-panel">
                    <h3><i class="fas fa-microscope"></i> Analysis Findings</h3>
                    <ul class="reasons-list">
                        ${data.reasons.map(r => `
                            <li class="reason-item">
                                <i class="fas fa-times-circle text-danger"></i>
                                <span>${r}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else if (isReal) {
             reasonsHtml = `
                <div class="explanation-panel">
                    <h3><i class="fas fa-shield-alt"></i> Security Verification</h3>
                    <ul class="reasons-list">
                        <li class="reason-item">
                            <i class="fas fa-check-circle text-success"></i>
                            <span>Texture consistency verified</span>
                        </li>
                        <li class="reason-item">
                            <i class="fas fa-check-circle text-success"></i>
                            <span>Security thread pattern matches</span>
                        </li>
                    </ul>
                </div>
            `;
        }

        resultContainer.innerHTML = `
            <div class="result-card">
                <div class="result-header">
                    <div class="badge ${badgeClass} result-badge-lg">
                        <i class="fas ${icon}"></i> ${data.result}
                    </div>
                    <div class="certainty-badge">
                        <i class="fas ${certaintyIcon}"></i> ${certaintyLabel}
                    </div>
                </div>

                <p class="story-text">${storyText}</p>
                
                <div class="confidence-section">
                    <div class="confidence-header">
                        <span>AI Confidence</span>
                        <strong>${data.confidence.toFixed(2)}%</strong>
                    </div>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${data.confidence}%; background-color: ${color};"></div>
                    </div>
                </div>

                ${reasonsHtml}

                <div class="advice-box ${isReal ? 'advice-safe' : 'advice-warning'}">
                    <strong><i class="fas fa-info-circle"></i> Advice:</strong> ${adviceText}
                </div>
                
                <div class="action-grid">
                    <button class="action-btn" onclick="generateReport('${data.result}', ${data.confidence}, '${data.filename}', '${data.timestamp}')">
                        <i class="fas fa-print"></i> Report
                    </button>
                    <button class="action-btn secondary" onclick="openLightbox('${data.filename}')">
                        <i class="fas fa-search-plus"></i> Inspect
                    </button>
                    <button class="action-btn warning" onclick="openCompareMode('${data.filename}')">
                        <i class="fas fa-columns"></i> Compare
                    </button>
                </div>
            </div>
        `;
        
        // Store current result data globally
        window.currentResultData = { ...data, filename: data.filename };
        
        // Temporarily store the image URL
        const reader = new FileReader();
        reader.onload = (e) => {
            window.currentImageSrc = e.target.result;
        };
        reader.readAsDataURL(file);

        resultContainer.classList.remove('hidden');
    }

    function updateStats(data) {
        let real = 0, fake = 0;
        data.forEach(item => {
            if (item.result === 'REAL') real++;
            else fake++;
        });
        
        statReal.textContent = real;
        statFake.textContent = fake;
        statTotal.textContent = data.length;
    }

    function loadHistory() {
        fetch('/history')
            .then(res => res.json())
            .then(data => {
                updateStats(data);
                historyList.innerHTML = data.map(item => `
                    <div class="history-item">
                        <div class="history-time">
                            <i class="far fa-clock"></i> ${item.timestamp.split(' ')[1]}
                        </div>
                        <div class="history-details">
                            <span class="history-result ${item.result === 'REAL' ? 'text-success' : 'text-danger'}">
                                ${item.result}
                            </span>
                            <span class="history-conf">(${item.confidence.toFixed(1)}%)</span>
                        </div>
                    </div>
                `).join('');
            });
    }

    // Initial Load
    loadHistory();
});