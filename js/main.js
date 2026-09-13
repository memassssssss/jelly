import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. СЦЕНА
const scene = new THREE.Scene();

// 2. КАМЕРА
const camera = new THREE.PerspectiveCamera(
    60, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
);
camera.position.set(0, 1, 5);

// 3. РЕНДЕРЕР
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0a10, 1);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const container = document.getElementById('webgl-container');
container.appendChild(renderer.domElement);

// 4. УПРАВЛЕНИЕ МЫШЬЮ
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2 + 0.05;

// ОСВЕЩЕНИЕ
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
mainLight.position.set(5, 8, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
scene.add(mainLight);

const backLight = new THREE.DirectionalLight(0x7bc8ff, 2.5); 
backLight.position.set(-5, 3, -5);
scene.add(backLight);

// ==========================================
// НОВЫЙ ПОЛ И ДИНАМИЧЕСКАЯ ТЕНЬ
// ==========================================
const floorY = -1.8;

// Чистый тёмный пол-подиум
const floorGeometry = new THREE.CylinderGeometry(4.5, 4.5, 0.2, 64);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x12131e,
    roughness: 0.6,
    metalness: 0.3
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.position.y = floorY - 0.1;
floor.receiveShadow = true;
scene.add(floor);

// Мягкое неоновое кольцо вокруг платформы
const ringGeo = new THREE.RingGeometry(4.45, 4.5, 64);
const ringMat = new THREE.MeshBasicMaterial({ 
    color: 0x6ee7b7,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
});
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = floorY + 0.001;
scene.add(ring);

// Генерация текстуры мягкой тени через Canvas
function createShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    return new THREE.CanvasTexture(canvas);
}

const shadowGeo = new THREE.PlaneGeometry(3, 3);
const shadowMat = new THREE.MeshBasicMaterial({
    map: createShadowTexture(),
    transparent: true,
    depthWrite: false
});
const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
shadowMesh.rotation.x = -Math.PI / 2;
shadowMesh.position.y = floorY + 0.002;
scene.add(shadowMesh);

// ==========================================
// ФИЗИКА ЖЕЛЕ (Пружины + Вязкость + Дыхание)
// ==========================================
const jellyPhysics = {
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0,

    vX: 0,
    vY: 0,
    vZ: 0,

    stiffness: 0.0006,
    damping: 0.9,

    applyImpulse(fx, fy, fz) {
        this.vX += fx;
        this.vY += fy;
        this.vZ += fz;
    },

    update(isGrounded, time) {
        let targetX = 1.0;
        let targetY = 1.0;
        let targetZ = 1.0;

        if (isGrounded) {
            const breath = Math.sin(time * 2.5) * 0.035;
            targetY = 1.0 + breath;
            targetX = 1.0 - breath * 0.5;
            targetZ = 1.0 - breath * 0.5;
        }

        const fX = -this.stiffness * (this.scaleX - targetX);
        const fY = -this.stiffness * (this.scaleY - targetY);
        const fZ = -this.stiffness * (this.scaleZ - targetZ);

        this.vX = (this.vX + fX) * this.damping;
        this.vY = (this.vY + fY) * this.damping;
        this.vZ = (this.vZ + fZ) * this.damping;

        this.scaleX += this.vX;
        this.scaleY += this.vY;
        this.scaleZ += this.vZ;

        this.scaleY = Math.max(0.45, Math.min(this.scaleY, 1.8));
        this.scaleX = Math.max(0.6, Math.min(this.scaleX, 1.8));
        this.scaleZ = Math.max(0.6, Math.min(this.scaleZ, 1.8));

        if (!isGrounded && Math.abs(this.vX) < 0.0001 && Math.abs(this.scaleX - 1.0) < 0.001) { this.scaleX = 1.0; this.vX = 0; }
        if (!isGrounded && Math.abs(this.vY) < 0.0001 && Math.abs(this.scaleY - 1.0) < 0.001) { this.scaleY = 1.0; this.vY = 0; }
        if (!isGrounded && Math.abs(this.vZ) < 0.0001 && Math.abs(this.scaleZ - 1.0) < 0.001) { this.scaleZ = 1.0; this.vZ = 0; }
    }
};

