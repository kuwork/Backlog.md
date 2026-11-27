(function () {
	"use strict";

	var wall = document.querySelector("[data-adopter-wall]");
	var directory = document.querySelector("[data-adopter-directory]");
	var payload = window.BACKLOG_ADOPTER_DATA;
	if ((!wall && !directory) || !payload || !Array.isArray(payload.items)) {
		return;
	}

	var items = payload.items;
	var zh = document.documentElement.lang.toLowerCase().indexOf("zh") === 0;
	var labels = zh
		? {
				noIntro: "仓库未提供公开简介",
				tasks: "任务",
				allTypes: "全部类型",
				allLanguages: "全部语言",
				countAll: "共 {count} 个项目",
				countFiltered: "找到 {count} 个项目，共 {total} 个",
		  }
		: {
				noIntro: "No public repository description",
				tasks: "task files",
				allTypes: "All types",
				allLanguages: "All languages",
				countAll: "{count} projects",
				countFiltered: "{count} of {total} projects",
		  };
	var typeNames = {
		"软件项目": "Software project",
		"工具生态/模板": "Tooling / template",
	};

	function element(tag, className, text) {
		var node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		if (text !== undefined) {
			node.textContent = text;
		}
		return node;
	}

	function formatNumber(value) {
		var number = Number(value) || 0;
		if (number >= 1000) {
			return (number / 1000).toFixed(number >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
		}
		return String(number);
	}

	function formatDate(value) {
		if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
			return "";
		}
		var date = value.slice(0, 10);
		return date;
	}

	function typeLabel(value) {
		return zh ? value : typeNames[value] || value;
	}

	function createCard(item) {
		var card = element("a", "adopter-card");
		card.href = "https://github.com/" + item.r;
		card.target = "_blank";
		card.rel = "noopener noreferrer";
		card.setAttribute("aria-label", item.r);
		card.title = item.r;

		var avatar = element("img", "adopter-avatar");
		avatar.src = "https://github.com/" + item.o + ".png?size=80";
		avatar.alt = "";
		avatar.width = 40;
		avatar.height = 40;
		avatar.loading = "lazy";
		avatar.decoding = "async";
		avatar.addEventListener("error", function () {
			var fallback = element("span", "adopter-avatar-fallback", item.o.slice(0, 1).toUpperCase());
			fallback.setAttribute("aria-hidden", "true");
			avatar.replaceWith(fallback);
		});

		var repo = element("span", "adopter-repo", item.r);
		var meta = element("span", "adopter-card-meta");
		meta.appendChild(element("span", "adopter-card-star", "★ " + formatNumber(item.s)));
		if (item.l) {
			meta.appendChild(element("span", "adopter-card-type", item.l));
		}

		var header = element("span", "adopter-card-head");
		header.appendChild(avatar);
		var heading = element("span", "adopter-repo-block");
		heading.appendChild(repo);
		heading.appendChild(meta);
		header.appendChild(heading);
		card.appendChild(header);

		card.appendChild(element("p", "adopter-intro", (zh ? item.z : item.e) || labels.noIntro));

		var metrics = element("span", "adopter-metrics");
		if (Number(item.t) > 0) {
			var taskMetric = element("span", "adopter-metric");
			taskMetric.appendChild(element("strong", "", formatNumber(item.t)));
			taskMetric.appendChild(document.createTextNode(" " + labels.tasks));
			metrics.appendChild(taskMetric);
		}
		var pushed = formatDate(item.d);
		if (pushed) {
			metrics.appendChild(element("span", "adopter-metric", pushed));
		}
		card.appendChild(metrics);
		return card;
	}

	function distributeBalanced(projects) {
		var rows = [[], [], []];
		projects.forEach(function (item, index) {
			var position = index % 3;
			var rowIndex = Math.floor(index / 3) % 2 === 0 ? position : 2 - position;
			rows[rowIndex].push(item);
		});

		var sums = rows.map(function (row) {
			return row.reduce(function (sum, item) { return sum + item.q; }, 0);
		});
		for (var iteration = 0; iteration < 12; iteration += 1) {
			var best = null;
			var bestRange = Math.max.apply(null, sums) - Math.min.apply(null, sums);
			for (var left = 0; left < 3; left += 1) {
				for (var right = left + 1; right < 3; right += 1) {
					for (var i = 0; i < rows[left].length; i += 1) {
						for (var j = 0; j < rows[right].length; j += 1) {
							var nextSums = sums.slice();
							nextSums[left] += rows[right][j].q - rows[left][i].q;
							nextSums[right] += rows[left][i].q - rows[right][j].q;
							var range = Math.max.apply(null, nextSums) - Math.min.apply(null, nextSums);
							if (range < bestRange - 0.049) {
								bestRange = range;
								best = { left: left, right: right, i: i, j: j, sums: nextSums };
							}
						}
					}
				}
			}
			if (!best) {
				break;
			}
			var moved = rows[best.left][best.i];
			rows[best.left][best.i] = rows[best.right][best.j];
			rows[best.right][best.j] = moved;
			sums = best.sums;
		}
		return rows;
	}

	function renderWall() {
		var baseDurations = [320, 360, 400];
		var rows = distributeBalanced(items);
		wall.replaceChildren();
		rows.forEach(function (rowItems, rowIndex) {
			var track = element("div", "adopter-track adopter-track-" + (rowIndex + 1));
			var group = element("div", "adopter-group");
			rowItems.forEach(function (item) {
				group.appendChild(createCard(item));
			});
			track.appendChild(group);
			track.appendChild(group.cloneNode(true));
			var duration = (rowItems.length / 60) * baseDurations[rowIndex];
			track.style.setProperty("--adopter-duration-" + (rowIndex + 1), duration.toFixed(1) + "s");
			wall.appendChild(track);
		});
	}

	function populateOptions(select, values, allLabel) {
		select.replaceChildren();
		select.appendChild(new Option(allLabel, ""));
		values
			.slice()
			.sort(function (a, b) {
				return a.localeCompare(b, zh ? "zh-CN" : "en");
			})
			.forEach(function (value) {
				select.appendChild(new Option(select.hasAttribute("data-adopter-type") ? typeLabel(value) : value, value));
			});
	}

	function renderDirectory() {
		var form = directory.querySelector("[data-adopter-filters]");
		var search = directory.querySelector("[data-adopter-search]");
		var type = directory.querySelector("[data-adopter-type]");
		var language = directory.querySelector("[data-adopter-language]");
		var sort = directory.querySelector("[data-adopter-sort]");
		var grid = directory.querySelector("[data-adopter-grid]");
		var count = directory.querySelector("[data-adopter-count]");
		var empty = directory.querySelector("[data-adopter-empty]");
		if (!form || !search || !type || !language || !sort || !grid || !count || !empty) {
			return;
		}

		populateOptions(type, Array.from(new Set(items.map(function (item) { return item.y; }).filter(Boolean))), labels.allTypes);
		populateOptions(language, Array.from(new Set(items.map(function (item) { return item.l; }).filter(Boolean))), labels.allLanguages);

		function update() {
			var query = search.value.trim().toLowerCase();
			var filtered = items.filter(function (item) {
				if (type.value && item.y !== type.value) {
					return false;
				}
				if (language.value && item.l !== language.value) {
					return false;
				}
				if (!query) {
					return true;
				}
				return [item.r, item.e, item.z, item.l, typeLabel(item.y)]
					.join(" ")
					.toLowerCase()
					.indexOf(query) !== -1;
			});

			filtered.sort(function (a, b) {
				if (sort.value === "tasks") {
					return b.t - a.t || b.s - a.s;
				}
				if (sort.value === "recent") {
					return String(b.d).localeCompare(String(a.d)) || b.s - a.s;
				}
				return b.s - a.s || b.t - a.t;
			});

			var fragment = document.createDocumentFragment();
			filtered.forEach(function (item) {
				fragment.appendChild(createCard(item));
			});
			grid.replaceChildren(fragment);
			grid.hidden = filtered.length === 0;
			empty.hidden = filtered.length !== 0;
			var template = filtered.length === items.length ? labels.countAll : labels.countFiltered;
			count.textContent = template
				.replace("{count}", String(filtered.length))
				.replace("{total}", String(items.length));
		}

		form.addEventListener("submit", function (event) {
			event.preventDefault();
		});
		search.addEventListener("input", update);
		type.addEventListener("change", update);
		language.addEventListener("change", update);
		sort.addEventListener("change", update);
		directory.querySelectorAll("[data-adopter-reset]").forEach(function (button) {
			button.addEventListener("click", function () {
				form.reset();
				update();
				search.focus();
			});
		});
		update();
	}

	if (wall) {
		renderWall();
	}
	if (directory) {
		renderDirectory();
	}
})();
