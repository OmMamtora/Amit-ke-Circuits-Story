(function () {
  window.dataLayer = window.dataLayer || [];

  if (window.CIRCUIT_GA_ID) {
    var gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(window.CIRCUIT_GA_ID);
    document.head.appendChild(gaScript);
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", window.CIRCUIT_GA_ID);
  }

  window.trackCircuitEvent = function (eventName, details) {
    var payload = Object.assign({
      event: eventName,
      page_path: window.location.pathname,
      timestamp: new Date().toISOString()
    }, details || {});

    window.dataLayer.push(payload);
    if (typeof window.gtag === "function") window.gtag("event", eventName, details || {});
    try {
      var history = JSON.parse(sessionStorage.getItem("circuitEvents") || "[]");
      history.push(payload);
      sessionStorage.setItem("circuitEvents", JSON.stringify(history.slice(-50)));
    } catch (error) {
      // Analytics must never block the visitor journey.
    }
  };

  window.addEventListener("DOMContentLoaded", function () {
    var params = new URLSearchParams(window.location.search);
    var memberId = params.get("id") || undefined;
    window.trackCircuitEvent("circuit_page_view", { title: document.title, member_id: memberId });
    if (params.get("source") === "qr" || params.get("utm_source") === "qr") {
      window.trackCircuitEvent("qr_landing_visit", { title: document.title });
    }
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-track]");
      if (target) window.trackCircuitEvent(target.dataset.track, {
        label: target.textContent.trim(),
        member_id: target.dataset.memberId || memberId
      });
    });
  });
})();