// Переменные падения и анимации
let jellyModel = null;
const baseScale = 20;
let rawMinY = 0;
let posY = 4.5;
let velocityY = 0;
const gravity = 0.001; 
const bounceCoeff = 0.1; 
let isGrounded = false;
let animTime = 0;

// 5. ЗАГРУЗКА МОДЕЛИ
const loader = new GLTFLoader();

loader.load(
    'models/jelly/scene.gltf',
    (gltf) => {
        jellyModel = gltf.scene;

        jellyModel.scale.set(1, 1, 1);
        const box = new THREE.Box3().setFromObject(jellyModel);
        rawMinY = box.min.y;

        jellyModel.scale.set(baseScale, baseScale, baseScale);
        jellyModel.position.set(0, posY, 0);

        jellyModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                if (child.material) {
                    const mat = child.material;
                    mat.transparent = true;
                    mat.opacity = 0.95;
                    mat.side = THREE.DoubleSide;
                    mat.depthWrite = false;
                    mat.needsUpdate = true;
                }
            }
        });

        scene.add(jellyModel);
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% загружено');
    },
    (error) => {
        console.error('Ошибка при загрузке модели:', error);
    }
);

// ИНТЕРАКТИВНОСТЬ (Клик)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    if (jellyModel) {
        const intersects = raycaster.intersectObject(jellyModel, true);
        if (intersects.length > 0) {
            jellyPhysics.applyImpulse(
                (Math.random() - 0.5) * 0.2, 
                -0.28, 
                (Math.random() - 0.5) * 0.2
            );

            if (isGrounded) {
                isGrounded = false;
                velocityY = 0.05;
            }
        }
    }
});

const launchBtn = document.getElementById('launch-btn');
if (launchBtn) {
    launchBtn.addEventListener('click', () => {
        if (jellyModel && isGrounded) {
            isGrounded = false;
            velocityY = 0.18;
            jellyPhysics.applyImpulse(-0.1, 0.3, -0.1);
        }
    });
}

// 6. ЦИКЛ АНИМАЦИИ
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    animTime += 0.016;

    if (jellyModel) {
        jellyPhysics.update(isGrounded, animTime);

        if (!isGrounded) {
            velocityY -= gravity;
            posY += velocityY;

            jellyPhysics.scaleY = 1.0 - velocityY * 0.8;
            jellyPhysics.scaleX = 1.0 + velocityY * 0.4;
            jellyPhysics.scaleZ = 1.0 + velocityY * 0.4;

            const currentBottomY = posY + (rawMinY * baseScale * jellyPhysics.scaleY);

            if (currentBottomY <= floorY) {
                const impactSpeed = Math.abs(velocityY);
                
                jellyPhysics.applyImpulse(
                    impactSpeed * 1.2, 
                    -impactSpeed * 1.2, 
                    impactSpeed * 1.2
                );

                velocityY = impactSpeed * bounceCoeff;

                if (velocityY < 0.01) {
                    velocityY = 0;
                    isGrounded = true;
                }
            }
        }

        if (isGrounded) {
            posY = floorY - (rawMinY * baseScale * jellyPhysics.scaleY);
        }

        // Применяем трансформации
        jellyModel.position.y = posY;
        jellyModel.scale.set(
            baseScale * jellyPhysics.scaleX,
            baseScale * jellyPhysics.scaleY,
            baseScale * jellyPhysics.scaleZ
        );

        // ОБНОВЛЕНИЕ ДИНАМИЧЕСКОЙ ТЕНИ
        const distFromFloor = Math.max(0, posY - (floorY - rawMinY * baseScale));
        const shadowFactor = Math.max(0.1, 1 - distFromFloor / 5);
        
        shadowMesh.scale.set(
            jellyPhysics.scaleX * shadowFactor, 
            jellyPhysics.scaleZ * shadowFactor, 
            1
        );
        shadowMat.opacity = 0.7 * shadowFactor;
    }

    renderer.render(scene, camera);
}
animate();

// 7. АДАПТИВНОСТЬ
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});