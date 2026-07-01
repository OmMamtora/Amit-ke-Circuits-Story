// // document.addEventListener("DOMContentLoaded", () => {
// //     const activateBtn = document.getElementById("ar-activate-btn");
// //     const activateScreen = document.getElementById("ar-activate");
// //     const arStage = document.getElementById("ar-stage");
// //     const fallbackScreen = document.getElementById("ar-fallback");
// //     const statusText = document.getElementById("ar-status");
// //     const OPENCV_SRC = "https://docs.opencv.org/4.9.0/opencv.js";
// //     const LOST_GRACE_FRAMES = 1;
// //     // Lower processing width = much cheaper Canny/contour pass. 480 → 360
// //     // barely hurts accuracy for a card-sized object but cuts pixel count
// //     // (and therefore most of the per-frame cost) by ~45%.
// //     const PROC_WIDTH = 360;
// //     const DEBUG = false;

// //     // ── Performance knobs ──────────────────────────────────────────────
// //     // Run the expensive OpenCV quad-detection only every Nth frame.
// //     // Tracking between detections is handled by quad smoothing, so the
// //     // overlay still looks continuous even though detection itself is slow.
// //     const DETECT_EVERY_N_FRAMES = 3;

// //     function track(name, details) {
// //         if (typeof window.trackCircuitEvent === "function") window.trackCircuitEvent(name, details || {});
// //     }
// //     function showFallback(reason) {
// //         track("ar_fallback_shown", { reason });
// //         stopEverything();
// //         arStage.hidden = true;
// //         arStage.innerHTML = "";
// //         activateScreen.hidden = true;
// //         fallbackScreen.hidden = false;
// //     }
// //     function loadScript(src) {
// //         return new Promise((resolve, reject) => {
// //             if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
// //             const s = document.createElement("script");
// //             s.src = src; s.async = true;
// //             s.onload = () => resolve();
// //             s.onerror = () => reject(new Error("script_load_failed:" + src));
// //             document.body.appendChild(s);
// //         });
// //     }
// //     function waitForOpenCv() {
// //         return new Promise((resolve, reject) => {
// //             loadScript(OPENCV_SRC).then(() => {
// //                 if (window.cv && window.cv.Mat) { resolve(); return; }
// //                 window.cv = window.cv || {};
// //                 const prev = window.cv["onRuntimeInitialized"];
// //                 window.cv["onRuntimeInitialized"] = () => { if (typeof prev === "function") prev(); resolve(); };
// //             }).catch(reject);
// //         });
// //     }
// //     let rafId = null, stream = null;
// //     function stopEverything() {
// //         if (rafId) cancelAnimationFrame(rafId);
// //         rafId = null;
// //         if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
// //     }
// //     function orderCorners(pts) {
// //         const sorted = pts.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
// //         const tl = sorted[0], br = sorted[3];
// //         const remaining = pts.filter(p => p !== tl && p !== br);
// //         remaining.sort((a, b) => (a.y - a.x) - (b.y - b.x));
// //         return [tl, remaining[0], br, remaining[1]];
// //     }
// //     function quadArea(pts) {
// //         let area = 0;
// //         for (let i = 0; i < pts.length; i++) {
// //             const a = pts[i], b = pts[(i + 1) % pts.length];
// //             area += a.x * b.y - b.x * a.y;
// //         }
// //         return Math.abs(area / 2);
// //     }
// //     // Runs on the FULL downscaled camera frame — no fixed region, so a
// //     // card anywhere on screen gets detected. No on-screen guide box.
// //     function findCardQuad(cv, srcMat, minAreaFrac) {
// //         const gray = new cv.Mat();
// //         cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
// //         cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
// //         const edges = new cv.Mat();
// //         cv.Canny(gray, edges, 30, 90);
// //         const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
// //         cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
// //         kernel.delete();
// //         const contours = new cv.MatVector(), hierarchy = new cv.Mat();
// //         cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
// //         const frameArea = srcMat.cols * srcMat.rows;
// //         let best = null, bestArea = 0;
// //         for (let i = 0; i < contours.size(); i++) {
// //             const cnt = contours.get(i);
// //             const peri = cv.arcLength(cnt, true);
// //             const approx = new cv.Mat();
// //             cv.approxPolyDP(cnt, approx, 0.03 * peri, true);
// //             if (approx.rows === 4 && cv.isContourConvex(approx)) {
// //                 const pts = [];
// //                 for (let r = 0; r < 4; r++) pts.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] });
// //                 const area = quadArea(pts);
// //                 const areaFrac = area / frameArea;
// //                 if (areaFrac > minAreaFrac && areaFrac < 0.95) {
// //                     const ordered = orderCorners(pts);
// //                     const w1 = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
// //                     const w2 = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
// //                     const h1 = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
// //                     const h2 = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
// //                     const w = (w1 + w2) / 2, h = (h1 + h2) / 2;
// //                     const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
// //                     if (ratio > 1.1 && ratio < 3.2 && area > bestArea) { bestArea = area; best = ordered; }
// //                 }
// //             }
// //             approx.delete(); cnt.delete();
// //         }
// //         gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
// //         return best;
// //     }
// //     function mountArScene() {
// //         // No dashed scan box — card can be shown anywhere, full frame.
// //         arStage.innerHTML = `
// //             <div class="ar-scanning-overlay" id="scanning-overlay">
// //                 <p class="ar-scan-label">Scanning…</p>
// //             </div>
// //             <a href="index.html" class="ar-back-btn">← Back</a>
// //             <video id="ar-video" playsinline autoplay muted></video>
// //             <video id="overlay-video" src="assets/video/card-video.mp4" playsinline muted loop preload="auto"></video>
// //             <div class="ar-ui-layer" id="ui-layer">
// //                 <a href="index.html#journey" class="button button-primary" id="ar-visit-btn">Visit Microsite ⚡</a>
// //             </div>
// //         `;
// //         const video = document.getElementById("ar-video");
// //         const overlayVideo = document.getElementById("overlay-video");
// //         const scanningOverlay = document.getElementById("scanning-overlay");
// //         const uiLayer = document.getElementById("ui-layer");
// //         const visitBtn = document.getElementById("ar-visit-btn");
// //         if (visitBtn) visitBtn.addEventListener("click", () => track("ar_cta_click"));

