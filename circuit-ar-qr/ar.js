// ─────────────────────────────────────────────────────────────────────────
// Circuit AR — standalone QR-scanner build
//
// This page does NOT know about Amit, Prachi, or anyone else. Its only job
// is: scan a QR code → read the URL it contains → go there. Each physical
// coaster's QR already encodes the destination (e.g.
// ".../member.html?id=prachi&source=qr" on the Amit Ke Circuits site), so
// this scanner works for all members automatically with zero hardcoded
// mapping. That's what keeps it genuinely standalone.
// ─────────────────────────────────────────────────────────────────────────


const params = new URLSearchParams(window.location.search);

const MEMBER_ID = params.get("id") || "amit";

const member = window.CIRCUIT_TEAM.find(m => m.id === MEMBER_ID);

console.log(member);

const CONFIG = {
    // How long to show the "found" checkmark before redirecting.
    REDIRECT_DELAY_MS: 900,

    // If set, only URLs on these hostnames will be auto-redirected to —
    // anything else is shown but NOT auto-opened, as a safety guard against
    // a damaged/spoofed QR code. Leave empty [] to allow any https URL.
    // Example: ["amitkecircuits.example.com"]
    ALLOWED_HOSTS: [],

    // "same" = navigate this tab to the scanned URL (feels like walking
    // through a portal). "new" = open a new tab and keep the scanner open.
    OPEN_MODE: "same",
};

document.addEventListener("DOMContentLoaded", () => {
    const activateBtn = document.getElementById("ar-activate-btn");
    const activateScreen = document.getElementById("ar-activate");
    const arStage = document.getElementById("ar-stage");
    const fallbackScreen = document.getElementById("ar-fallback");
    const fallbackMessage = document.getElementById("fallback-message");
    const retryBtn = document.getElementById("ar-retry-btn");
    const backBtn = document.getElementById("ar-back-btn");
    const statusText = document.getElementById("ar-status");
    const scanningOverlay = document.getElementById("scanning-overlay");
    const foundLayer = document.getElementById("found-layer");
    const foundLabel = document.getElementById("found-label");

    let html5QrCode = null;
    let stopping = false;

    function track(name, details) {
        console.log("[circuit-ar]", name, details || {});
    }

    function showFallback(reason, message) {
        track("ar_fallback_shown", { reason });
        fallbackMessage.textContent = message || "Camera or scanner didn't load. Try again.";
        stopScanner().finally(() => {
            arStage.hidden = true;
            activateScreen.hidden = true;
            fallbackScreen.hidden = false;
        });
    }

    function stopScanner() {
        if (!html5QrCode || stopping) return Promise.resolve();
        stopping = true;
        return html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(() => {}).finally(() => { stopping = false; });
    }

    // Extracts a human-friendly name from a scanned member URL, if possible,
    // purely for the on-screen "X found!" message — has no effect on where
    // we navigate.
    function guessNameFromUrl(url) {
        try {
            const u = new URL(url);
            const id = u.searchParams.get("id");
            if (id) return id.charAt(0).toUpperCase() + id.slice(1);
        } catch (e) { /* not a valid URL, ignore */ }
        return null;
    }

    function isUrlAllowed(url) {
        if (!CONFIG.ALLOWED_HOSTS.length) return true;
        try {
            const u = new URL(url);
            return CONFIG.ALLOWED_HOSTS.includes(u.hostname);
        } catch (e) {
            return false;
        }
    }

    function onScanSuccess(decodedText) {
        if (stopping) return; // ignore duplicate fires while we're shutting down
        track("ar_qr_scanned", { value: decodedText });

        let isUrl = false;
        try { new URL(decodedText); isUrl = true; } catch (e) { isUrl = false; }

        const name = isUrl ? guessNameFromUrl(decodedText) : null;
        foundLabel.textContent = name
            ? `${name} found — opening profile…`
            : (isUrl ? "Coaster found — opening…" : "QR scanned.");

        scanningOverlay.style.display = "none";
        foundLayer.classList.add("visible");

        stopScanner().then(() => {
            if (!isUrl) {
                // Not a URL — nothing to navigate to. Show the raw value so
                // it's at least visible/debuggable instead of failing silently.
                foundLabel.textContent = "Scanned: " + decodedText;
                track("ar_qr_not_a_url", { value: decodedText });
                return;
            }
            if (!isUrlAllowed(decodedText)) {
                foundLabel.textContent = "This QR points outside the allowed site — not opening automatically.";
                track("ar_qr_blocked_host", { value: decodedText });
                return;
            }
            track("ar_qr_redirect", { url: decodedText });
            setTimeout(() => {
                if (CONFIG.OPEN_MODE === "new") {
                    window.open(decodedText, "_blank", "noopener");
                    // Reset back to the activate screen so they can scan again.
                    foundLayer.classList.remove("visible");
                    arStage.hidden = true;
                    activateScreen.hidden = false;
                } else {
                    window.location.href = decodedText;
                }
            }, CONFIG.REDIRECT_DELAY_MS);
        });
    }

    function onScanFailure() {
        // Fires continuously while no QR is in view — expected, ignore.
    }

    function startScanner() {
        foundLayer.classList.remove("visible");
        scanningOverlay.style.display = "flex";

        html5QrCode = new Html5Qrcode("qr-reader", { verbose: false });
        const config = {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.65);
                return { width: size, height: size };
            },
            aspectRatio: window.innerHeight / window.innerWidth,
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            track("ar_camera_denied", { error: String(err) });
            showFallback("camera_denied", "Camera access was denied or unavailable. Allow camera permission and try again.");
        });
    }

    if (activateBtn) {
        activateBtn.addEventListener("click", () => {
            track("ar_activate_tap");
            statusText.innerText = "Requesting camera access…";

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showFallback("getUserMedia_unsupported", "Your browser doesn't support camera access. Try Chrome or Safari.");
                return;
            }
            if (typeof Html5Qrcode === "undefined") {
                showFallback("library_load_failed", "The scanner library failed to load. Check your connection and try again.");
                return;
            }

            activateScreen.hidden = true;
            arStage.hidden = false;
            startScanner();
        });
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            track("ar_scan_cancelled");
            stopScanner().finally(() => {
                arStage.hidden = true;
                activateScreen.hidden = false;
            });
        });
    }

    if (retryBtn) {
        retryBtn.addEventListener("click", () => {
            fallbackScreen.hidden = true;
            activateScreen.hidden = false;
        });
    }
});
