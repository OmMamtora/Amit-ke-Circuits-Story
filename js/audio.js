(function () {
  var audioPath = "assets/audio/munna-bhai-theme.mp3";
  var storageKey = "akc_music_state";
  var savedState = window.localStorage.getItem(storageKey) || "off";
  var audio = document.createElement("audio");
  var toggle = document.createElement("button");
  var hasTriedLoading = false;

  audio.src = audioPath;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.38;
  audio.muted = savedState !== "on";
  audio.setAttribute("aria-hidden", "true");

  toggle.type = "button";
  toggle.className = "music-toggle";
  toggle.setAttribute("aria-pressed", savedState === "on" ? "true" : "false");

  function setLabel(state, note) {
    var labels = {
      on: "Mute music",
      off: "Play music",
      missing: "Add music file"
    };
    toggle.textContent = note || labels[state] || labels.off;
    toggle.dataset.musicState = state;
  }

  function remember(state) {
    window.localStorage.setItem(storageKey, state);
    toggle.setAttribute("aria-pressed", state === "on" ? "true" : "false");
  }

  function trackAudioEvent(name, data) {
    if (window.trackCircuitEvent) window.trackCircuitEvent(name, data);
  }

  function reportMissing() {
    remember("off");
    setLabel("missing");
    toggle.title = "Add your licensed MP3 at " + audioPath;
  }

  function playMusic() {
    hasTriedLoading = true;
    audio.muted = false;
    audio.play().then(function () {
      remember("on");
      setLabel("on");
      trackAudioEvent("background_music_played", { track: "munna_bhai_theme" });
    }).catch(function () {
      remember("off");
      setLabel("off", "Tap to play music");
    });
  }

  function muteMusic() {
    audio.muted = true;
    audio.pause();
    remember("off");
    setLabel("off");
    trackAudioEvent("background_music_muted", { track: "munna_bhai_theme" });
  }

  audio.addEventListener("error", function () {
    if (hasTriedLoading) reportMissing();
  });

  toggle.addEventListener("click", function () {
    if (toggle.dataset.musicState === "missing") {
      reportMissing();
      return;
    }
    if (audio.paused || audio.muted) playMusic();
    else muteMusic();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && !audio.muted) audio.pause();
    if (!document.hidden && window.localStorage.getItem(storageKey) === "on") playMusic();
  });

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(audio);
    document.body.appendChild(toggle);
    setLabel(savedState === "on" ? "off" : "off");
  });
})();