// //         // overlay-video is positioned top-left, then transformed entirely
// //         // via CSS matrix3d — GPU compositing, essentially free per frame.
// //         // (Make sure CSS has: #overlay-video { position:absolute; top:0;
// //         // left:0; transform-origin:0 0; display:none; will-change:transform; })
// //         overlayVideo.load();
// //         overlayVideo.style.display = "none";
// //         overlayVideo.style.position = "fixed";   // -9999px wala absolute ne override
// //         overlayVideo.style.top = "0";
// //         overlayVideo.style.left = "0";
// //         overlayVideo.style.transformOrigin = "0 0";

// //         let missingFrames = LOST_GRACE_FRAMES;
// //         let foundFrames = 0;
// //         const FOUND_CONFIRM_FRAMES = 1;
// //         let smoothedQuad = null;
// //         let cardVisible = false;
// //         let frameCounter = 0;

// //         navigator.mediaDevices.getUserMedia({
// //             video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
// //         }).then(s => {
// //             stream = s;
// //             video.srcObject = stream;
// //             return video.play();
// //         }).then(() => {
// //             waitForOpenCv().then(startLoop).catch(err => {
// //                 console.error("OpenCV load failed:", err);
// //                 showFallback("opencv_load_failed");
// //             });
// //         }).catch(error => {
// //             track("ar_camera_denied", { error: String(error && error.name) });
// //             showFallback("camera_denied");
// //         });

// //         function startLoop() {
// //             const cv = window.cv;
// //             const procCanvas = document.createElement("canvas");
// //             const procCtx = procCanvas.getContext("2d", { willReadFrequently: true });

// //             function tick() {
// //                 if (!video.videoWidth) { rafId = requestAnimationFrame(tick); return; }
// //                 frameCounter++;

// //                 if (frameCounter % DETECT_EVERY_N_FRAMES === 0) {
// //                     const scale = PROC_WIDTH / video.videoWidth;
// //                     const procH = Math.round(video.videoHeight * scale);
// //                     procCanvas.width = PROC_WIDTH;
// //                     procCanvas.height = procH;
// //                     procCtx.drawImage(video, 0, 0, PROC_WIDTH, procH);

// //                     const frame = cv.imread(procCanvas);
// //                     const quad = findCardQuad(cv, frame, 0.004);
// //                     frame.delete();

// //                     if (quad) {
// //                         missingFrames = 0;
// //                         foundFrames++;
// //                         const videoRatio = video.videoWidth / video.videoHeight;
// //                         const screenRatio = window.innerWidth / window.innerHeight;
// //                         let drawW, drawH, offsetX, offsetY;
// //                         if (screenRatio > videoRatio) {
// //                             drawW = window.innerWidth;
// //                             drawH = window.innerWidth / videoRatio;
// //                             offsetX = 0;
// //                             offsetY = (window.innerHeight - drawH) / 2;
// //                         } else {
// //                             drawW = window.innerHeight * videoRatio;
// //                             drawH = window.innerHeight;
// //                             offsetX = (window.innerWidth - drawW) / 2;
// //                             offsetY = 0;
// //                         }
// //                         const scaleX = drawW / PROC_WIDTH;
// //                         const scaleY = drawH / procH;
// //                         const displayQuad = quad.map(p => ({
// //                             x: p.x * scaleX + offsetX,
// //                             y: p.y * scaleY + offsetY
// //                         }));
// //                         smoothedQuad = smoothQuad(smoothedQuad, displayQuad);
// //                     } else {
// //                         missingFrames++;
// //                         if (missingFrames > LOST_GRACE_FRAMES) {
// //                             smoothedQuad = null;
// //                             foundFrames = 0;
// //                         }
// //                     }

