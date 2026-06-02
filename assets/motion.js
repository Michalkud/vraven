/* ============================================================================
   VRAVEN — scroll choreography (full site only).
   GSAP + ScrollTrigger + SplitText + Lenis, all loaded as UMD globals before
   this file. Fully optional: if libraries are missing or the user prefers
   reduced motion, everything stays in its default (visible, static) state.
   ============================================================================ */
(function () {
  "use strict";

  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = window.gsap && window.ScrollTrigger;
  if (REDUCE || !hasGSAP) return;   // [data-reveal] are visible by default

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = !!window.SplitText;
  if (hasSplit) gsap.registerPlugin(SplitText);

  /* ---- Lenis smooth scroll, wired to ScrollTrigger ---------------------- */
  if (window.Lenis) {
    var lenis = new Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 0.9 });
    window.VRAVEN = window.VRAVEN || {}; window.VRAVEN.lenis = lenis;   // exposed for control/testing
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    // honour in-page anchor clicks through Lenis
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault(); lenis.scrollTo(id, { offset: 0 });
        }
      });
    });
  }

  /* ---- Generic section reveals ----------------------------------------- */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.set(el, { y: 30, opacity: 0 });
    ScrollTrigger.create({
      trigger: el, start: "top 86%", once: true,
      onEnter: function () { gsap.to(el, { y: 0, opacity: 1, duration: 0.95, ease: "power3.out" }); }
    });
  });

  /* ---- Kinetic statement (word-by-word) — split AFTER fonts settle so the
     measurement is correct (avoids the SplitText "fonts not loaded" warning). */
  function initSplit() {
    var stmt = document.querySelector("[data-split]");
    if (!stmt || !hasSplit) return;
    var split = new SplitText(stmt, { type: "words,lines", linesClass: "split-line" });
    gsap.set(split.words, { yPercent: 115, opacity: 0 });
    ScrollTrigger.create({
      trigger: stmt, start: "top 72%", once: true,
      onEnter: function () {
        gsap.to(split.words, { yPercent: 0, opacity: 1, duration: 0.85, ease: "power3.out", stagger: 0.025 });
      }
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initSplit);
  else initSplit();

  /* ---- Hero handoff: lift + fade the wordmark as you scroll past -------- */
  var heroContent = document.querySelector(".hero-content");
  if (heroContent) {
    gsap.to(heroContent, {
      yPercent: -16, opacity: 0, ease: "none",
      scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
    });
  }
  var scrollCue = document.querySelector(".scroll-cue");
  if (scrollCue) {
    gsap.to(scrollCue, { opacity: 0, ease: "none",
      scrollTrigger: { trigger: "#hero", start: "top top", end: "20% top", scrub: true } });
  }

  /* ---- Slim header reveals after the hero ------------------------------ */
  var header = document.querySelector(".site-header");
  if (header) {
    ScrollTrigger.create({
      trigger: "#hero", start: "bottom 70%",
      onEnter: function () { header.classList.add("show"); },
      onLeaveBack: function () { header.classList.remove("show"); }
    });
  }

  /* ---- Magnetic CTA ----------------------------------------------------- */
  document.querySelectorAll("[data-magnetic]").forEach(function (el) {
    var strength = 0.3;
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * strength,
                    y: (e.clientY - (r.top + r.height / 2)) * strength,
                    duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", function () {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    });
  });

  /* refresh once webfonts have settled so triggers measure correctly */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
