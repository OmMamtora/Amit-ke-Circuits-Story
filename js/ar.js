document.addEventListener("DOMContentLoaded", () => {
    const activateBtn = document.getElementById("ar-activate-btn");
    const activateScreen = document.getElementById("ar-activate");
    const arStage = document.getElementById("ar-stage");
    const fallbackScreen = document.getElementById("ar-fallback");
    const statusText = document.getElementById("ar-status");

    const OPENCV_SRC = "https://docs.opencv.org/4.9.0/opencv.js";

    // How many consecutive frames a quad must be missing before we
    // consider the card "lost" (avoids flicker from a single bad frame).
    const LOST_GRACE_FRAMES = 8;
    // Smaller = faster but less accurate. Processing happens on a
    // downscaled copy of the camera frame, then we scale results back up.
    const PROC_WIDTH = 480;
    // Set to true to show a live debug readout (OpenCV status, contour
    // counts, best-candidate stats) on screen. Turn off for production.
    const DEBUG = false;

    function track(name, details) {
        if (typeof window.trackCircuitEvent === "function") window.trackCircuitEvent(name, details || {});
    }

    function showFallback(reason) {
        track("ar_fallback_shown", { reason: reason });
        stopEverything();
        arStage.hidden = true;
        arStage.innerHTML = "";
        activateScreen.hidden = true;
        fallbackScreen.hidden = false;
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement("script");
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("script_load_failed:" + src));
            document.body.appendChild(s);
        });
    }

    function waitForOpenCv() {
        return new Promise((resolve, reject) => {
            loadScript(OPENCV_SRC)
                .then(() => {
                    if (window.cv && window.cv.Mat) { resolve(); return; }
                    window.cv = window.cv || {};
                    const prevInit = window.cv["onRuntimeInitialized"];
                    window.cv["onRuntimeInitialized"] = () => {
                        if (typeof prevInit === "function") prevInit();
                        resolve();
                    };
                })
                .catch(reject);
        });
    }

    let rafId = null;
    let stream = null;

    function stopEverything() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            stream = null;
        }
    }

    function orderCorners(pts) {
        const sorted = pts.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
        const tl = sorted[0];
        const br = sorted[3];
        const remaining = pts.filter((p) => p !== tl && p !== br);
        remaining.sort((a, b) => (a.y - a.x) - (b.y - b.x));
        const tr = remaining[0];
        const bl = remaining[1];
        return [tl, tr, br, bl];
    }

    function quadArea(pts) {
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            area += a.x * b.y - b.x * a.y;
        }
        return Math.abs(area / 2);
    }

    function findCardQuad(cv, srcMat, minAreaFrac, debugStats) {
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        const edges = new cv.Mat();
        cv.Canny(gray, edges, 30, 90);
        const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
        kernel.delete();

        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        const frameArea = srcMat.cols * srcMat.rows;
        let best = null;
        let bestArea = 0;
        let quadCandidates = 0;
        let closestRejected = null; 

        for (let i = 0; i < contours.size(); i++) {
            const cnt = contours.get(i);
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.03 * peri, true);

            if (approx.rows === 4 && cv.isContourConvex(approx)) {
                quadCandidates++;
                const pts = [];
                for (let r = 0; r < 4; r++) {
                    pts.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] });
                }
                const area = quadArea(pts);
                const areaFrac = area / frameArea;

                if (areaFrac > minAreaFrac && areaFrac < 0.95) {
                    const ordered = orderCorners(pts);
                    const w1 = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
                    const w2 = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
                    const h1 = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
                    const h2 = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
                    const w = (w1 + w2) / 2, h = (h1 + h2) / 2;
                    const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
                    
                    if (ratio > 1.1 && ratio < 3.2) {
                        if (area > bestArea) { bestArea = area; best = ordered; }
                    } else if (!closestRejected || area > closestRejected.area) {
                        closestRejected = { area, ratio };
                    }
                }
            }
            approx.delete();
            cnt.delete();
        }

        if (debugStats) {
            debugStats.totalContours = contours.size();
            debugStats.quadCandidates = quadCandidates;
            debugStats.rejectedRatio = closestRejected ? closestRejected.ratio.toFixed(2) : null;
            debugStats.found = !!best;
        }

        gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
        return best;
    }

    function mountArScene() {
        arStage.innerHTML = `
            <div class="ar-scanning-overlay" id="scanning-overlay"></div>

            <a href="index.html" class="ar-back-btn">← Back</a>

            <video id="ar-video" playsinline autoplay muted></video>
            
            <!-- Video Overlay (Placeholder source) -->
            <video id="overlay-video" src="https://www.w3schools.com/html/mov_bbb.mp4" playsinline autoplay muted loop crossorigin="anonymous"></video>
            
            <canvas id="ar-canvas"></canvas>

            <div class="ar-ui-layer" id="ui-layer">
                <a href="index.html#journey" class="button button-primary" id="ar-visit-btn">Visit Microsite ⚡</a>
            </div>
        `;

        const video = document.getElementById("ar-video");
        const overlayVideo = document.getElementById("overlay-video");
        const canvas = document.getElementById("ar-canvas");
        const ctx = canvas.getContext("2d");
        const scanningOverlay = document.getElementById("scanning-overlay");
        const uiLayer = document.getElementById("ui-layer");
        const visitBtn = document.getElementById("ar-visit-btn");
        if (visitBtn) visitBtn.addEventListener("click", () => track("ar_cta_click"));

        let missingFrames = LOST_GRACE_FRAMES;
        let foundFrames = 0; // consecutive frames with a quad, gates showing the overlay
        const FOUND_CONFIRM_FRAMES = 3;
        let smoothedQuad = null;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        }).then((s) => {
            stream = s;
            video.srcObject = stream;
            return video.play();
        }).then(() => {
            if (DEBUG) drawDebugText(ctx, canvas, "Loading OpenCV.js…");
            waitForOpenCv().then(startLoop).catch((err) => {
                console.error("OpenCV load failed:", err);
                showFallback("opencv_load_failed");
            });
        }).catch((error) => {
            track("ar_camera_denied", { error: String(error && error.name) });
            showFallback("camera_denied");
        });

        function startLoop() {
            const cv = window.cv;
            const procCanvas = document.createElement("canvas");
            const procCtx = procCanvas.getContext("2d");

            function tick() {
                if (!video.videoWidth) { rafId = requestAnimationFrame(tick); return; }

                canvas.width = canvas.width;

                const scale = PROC_WIDTH / video.videoWidth;
                const procH = Math.round(video.videoHeight * scale);
                procCanvas.width = PROC_WIDTH;
                procCanvas.height = procH;
                procCtx.drawImage(video, 0, 0, PROC_WIDTH, procH);

                const frame = cv.imread(procCanvas);
                const debugStats = DEBUG ? {} : null;
                const quad = findCardQuad(cv, frame, 0.004, debugStats);
                frame.delete();

                if (quad) {
                    missingFrames = 0;
                    foundFrames++;
                    
                    // Map procCanvas coords to screen coords (object-fit: cover)
                    const videoRatio = video.videoWidth / video.videoHeight;
                    const screenRatio = window.innerWidth / window.innerHeight;
                    let drawW, drawH, offsetX, offsetY;

                    if (screenRatio > videoRatio) {
                        drawW = window.innerWidth;
                        drawH = window.innerWidth / videoRatio;
                        offsetX = 0;
                        offsetY = (window.innerHeight - drawH) / 2;
                    } else {
                        drawW = window.innerHeight * videoRatio;
                        drawH = window.innerHeight;
                        offsetX = (window.innerWidth - drawW) / 2;
                        offsetY = 0;
                    }

                    const scaleX = drawW / PROC_WIDTH;
                    const scaleY = drawH / procH;

                    const displayQuad = quad.map((p) => ({ 
                        x: p.x * scaleX + offsetX, 
                        y: p.y * scaleY + offsetY 
                    }));
                    smoothedQuad = smoothQuad(smoothedQuad, displayQuad);
                } else {
                    missingFrames++;
                    if (missingFrames > LOST_GRACE_FRAMES) { smoothedQuad = null; foundFrames = 0; }
                }

                if (smoothedQuad && foundFrames >= FOUND_CONFIRM_FRAMES) {
                    if (!uiLayer.classList.contains("visible")) {
                        uiLayer.classList.add("visible");
                        scanningOverlay.classList.add("hidden");
                        overlayVideo.style.display = "block";
                        overlayVideo.play().catch(e => {});
                        track("ar_target_found");
                    }
                    
                    // Calculate Perspective Transform for Video Overlay
                    if (overlayVideo.videoWidth > 0) {
                        const vidW = overlayVideo.videoWidth;
                        const vidH = overlayVideo.videoHeight;
                        
                        const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [0,0, vidW,0, vidW,vidH, 0,vidH]);
                        const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
                            smoothedQuad[0].x, smoothedQuad[0].y,
                            smoothedQuad[1].x, smoothedQuad[1].y,
                            smoothedQuad[2].x, smoothedQuad[2].y,
                            smoothedQuad[3].x, smoothedQuad[3].y
                        ]);
                        
                        const M = cv.getPerspectiveTransform(srcMat, dstMat);
                        const h = M.data64F;
                        
                        // matrix3d is column-major
                        // const matrix3d = `matrix3d(\${h[0]}, \${h[3]}, 0, \${h[6]}, \${h[1]}, \${h[4]}, 0, \${h[7]}, 0, 0, 1, 0, \${h[2]}, \${h[5]}, 0, \${h[8]})\`;
                        const matrix3d = `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,${h[8]})`;
                        overlayVideo.style.transform = matrix3d;
                        overlayVideo.style.width = vidW + "px";
                        overlayVideo.style.height = vidH + "px";
                        
                        srcMat.delete();
                        dstMat.delete();
                        M.delete();
                    }

                } else {
                    if (uiLayer.classList.contains("visible")) {
                        uiLayer.classList.remove("visible");
                        scanningOverlay.classList.remove("hidden");
                        overlayVideo.style.display = "none";
                        overlayVideo.pause();
                        track("ar_target_lost");
                    }
                }

                if (DEBUG && debugStats) {
                    drawDebugText( ctx, canvas,
                        `contours: ${debugStats.totalContours}  4-sided: ${debugStats.quadCandidates} ` +
                        `found: ${debugStats.found}  rejectedRatio: ${debugStats.rejectedRatio ?? "-"}`
                    );
                }

                rafId = requestAnimationFrame(tick);
            }
            rafId = requestAnimationFrame(tick);
        }
    }

    function drawDebugText(ctx, canvas, text) {
        ctx.save();
        ctx.font = "16px monospace";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
        ctx.fillStyle = "#00ff88";
        ctx.fillText(text, 12, canvas.height - 12);
        ctx.restore();
    }

    function smoothQuad(prev, next, alpha = 0.35) {
        if (!prev) return next;
        return next.map((p, i) => ({
            x: prev[i].x + (p.x - prev[i].x) * alpha,
            y: prev[i].y + (p.y - prev[i].y) * alpha
        }));
    }

    if (activateBtn) {
        activateBtn.addEventListener("click", () => {
            track("ar_activate_tap");
            statusText.innerText = "Requesting camera access…";

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showFallback("getUserMedia_unsupported");
                return;
            }

            activateScreen.hidden = true;
            arStage.hidden = false;
            mountArScene();
        });
    }
});