// //                     const shouldShowCard = smoothedQuad && foundFrames >= FOUND_CONFIRM_FRAMES;
// //                     if (shouldShowCard) {
// //                         if (!cardVisible) {
// //                             cardVisible = true;
// //                             scanningOverlay.classList.add("hidden");
// //                             overlayVideo.style.display = "block";
// //                             overlayVideo.play().catch(() => {});
// //                             setTimeout(() => {
// //                                 if (cardVisible) uiLayer.classList.add("visible");
// //                             }, 600);
// //                             track("ar_target_found");
// //                         }
// //                     } else if (cardVisible) {
// //                         cardVisible = false;
// //                         uiLayer.classList.remove("visible");
// //                         scanningOverlay.classList.remove("hidden");
// //                         overlayVideo.style.display = "none";
// //                         overlayVideo.pause();
// //                         track("ar_target_lost");
// //                     }
// //                 }

// //                 // Cheap GPU transform update — runs every frame regardless
// //                 // of whether detection re-ran, using the latest smoothed quad.
// //                 if (cardVisible && smoothedQuad && overlayVideo.videoWidth > 0) {
// //                     applyPerspective(overlayVideo, smoothedQuad);
// //                 }

// //                 rafId = requestAnimationFrame(tick);
// //             }
// //             rafId = requestAnimationFrame(tick);
// //         }
// //     }

// //     // Maps the overlay video's natural rect onto the four quad points using
// //     // a single CSS matrix3d — composited on the GPU, no per-frame canvas work.
// //     function applyPerspective(videoEl, quad) {
// //         const w = videoEl.videoWidth, h = videoEl.videoHeight;
// //         const H = computeHomography(
// //             [[0, 0], [w, 0], [w, h], [0, h]],
// //             [[quad[0].x, quad[0].y], [quad[1].x, quad[1].y], [quad[2].x, quad[2].y], [quad[3].x, quad[3].y]]
// //         );
// //         if (!H) return;
// //         // H is row-major 3x3 mapping (x,y,1) -> (x',y',w'). CSS matrix3d is
// //         // column-major 4x4; embed the 2D homography into it.
// //         const m = [
// //             H[0], H[3], 0, H[6],
// //             H[1], H[4], 0, H[7],
// //             0,    0,    1, 0,
// //             H[2], H[5], 0, H[8]
// //         ];
// //         videoEl.style.width = w + "px";
// //         videoEl.style.height = h + "px";
// //         videoEl.style.transform = `matrix3d(${m.join(",")})`;
// //     }

// //     // Solves the 8-DOF planar homography mapping src quad -> dst quad via a
// //     // direct linear system (no OpenCV needed for this part).
// //     function computeHomography(src, dst) {
// //         const A = [];
// //         const b = [];
// //         for (let i = 0; i < 4; i++) {
// //             const [x, y] = src[i];
// //             const [X, Y] = dst[i];
// //             A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
// //             A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
// //         }
// //         const h = solveLinearSystem(A, b);
// //         if (!h) return null;
// //         return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
// //     }

// //     // Gaussian elimination with partial pivoting for an 8x8 system.
// //     function solveLinearSystem(A, b) {
// //         const n = A.length;
// //         const M = A.map((row, i) => row.concat([b[i]]));
// //         for (let col = 0; col < n; col++) {
// //             let pivot = col;
// //             for (let r = col + 1; r < n; r++) {
// //                 if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
// //             }
// //             if (Math.abs(M[pivot][col]) < 1e-10) return null;
// //             [M[col], M[pivot]] = [M[pivot], M[col]];
// //             for (let r = 0; r < n; r++) {
// //                 if (r === col) continue;
// //                 const factor = M[r][col] / M[col][col];
// //                 for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
// //             }
// //         }
// //         return M.map((row, i) => row[n] / row[i]);
// //     }

// //     function smoothQuad(prev, next, alpha = 0.35) {
// //         if (!prev) return next;
// //         return next.map((p, i) => ({
// //             x: prev[i].x + (p.x - prev[i].x) * alpha,
// //             y: prev[i].y + (p.y - prev[i].y) * alpha
// //         }));
// //     }

// //     if (activateBtn) {
// //         activateBtn.addEventListener("click", () => {
// //             track("ar_activate_tap");
// //             statusText.innerText = "Requesting camera access…";
// //             if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
// //                 showFallback("getUserMedia_unsupported");
// //                 return;
// //             }
// //             activateScreen.hidden = true;
// //             arStage.hidden = false;
// //             mountArScene();
// //         });
// //     }
// // });

// document.addEventListener("DOMContentLoaded", () => {
//     const activateBtn = document.getElementById("ar-activate-btn");
//     const activateScreen = document.getElementById("ar-activate");
//     const arStage = document.getElementById("ar-stage");
//     const fallbackScreen = document.getElementById("ar-fallback");
//     const statusText = document.getElementById("ar-status");
//     const OPENCV_SRC = "https://docs.opencv.org/4.9.0/opencv.js";
//     const LOST_GRACE_FRAMES = 8;
//     // Lower processing width = much cheaper Canny/contour pass. 480 → 360
//     // barely hurts accuracy for a card-sized object but cuts pixel count
//     // (and therefore most of the per-frame cost) by ~45%.
//     const PROC_WIDTH = 360;
//     const DEBUG = false;

//     // ── Performance knobs ──────────────────────────────────────────────
//     // Run the expensive OpenCV quad-detection only every Nth frame.
//     // Tracking between detections is handled by quad smoothing, so the
//     // overlay still looks continuous even though detection itself is slow.
//     const DETECT_EVERY_N_FRAMES = 4;

