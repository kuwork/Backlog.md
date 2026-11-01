/* Backlog.md site — v2 interactions
   Boot sequence, character rise, canvas graph field, 3D tilt, cursor glow,
   scroll progress, count up, magnetic buttons.
   All scroll work runs through one rAF loop, never a raw scroll listener. */

(function () {
	"use strict";

	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	/* ---------- boot sequence ---------- */

	var boot = document.querySelector("[data-boot]");
	var bootText = boot && boot.querySelector("[data-boot-text]");
	var bootSkip = document.querySelector("[data-boot-skip]");
	var heroInner = document.querySelector("[data-hero-inner]");

	function revealHero() {
		if (heroInner) heroInner.classList.add("is-typed");
	}

	function endBoot() {
		if (!boot || boot.classList.contains("is-done")) return;
		boot.classList.add("is-done");
		document.body.classList.remove("is-booting");
		revealHero();
		if (window.sessionStorage) {
			try {
				window.sessionStorage.setItem("bl-boot-v2", "1");
			} catch (error) {
				/* storage blocked, nothing to do */
			}
		}
		window.setTimeout(function () {
			if (boot) boot.style.display = "none";
		}, reduceMotion ? 0 : 900);
	}

	if (boot && bootText) {
		var already = false;
		if (window.sessionStorage) {
			try {
				already = window.sessionStorage.getItem("bl-boot-v2") === "1";
			} catch (error) {
				already = false;
			}
		}

		if (already || reduceMotion) {
			boot.style.display = "none";
			document.body.classList.remove("is-booting");
			revealHero();
		} else {
			document.body.classList.add("is-booting");
			var phrase = bootText.dataset.bootText || "backlog init";
			var i = 0;
			var typeTimer = window.setInterval(function () {
				i += 1;
				bootText.textContent = phrase.slice(0, i);
				if (i >= phrase.length) {
					window.clearInterval(typeTimer);
					window.setTimeout(endBoot, 420);
				}
			}, 45);
			/* never trap the page behind the curtain */
			window.setTimeout(function () {
				window.clearInterval(typeTimer);
				endBoot();
			}, 4000);
			if (bootSkip) {
				bootSkip.addEventListener("click", function () {
					window.clearInterval(typeTimer);
					endBoot();
				});
			}
		}
	} else {
		revealHero();
	}

	/* ---------- split hero heading into characters ---------- */

	document.querySelectorAll("[data-split]").forEach(function (block) {
		var index = 0;
		block.querySelectorAll(".line").forEach(function (line) {
			var text = line.textContent;
			line.textContent = "";
		var pieces = [];
		var tokens = text.split(" ");
		var LATIN = /[A-Za-z0-9]/;
		var CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;
		tokens.forEach(function (token, ti) {
			/* each space separated token stays in one inline-block, otherwise Blink
			   may break between inline-blocks and split a latin word in half */
			var word = document.createElement("span");
			word.className = "word";
			line.appendChild(word);
			for (var c = 0; c < token.length; c++) {
				var glyph = token[c];
				var mask = document.createElement("span");
				mask.className = "char-mask";
				var char = document.createElement("span");
				char.className = "char";
				char.textContent = glyph;
				char.style.transitionDelay = index * 26 + "ms";
				mask.appendChild(char);
				word.appendChild(mask);
				/* keep a break opportunity so CJK lines can still wrap */
				var next = c + 1 < token.length ? token[c + 1] : "";
				if (!LATIN.test(glyph) || CJK.test(next)) {
					word.appendChild(document.createElement("wbr"));
				}
				pieces.push(char);
				index += 1;
			}
			if (ti < tokens.length - 1) line.appendChild(document.createTextNode(" "));
		});
			/* a transformed child cannot inherit the parent text clip, so each
			   character carries its own slice of the heading gradient */
			var lineRect = line.getBoundingClientRect();
			var lineLeft = lineRect.left;
			var lineWidth = Math.max(lineRect.width, 1);
			pieces.forEach(function (char) {
				var offset = char.getBoundingClientRect().left - lineLeft;
				char.style.backgroundImage = "linear-gradient(90deg, #ffffff 0%, #9b9b9b 100%)";
				char.style.backgroundSize = lineWidth + "px 100%";
				char.style.backgroundPosition = -offset + "px 0";
				char.style.webkitBackgroundClip = "text";
				char.style.backgroundClip = "text";
				char.style.color = "transparent";
			});
		});
	});

	/* ---------- hero command typewriter ---------- */

	var typedTarget = document.querySelector("[data-typed]");
	if (typedTarget) {
		var full = typedTarget.dataset.typed;
		if (reduceMotion) {
			typedTarget.textContent = full;
		} else {
			var t = 0;
			var startDelay = boot && !boot.classList.contains("is-done") ? 2200 : 600;
			window.setTimeout(function () {
				var timer = window.setInterval(function () {
					t += 1;
					typedTarget.textContent = full.slice(0, t);
					if (t >= full.length) window.clearInterval(timer);
				}, 55);
			}, startDelay);
		}
	}

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
		document.addEventListener("click", function (event) {
			if (!menu.classList.contains("is-open")) return;
			if (menu.contains(event.target) || toggle.contains(event.target)) return;
			setMenu(false);
		});
		window.addEventListener("resize", function () {
			if (window.innerWidth > 1100 && menu.classList.contains("is-open")) setMenu(false);
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
					var group = entry.target.parentElement ? entry.target.parentElement.children : [];
					var order = Array.prototype.indexOf.call(group, entry.target);
					entry.target.style.transitionDelay = clamp(order, 0, 6) * 70 + "ms";
					entry.target.classList.add("is-visible");
					revealObserver.unobserve(entry.target);
				});
			},
			{ rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
		);
		revealTargets.forEach(function (el) {
			revealObserver.observe(el);
		});
	}

	/* ---------- tagline words ---------- */

	var words = Array.prototype.slice.call(document.querySelectorAll("[data-word]"));
	if (words.length) {
		if (reduceMotion || !("IntersectionObserver" in window)) {
			words.forEach(function (word) {
				word.classList.add("is-lit");
			});
		} else {
			var pending = [];
			var nextAllowed = 0;
			var lastLit = -1;

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

	/* ---------- count up ---------- */

	document.querySelectorAll("[data-count]").forEach(function (el) {
		var target = Number(el.dataset.count);
		if (reduceMotion) {
			el.textContent = String(target);
			return;
		}
		var started = false;
		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting || started) return;
					started = true;
					observer.disconnect();
					var start = performance.now();
					var duration = 1300;
					var tick = function (now) {
						var p = clamp((now - start) / duration, 0, 1);
						var eased = 1 - Math.pow(1 - p, 3);
						el.textContent = String(Math.round(target * eased));
						if (p < 1) requestAnimationFrame(tick);
					};
					requestAnimationFrame(tick);
				});
			},
			{ threshold: 0.4 },
		);
		observer.observe(el);
	});

	/* ---------- canvas graph field ---------- */

	var canvas = document.querySelector("[data-canvas]");
	if (canvas) {
		var ctx = canvas.getContext("2d");
		var nodes = [];
		var dpr = Math.min(window.devicePixelRatio || 1, 2);
		var width = 0;
		var height = 0;
		var pointer = { x: -9999, y: -9999 };

		function seed() {
			var rect = canvas.getBoundingClientRect();
			width = rect.width;
			height = rect.height;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			var count = Math.round(clamp((width * height) / 22000, 28, 90));
			nodes = [];
			for (var i = 0; i < count; i++) {
				nodes.push({
					x: Math.random() * width,
					y: Math.random() * height,
					vx: (Math.random() - 0.5) * 0.22,
					vy: (Math.random() - 0.5) * 0.22,
					r: Math.random() < 0.18 ? 2.6 : 1.6,
					hot: Math.random() < 0.16,
				});
			}
		}

		function draw() {
			ctx.clearRect(0, 0, width, height);
			for (var i = 0; i < nodes.length; i++) {
				var a = nodes[i];
				a.x += a.vx;
				a.y += a.vy;
				if (a.x < 0 || a.x > width) a.vx *= -1;
				if (a.y < 0 || a.y > height) a.vy *= -1;

				var near = Math.hypot(a.x - pointer.x, a.y - pointer.y) < 160;
				for (var j = i + 1; j < nodes.length; j++) {
					var b = nodes[j];
					var d = Math.hypot(a.x - b.x, a.y - b.y);
					if (d > 150) continue;
					var alpha = (1 - d / 150) * 0.34;
					ctx.strokeStyle = near ? "rgba(0, 196, 204, " + alpha + ")" : "rgba(255, 255, 255, " + alpha * 0.32 + ")";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(b.x, b.y);
					ctx.stroke();
				}
				ctx.fillStyle = a.hot || near ? "rgba(0, 196, 204, 0.9)" : "rgba(255, 255, 255, 0.28)";
				ctx.beginPath();
				ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		var canvasVisible = true;
		if ("IntersectionObserver" in window) {
			var canvasObserver = new IntersectionObserver(function (entries) {
				canvasVisible = entries[0].isIntersecting;
			});
			canvasObserver.observe(canvas);
		}

		canvas.addEventListener("pointermove", function (event) {
			var rect = canvas.getBoundingClientRect();
			pointer.x = event.clientX - rect.left;
			pointer.y = event.clientY - rect.top;
		});
		canvas.addEventListener("pointerleave", function () {
			pointer.x = -9999;
			pointer.y = -9999;
		});

		seed();
		var resizeTimer;
		window.addEventListener("resize", function () {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(function () {
				seed();
				if (reduceMotion) draw();
			}, 200);
		});

		if (reduceMotion) {
			/* Reduced motion keeps the field static rather than leaving it blank. */
			draw();
		} else {
			(function loopCanvas() {
				if (canvasVisible) draw();
				requestAnimationFrame(loopCanvas);
			})();
		}
	}

	/* ---------- hero 3D tilt ---------- */

	var stage = document.querySelector("[data-stage]");
	var tilt = document.querySelector("[data-tilt]");
	var pip = document.querySelector(".tui-pip");
	var tiltX = 0;
	var tiltY = 0;

	if (stage && tilt && finePointer && !reduceMotion) {
		stage.addEventListener("pointermove", function (event) {
			var rect = stage.getBoundingClientRect();
			tiltX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
			tiltY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
		});
		stage.addEventListener("pointerleave", function () {
			tiltX = 0;
			tiltY = 0;
		});
	}

	/* ---------- magnetic buttons ---------- */

	if (finePointer && !reduceMotion) {
		document.querySelectorAll("[data-magnetic]").forEach(function (el) {
			el.addEventListener("pointermove", function (event) {
				var rect = el.getBoundingClientRect();
				var dx = (event.clientX - (rect.left + rect.width / 2)) * 0.16;
				var dy = (event.clientY - (rect.top + rect.height / 2)) * 0.2;
				el.style.transform = "translate(" + clamp(dx, -6, 6) + "px," + clamp(dy, -5, 5) + "px)";
			});
			el.addEventListener("pointerleave", function () {
				el.style.transform = "";
			});
		});
	}

	/* ---------- cursor glow ---------- */

	var glow = document.querySelector("[data-glow]");
	var glowTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
	var glowPos = { x: glowTarget.x, y: glowTarget.y };

	if (glow && finePointer && !reduceMotion) {
		window.addEventListener("pointermove", function (event) {
			glowTarget.x = event.clientX;
			glowTarget.y = event.clientY;
		});
	}

	/* ---------- master rAF loop: progress, tilt, glow, nav ---------- */

	var progressBar = document.querySelector("[data-progress-bar]");
	var nav = document.querySelector("[data-nav]");

	var lastScroll = window.scrollY;
	var navHidden = false;
	var programmatic = false;
	var settleFrames = 0;

	function updateScroll() {
		var y = window.scrollY;
		var vh = window.innerHeight;
		var docHeight = document.documentElement.scrollHeight - vh;
		if (progressBar) progressBar.style.transform = "scaleX(" + clamp(y / Math.max(docHeight, 1), 0, 1) + ")";

		if (tilt) {
			var depth = clamp(y / 900, 0, 1);
			var tiltTransform =
				"rotateY(" + tiltX * 5 + "deg) rotateX(" + -tiltY * 4 + "deg) scale(" + (1 - depth * 0.05) + ")";
			tilt.style.transform = tiltTransform;
			/* Keep the floating TUI window on the same 3D plane as the hero shot. */
			if (pip) pip.style.transform = "translateZ(70px) " + tiltTransform;
		}

		if (glow) {
			glowPos.x += (glowTarget.x - glowPos.x) * 0.12;
			glowPos.y += (glowTarget.y - glowPos.y) * 0.12;
			glow.style.transform = "translate3d(" + glowPos.x + "px," + glowPos.y + "px,0)";
		}

		if (nav) {
			var delta = y - lastScroll;
			if (programmatic) {
				/* A click on an in-page anchor jumps the scroll position in one
				   step; that large positive delta must not be read as "user scrolled
				   down, hide the nav". Keep the nav visible until motion settles. */
				if (Math.abs(delta) < 0.5) {
					settleFrames++;
					if (settleFrames > 3) {
						programmatic = false;
						settleFrames = 0;
					}
				} else {
					settleFrames = 0;
				}
				lastScroll = y;
			} else if (Math.abs(delta) > 4) {
				var shouldHide = delta > 0 && y > 400;
				if (shouldHide !== navHidden) {
					navHidden = shouldHide;
					nav.classList.toggle("is-hidden", shouldHide);
				}
				lastScroll = y;
			}
		}
	}

	/* Clicking an in-page anchor triggers a programmatic jump: force the nav to
	   stay visible during the jump, then hand control back once scrolling stops. */
	var anchorLinks = document.querySelectorAll('a[href^="#"]');
	for (var a = 0; a < anchorLinks.length; a++) {
		anchorLinks[a].addEventListener("click", function () {
			programmatic = true;
			settleFrames = 0;
			lastScroll = window.scrollY;
			if (nav) {
				navHidden = false;
				nav.classList.remove("is-hidden");
			}
		});
	}

	if (!reduceMotion) {
		(function loop() {
			updateScroll();
			requestAnimationFrame(loop);
		})();
	} else {
		updateScroll();
		/* reduced motion has no rAF loop, so progress and the nav still need to
		   follow the scroll - just without the continuous animation */
		var scrollTick = false;
		window.addEventListener(
			"scroll",
			function () {
				if (scrollTick) return;
				scrollTick = true;
				window.requestAnimationFrame(function () {
					updateScroll();
					scrollTick = false;
				});
			},
			{ passive: true },
		);
	}

	window.addEventListener("resize", function () {
		updateScroll();
	});

	/* ---------- faq ---------- */

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

	/* ---------- copy command ---------- */

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
			var copied = button.dataset.copiedLabel || "Copied";
			var failed = button.dataset.failedLabel || "Copy failed";

			if (navigator.clipboard && window.isSecureContext) {
				navigator.clipboard.writeText(text).then(
					function () {
						flash(state, copied);
					},
					function () {
						flash(state, legacyCopy(text) ? copied : failed);
					},
				);
				return;
			}
			flash(state, legacyCopy(text) ? copied : failed);
		});
	});

	/* ---------- footer year ---------- */

	var year = document.querySelector("[data-year]");
	if (year) year.textContent = String(new Date().getFullYear());
})();
