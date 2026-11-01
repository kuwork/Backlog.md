/* Backlog.md product site — interactions
   Motion rule: only transform and opacity animate. Scroll work goes through
   IntersectionObserver or a rAF loop, never a raw scroll listener. */

(function () {
	"use strict";

	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* ---------- mobile navigation ---------- */

	var toggle = document.querySelector("[data-nav-toggle]");
	var menu = document.querySelector("[data-mobile-menu]");

	if (toggle && menu) {
		var menuLinks = Array.prototype.slice.call(menu.querySelectorAll("a"));
		var step = Math.min(60, Math.max(20, Math.floor(400 / Math.max(menuLinks.length, 1))));
		menuLinks.forEach(function (link, i) {
			link.style.transitionDelay = i * step + "ms";
		});

		var setMenu = function (open) {
			toggle.setAttribute("aria-expanded", open ? "true" : "false");
			document.body.style.overflow = open ? "hidden" : "";
			if (open) {
				menu.classList.add("is-open");
				requestAnimationFrame(function () {
					menu.classList.add("is-entered");
				});
			} else {
				menu.classList.remove("is-entered");
				window.setTimeout(function () {
					if (!menu.classList.contains("is-entered")) menu.classList.remove("is-open");
				}, reduceMotion ? 0 : 400);
			}
		};

		toggle.addEventListener("click", function () {
			setMenu(toggle.getAttribute("aria-expanded") !== "true");
		});

		menuLinks.forEach(function (link) {
			link.addEventListener("click", function () {
				setMenu(false);
			});
		});

		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape" && menu.classList.contains("is-open")) {
				setMenu(false);
				toggle.focus();
			}
		});
	}

	/* ---------- scroll reveal ---------- */

	var revealTargets = document.querySelectorAll("[data-reveal]");

	if (reduceMotion || !("IntersectionObserver" in window)) {
		revealTargets.forEach(function (el) {
			el.classList.add("is-visible");
		});
	} else {
		var revealObserver = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) return;
					entry.target.classList.add("is-visible");
					revealObserver.unobserve(entry.target);
				});
			},
			{ rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
		);
		revealTargets.forEach(function (el) {
			revealObserver.observe(el);
		});
	}

	/* ---------- tagline word reveal ---------- */

	var words = Array.prototype.slice.call(document.querySelectorAll("[data-word]"));

	if (words.length) {
		if (reduceMotion || !("IntersectionObserver" in window)) {
			words.forEach(function (word) {
				word.classList.add("is-lit");
			});
		} else {
			var pending = [];
			var lastLit = -1;
			var nextAllowed = 0;

			var drain = function (now) {
				if (pending.length && now >= nextAllowed) {
					pending.sort(function (a, b) {
						return a.index - b.index;
					});
					var word = pending.shift();
					word.el.classList.add("is-lit");
					lastLit = word.index;
					nextAllowed = now + 55;
				}
				if (pending.length || lastLit < words.length - 1) requestAnimationFrame(drain);
			};

			var wordObserver = new IntersectionObserver(
				function (entries) {
					entries.forEach(function (entry) {
						if (!entry.isIntersecting) return;
						pending.push({ index: Number(entry.target.dataset.word), el: entry.target });
						wordObserver.unobserve(entry.target);
					});
				},
				{ rootMargin: "0px 0px -28% 0px", threshold: 0 },
			);

			words.forEach(function (word) {
				wordObserver.observe(word);
			});
			requestAnimationFrame(drain);
		}
	}

	/* ---------- faq accordion ---------- */

	document.querySelectorAll("[data-faq-q]").forEach(function (button) {
		var panel = document.getElementById(button.getAttribute("aria-controls"));
		if (!panel) return;

		button.addEventListener("click", function () {
			var open = button.getAttribute("aria-expanded") === "true";

			if (open) {
				button.setAttribute("aria-expanded", "false");
				panel.classList.remove("is-entered");
				window.setTimeout(function () {
					if (button.getAttribute("aria-expanded") === "false") panel.classList.remove("is-open");
				}, reduceMotion ? 0 : 400);
				return;
			}

			button.setAttribute("aria-expanded", "true");
			panel.classList.add("is-open");
			requestAnimationFrame(function () {
				panel.classList.add("is-entered");
			});
		});
	});

	/* ---------- copy install command ---------- */

	function flash(state, message) {
		if (!state) return;
		state.textContent = message;
		state.classList.add("is-shown");
		window.setTimeout(function () {
			state.classList.remove("is-shown");
		}, 2400);
	}

	function legacyCopy(text) {
		var area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		var ok = false;
		try {
			ok = document.execCommand("copy");
		} catch (error) {
			ok = false;
		}
		document.body.removeChild(area);
		return ok;
	}

	document.querySelectorAll("[data-copy]").forEach(function (button) {
		button.addEventListener("click", function () {
			var target = document.querySelector(button.dataset.copy);
			var state = document.querySelector("[data-copy-state]");
			if (!target) return;
			var text = (target.dataset.copyValue || target.textContent).trim();

			if (navigator.clipboard && window.isSecureContext) {
				navigator.clipboard.writeText(text).then(
					function () {
						flash(state, button.dataset.copiedLabel || "Copied");
					},
					function () {
						flash(state, legacyCopy(text) ? button.dataset.copiedLabel || "Copied" : button.dataset.failedLabel || "Copy failed");
					},
				);
				return;
			}

			flash(state, legacyCopy(text) ? button.dataset.copiedLabel || "Copied" : button.dataset.failedLabel || "Copy failed");
		});
	});

	/* ---------- footer year ---------- */

	var year = document.querySelector("[data-year]");
	if (year) year.textContent = String(new Date().getFullYear());
})();