//     function track(name, details) {
//         if (typeof window.trackCircuitEvent === "function") window.trackCircuitEvent(name, details || {});
//     }
//     function showFallback(reason) {
//         track("ar_fallback_shown", { reason });
//         stopEverything();
//         arStage.hidden = true;
//         arStage.innerHTML = "";
//         activateScreen.hidden = true;
//         fallbackScreen.hidden = false;
//     }
//     function loadScript(src) {
//         return new Promise((resolve, reject) => {
//             if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
//             const s = document.createElement("script");
//             s.src = src; s.async = true;
//             s.onload = () => resolve();
//             s.onerror = () => reject(new Error("script_load_failed:" + src));
//             document.body.appendChild(s);
//         });
//     }
//     function waitForOpenCv() {
//         return new Promise((resolve, reject) => {
//             loadScript(OPENCV_SRC).then(() => {
//                 if (window.cv && window.cv.Mat) { resolve(); return; }
//                 window.cv = window.cv || {};
//                 const prev = window.cv["onRuntimeInitialized"];
//                 window.cv["onRuntimeInitialized"] = () => { if (typeof prev === "function") prev(); resolve(); };
//             }).catch(reject);
//         });
//     }
//     let rafId = null, stream = null;
//     function stopEverything() {
//         if (rafId) cancelAnimationFrame(rafId);
//         rafId = null;
//         if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
//     }
//     function orderCorners(pts) {
//         const sorted = pts.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
//         const tl = sorted[0], br = sorted[3];
//         const remaining = pts.filter(p => p !== tl && p !== br);
//         remaining.sort((a, b) => (a.y - a.x) - (b.y - b.x));
//         return [tl, remaining[0], br, remaining[1]];
//     }
//     function quadArea(pts) {
//         let area = 0;
//         for (let i = 0; i < pts.length; i++) {
//             const a = pts[i], b = pts[(i + 1) % pts.length];
//             area += a.x * b.y - b.x * a.y;
//         }
//         return Math.abs(area / 2);
//     }
//     // Runs on the FULL downscaled camera frame — no fixed region, so a
//     // card anywhere on screen gets detected. No on-screen guide box.
//     function findCardQuad(cv, srcMat, minAreaFrac) {
//         const gray = new cv.Mat();
//         cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
//         cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
//         const edges = new cv.Mat();
//         cv.Canny(gray, edges, 30, 90);
//         const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
//         cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
//         kernel.delete();
//         const contours = new cv.MatVector(), hierarchy = new cv.Mat();
//         cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
//         const frameArea = srcMat.cols * srcMat.rows;
//         let best = null, bestArea = 0;
//         for (let i = 0; i < contours.size(); i++) {
//             const cnt = contours.get(i);
//             const peri = cv.arcLength(cnt, true);
//             const approx = new cv.Mat();
//             cv.approxPolyDP(cnt, approx, 0.03 * peri, true);
//             if (approx.rows === 4 && cv.isContourConvex(approx)) {
//                 const pts = [];
//                 for (let r = 0; r < 4; r++) pts.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] });
//                 const area = quadArea(pts);
//                 const areaFrac = area / frameArea;
//                 if (areaFrac > minAreaFrac && areaFrac < 0.95) {
//                     const ordered = orderCorners(pts);
//                     const w1 = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
//                     const w2 = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
//                     const h1 = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
//                     const h2 = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
//                     const w = (w1 + w2) / 2, h = (h1 + h2) / 2;
//                     const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
//                     if (ratio > 1.1 && ratio < 3.2 && area > bestArea) { bestArea = area; best = ordered; }
//                 }
//             }
//             approx.delete(); cnt.delete();
//         }
//         gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
//         return best;
//     }
//     function mountArScene() {
//         // No dashed scan box — card can be shown anywhere, full frame.
//         arStage.innerHTML = `
//             <div class="ar-scanning-overlay" id="scanning-overlay">
//                 <p class="ar-scan-label">Scanning…</p>
//             </div>
//             <a href="index.html" class="ar-back-btn">← Back</a>
//             <video id="ar-video" playsinline autoplay muted></video>
//             <video id="overlay-video" src="assets/video/card-video.mp4" playsinline loop crossorigin="anonymous" preload="auto"></video>
//             <div class="ar-ui-layer" id="ui-layer">
//                 <a href="index.html#journey" class="button button-primary" id="ar-visit-btn">Visit Microsite ⚡</a>
//             </div>
//         `;
//         const video = document.getElementById("ar-video");
//         const overlayVideo = document.getElementById("overlay-video");
//         const scanningOverlay = document.getElementById("scanning-overlay");
//         const uiLayer = document.getElementById("ui-layer");
//         const visitBtn = document.getElementById("ar-visit-btn");
//         if (visitBtn) visitBtn.addEventListener("click", () => track("ar_cta_click"));

//         // overlay-video is positioned top-left, then transformed entirely
//         // via CSS matrix3d — GPU compositing, essentially free per frame.
//         // (Make sure CSS has: #overlay-video { position:absolute; top:0;
//         // left:0; transform-origin:0 0; display:none; will-change:transform; })
        
        
//         // overlayVideo.load();
//         // overlayVideo.style.display = "none";

