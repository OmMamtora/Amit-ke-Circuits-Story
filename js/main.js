(function () {
  var team = window.CIRCUIT_TEAM;
  var propStage = document.getElementById("prop-stage");
  var revealPanel = document.getElementById("reveal-panel");
  var quickGrid = document.getElementById("quick-grid");
  var quickSection = document.getElementById("quick-connect");
  var guideList = document.getElementById("guide-list");
  var storyScenes = document.getElementById("story-scenes");

  function memberUrl(member) { return "member.html?id=" + encodeURIComponent(member.id); }
  function whatsappUrl(member) {
    return "https://wa.me/?text=" + encodeURIComponent("Hello " + member.name + ", I found you through Amit Ke Circuits and would like to discuss: " + member.problem + ".");
  }

  function buildProp(member) {
    var button = document.createElement("button");
    button.className = "prop-button";
    button.type = "button";
    button.dataset.member = member.id;
    button.setAttribute("aria-label", member.tension + " Reveal " + member.name);
    button.innerHTML = '<span class="prop-icon">' + window.propIcon(member.icon) + "</span><strong>" + member.tension + "</strong><small>Tap to connect</small>";
    button.addEventListener("click", function () { revealMember(member, button); });
    return button;
  }

  function revealMember(member, source) {
    document.querySelectorAll(".prop-button").forEach(function (button) { button.classList.toggle("active", button === source); });
    revealPanel.hidden = false;
    revealPanel.classList.remove("is-entering");
    void revealPanel.offsetWidth;
    revealPanel.classList.add("is-entering");
    var revealVisual = member.photo
      ? '<div class="reveal-character-stage reveal-profile character-' + member.id + '"><span class="stage-effect" aria-hidden="true"></span><img src="' + member.photo + '" alt="Professional portrait of ' + member.name + '"></div>'
      : '<div class="reveal-prop"><span class="prop-icon">' + window.propIcon(member.icon) + '</span><div class="member-monogram">' + member.initials + '</div></div>';
    revealPanel.innerHTML = '<div class="reveal-grid">' + revealVisual + '<div><p class="section-kicker">Circuit Found / ' + member.category + '</p><h3>' + member.name + '</h3><p class="reveal-tagline">“' + member.tagline + '”</p><p>' + member.shortIntro + '</p><p class="reveal-hint"><strong>Ideal connection:</strong> ' + member.referrals.slice(0, 2).join(" · ") + '</p><div class="button-row"><a class="button button-primary button-small" href="' + memberUrl(member) + '" data-track="member_profile_selected" data-member-id="' + member.id + '">Enter Their Story →</a><a class="button button-ghost button-small" href="' + whatsappUrl(member) + '" target="_blank" rel="noopener" data-track="whatsapp_clicked" data-member-id="' + member.id + '">WhatsApp</a><a class="text-link" href="' + member.resourceFile + '" download data-track="resource_downloaded" data-member-id="' + member.id + '">Download resource ↓</a></div></div></div>';
    window.trackCircuitEvent("prop_clicked", { member_id: member.id, problem: member.problem });
    if (window.innerWidth < 800) revealPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function buildQuickCard(member) {
    var avatar = member.photo ? '<span class="quick-avatar"><img src="' + member.photo + '" alt="" loading="lazy"></span>' : '<span class="prop-icon">' + window.propIcon(member.icon) + '</span>';
    return '<a class="quick-card" href="' + memberUrl(member) + '" data-track="member_profile_selected" data-member-id="' + member.id + '">' + avatar + '<span><strong>' + member.name + '</strong><small>' + member.problem + '</small></span><span class="quick-arrow">→</span></a>';
  }

  function buildGuideRow(member) {
    var avatar = member.photo ? '<span class="guide-avatar"><img src="' + member.photo + '" alt="" loading="lazy"></span>' : "";
    return '<a class="guide-row" href="' + memberUrl(member) + '" data-track="member_profile_selected" data-member-id="' + member.id + '">' + avatar + '<span>' + member.problem + '</span><strong>Connect with ' + member.name + '</strong><b class="quick-arrow">→</b></a>';
  }

  team.forEach(function (member) { propStage.appendChild(buildProp(member)); });
  storyScenes.innerHTML = team.filter(function (member) { return member.characterImage; }).map(function (member, index) {
    return '<button class="story-scene character-' + member.id + '" type="button" data-story-member="' + member.id + '" style="--scene-index:' + index + '"><span class="stage-effect" aria-hidden="true"></span><img src="' + member.characterImage + '" alt="Animated character representation of ' + member.name + '" loading="lazy"><span class="story-scene-copy"><small>Case file 0' + (index + 1) + '</small><strong>' + member.sceneLabel + '</strong><b>Meet ' + member.name.split(" ")[0] + ' →</b></span></button>';
  }).join("");
  quickGrid.innerHTML = team.map(buildQuickCard).join("");
  guideList.innerHTML = team.map(buildGuideRow).join("");

  document.querySelectorAll("[data-story-member]").forEach(function (scene) {
    scene.addEventListener("click", function () {
      var member = window.getCircuitMember(scene.dataset.storyMember);
      var prop = document.querySelector('[data-member="' + member.id + '"]');
      document.getElementById("journey").scrollIntoView({ behavior: "smooth" });
      window.setTimeout(function () { revealMember(member, prop); }, 450);
    });
  });

  document.querySelectorAll("[data-mode]").forEach(function (control) {
    control.addEventListener("click", function (event) {
      var mode = control.dataset.mode;
      window.trackCircuitEvent(mode === "story" ? "start_journey_clicked" : "quick_mode_clicked");
      if (mode === "quick") {
        event.preventDefault();
        quickSection.classList.add("is-open");
        quickSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  var motionToggle = document.getElementById("motion-toggle");
  motionToggle.addEventListener("click", function () {
    var paused = document.body.classList.toggle("motion-paused");
    motionToggle.setAttribute("aria-pressed", String(paused));
    motionToggle.textContent = paused ? "Resume motion" : "Pause motion";
  });

  document.getElementById("refer-whatsapp").href = window.CIRCUIT_CONTACTS.referWhatsapp;
  document.getElementById("team-whatsapp").href = window.CIRCUIT_CONTACTS.teamWhatsapp;
  document.getElementById("sticky-whatsapp").href = window.CIRCUIT_CONTACTS.teamWhatsapp;
  document.getElementById("year").textContent = new Date().getFullYear();
})();
