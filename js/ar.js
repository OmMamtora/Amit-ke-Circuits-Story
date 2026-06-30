(function () {
  "use strict";

  // ---- Config ---------------------------------------------------------
  var AFRAME_SRC = "https://aframe.io/releases/1.4.2/aframe.min.js";
  var ARJS_SRC = "https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/aframe/build/aframe-ar.js";
  var FALLBACK_TEXT = "Camera ya AR load nahi hua? Koi tension nahi. Amit Ke Circuits microsite yahin se open karo.";
  var MICROSITE_URL = "index.html#journey";
  var MEMBER_ICONS = [
    { id: "amit", img: "assets/images/amit-profile.png" },
    { id: "prachi", img: "assets/images/prachi-profile.png" },
    { id: "sopan", img: "assets/images/sopan-profile.png" },
    { id: "shikha", img: "assets/images/shikha-profile.png" },
    { id: "tejaswini", img: "assets/images/tejaswini-profile-v2.png" },
    { id: "prashant", img: "assets/images/prashant-profile.png" },
    { id: "shubham", img: "assets/images/shubham-profile.png" }
  ];

  function track(name, details) {
    if (typeof window.trackCircuitEvent === "function") window.trackCircuitEvent(name, details || {});
  }

  document.addEventListener("DOMContentLoaded", function () {
    var activateScreen = document.getElementById("ar-activate");
    var stage = document.getElementById("ar-stage");
    var fallback = document.getElementById("ar-fallback");
    var activateBtn = document.getElementById("ar-activate-btn");
    var statusEl = document.getElementById("ar-status");
    var openMicrositeBtns = document.querySelectorAll("[data-ar-open-microsite]");

    if (!activateScreen || !stage || !fallback || !activateBtn) return; // markup missing, nothing to wire up

    openMicrositeBtns.forEach(function (btn) {
      btn.setAttribute("href", MICROSITE_URL);
    });

    function showFallback(reason) {
      track("ar_fallback_shown", { reason: reason });
      activateScreen.hidden = true;
      stage.hidden = true;
      fallback.hidden = false;
    }

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || "";
    }

    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[src="' + src + '"]');
        if (existing) { resolve(); return; }
        var s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error("script_load_failed:" + src)); };
        document.body.appendChild(s);
      });
    }

    function buildIconOrbit() {
      var wrap = document.createElement("div");
      wrap.className = "ar-icon-orbit";
      MEMBER_ICONS.forEach(function (member) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", "Meet " + member.id);
        btn.dataset.memberId = member.id;
        var img = document.createElement("img");
        img.src = member.img;
        img.alt = member.id;
        img.loading = "lazy";
        btn.appendChild(img);
        btn.addEventListener("click", function () {
          track("ar_member_icon_tap", { member_id: member.id });
          window.location.href = "member.html?id=" + encodeURIComponent(member.id);
        });
        wrap.appendChild(btn);
      });
      return wrap;
    }

    function buildOverlay() {
      var overlay = document.createElement("div");
      overlay.className = "ar-overlay";
      overlay.id = "ar-overlay";
      overlay.innerHTML =
        '<div class="ar-overlay-card">' +
          '<div class="ar-glow-ring" aria-hidden="true"><span>⚡</span></div>' +
          '<h2 class="ar-overlay-title">Amit Ke <span>Circuits</span> ⚡</h2>' +
          '<p class="ar-overlay-tagline">Tension koi bhi ho&hellip; connect karne ka!</p>' +
        '</div>';
      var card = overlay.querySelector(".ar-overlay-card");
      card.appendChild(buildIconOrbit());
      var cta = document.createElement("a");
      cta.className = "button button-primary";
      cta.href = "#";
      cta.textContent = "Meet the Circuits";
      cta.dataset.track = "ar_cta_meet_circuits";
      cta.addEventListener("click", function (event) {
        event.preventDefault();
        track("ar_cta_click", {});
        window.location.href = MICROSITE_URL;
      });
      card.appendChild(cta);
      return overlay;
    }

    function mountArScene() {
      stage.innerHTML =
        '<div class="ar-hud-top">' +
          '<a class="brand" href="index.html" aria-label="Amit Ke Circuits home"><span class="brand-bolt">⚡</span><span>Amit Ke <strong>Circuits</strong></span></a>' +
          '<button class="ar-exit" type="button" id="ar-exit-btn">Exit AR ✕</button>' +
        '</div>' +
        '<div class="ar-hint" id="ar-hint">Point the camera at the printed Circuit AR Badge</div>' +
        '<a-scene embedded vr-mode-ui="enabled: false" renderer="logarithmicDepthBuffer: true; alpha: true"' +
        ' arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3; trackingMethod: best;">' +
          '<a-marker preset="hiro" id="circuit-ar-marker" smooth="true" smoothCount="10" smoothTolerance="0.01" smoothThreshold="5"></a-marker>' +
          '<a-entity camera></a-entity>' +
        '</a-scene>';

      var overlay = buildOverlay();
      stage.appendChild(overlay);

      document.getElementById("ar-exit-btn").addEventListener("click", function () {
        track("ar_exit", {});
        stage.hidden = true;
        stage.innerHTML = "";
        activateScreen.hidden = false;
        setStatus("");
      });

      var marker = document.getElementById("circuit-ar-marker");
      var hint = document.getElementById("ar-hint");
      marker.addEventListener("markerFound", function () {
        track("ar_marker_found", {});
        overlay.classList.add("is-visible");
        if (hint) hint.classList.add("is-hidden");
      });
      marker.addEventListener("markerLost", function () {
        track("ar_marker_lost", {});
        overlay.classList.remove("is-visible");
        if (hint) hint.classList.remove("is-hidden");
      });
    }

    function startAr() {
      setStatus("Camera load ho rahi hai…");
      track("ar_activate_tap", {});

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showFallback("getUserMedia_unsupported");
        return;
      }

      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function (stream) {
          // Permission confirmed — release this test stream, AR.js will open its own.
          stream.getTracks().forEach(function (track) { track.stop(); });
          track("ar_camera_granted", {});
          setStatus("AR engine load ho raha hai…");

          loadScript(AFRAME_SRC)
            .then(function () { return loadScript(ARJS_SRC); })
            .then(function () {
              activateScreen.hidden = true;
              stage.hidden = false;
              mountArScene();
            })
            .catch(function () { showFallback("ar_library_failed"); });
        })
        .catch(function (error) {
          track("ar_camera_denied", { error: String(error && error.name) });
          showFallback("camera_denied");
        });
    }

    activateBtn.addEventListener("click", startAr);
  });
})();