//         overlayVideo.load();
//         overlayVideo.style.display = "none";
//         overlayVideo.style.position = "fixed";
//         overlayVideo.style.top = "0";
//         overlayVideo.style.left = "0";
//         overlayVideo.style.transformOrigin = "0 0";
//         overlayVideo.style.willChange = "transform";
//         overlayVideo.style.zIndex = "50";

//         let missingFrames = LOST_GRACE_FRAMES;
//         let foundFrames = 0;
//         const FOUND_CONFIRM_FRAMES = 3;
//         let smoothedQuad = null;
//         let cardVisible = false;
//         let frameCounter = 0;

//         navigator.mediaDevices.getUserMedia({
//             video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
//         }).then(s => {
//             stream = s;
//             video.srcObject = stream;
//             return video.play();
//         }).then(() => {
//             waitForOpenCv().then(startLoop).catch(err => {
//                 console.error("OpenCV load failed:", err);
//                 showFallback("opencv_load_failed");
//             });
//         }).catch(error => {
//             track("ar_camera_denied", { error: String(error && error.name) });
//             showFallback("camera_denied");
//         });

//         function startLoop() {
//             const cv = window.cv;
//             const procCanvas = document.createElement("canvas");
//             const procCtx = procCanvas.getContext("2d", { willReadFrequently: true });

//             function tick() {
//                 if (!video.videoWidth) { rafId = requestAnimationFrame(tick); return; }
//                 frameCounter++;

//                 if (frameCounter % DETECT_EVERY_N_FRAMES === 0) {
//                     const scale = PROC_WIDTH / video.videoWidth;
//                     const procH = Math.round(video.videoHeight * scale);
//                     procCanvas.width = PROC_WIDTH;
//                     procCanvas.height = procH;
//                     procCtx.drawImage(video, 0, 0, PROC_WIDTH, procH);

//                     const frame = cv.imread(procCanvas);
//                     // const quad = findCardQuad(cv, frame, 0.004);
//                     const quad = findCardQuad(cv, frame, 0.002);
//                     frame.delete();

//                     if (quad) {
//                         missingFrames = 0;
//                         foundFrames++;
//                         const videoRatio = video.videoWidth / video.videoHeight;
//                         const screenRatio = window.innerWidth / window.innerHeight;
//                         let drawW, drawH, offsetX, offsetY;
//                         if (screenRatio > videoRatio) {
//                             drawW = window.innerWidth;
//                             drawH = window.innerWidth / videoRatio;
//                             offsetX = 0;
//                             offsetY = (window.innerHeight - drawH) / 2;
//                         } else {
//                             drawW = window.innerHeight * videoRatio;
//                             drawH = window.innerHeight;
//                             offsetX = (window.innerWidth - drawW) / 2;
//                             offsetY = 0;
//                         }
//                         const scaleX = drawW / PROC_WIDTH;
//                         const scaleY = drawH / procH;
//                         const displayQuad = quad.map(p => ({
//                             x: p.x * scaleX + offsetX,
//                             y: p.y * scaleY + offsetY
//                         }));
//                         smoothedQuad = smoothQuad(smoothedQuad, displayQuad);
//                     } else {
//                         missingFrames++;
//                         if (missingFrames > LOST_GRACE_FRAMES) {
//                             smoothedQuad = null;
//                             foundFrames = 0;
//                         }
//                     }

//                     const shouldShowCard = smoothedQuad && foundFrames >= FOUND_CONFIRM_FRAMES;
//                     if (shouldShowCard) {
//                         if (!cardVisible) {
//                             cardVisible = true;
//                             scanningOverlay.classList.add("hidden");
//                             overlayVideo.style.display = "block";
//                             // overlayVideo.play().catch(() => {});
//                             // overlayVideo.muted = true; // Explicitly mute to satisfy browser policy
//                             //     overlayVideo.play().then(() => {
//                             //         console.log("Overlay video playing");
//                             //     }).catch(err => {
//                             //         console.error("Overlay video play failed:", err);
//                             //     });


//                             overlayVideo.muted = false;
//                             overlayVideo.play().then(() => {
//                                 console.log("Overlay video playing with audio");
//                             }).catch(err => {
//                                 console.warn("Audio playback blocked, trying muted:", err);
//                                 overlayVideo.muted = true;
//                                 overlayVideo.play().catch(e => {
//                                     console.error("Overlay video play failed:", e);
//                                 });
//                             });
//                             // setTimeout(() => {
//                             //     if (cardVisible) uiLayer.classList.add("visible");
//                             // }, 600);

//                             const checkVideoPlaying = setInterval(() => {
//                                 if (overlayVideo.currentTime > 0.1 || overlayVideo.readyState === 4) {
//                                     clearInterval(checkVideoPlaying);
//                                     if (cardVisible) uiLayer.classList.add("visible");
//                                 }
//                             }, 50);
//                             track("ar_target_found");
//                         }
//                     } else if (cardVisible) {
//                         cardVisible = false;
//                         uiLayer.classList.remove("visible");
//                         scanningOverlay.classList.remove("hidden");
//                         overlayVideo.style.display = "none";
//                         overlayVideo.pause();
//                         track("ar_target_lost");
//                     }
//                 }

