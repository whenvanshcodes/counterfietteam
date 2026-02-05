document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('result');
    const historyList = document.getElementById('history-list');
    const themeToggle = document.getElementById('theme-toggle');
    const loadingText = document.getElementById('loading-text');
    
    // New Elements
    const scanContextSelect = document.getElementById('scan-context');
    const sessionTotalEl = document.getElementById('session-total');
    const sessionCountEl = document.getElementById('session-count');
    const sessionVerifiedEl = document.getElementById('session-verified');
    const langToggleBtn = document.getElementById('lang-toggle');
    const accessModeBtn = document.getElementById('access-mode');
    const demoBtn = document.getElementById('demo-btn');
    const qualityAdvisory = document.getElementById('quality-advisory');
    const advisoryText = document.getElementById('advisory-text');

    // Camera Elements
    const cameraBtn = document.getElementById('camera-btn');
    const cameraInterface = document.getElementById('camera-interface');
    const cameraStream = document.getElementById('camera-stream');
    const captureBtn = document.getElementById('capture-btn');
    const closeCameraBtn = document.getElementById('close-camera');
    let mediaStream = null;

    // Lightbox & Compare Elements
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.querySelector('.lightbox-close');
    const compareModal = document.getElementById('compare-modal');

    // AI Insights Panel Elements
    const insightsPanel = document.getElementById('ai-insights-panel');
    const openInsightsBtn = document.getElementById('open-insights-btn');
    const closeInsightsBtn = document.getElementById('close-panel');

    // State
    let sessionState = {
        count: 0,
        verifiedCount: 0,
        totalValue: 0
    };
    let currentLanguage = 'en';

    // --- Initialization ---
    loadHistory();
    initTheme();
    initAIInsights();
    initAccessTools();
    initSession();

    // --- Session Logic ---
    function initSession() {
        // Reset session on reload (or load from sessionStorage if persistence is desired)
        updateSessionStats();
    }

    function updateSessionStats() {
        sessionCountEl.textContent = sessionState.count;
        const percent = sessionState.count === 0 ? 0 : Math.round((sessionState.verifiedCount / sessionState.count) * 100);
        sessionVerifiedEl.textContent = percent + '%';
        sessionTotalEl.textContent = '₹' + sessionState.totalValue;
    }

    function addToSession(isReal, denomination) {
        sessionState.count++;
        if (isReal) {
            sessionState.verifiedCount++;
            if (denomination) {
                // Extract number from string like "500" or "2000"
                const value = parseInt(denomination.replace(/[^0-9]/g, ''));
                if (!isNaN(value)) {
                    sessionState.totalValue += value;
                }
            }
        }
        updateSessionStats();
    }

    // --- Access Tools Logic ---
    function initAccessTools() {
        // Accessibility Mode
        accessModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('accessibility-mode');
            // Toggle icon/text
            const isAccess = document.body.classList.contains('accessibility-mode');
            // accessModeBtn is now inside the dropdown, we can change its style or text
            accessModeBtn.classList.toggle('active', isAccess);
        });

        // Dropdown Logic
        const accessMenuBtn = document.getElementById('access-menu-btn');
        const accessDropdown = document.getElementById('access-dropdown');

        if(accessMenuBtn && accessDropdown) {
            accessMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                accessDropdown.classList.toggle('active');
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!accessDropdown.contains(e.target)) {
                    accessDropdown.classList.remove('active');
                }
            });
        }

        // Language Toggle (Simple Demo)
        langToggleBtn.addEventListener('click', () => {
            currentLanguage = currentLanguage === 'en' ? 'hi' : 'en';
            updateLanguage();
        });

        // Font Size Adjustment
        const fontDecreaseBtn = document.getElementById('font-decrease');
        const fontIncreaseBtn = document.getElementById('font-increase');
        let currentFontSize = 100; // Percentage

        if (fontDecreaseBtn && fontIncreaseBtn) {
            fontDecreaseBtn.addEventListener('click', () => {
                if (currentFontSize > 80) {
                    currentFontSize -= 10;
                    document.documentElement.style.fontSize = currentFontSize + '%';
                }
            });

            fontIncreaseBtn.addEventListener('click', () => {
                if (currentFontSize < 150) {
                    currentFontSize += 10;
                    document.documentElement.style.fontSize = currentFontSize + '%';
                }
            });
        }
    }

    function updateLanguage() {
        const translations = {
            en: {
                title: 'Fake Currency Detection',
                dropText: 'Drag & Drop currency image here',
                tips: 'Upload Tips for Best Results'
            },
            hi: {
                title: 'जाली नोट पहचान प्रणाली',
                dropText: 'नोट की फोटो यहाँ डालें',
                tips: 'अच्छे परिणाम के लिए सुझाव'
            }
        };
        
        const t = translations[currentLanguage];
        // Only update a few visible elements for demo
        document.querySelector('h1').innerHTML = `<i class="fas fa-shield-alt"></i> ${t.title}`;
        document.querySelector('.upload-content p').textContent = t.dropText;
        document.querySelector('.tips-toggle').innerHTML = `<i class="fas fa-lightbulb"></i> ${t.tips}`;
        langToggleBtn.textContent = currentLanguage === 'en' ? 'EN/HI' : 'HI/EN';
    }

    // --- Demo Mode Logic ---
    if(demoBtn) {
        demoBtn.addEventListener('click', async () => {
            // Load the reference image as a blob to simulate upload
            try {
                const response = await fetch('/static/reference.jpg');
                const blob = await response.blob();
                const file = new File([blob], "demo_note.jpg", { type: "image/jpeg" });
                
                // Set context to 'learning' automatically
                scanContextSelect.value = 'learning';
                
                handleFile(file);
            } catch (e) {
                console.error("Demo failed", e);
                alert("Demo image could not be loaded.");
            }
        });
    }

    // --- AI Insights Panel Logic ---
    function initAIInsights() {
        if(openInsightsBtn) {
            openInsightsBtn.addEventListener('click', () => {
                insightsPanel.classList.add('open');
                fetchModelInfo();
            });
        }
        if(closeInsightsBtn) {
            closeInsightsBtn.addEventListener('click', () => {
                insightsPanel.classList.remove('open');
            });
        }
    }

    function fetchModelInfo() {
        fetch('/model_info')
            .then(res => res.json())
            .then(data => {
                document.getElementById('model-version').textContent = data.identity.version;
                document.getElementById('model-type').textContent = data.identity.type;
                document.getElementById('model-accuracy').textContent = data.metrics.accuracy + '%';
                
                // Limitations
                const limitList = document.getElementById('model-limitations');
                if(limitList && data.limitations) {
                    limitList.innerHTML = data.limitations.map(l => `<li>${l}</li>`).join('');
                }
            })
            .catch(console.error);
    }

    // --- Timeline Animation Logic ---
    function updateTimeline(stepIndex) {
        const steps = ['step-1', 'step-2', 'step-3'];
        steps.forEach((id, index) => {
            const el = document.getElementById(id);
            if (index < stepIndex) {
                el.classList.add('completed');
                el.classList.remove('active');
            } else if (index === stepIndex) {
                el.classList.add('active');
                el.classList.remove('completed');
            } else {
                el.classList.remove('active', 'completed');
            }
        });
    }

    // --- Toggle Upload Tips ---
    window.toggleTips = function() {
        document.getElementById('upload-tips').classList.toggle('hidden');
    };

    // --- Image Quality Advisory ---
    function checkImageQuality(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                let warnings = [];
                // Check 1: File Size
                if (file.size < 50 * 1024) warnings.push("File size too small (< 50KB)");
                
                // Check 2: Resolution
                if (this.width < 500 || this.height < 500) warnings.push("Low resolution (< 500px)");
                
                if (warnings.length > 0) {
                    advisoryText.textContent = "Warning: " + warnings.join(", ");
                    qualityAdvisory.classList.remove('hidden');
                } else {
                    qualityAdvisory.classList.add('hidden');
                }
                resolve(true);
            };
            img.onerror = resolve;
            img.src = URL.createObjectURL(file);
        });
    }

    // --- Drag & Drop ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    // --- File Handling & Prediction ---
    async function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }

        // Quality Check
        await checkImageQuality(file);

        // UI Updates
        dropZone.classList.add('scanning');
        loading.style.display = 'block';
        loading.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        document.querySelector('.stats-container').classList.add('hidden'); // Hide stats during scan
        updateTimeline(0); // Uploading
        loadingText.textContent = "Uploading image...";

        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', scanContextSelect.value); // Send context

        // Simulate Timeline steps
        setTimeout(() => {
            updateTimeline(1); // Analyzing
            loadingText.textContent = "Analyzing forensic features...";
        }, 1000);

        fetch('/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            updateTimeline(2); // Verifying
            loadingText.textContent = "Verifying authenticity...";
            
            setTimeout(() => {
                dropZone.classList.remove('scanning');
                loading.style.display = 'none';
                document.querySelector('.stats-container').classList.remove('hidden');
                displayResult(data, file);
                addToSession(data.result === 'Real', data.denomination);
            }, 800);
        })
        .catch(error => {
            console.error('Error:', error);
            dropZone.classList.remove('scanning');
            loading.style.display = 'none';
            
            // Graceful Failure UI
            resultContainer.innerHTML = `
                <div class="result-card error-card" style="border-color: var(--danger-color); background: rgba(239, 68, 68, 0.05);">
                    <div class="badge fake" style="background: var(--danger-color); color: white;">
                        <i class="fas fa-exclamation-circle"></i> Analysis Failed
                    </div>
                    <h2>We couldn't analyze this image reliably.</h2>
                    <p>Please ensure the image is clear, well-lit, and contains a valid currency note.</p>
                    <div class="upload-actions">
                        <button onclick="location.reload()" class="camera-btn">Try Again</button>
                    </div>
                </div>
            `;
            resultContainer.classList.remove('hidden');
        });
    }

    function displayResult(data, file) {
        const isReal = data.result.toUpperCase() === 'REAL';
        const isUncertain = data.confidence < 70.0;
        const confidence = parseFloat(data.confidence).toFixed(1);
        
        // Neutralization for uncertain results
        if (isUncertain) {
            document.body.classList.add('neutral-result');
        } else {
            document.body.classList.remove('neutral-result');
        }

        // Determine Badge Styling
        const badgeClass = isUncertain ? 'badge-secondary' : (isReal ? 'real' : 'fake');
        const badgeIcon = isUncertain ? 'fa-question-circle' : (isReal ? 'fa-check-circle' : 'fa-exclamation-triangle');
        const resultText = isUncertain ? 'Analysis Uncertain' : `${data.result} Note Detected`;
        const barColor = isUncertain ? 'var(--warning-color)' : (isReal ? 'var(--success-color)' : 'var(--danger-color)');

        let html = `
            <div class="result-card">
                ${isUncertain ? `
                <div class="uncertainty-banner">
                    <i class="fas fa-lock"></i>
                    <span><strong>Uncertain Result:</strong> Confidence is below safety threshold (${confidence}%). Please verify manually.</span>
                </div>
                ` : ''}
                
                <div class="badge ${badgeClass}">
                    <i class="fas ${badgeIcon}"></i>
                    ${resultText}
                </div>
                
                <h2>Confidence: ${confidence}%</h2>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidence}%; background-color: ${barColor}"></div>
                </div>
                
                <div class="reasons-list">
                    <h3>Analysis Report:</h3>
                    ${data.reasons.map(reason => `
                        <div class="reason-item">
                            <i class="fas fa-search"></i>
                            <span>${reason}</span>
                        </div>
                    `).join('')}
                </div>

                <!-- Currency Care Tips (Conditional) -->
                <div class="care-tips">
                    <h4><i class="fas fa-heart"></i> Currency Care</h4>
                    <ul>
                        <li>Avoid folding the note repeatedly.</li>
                        <li>Do not write on the watermark area.</li>
                        ${!isReal ? '<li><strong>Action:</strong> Do not recirculate this note. Surrender it to a bank.</li>' : ''}
                    </ul>
                </div>

                <!-- Scan Purpose Note -->
                <div class="scan-notes">
                    <label><i class="fas fa-sticky-note"></i> Add Note (Optional):</label>
                    <div class="note-input-group">
                        <input type="text" id="scan-note-input" placeholder="E.g., Received from petrol pump...">
                        <button class="btn-text" onclick="saveScanNote()">Save</button>
                    </div>
                </div>

                <div class="upload-actions">
                    <button onclick="location.reload()" class="camera-btn" style="background: var(--text-color)">Scan Another</button>
                    <button onclick="openCompare()" class="demo-btn">Compare Mode</button>
                </div>
            </div>
        `;
        
        resultContainer.innerHTML = html;
        resultContainer.classList.remove('hidden');
        
        // Update History
        loadHistory();
        
        // Setup Compare Image
        const reader = new FileReader();
        reader.onload = function(e) {
            window.currentImageSrc = e.target.result;
            const suspectImg = document.getElementById('compare-img-suspect');
            if(suspectImg) suspectImg.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }

    // --- Compare Modal Logic ---
    window.openCompare = function() {
        compareModal.classList.remove('hidden');
        initCompareSlider();
    }
    
    window.closeCompare = function() {
        compareModal.classList.add('hidden');
    }

    function initCompareSlider() {
        const container = document.querySelector('.img-comp-container');
        // Remove existing slider if any
        const existingSlider = document.querySelector('.img-comp-slider');
        if(existingSlider) existingSlider.remove();

        const slider = document.createElement("DIV");
        slider.setAttribute("class", "img-comp-slider");
        slider.innerHTML = '<i class="fas fa-arrows-alt-h"></i>';
        
        const imgOverlay = document.querySelector('.img-comp-overlay');
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        
        imgOverlay.style.width = (w / 2) + "px";
        container.appendChild(slider);

        slider.style.top = (h / 2) + "px";
        slider.style.left = (w / 2) - (slider.offsetWidth / 2) + "px";

        // Drag Logic
        let clicked = 0;
        slider.addEventListener("mousedown", slideReady);
        window.addEventListener("mouseup", slideFinish);
        slider.addEventListener("touchstart", slideReady);
        window.addEventListener("touchend", slideFinish);

        function slideReady(e) {
            e.preventDefault();
            clicked = 1;
            window.addEventListener("mousemove", slideMove);
            window.addEventListener("touchmove", slideMove);
        }

        function slideFinish() {
            clicked = 0;
        }

        function slideMove(e) {
            if (clicked == 0) return false;
            let pos = getCursorPos(e);
            if (pos < 0) pos = 0;
            if (pos > w) pos = w;
            slide(pos);
        }

        function getCursorPos(e) {
            let a = imgOverlay.getBoundingClientRect();
            let x = 0;
            e = e || window.event;
            x = e.pageX - a.left;
            x = x - window.pageXOffset;
            return x;
        }

        function slide(x) {
            imgOverlay.style.width = x + "px";
            slider.style.left = imgOverlay.offsetWidth - (slider.offsetWidth / 2) + "px";
        }
    }

    // --- Note Saving Logic ---
    window.saveScanNote = function() {
        const input = document.getElementById('scan-note-input');
        if(input.value.trim()) {
            alert('Note saved to local session!');
            // In a real app, send to backend
            input.disabled = true;
            input.value += " (Saved)";
        }
    }

    // --- Camera Logic ---
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

    // --- History Logic ---
    function loadHistory() {
        fetch('/get_history')
            .then(res => res.json())
            .then(data => {
                const historyHtml = data.slice().reverse().map(item => `
                    <div class="history-item">
                        <div class="history-info">
                            <strong>${item.result}</strong>
                            <small>${item.timestamp}</small>
                        </div>
                        <div class="history-badge ${item.result === 'Real' ? 'real' : 'fake'}">
                            ${item.confidence}%
                        </div>
                    </div>
                `).join('');
                if(historyList) historyList.innerHTML = historyHtml;
                updateStats(data);
            });
    }

    function updateStats(history) {
        const total = history.length;
        const real = history.filter(h => h.result === 'Real').length;
        const fake = history.filter(h => h.result === 'Fake').length;
        
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-real').textContent = real;
        document.getElementById('stat-fake').textContent = fake;
    }

    document.getElementById('clear-history').addEventListener('click', () => {
        if(confirm('Are you sure you want to clear all history?')) {
            fetch('/clear_history', { method: 'POST' })
                .then(() => {
                    loadHistory();
                    updateStats([]);
                });
        }
    });

    // --- Theme Logic ---
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        let theme = 'light';
        
        if (savedTheme) {
            theme = savedTheme;
        } else {
            // Adaptive: Auto dark mode between 7 PM and 6 AM
            const hour = new Date().getHours();
            if (hour >= 19 || hour < 6) {
                theme = 'dark';
            }
        }
        
        document.body.setAttribute('data-theme', theme);
        updateThemeIcon(theme);
        
        themeToggle.addEventListener('click', () => {
            const current = document.body.getAttribute('data-theme');
            const newTheme = current === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        themeToggle.innerHTML = theme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    }
    
    // --- Keyboard Support ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Check if any modal is open
            const isModalOpen = document.querySelector('.lightbox:not(.hidden)') || 
                                document.querySelector('.side-panel.open') ||
                                document.querySelector('.camera-interface:not(.hidden)');
            
            if (!isModalOpen) {
                fileInput.click();
            }
        }
    });

    // --- Lightbox Logic (Legacy Support) ---
    window.switchView = function(viewType) {
        // ... (Keep existing if needed, or remove if unused)
    };
});
