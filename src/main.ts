import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './audio';

interface AnalectsData {
  eras: Array<{
    id: string;
    name: string;
    period: string;
    themeColor: string;
    ambientLightIntensity: number;
    angle: number;
    keyText: string;
    summary: string;
  }>;
  concepts: Array<{
    id: string;
    hanja: string;
    pronunciation: string;
    english: string;
    calligraphyTexture: string;
    coreQuote: { original: string; translation: string };
    interpretations: Record<string, {
      keyword: string;
      scholarNote: string;
      description: string;
      originalAnnotation: string;
    }>;
  }>;
}

class LivingAnalectsApp {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private ambientLight = new THREE.AmbientLight('#ffffff', 1.8);
  private centerPrism!: THREE.Mesh;
  private monolithMeshes: THREE.Mesh[] = [];

  private data!: AnalectsData;
  private currentConceptId = 'ren';
  private selectedEraId: string | null = null;
  private movingCamera = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private previousFocus: HTMLElement | null = null;
  private lastFrame = 0;

  private targetCameraPos = new THREE.Vector3(0, 6, 14);
  private targetLookAt = new THREE.Vector3(0, 1.4, 0);

  constructor(private container: HTMLElement) {
    this.scene.background = new THREE.Color('#141413');
    this.scene.fog = new THREE.FogExp2('#141413', 0.016);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.copy(this.targetCameraPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 28;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.target.copy(this.targetLookAt);
    this.controls.addEventListener('start', () => { this.movingCamera = false; });

    this.scene.add(this.ambientLight);
    // Broad neutral lighting keeps inscriptions readable as the view rotates.
    const keyLight = new THREE.DirectionalLight('#fff3df', 2.4);
    keyLight.position.set(5, 8, 9);
    const fillLight = new THREE.DirectionalLight('#e5efff', 1.6);
    fillLight.position.set(-6, 5, -7);
    this.scene.add(keyLight, fillLight, new THREE.HemisphereLight('#ffffff', '#544a3c', 0.7));
    this.initDataAndScene().catch((error: unknown) => {
      console.error('Archive initialization failed:', error);
      document.getElementById('load-status')!.textContent = '자료를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 페이지를 새로고침해 주세요.';
    });
    this.bindEvents();
    this.animate();
  }

  private createCalligraphyTexture(hanja: string, subtitle: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(180, 170, 155, 0.15)';
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillRect(x, y, Math.random() * 3, Math.random() * 3);
    }

    ctx.strokeStyle = '#2b2927';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = '#141413';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = hanja.length > 1 ? 180 : 270;
    ctx.font = `700 ${fontSize}px "Noto Serif KR", "Batang", serif`;
    ctx.fillText(hanja, canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = '#5c574f';
    ctx.font = '500 28px "Noto Serif KR", serif';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height - 130, canvas.width - 72);

    const sealX = canvas.width - 96;
    const sealY = canvas.height - 96;
    ctx.fillStyle = '#b32d2e';
    ctx.fillRect(sealX, sealY, 44, 44);
    ctx.fillStyle = '#f2efe9';
    ctx.font = '700 18px serif';
    ctx.fillText('獨樂', sealX + 22, sealY + 23);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createMonolithTexture(eraName: string, scholar: string, colorHex: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 250, 239, 0.75)';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.fillStyle = '#fffaf0';
    ctx.textAlign = 'center';
    ctx.font = '700 26px "Noto Serif KR", serif';
    ctx.fillText(eraName, canvas.width / 2, 220, canvas.width - 44);

    ctx.fillStyle = '#f0ede6';
    ctx.font = '500 18px "Noto Serif KR", serif';
    ctx.fillText(scholar, canvas.width / 2, 270, canvas.width - 44);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private updatePrismTexture(conceptId: string): void {
    if (!this.data || !this.centerPrism) return;
    const concept = this.data.concepts.find((c) => c.id === conceptId);
    if (!concept) return;

    const fallbackTexture = this.createCalligraphyTexture(
      concept.hanja,
      `${concept.pronunciation} · ${concept.english}`
    );
    const sideMat = new THREE.MeshStandardMaterial({ color: '#2b2927', roughness: 0.7 });
    const faceMat = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      emissive: '#ffffff',
      emissiveMap: fallbackTexture,
      emissiveIntensity: 0.15,
      bumpMap: fallbackTexture,
      bumpScale: 0.015,
      roughness: 0.45
    });
    const oldMaterials = Array.isArray(this.centerPrism.material) ? this.centerPrism.material : [this.centerPrism.material];
    for (const material of new Set(oldMaterials)) {
      if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    }
    this.centerPrism.material = [sideMat, sideMat, sideMat, sideMat, faceMat, faceMat];
  }

  private async initDataAndScene(): Promise<void> {
    const response = await fetch('./data/analects_data.json');
    if (!response.ok) throw new Error(`Archive request failed: ${response.status}`);
    this.data = await response.json();

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.5, 0.4, 64),
      new THREE.MeshStandardMaterial({ color: '#11110f', roughness: 0.85 })
    );
    platform.position.y = -0.2;
    this.scene.add(platform);

    const pointLight = new THREE.PointLight('#ffe8c2', 18, 25);
    pointLight.position.set(0, 7, 0);
    this.scene.add(pointLight);

    this.centerPrism = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 2.6, 0.15),
      new THREE.MeshStandardMaterial({ color: '#f5f2eb', roughness: 0.35 })
    );
    this.centerPrism.position.set(0, 1.8, 0);
    this.scene.add(this.centerPrism);
    this.updatePrismTexture(this.currentConceptId);

    const radius = 5.2;
    const monoGeo = new THREE.BoxGeometry(1.1, 2.4, 0.35);

    this.data.eras.forEach((era) => {
      const tex = this.createMonolithTexture(era.name, era.keyText, era.themeColor);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        // A small emission floor protects text on the unlit faces.
        emissive: '#ffffff',
        emissiveMap: tex,
        emissiveIntensity: 0.3,
        roughness: 0.75,
        metalness: 0.02
      });
      const mesh = new THREE.Mesh(monoGeo, mat);
      mesh.position.set(Math.cos(era.angle) * radius, 1.2, Math.sin(era.angle) * radius);
      mesh.lookAt(0, 1.2, 0);
      mesh.userData = { eraId: era.id };

      this.scene.add(mesh);
      this.monolithMeshes.push(mesh);

      const button = document.createElement('button');
      button.className = 'era-btn';
      button.textContent = era.name;
      button.dataset.era = era.id;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => this.selectEra(era.id, mesh.position));
      document.getElementById('era-nav')!.appendChild(button);
    });
    document.querySelectorAll<HTMLButtonElement>('.concept-btn').forEach((button) => { button.disabled = false; });
    document.getElementById('load-status')!.textContent = '';
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    let pointerStart: { x: number; y: number; id: number } | null = null;
    canvas.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) { pointerStart = null; return; }
      pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    canvas.addEventListener('pointercancel', () => { pointerStart = null; });
    canvas.addEventListener('pointerup', (e: PointerEvent) => {
      const start = pointerStart;
      pointerStart = null;
      if (!start || start.id !== e.pointerId || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
      const bounds = canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
      this.pointer.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const intersects = this.raycaster.intersectObjects(this.monolithMeshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const eraId = hitMesh.userData.eraId;
        this.selectEra(eraId, hitMesh.position);
      }
    });

    document.querySelectorAll('.concept-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (!this.data) return;
        document.querySelectorAll('.concept-btn').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        const target = e.currentTarget as HTMLButtonElement;
        target.classList.add('active');
        target.setAttribute('aria-pressed', 'true');
        this.currentConceptId = target.dataset.concept || 'ren';
        this.updatePrismTexture(this.currentConceptId);

        if (this.selectedEraId) {
          this.updateOverlayUI(this.selectedEraId);
        }
      });
    });

    document.getElementById('close-panel-btn')?.addEventListener('click', () => this.closePanel());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.selectedEraId) this.closePanel();
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });
  }

  private closePanel(): void {
    const panel = document.getElementById('overlay-panel')!;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    this.selectedEraId = null;
    this.targetCameraPos.set(0, 6, 14);
    this.targetLookAt.set(0, 1.4, 0);
    this.movingCamera = true;
    this.ambientLight.color.set('#ffffff');
    this.ambientLight.intensity = 1.8;
    document.querySelectorAll('.era-btn').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    this.previousFocus?.focus();
  }

  private selectEra(eraId: string, meshPosition: THREE.Vector3): void {
    const era = this.data.eras.find((e) => e.id === eraId);
    if (!era) return;
    if (!this.selectedEraId) this.previousFocus = document.activeElement as HTMLElement;
    this.selectedEraId = eraId;

    const direction = meshPosition.clone().normalize();
    this.targetCameraPos.copy(meshPosition).add(direction.multiplyScalar(3.5)).setY(2.2);
    this.targetLookAt.copy(meshPosition);
    this.movingCamera = true;

    this.ambientLight.color.set('#ffffff').lerp(new THREE.Color(era.themeColor), 0.1);
    this.ambientLight.intensity = 1.8 * (0.9 + era.ambientLightIntensity * 0.1);

    this.updateOverlayUI(eraId);
    const panel = document.getElementById('overlay-panel')!;
    panel.inert = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('open');
    panel.scrollTop = 0;
    document.querySelectorAll<HTMLButtonElement>('.era-btn').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.era === eraId)));
    document.getElementById('close-panel-btn')!.focus({ preventScroll: true });
  }

  private updateOverlayUI(eraId: string): void {
    const era = this.data.eras.find((e) => e.id === eraId);
    const concept = this.data.concepts.find((c) => c.id === this.currentConceptId);
    if (!era || !concept) return;

    const interp = concept.interpretations[eraId];

    document.getElementById('ui-era-period')!.textContent = `${era.period} | ${era.keyText}`;
    document.getElementById('ui-era-name')!.textContent = `${era.name}의 '${concept.hanja}(${concept.pronunciation})' 해석`;
    document.getElementById('ui-era-summary')!.textContent = era.summary;
    document.getElementById('ui-core-original')!.textContent = concept.coreQuote.original;
    document.getElementById('ui-core-translation')!.textContent = concept.coreQuote.translation;

    document.getElementById('ui-scholar-note')!.textContent = interp.scholarNote;
    document.getElementById('ui-interp-keyword')!.textContent = interp.keyword;
    document.getElementById('ui-interp-desc')!.textContent = interp.description;
    document.getElementById('ui-interp-annotation')!.textContent = interp.originalAnnotation;
  }

  private animate = (time = 0): void => {
    requestAnimationFrame(this.animate);
    const delta = Math.min((time - this.lastFrame) / 1000, 0.05);
    this.lastFrame = time;

    if (this.centerPrism && !this.reducedMotion.matches) {
      this.centerPrism.rotation.y += 0.24 * delta;
    }

    if (this.movingCamera) {
      const alpha = this.reducedMotion.matches ? 1 : 1 - Math.exp(-5 * delta);
      this.camera.position.lerp(this.targetCameraPos, alpha);
      this.controls.target.lerp(this.targetLookAt, alpha);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.01 && this.controls.target.distanceTo(this.targetLookAt) < 0.01) this.movingCamera = false;
    }
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  };
}

try {
  new LivingAnalectsApp(document.getElementById('canvas-container')!);
} catch (error) {
  console.error('3D initialization failed:', error);
  document.getElementById('load-status')!.textContent = '3D 화면을 시작하지 못했습니다. WebGL을 지원하는 브라우저에서 하드웨어 가속을 켜고 다시 열어 주세요.';
}