//                 // Cheap GPU transform update — runs every frame regardless
//                 // of whether detection re-ran, using the latest smoothed quad.
                
                
//                 // if (cardVisible && smoothedQuad && overlayVideo.videoWidth > 0) {
//                 //     applyPerspective(overlayVideo, smoothedQuad);
//                 // }

//                 if (cardVisible && smoothedQuad) {
//                     const w = overlayVideo.videoWidth || 640; // Fallback width
//                     const h = overlayVideo.videoHeight || 360; // Fallback height
//                     applyPerspective(overlayVideo, smoothedQuad, w, h);
//                 }

//                 rafId = requestAnimationFrame(tick);
//             }
//             rafId = requestAnimationFrame(tick);
//         }
//     }

//     // Maps the overlay video's natural rect onto the four quad points using
//     // a single CSS matrix3d — composited on the GPU, no per-frame canvas work.
//     function applyPerspective(videoEl, quad) {
//         const w = videoEl.videoWidth, h = videoEl.videoHeight;
//         const H = computeHomography(
//             [[0, 0], [w, 0], [w, h], [0, h]],
//             [[quad[0].x, quad[0].y], [quad[1].x, quad[1].y], [quad[2].x, quad[2].y], [quad[3].x, quad[3].y]]
//         );
//         if (!H) return;
//         // H is row-major 3x3 mapping (x,y,1) -> (x',y',w'). CSS matrix3d is
//         // column-major 4x4; embed the 2D homography into it.
//         const m = [
//             H[0], H[3], 0, H[6],
//             H[1], H[4], 0, H[7],
//             0,    0,    1, 0,
//             H[2], H[5], 0, H[8]
//         ];
//         videoEl.style.width = w + "px";
//         videoEl.style.height = h + "px";
//         videoEl.style.transform = `matrix3d(${m.join(",")})`;
//     }

//     // Solves the 8-DOF planar homography mapping src quad -> dst quad via a
//     // direct linear system (no OpenCV needed for this part).
//     function computeHomography(src, dst) {
//         const A = [];
//         const b = [];
//         for (let i = 0; i < 4; i++) {
//             const [x, y] = src[i];
//             const [X, Y] = dst[i];
//             A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
//             A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
//         }
//         const h = solveLinearSystem(A, b);
//         if (!h) return null;
//         return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
//     }

//     // Gaussian elimination with partial pivoting for an 8x8 system.
//     function solveLinearSystem(A, b) {
//         const n = A.length;
//         const M = A.map((row, i) => row.concat([b[i]]));
//         for (let col = 0; col < n; col++) {
//             let pivot = col;
//             for (let r = col + 1; r < n; r++) {
//                 if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
//             }
//             if (Math.abs(M[pivot][col]) < 1e-10) return null;
//             [M[col], M[pivot]] = [M[pivot], M[col]];
//             for (let r = 0; r < n; r++) {
//                 if (r === col) continue;
//                 const factor = M[r][col] / M[col][col];
//                 for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
//             }
//         }
//         return M.map((row, i) => row[n] / row[i]);
//     }

//     function smoothQuad(prev, next, alpha = 0.35) {
//         if (!prev) return next;
//         return next.map((p, i) => ({
//             x: prev[i].x + (p.x - prev[i].x) * alpha,
//             y: prev[i].y + (p.y - prev[i].y) * alpha
//         }));
//     }

//     if (activateBtn) {
//         activateBtn.addEventListener("click", () => {
//             track("ar_activate_tap");
//             statusText.innerText = "Requesting camera access…";
//             if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
//                 showFallback("getUserMedia_unsupported");
//                 return;
//             }
//             activateScreen.hidden = true;
//             arStage.hidden = false;
//             mountArScene();
//         });
//     }
// });

