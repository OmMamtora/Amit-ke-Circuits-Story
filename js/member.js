(function () {
  var id = new URLSearchParams(window.location.search).get("id") || "amit";
  var member = window.getCircuitMember(id);
  var main = document.getElementById("member-main");
  var sticky = document.getElementById("member-sticky");

  if (!member) {
    main.innerHTML = '<section class="error-state"><div><p class="section-kicker">Circuit not found</p><h1>Wrong wire.<br><span>Easy fix.</span></h1><p>That member link does not exist.</p><a class="button button-primary" href="index.html#journey">Meet the team</a></div></section>';
    sticky.hidden = true;
    return;
  }

  var whatsapp = "https://wa.me/?text=" + encodeURIComponent("Hello " + member.name + ", I found you through Amit Ke Circuits and would like to discuss: " + member.problem + ".");
  var email = "mailto:?subject=" + encodeURIComponent("Referral for " + member.name) + "&body=" + encodeURIComponent("Hello, I found " + member.name + " through Amit Ke Circuits.");
  document.title = member.name + " | Amit Ke Circuits";

  var portrait = member.photo
    ? '<img src="' + member.photo + '" alt="' + member.name + '" loading="lazy">'
    : '<div class="member-monogram">' + member.initials + '</div>';
  var portraitLabel = member.photo ? member.name : "Member photo coming soon";
  var video = member.videoUrl
    ? '<video controls muted playsinline preload="metadata" poster="' + (member.videoPoster || member.photo || "") + '"><source src="' + member.videoUrl + '" type="video/mp4">Your browser does not support embedded video.</video>'
    : '<div class="play-placeholder"><span class="play-circle">▶</span><span>30–45 sec member video<br><small>Media placeholder</small></span></div>';
  var entryClass = member.characterImage ? "member-entry has-character character-" + member.id : (member.photo ? "member-entry has-character has-profile" : "member-entry");
  var entryVisual = member.characterImage || member.photo;
  var entryCharacter = entryVisual ? '<div class="entry-character-wrap"><span class="stage-effect" aria-hidden="true"></span><img class="entry-character" src="' + entryVisual + '" alt="' + (member.characterImage ? "Animated character representation of " : "Professional portrait of ") + member.name + '">' + (member.categoryProp ? '<img class="entry-category-prop" src="' + member.categoryProp + '" alt="' + member.prop + '">' : "") + '</div>' : "";
  var danceCard = member.danceCard || "";
  var phone = member.phone || "";
  var steps = ["problem", "solution", "referral", "resource", "contact"];
  var stepLabels = { problem: "Problem Prop", solution: "Solution Prop", referral: "Referral Prop", resource: "Resource Prop", contact: "Contact Prop" };

  function stepIcon(type) {
    var icons = {
      problem: '<svg viewBox="0 0 48 48"><path d="M24 5 44 41H4z"/><path d="M24 17v11m0 6v1"/></svg>',
      solution: '<svg viewBox="0 0 48 48"><path d="M9 33h7V22H9zm12 0h7V15h-7zm12 0h7V9h-7z"/><path d="m8 14 10-5 8 3 13-8"/></svg>',
      referral: '<svg viewBox="0 0 48 48"><circle cx="9" cy="24" r="5"/><circle cx="39" cy="11" r="5"/><circle cx="39" cy="37" r="5"/><path d="M14 23 34 13M14 26l20 9"/></svg>',
      resource: '<svg viewBox="0 0 48 48"><path d="M12 5h17l8 8v30H12z"/><path d="M29 5v9h8M18 24h13M18 31h13"/></svg>',
      contact: '<svg viewBox="0 0 48 48"><path d="M12 6h24v36H12z"/><path d="M19 12h10M21 35h6"/><path d="m5 20 6-3m32 3-6-3M5 29l6 3m32-3-6 3"/></svg>'
    };
    return icons[type];
  }

  function stepButtons() {
    return steps.map(function (type, index) {
      return '<button class="prop-step' + (index === 0 ? " active" : "") + '" type="button" data-step="' + type + '"><span class="prop-step-number">0' + (index + 1) + '</span><span class="prop-step-icon">' + stepIcon(type) + '</span><strong>' + stepLabels[type] + '</strong></button>';
    }).join("");
  }

  function list(items) { return "<ul>" + items.map(function (item) { return "<li>" + item + "</li>"; }).join("") + "</ul>"; }
  function disabledButton(label) { return '<span class="button button-ghost" aria-disabled="true" title="Contact detail pending">' + label + ' · Soon</span>'; }

  main.innerHTML =
    '<section class="' + entryClass + '">' + entryCharacter + '<div class="entry-content"><span class="prop-icon">' + window.propIcon(member.icon) + '</span><p class="section-kicker">' + member.prop + ' / Circuit activated</p><h1>' + member.name + '</h1><p class="category">' + member.category + '</p><p class="tagline">“' + member.tagline + '”</p></div></section>' +
    '<section class="member-hero section"><div class="portrait-card" data-label="' + portraitLabel + '">' + portrait + '</div><div class="member-copy"><p class="section-kicker">The Specialist</p><h2>' + member.category + '</h2><p class="promise">' + member.promise + '</p><p class="tagline">' + member.tagline + '</p><div class="button-row"><a class="button button-primary" href="' + whatsapp + '" target="_blank" rel="noopener" data-track="whatsapp_clicked">WhatsApp</a>' + (phone ? '<a class="button button-ghost" href="tel:' + phone + '" data-track="call_clicked">Call</a>' : disabledButton("Call")) + (danceCard ? '<a class="button button-ghost" href="' + danceCard + '" target="_blank" rel="noopener" data-track="dance_card_clicked">DANCE Card</a>' : disabledButton("DANCE Card")) + '</div></div></section>' +
    '<section class="section"><div class="section-heading"><div><p class="section-kicker">Meet ' + member.name.split(" ")[0] + '</p><h2>One minute.<br><span>Full clarity.</span></h2></div><p>A short introduction video, loaded only when needed and never auto-played with sound.</p></div><div class="video-shell">' + video + '</div></section>' +
    '<section class="section prop-journey-section"><p class="section-kicker">Tap To Explore</p><h2>Five props.<br><span>One clear story.</span></h2><div class="prop-journey" id="prop-journey"><div class="prop-stepper">' + stepButtons() + '</div><div class="prop-story-stage character-' + member.id + '" id="prop-story-stage" data-step="problem"><div class="prop-story-visual"><span class="prop-story-signal" aria-hidden="true"></span>' + (member.categoryProp ? '<img src="' + member.categoryProp + '" alt="' + member.prop + '">' : '<span class="prop-icon">' + window.propIcon(member.icon) + '</span>') + '</div><div class="prop-story-copy"><p class="section-kicker" id="prop-step-label">Step 01 / Problem Prop</p><h3 id="prop-story-title"></h3><p id="prop-story-body"></p><div class="prop-story-actions" id="prop-story-actions"></div><button class="button button-primary button-small" type="button" id="next-prop-step">Next Circuit →</button></div></div></div></section>' +
    '<section class="section"><div class="section-heading"><div><p class="section-kicker">What I Do</p><h2>Simple words.<br><span>Serious work.</span></h2></div><p>' + member.shortIntro + '</p></div></section>' +
    '<section class="section"><p class="section-kicker">Ideal Referral Ask</p><h2>Please connect me<br><span>with these people.</span></h2><div class="content-card good">' + list(member.referrals) + '</div></section>' +
    '<section class="section"><div class="content-split"><article class="content-card good"><p class="section-kicker">Green Signal</p><h3>Best referrals</h3>' + list(member.rightReferrals) + '</article><article class="content-card"><p class="section-kicker">Wrong Circuit</p><h3>Not ideal</h3>' + list(member.notIdeal) + '</article></div></section>' +
    '<section class="section"><div class="download-card"><div><p class="section-kicker">Free Resource</p><h2>' + member.resourceTitle + '</h2><p>A practical starter guide from ' + member.name + '.</p></div><a class="button" href="' + member.resourceFile + '" download data-track="resource_downloaded">Download PDF ↓</a></div></section>' +
    '<section class="section"><p class="section-kicker">Trust / Proof</p><h2>Work that<br><span>speaks clearly.</span></h2><div class="proof-row">' + member.proof.map(function (item) { return '<div class="proof-item">' + item + '</div>'; }).join("") + '</div></section>' +
    '<section class="final-cta section"><p class="section-kicker">Make The Connection</p><h2>Right referral?<br><span>Switch it on.</span></h2><div class="hero-actions"><a class="button button-primary" href="' + whatsapp + '" target="_blank" rel="noopener" data-track="whatsapp_clicked">WhatsApp ' + member.name.split(" ")[0] + '</a><a class="button button-ghost" href="' + email + '" data-track="email_clicked">Email intro</a><a class="button button-ghost" href="index.html#journey">Back to team</a></div></section>';

  var activeStep = 0;
  var stage = document.getElementById("prop-story-stage");
  var storyTitle = document.getElementById("prop-story-title");
  var storyBody = document.getElementById("prop-story-body");
  var stepLabel = document.getElementById("prop-step-label");
  var storyActions = document.getElementById("prop-story-actions");
  var nextStep = document.getElementById("next-prop-step");

  function renderStep(index) {
    activeStep = index;
    var type = steps[index];
    var story = member.propStory[type];
    stage.dataset.step = type;
    stepLabel.textContent = "Step 0" + (index + 1) + " / " + stepLabels[type];
    storyTitle.textContent = story[0];
    storyBody.textContent = story[1];
    storyActions.innerHTML = "";
    if (type === "resource") storyActions.innerHTML = '<a class="button button-ghost button-small" href="' + member.resourceFile + '" download data-track="resource_downloaded">Download ' + member.resourceTitle + ' ↓</a>';
    if (type === "contact") storyActions.innerHTML = '<a class="button button-primary button-small" href="' + whatsapp + '" target="_blank" rel="noopener" data-track="whatsapp_clicked">WhatsApp</a>' + (phone ? '<a class="button button-ghost button-small" href="tel:' + phone + '" data-track="call_clicked">Call</a>' : disabledButton("Call")) + (danceCard ? '<a class="button button-ghost button-small" href="' + danceCard + '" target="_blank" rel="noopener" data-track="dance_card_clicked">DANCE Card</a>' : disabledButton("DANCE Card"));
    document.querySelectorAll(".prop-step").forEach(function (button, buttonIndex) {
      button.classList.toggle("active", buttonIndex === index);
      button.classList.toggle("completed", buttonIndex < index);
    });
    nextStep.textContent = index === steps.length - 1 ? "Circuit complete ✓" : "Next Circuit →";
    nextStep.disabled = index === steps.length - 1;
    window.trackCircuitEvent("member_prop_step_viewed", { member_id: member.id, step: type });
  }

  document.querySelectorAll(".prop-step").forEach(function (button, index) {
    button.addEventListener("click", function () { renderStep(index); });
  });
  nextStep.addEventListener("click", function () { if (activeStep < steps.length - 1) renderStep(activeStep + 1); });
  renderStep(0);

  sticky.innerHTML = (phone ? '<a href="tel:' + phone + '" data-track="call_clicked"><span>☎</span>Call</a>' : '<a aria-disabled="true"><span>☎</span>Call soon</a>') + '<a href="' + whatsapp + '" target="_blank" rel="noopener" data-track="whatsapp_clicked"><span>◉</span>WhatsApp</a>' + (danceCard ? '<a href="' + danceCard + '" target="_blank" rel="noopener" data-track="dance_card_clicked"><span>↗</span>DANCE</a>' : '<a aria-disabled="true"><span>↗</span>DANCE soon</a>');
  window.trackCircuitEvent("member_profile_opened", { member_id: member.id });
})();
