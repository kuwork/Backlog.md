// 光晕球特效：基于 Three.js + UnrealBloom 的粒子球（来自示例 deepseek_html_20261102）。
// 渲染进 .hero-orb 容器，配色对齐站点品牌（青/teal），尊重 prefers-reduced-motion。
(function () {
	"use strict";

	var container = document.querySelector("[data-orb]");
	if (!container) return;
	if (typeof window.THREE === "undefined") return; // CDN 未加载则静默降级，保留留白

	var THREE = window.THREE;

	var scene = new THREE.Scene();
	var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
	camera.position.z = 18; // 较小画幅：留出边缘空白，避免裁切

	var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.setClearColor(0x000000, 0);
	renderer.toneMapping = THREE.ReinhardToneMapping;
	container.appendChild(renderer.domElement);

	var renderScene = new THREE.RenderPass(scene, camera);
	var bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.42, 0.15);

	// 让画布保持透明：bloom 合成后按亮度回写 alpha，
	// 否则暗部 alpha 会被写成 1，在星空背景上露出一块不透明方形。
	bloomPass.materialCopy.fragmentShader = [
		"uniform sampler2D tDiffuse;",
		"varying vec2 vUv;",
		"void main() {",
		"  vec4 tex = texture2D(tDiffuse, vUv);",
		"  float m = max(tex.r, max(tex.g, tex.b));",
		"  float a = smoothstep(0.02, 0.22, m);", // 淡雾直接透明，露出背景粒子场
		"  gl_FragColor = vec4(tex.rgb, a);",
		"}"
	].join("\n");
	bloomPass.materialCopy.needsUpdate = true;

	var composer = new THREE.EffectComposer(renderer);
	composer.addPass(renderScene);
	composer.addPass(bloomPass);

	var sphereGroup = new THREE.Group();
	scene.add(sphereGroup);

	var radius = 5.5;
	var numNodes = 360;
	var nodesData = [];
	var colors = [0x00c4cc, 0x00e5ff, 0x66ffd9]; // 品牌青 / 亮青 / 薄荷

	var nodeGeometry = new THREE.BufferGeometry();
	var positions = new Float32Array(numNodes * 3);
	var colorsArray = new Float32Array(numNodes * 3);
	var randomArray = new Float32Array(numNodes);

	var phi = Math.PI * (3 - Math.sqrt(5));
	var color = new THREE.Color();

	for (var i = 0; i < numNodes; i++) {
		var y = 1 - (i / (numNodes - 1)) * 2;
		var rad = Math.sqrt(1 - y * y);
		var theta = phi * i;
		var x = Math.cos(theta) * rad;
		var z = Math.sin(theta) * rad;

		var pos = new THREE.Vector3(x, y, z).multiplyScalar(radius);
		positions[i * 3] = pos.x;
		positions[i * 3 + 1] = pos.y;
		positions[i * 3 + 2] = pos.z;

		nodesData.push({ originPos: pos.clone(), currentPos: pos.clone() });

		color.setHex(colors[Math.floor(Math.random() * colors.length)]);
		colorsArray[i * 3] = color.r;
		colorsArray[i * 3 + 1] = color.g;
		colorsArray[i * 3 + 2] = color.b;

		randomArray[i] = Math.random() * 1000;
	}

	nodeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	nodeGeometry.setAttribute("color", new THREE.BufferAttribute(colorsArray, 3));
	nodeGeometry.setAttribute("aRandom", new THREE.BufferAttribute(randomArray, 1));

	var particleMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0.0 },
			uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) }
		},
		vertexShader: [
			"uniform float uTime;",
			"uniform float uPixelRatio;",
			"attribute float aRandom;",
			"varying vec3 vColor;",
			"varying float vTwinkle;",
			"void main() {",
			"  vColor = color;",
			"  float pulse = (sin(uTime * 1.5 + aRandom) + 1.0) * 0.5;",
			"  vTwinkle = smoothstep(0.88, 1.0, pulse);",
			"  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
			"  float baseSize = 1500.0;",
			"  float scaleFactor = 1.0 + vTwinkle * 0.5;",
			"  gl_PointSize = baseSize * uPixelRatio * scaleFactor / -mvPosition.z;",
			"  gl_Position = projectionMatrix * mvPosition;",
			"}"
		].join("\n"),
		fragmentShader: [
			"varying vec3 vColor;",
			"varying float vTwinkle;",
			"void main() {",
			"  vec2 uv = gl_PointCoord.xy - vec2(0.5);",
			"  float dist = length(uv);",
			"  float coreRadius = 0.015;",
			"  float alpha = pow(1.0 - dist * 2.0, 5.0);",
			"  float coreGlow = smoothstep(coreRadius, 0.0, dist);",
			"  vec3 finalColor = vColor * (1.0 + vTwinkle * 0.8);",
			"  float twinkleAlpha = 1.0 - vTwinkle * 0.6;",
			"  float finalAlpha = (alpha * 0.3 + coreGlow) * twinkleAlpha;",
			"  if (finalAlpha < 0.01) discard;",
			"  gl_FragColor = vec4(finalColor, finalAlpha);",
			"}"
		].join("\n"),
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		vertexColors: true
	});

	var points = new THREE.Points(nodeGeometry, particleMaterial);
	sphereGroup.add(points);

	var connections = [];
	var maxDistance = 1.8;
	for (var a = 0; a < numNodes; a++) {
		for (var b = a + 1; b < numNodes; b++) {
			if (nodesData[a].originPos.distanceTo(nodesData[b].originPos) < maxDistance) {
				connections.push({ i: a, j: b });
			}
		}
	}

	var lineGeometry = new THREE.BufferGeometry();
	var linePositions = new Float32Array(connections.length * 6);
	var lineColors = new Float32Array(connections.length * 6);
	lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
	lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));

	var lineMaterial = new THREE.LineBasicMaterial({
		vertexColors: true,
		transparent: true,
		opacity: 0.2,
		blending: THREE.AdditiveBlending
	});

	var lines = new THREE.LineSegments(lineGeometry, lineMaterial);
	sphereGroup.add(lines);

	var mouse3D = new THREE.Vector3(999, 999, 999);
	var raycaster = new THREE.Raycaster();
	var mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
	var mouse2D = new THREE.Vector2();

	// 仅当指针落在球体附近时才触发牵引：以容器中心为原点做归一化，
	// 超出该圆域（页面其它区域）则让节点回弹原位。
	var HOVER_RADIUS = 0.86; // 相对容器半宽/半高；球体可视半径约 0.74

	function onPointerMove(event) {
		var rect = container.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		// 关键：以画布中心为原点映射，而不是整个窗口。
		// 否则球的左半边会被映射到球心右侧，左侧节点永远碰不到。
		var nx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
		var ny = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);

		if (nx * nx + ny * ny > HOVER_RADIUS * HOVER_RADIUS) {
			mouse3D.set(999, 999, 999); // 远离球体，牵引解除
			return;
		}

		mouse2D.x = nx;
		mouse2D.y = -ny;
		raycaster.setFromCamera(mouse2D, camera);
		raycaster.ray.intersectPlane(mousePlane, mouse3D);
	}

	window.addEventListener("mousemove", onPointerMove);
	window.addEventListener("scroll", function () {
		mouse3D.set(999, 999, 999);
	});
	window.addEventListener("mouseleave", function () {
		mouse3D.set(999, 999, 999);
	});

	function sizeToContainer() {
		var w = container.clientWidth;
		var h = container.clientHeight;
		if (!w || !h) return; // 布局尚未就绪，交给下一帧重试
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h, false);
		composer.setSize(w, h);
		bloomPass.setSize(w, h);
	}

	var clock = new THREE.Clock();
	var running = false;
	var orbVisible = true;
	var lastDraw = 0;
	var frameInterval = 1000 / 40; // 限到约 40fps，给主线程/其他动效让路

	function frame(now) {
		requestAnimationFrame(frame);
		// 不可见或标签页在后台时跳过绘制，避免拖慢页面其它动效
		if (document.hidden || !orbVisible) return;
		if (now - lastDraw < frameInterval) return;
		lastDraw = now;

		var time = clock.getElapsedTime();
		particleMaterial.uniforms.uTime.value = time;

		sphereGroup.rotation.y = time * 0.22;
		sphereGroup.rotation.x = Math.sin(time * 0.12) * 0.28;
		sphereGroup.scale.setScalar(1 + Math.sin(time * 0.9) * 0.035);

		var posAttr = nodeGeometry.attributes.position;
		var posArray = posAttr.array;
		var localMouse = mouse3D.clone();
		sphereGroup.worldToLocal(localMouse);

		for (var k = 0; k < numNodes; k++) {
			var data = nodesData[k];
			var dist = data.originPos.distanceTo(localMouse);
			var interactionRadius = 3.5;
			var targetPos = data.originPos.clone();
			if (dist < interactionRadius) {
				var force = (interactionRadius - dist) / interactionRadius;
				var dir = new THREE.Vector3()
					.subVectors(localMouse, data.originPos)
					.normalize();
				targetPos.add(dir.multiplyScalar(force * 2.5));
			}
			data.currentPos.lerp(targetPos, 0.1);
			posArray[k * 3] = data.currentPos.x;
			posArray[k * 3 + 1] = data.currentPos.y;
			posArray[k * 3 + 2] = data.currentPos.z;
		}
		posAttr.needsUpdate = true;

		var linePosAttr = lines.geometry.attributes.position;
		var linePosArray = linePosAttr.array;
		var lineColorAttr = lines.geometry.attributes.color;
		var lineColorArray = lineColorAttr.array;
		var idx = 0;
		for (var c = 0; c < connections.length; c++) {
			var conn = connections[c];
			var p1 = nodesData[conn.i].currentPos;
			var p2 = nodesData[conn.j].currentPos;
			linePosArray[idx * 6] = p1.x;
			linePosArray[idx * 6 + 1] = p1.y;
			linePosArray[idx * 6 + 2] = p1.z;
			linePosArray[idx * 6 + 3] = p2.x;
			linePosArray[idx * 6 + 4] = p2.y;
			linePosArray[idx * 6 + 5] = p2.z;
			lineColorArray[idx * 6] = colorsArray[conn.i * 3];
			lineColorArray[idx * 6 + 1] = colorsArray[conn.i * 3 + 1];
			lineColorArray[idx * 6 + 2] = colorsArray[conn.i * 3 + 2];
			lineColorArray[idx * 6 + 3] = colorsArray[conn.j * 3];
			lineColorArray[idx * 6 + 4] = colorsArray[conn.j * 3 + 1];
			lineColorArray[idx * 6 + 5] = colorsArray[conn.j * 3 + 2];
			idx++;
		}
		linePosAttr.needsUpdate = true;
		lineColorAttr.needsUpdate = true;

		composer.render();
	}

	function start() {
		if (running) return;
		running = true;
		clock.start();
		frame(performance.now());
	}

	// 等布局就绪（clientWidth/Height 非零）再定尺寸并启动，最多重试 120 帧；
	// ≤900px 时容器被 CSS 隐藏，直接跳过。
	var attempts = 0;
	function boot() {
		if (window.innerWidth <= 900) return;
		sizeToContainer();
		if (container.clientWidth && container.clientHeight) {
			// 装饰性特效：始终动画。即便系统开启「减少动态效果」也不冻结，
			// 只是速度保持不变（球体旋转较缓，不构成干扰）。
			start();
			return;
		}
		if (attempts++ < 120) requestAnimationFrame(boot);
	}

	boot();

	window.addEventListener("resize", sizeToContainer);
	if (typeof ResizeObserver !== "undefined") {
		var ro = new ResizeObserver(sizeToContainer);
		ro.observe(container);
	}
	if ("IntersectionObserver" in window) {
		var orbObserver = new IntersectionObserver(function (entries) {
			orbVisible = entries[0].isIntersecting;
		});
		orbObserver.observe(container);
	}
})();