document.addEventListener("DOMContentLoaded", () => {
    const activateBtn = document.getElementById("ar-activate-btn");
    const activateScreen = document.getElementById("ar-activate");
    const arStage = document.getElementById("ar-stage");
    const fallbackScreen = document.getElementById("ar-fallback");
    const statusText = document.getElementById("ar-status");
    const OPENCV_SRC = "https://docs.opencv.org/4.9.0/opencv.js";
    const LOST_GRACE_FRAMES = 15; // Increased for better stability during movement
    // Lower processing width = much cheaper Canny/contour pass. 480 → 360
    // barely hurts accuracy for a card-sized object but cuts pixel count
    // (and therefore most of the per-frame cost) by ~45%.
    const PROC_WIDTH = 480; // Higher resolution for more precise edge detection
    const DEBUG = false;

    // ── Performance knobs ──────────────────────────────────────────────
    // Run the expensive OpenCV quad-detection only every Nth frame.
    // Tracking between detections is handled by quad smoothing, so the
    // overlay still looks continuous even though detection itself is slow.
    const DETECT_EVERY_N_FRAMES = 2; // Maximum frequency for smoothest tracking

    function track(name, details) {
        if (typeof window.trackCircuitEvent === "function") window.trackCircuitEvent(name, details || {});
    }
    function showFallback(reason) {
        track("ar_fallback_shown", { reason });
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
            s.src = src; s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("script_load_failed:" + src));
            document.body.appendChild(s);
        });
    }
    function waitForOpenCv() {
        return new Promise((resolve, reject) => {
            loadScript(OPENCV_SRC).then(() => {
                if (window.cv && window.cv.Mat) { resolve(); return; }
                window.cv = window.cv || {};
                const prev = window.cv["onRuntimeInitialized"];
                window.cv["onRuntimeInitialized"] = () => { if (typeof prev === "function") prev(); resolve(); };
            }).catch(reject);
        });
    }
    let rafId = null, stream = null;
    function stopEverything() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    }
    function orderCorners(pts) {
        const sorted = pts.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
        const tl = sorted[0], br = sorted[3];
        const remaining = pts.filter(p => p !== tl && p !== br);
        remaining.sort((a, b) => (a.y - a.x) - (b.y - b.x));
        return [tl, remaining[0], br, remaining[1]];
    }
    function quadArea(pts) {
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            area += a.x * b.y - b.x * a.y;
        }
        return Math.abs(area / 2);
    }
    // Runs on the FULL downscaled camera frame — no fixed region, so a
    // card anywhere on screen gets detected. No on-screen guide box.
    function findCardQuad(cv, srcMat, minAreaFrac) {
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        const edges = new cv.Mat();
        cv.Canny(gray, edges, 30, 90);
        const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
        kernel.delete();
        const contours = new cv.MatVector(), hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        const frameArea = srcMat.cols * srcMat.rows;
        let best = null, bestArea = 0;
        for (let i = 0; i < contours.size(); i++) {
            const cnt = contours.get(i);
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.03 * peri, true);
            if (approx.rows === 4 && cv.isContourConvex(approx)) {
                const pts = [];
                for (let r = 0; r < 4; r++) pts.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] });
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
                    if (ratio > 1.1 && ratio < 3.2 && area > bestArea) { bestArea = area; best = ordered; }
                }
            }
            approx.delete(); cnt.delete();
        }
        gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
        return best;
    }
    function mountArScene() {
        // No dashed scan box — card can be shown anywhere, full frame.
        arStage.innerHTML = `
            <div class="ar-scanning-overlay" id="scanning-overlay">
                <p class="ar-scan-label">Scanning…</p>
            </div>
            <a href="index.html" class="ar-back-btn">← Back</a>
            <video id="ar-video" playsinline autoplay muted></video>
            <video id="overlay-video" src="assets/video/card-video.mp4" playsinline loop crossorigin="anonymous" preload="auto"></video>
            <div class="ar-ui-layer" id="ui-layer">
                <a href="index.html#journey" class="button button-primary" id="ar-visit-btn">Visit Microsite ⚡</a>
            </div>
        `;
        const video = document.getElementById("ar-video");
        const overlayVideo = document.getElementById("overlay-video");
        const scanningOverlay = document.getElementById("scanning-overlay");
        const uiLayer = document.getElementById("ui-layer");
        const visitBtn = document.getElementById("ar-visit-btn");
        if (visitBtn) visitBtn.addEventListener("click", () => track("ar_cta_click"));

        // overlay-video is positioned top-left, then transformed entirely
        // via CSS matrix3d — GPU compositing, essentially free per frame.
        // (Make sure CSS has: #overlay-video { position:absolute; top:0;
        // left:0; transform-origin:0 0; display:none; will-change:transform; })
        overlayVideo.load();
        overlayVideo.style.display = "none";
        overlayVideo.style.position = "fixed";
        overlayVideo.style.top = "0";
        overlayVideo.style.left = "0";
        overlayVideo.style.transformOrigin = "0 0";
        overlayVideo.style.willChange = "transform";
        overlayVideo.style.zIndex = "50";

        let missingFrames = LOST_GRACE_FRAMES;
        let foundFrames = 0;
        const FOUND_CONFIRM_FRAMES = 2; // Quicker confirmation
        let smoothedQuad = null;
        let cardVisible = false;
        let frameCounter = 0;

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        }).then(s => {
            stream = s;
            video.srcObject = stream;
            return video.play();
        }).then(() => {
            waitForOpenCv().then(startLoop).catch(err => {
                console.error("OpenCV load failed:", err);
                showFallback("opencv_load_failed");
            });
        }).catch(error => {
            track("ar_camera_denied", { error: String(error && error.name) });
            showFallback("camera_denied");
        });

        function startLoop() {
            const cv = window.cv;
            const procCanvas = document.createElement("canvas");
            const procCtx = procCanvas.getContext("2d", { willReadFrequently: true });

            function tick() {
                if (!video.videoWidth) { rafId = requestAnimationFrame(tick); return; }
                frameCounter++;

                if (frameCounter % DETECT_EVERY_N_FRAMES === 0) {
                    const scale = PROC_WIDTH / video.videoWidth;
                    const procH = Math.round(video.videoHeight * scale);
                    procCanvas.width = PROC_WIDTH;
                    procCanvas.height = procH;
                    procCtx.drawImage(video, 0, 0, PROC_WIDTH, procH);

                    const frame = cv.imread(procCanvas);
                    const quad = findCardQuad(cv, frame, 0.002); // Lowered area threshold to detect smaller cards or cards further away
                    frame.delete();

                    if (quad) {
                        missingFrames = 0;
                        foundFrames++;
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
                        const displayQuad = quad.map(p => ({
                            x: p.x * scaleX + offsetX,
                            y: p.y * scaleY + offsetY
                        }));
                        smoothedQuad = smoothQuad(smoothedQuad, displayQuad);
                    } else {
                        missingFrames++;
                        if (missingFrames > LOST_GRACE_FRAMES) {
                            smoothedQuad = null;
                            foundFrames = 0;
                        }
                    }

                    const shouldShowCard = smoothedQuad && foundFrames >= FOUND_CONFIRM_FRAMES;
                    if (shouldShowCard) {
                        if (!cardVisible) {
                            cardVisible = true;
                            scanningOverlay.classList.add("hidden");
                            overlayVideo.style.display = "block";
                            // Try to play with sound, fallback to muted if blocked
                            overlayVideo.muted = false;
                            overlayVideo.play().then(() => {
                                console.log("Overlay video playing with audio");
                            }).catch(err => {
                                console.warn("Audio playback blocked, trying muted:", err);
                                overlayVideo.muted = true;
                                overlayVideo.play().catch(e => {
                                    console.error("Overlay video play failed:", e);
                                });
                            });
                            // Wait for video to actually start playing before showing button
                            const checkVideoPlaying = setInterval(() => {
                                if (overlayVideo.currentTime > 0.1 || overlayVideo.readyState === 4) {
                                    clearInterval(checkVideoPlaying);
                                    if (cardVisible) uiLayer.classList.add("visible");
                                }
                            }, 50);
                            track("ar_target_found");
                        }
                    } else if (cardVisible) {
                        cardVisible = false;
                        uiLayer.classList.remove("visible");
                        scanningOverlay.classList.remove("hidden");
                        overlayVideo.style.display = "none";
                        overlayVideo.pause();
                        track("ar_target_lost");
                    }
                }

                // Cheap GPU transform update — runs every frame regardless
                // of whether detection re-ran, using the latest smoothed quad.
                if (cardVisible && smoothedQuad) {
                    // Force a small size if videoWidth is not yet available to avoid zero-size issues
                    const w = overlayVideo.videoWidth || 640;
                    const h = overlayVideo.videoHeight || 360;
                    applyPerspective(overlayVideo, smoothedQuad, w, h);
                }

                rafId = requestAnimationFrame(tick);
            }
            rafId = requestAnimationFrame(tick);
        }
    }

    // Maps the overlay video's natural rect onto the four quad points using
    // a single CSS matrix3d — composited on the GPU, no per-frame canvas work.
    function applyPerspective(videoEl, quad, w, h) {
        const H = computeHomography(
            [[0, 0], [w, 0], [w, h], [0, h]],
            [[quad[0].x, quad[0].y], [quad[1].x, quad[1].y], [quad[2].x, quad[2].y], [quad[3].x, quad[3].y]]
        );
        if (!H) return;
        // H is row-major 3x3 mapping (x,y,1) -> (x',y',w'). CSS matrix3d is
        // column-major 4x4; embed the 2D homography into it.
        const m = [
            H[0], H[3], 0, H[6],
            H[1], H[4], 0, H[7],
            0,    0,    1, 0,
            H[2], H[5], 0, H[8]
        ];
        videoEl.style.width = w + "px";
        videoEl.style.height = h + "px";
        videoEl.style.transform = `matrix3d(${m.join(",")})`;
    }

    // Solves the 8-DOF planar homography mapping src quad -> dst quad via a
    // direct linear system (no OpenCV needed for this part).
    function computeHomography(src, dst) {
        const A = [];
        const b = [];
        for (let i = 0; i < 4; i++) {
            const [x, y] = src[i];
            const [X, Y] = dst[i];
            A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
            A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
        }
        const h = solveLinearSystem(A, b);
        if (!h) return null;
        return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    }

    // Gaussian elimination with partial pivoting for an 8x8 system.
    function solveLinearSystem(A, b) {
        const n = A.length;
        const M = A.map((row, i) => row.concat([b[i]]));
        for (let col = 0; col < n; col++) {
            let pivot = col;
            for (let r = col + 1; r < n; r++) {
                if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
            }
            if (Math.abs(M[pivot][col]) < 1e-10) return null;
            [M[col], M[pivot]] = [M[pivot], M[col]];
            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const factor = M[r][col] / M[col][col];
                for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
            }
        }
        return M.map((row, i) => row[n] / row[i]);
    }

    function smoothQuad(prev, next, alpha = 0.15) { // Increased smoothing (lower alpha)
        if (!prev) return next;
        
        // Calculate total movement to detect jitter
        let totalDist = 0;
        for (let i = 0; i < 4; i++) {
            totalDist += Math.hypot(next[i].x - prev[i].x, next[i].y - prev[i].y);
        }
        
        // If movement is very small, it's likely jitter; use more smoothing
        const effectiveAlpha = totalDist < 10 ? alpha * 0.5 : alpha;
        
        return next.map((p, i) => ({
            x: prev[i].x + (p.x - prev[i].x) * effectiveAlpha,
            y: prev[i].y + (p.y - prev[i].y) * effectiveAlpha
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