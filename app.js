AFRAME.registerComponent('interior-reflective', {
  init: function() {
    const el = this.el;
    const applyIntensity = () => {
      if (el.object3D && el.object3D.children) {
        el.object3D.children.forEach((child) => {
          if (child.material) {
            child.material.envMapIntensity = 1.0;
          }
        });
      }
    };
    applyIntensity();
    el.addEventListener('object3dset', applyIntensity);
  }
});

AFRAME.registerComponent('box-opener', {
  init: function() {
    const el = this.el;
    let isOpen = false;

    el.addEventListener('click', () => {
      if (isOpen) {
        console.log('📦 Box already open');
        return;
      }

      console.log('🎁 Opening jewelry box...');
      isOpen = true;

      const boxText = document.getElementById('box-text');
      if (boxText) {
        boxText.setAttribute('animation__text-fade', {
          property: 'opacity',
          to: 0,
          dur: 600,
          easing: 'easeOutQuad'
        });
        setTimeout(() => {
          boxText.setAttribute('visible', 'false');
        }, 600);
        console.log('✨ Text hidden');
      }
      el.setAttribute('animation__open', {
        property: 'rotation',
        to: '75 0 0',
        dur: 1200,
        easing: 'easeOutCubic'
      });
      setTimeout(() => {
        const rings = document.querySelectorAll('[ring-focus]');
        console.log(`✨ Found ${rings.length} rings to reveal`);
        
        if (rings.length === 0) {
          console.error('❌ No rings found! Check HTML structure');
          return;
        }
        
        rings.forEach((ring, idx) => {
          try {
            const ringModel = ring.getAttribute('src');
            const originalScale = ring.getAttribute('scale');
            
            const scaleX = parseFloat(originalScale.x);
            const scaleY = parseFloat(originalScale.y);
            const scaleZ = parseFloat(originalScale.z);
            
            console.log(`📍 Ring ${idx + 1}: ${ringModel} - Original scale: ${scaleX}`);
            ring.setAttribute('visible', 'true');
            if (ring.object3D) {
              ring.object3D.visible = true;
            }
            console.log(`✅ Ring ${idx + 1} set to visible`);
            ring.setAttribute('animation__reveal', {
              property: 'scale',
              from: `0.05 0.05 0.05`,
              to: `${scaleX} ${scaleY} ${scaleZ}`,
              dur: 1000 + (idx * 200),
              easing: 'easeOutElastic'
            });
            ring.setAttribute('animation__reveal-rotate', {
              property: 'rotation',
              from: '45 0 45',
              to: '0 0 0',
              dur: 1000 + (idx * 200),
              easing: 'easeOutElastic'
            });
            console.log(`🎬 Ring ${idx + 1} animation started - scaling to ${scaleX} with rotation`);
            
          } catch (e) {
            console.error(`Error revealing ring ${idx + 1}:`, e);
          }
        });
        
        console.log('🎉 All rings reveal animations queued!');
      }, 700);
    });
  }
});

AFRAME.registerComponent('hdr-env', {
  init: function() {
    const sceneEl = this.el.sceneEl;
    sceneEl.addEventListener('renderstart', () => {
      if (!window.THREE || !window.THREE.RGBELoader) {
        console.warn('THREE.RGBELoader not available, skipping HDR environment setup');
        return;
      }

      const loader = new window.THREE.RGBELoader();
      loader.load('assets/hdri/golden_bay_4k.hdr', (hdrTex) => {
        hdrTex.mapping = window.THREE.EquirectangularReflectionMapping;

        const PMREMGenerator = window.THREE.PMREMGenerator;
        if (!PMREMGenerator) {
          console.warn('PMREMGenerator not available, using raw HDR');
          sceneEl.object3D.background = hdrTex;
          sceneEl.object3D.environment = hdrTex;
          return;
        }

        const pmremGenerator = new PMREMGenerator(sceneEl.renderer);
        pmremGenerator.compileEquirectangularShader();
        const envMap = pmremGenerator.fromEquirectangular(hdrTex).texture;

        sceneEl.object3D.environment = envMap;
        sceneEl.object3D.background = hdrTex;

        hdrTex.dispose && hdrTex.dispose();
        pmremGenerator.dispose && pmremGenerator.dispose();
      });
    });
  }
});

AFRAME.registerComponent('state-manager', {
  init: function() {
    this.isBusy = false;
    this.isAnimating = false;
    this.focusedRing = null;
  }
});

AFRAME.registerComponent('ring-focus', {
  init: function() {
    const el = this.el;
    this.originalPosition = el.getAttribute('position');
    this.originalScale = el.getAttribute('scale');
    this.originalRotation = el.getAttribute('rotation') || {x:0,y:0,z:0};
    this.autoRotating = false;

    console.log(`💾 Stored original state - Position: (${this.originalPosition.x}, ${this.originalPosition.y}, ${this.originalPosition.z}), Scale: (${this.originalScale.x}, ${this.originalScale.y}, ${this.originalScale.z})`);

    this.focusDistance = 0.9;
    this.focusDur = 1000;

    window.tuneables = window.tuneables || {};
    window.tuneables.focusDistance = this.focusDistance;

    el.addEventListener('mouseenter', () => { document.body.style.cursor = 'pointer'; });
    el.addEventListener('mouseleave', () => { document.body.style.cursor = 'default'; });
    el.addEventListener('mouseenter', () => { document.body.style.cursor = 'pointer'; });
    el.addEventListener('mouseleave', () => { document.body.style.cursor = 'default'; });

    el.addEventListener('click', (e) => {
      console.log('🎯 Ring clicked:', el.getAttribute('src'));
      const scene = el.sceneEl;
      const state = scene.components['state-manager'];
      
      if (state.isBusy) {
        console.log('⚠️ Scene is busy, ignoring click');
        return;
      }

      console.log('✨ Focusing ring, animating to camera...');
      state.isBusy = true;
      state.isAnimating = true;
      state.focusedRing = el;

      const cam = scene.camera;
      const camPos = new THREE.Vector3();
      cam.getWorldPosition(camPos);
      const camDir = new THREE.Vector3();
      cam.getWorldDirection(camDir);

      const target = camPos.clone().add(camDir.multiplyScalar(window.tuneables.focusDistance || this.focusDistance));
      target.y = camPos.y - 0.15;

      console.log(`📍 Target position: (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`);
      el.setAttribute('animation__focus_pos', {
        property: 'position',
        to: `${target.x} ${target.y} ${target.z}`,
        dur: this.focusDur,
        easing: 'easeOutCubic'
      });

      el.setAttribute('animation__focus_scale', {
        property: 'scale',
        to: `${this.originalScale.x * 1.6} ${this.originalScale.y * 1.6} ${this.originalScale.z * 1.6}`,
        dur: this.focusDur,
        easing: 'easeOutCubic'
      });

      const newRot = { x: 0, y: (el.getAttribute('rotation')||{}).y || 0, z: 0 };
      el.setAttribute('rotation', newRot);

      document.getElementById('ui-container').classList.add('visible');
      
      const ringName = el.getAttribute('data-ring-name') || 'Ring';
      document.getElementById('ring-name-display').textContent = ringName;
      console.log(`💍 Displaying ring name: ${ringName}`);
      
      window.currentZoom = 100;
      window.focusedRingBaseScale = {
        x: parseFloat(this.originalScale.x),
        y: parseFloat(this.originalScale.y),
        z: parseFloat(this.originalScale.z)
      };
      window.focusedRingElement = el;
      document.getElementById('zoom-slider').value = 100;
      document.getElementById('zoom-value').textContent = '100';
      
      console.log('🔘 Close button and zoom control shown');
      setTimeout(() => {
        state.isAnimating = false;
        console.log('✅ Animation complete, ring ready for drag');
        this.startAutoRotation(el);
      }, this.focusDur + 20);
    });
  },

  startAutoRotation: function(el) {
    const focusComp = this;
    
    if (focusComp.autoRotating) return;
    focusComp.autoRotating = true;
    
    console.log('🌀 Auto-rotation started');
    el.setAttribute('animation__auto-rotate', {
      property: 'rotation',
      from: '0 0 0',
      to: '0 360 0',
      dur: 8000,
      easing: 'linear',
      loop: 'true'
    });
  },

  stopAutoRotation: function(el) {
    const focusComp = this;
    
    if (!focusComp.autoRotating) return;
    focusComp.autoRotating = false;
    
    console.log('⏸️ Auto-rotation paused for manual control');
    el.removeAttribute('animation__auto-rotate');
  }
});

AFRAME.registerComponent('drag-rotate', {
  init: function() {
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    const el = this.el;

    const startDrag = (x, y) => {
      const scene = el.sceneEl;
      const state = scene.components['state-manager'];
      if (state.focusedRing !== el || state.isAnimating) {
        console.log('❌ Cannot drag: focused=', state.focusedRing === el, 'animating=', state.isAnimating);
        return false;
      }
      console.log('🎬 Drag started on ring');
      const focusComp = el.components['ring-focus'];
      if (focusComp) {
        focusComp.stopAutoRotation(el);
      }
      
      this.isDragging = true;
      this.lastX = x;
      this.lastY = y;
      return true;
    };

    const updateRotation = (x, y) => {
      if (!this.isDragging) return;
      const deltaX = x - this.lastX;
      const deltaY = y - this.lastY;
      const rotation = el.getAttribute('rotation') || {x: 0, y: 0, z: 0};
      const sensitivity = window.tuneables.dragSensitivity || 0.4;
      
      rotation.y = rotation.y + deltaX * sensitivity;
      
      rotation.x = Math.max(-90, Math.min(90, rotation.x - deltaY * sensitivity));
      
      el.setAttribute('rotation', rotation);
      console.log(`🔄 Rotating: Y ${oldY.toFixed(2)}°→${rotation.y.toFixed(2)}°, X ${oldX.toFixed(2)}°→${rotation.x.toFixed(2)}° (360° view)`);
      this.lastX = x;
      this.lastY = y;
    };

    const endDrag = () => {
      if (this.isDragging) {
        console.log('🎬 Drag ended, resuming auto-rotation');
        const focusComp = el.components['ring-focus'];
        if (focusComp && focusComp.autoRotating === false) {
          focusComp.startAutoRotation(el);
        }
      }
      this.isDragging = false;
    };

    el.addEventListener('mousedown', (e) => {
      if (!startDrag(e.clientX, e.clientY)) return;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => updateRotation(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (!startDrag(e.touches[0].clientX, e.touches[0].clientY)) return;
      e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      updateRotation(e.touches[0].clientX, e.touches[0].clientY);
    });

    document.addEventListener('touchend', endDrag);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  const resetRotationBtn = document.getElementById('reset-rotation-btn');
  const zoomSlider = document.getElementById('zoom-slider');
  const zoomValue = document.getElementById('zoom-value');

  resetRotationBtn.addEventListener('click', () => {
    console.log('🔄 Reset rotation button clicked');
    const scene = document.querySelector('a-scene');
    const state = scene.components['state-manager'];
    if (!state.focusedRing) {
      console.log('⚠️ No focused ring to reset');
      return;
    }

    const ring = state.focusedRing;
    ring.setAttribute('animation__reset-rotation', {
      property: 'rotation',
      to: '0 0 0',
      dur: 500,
      easing: 'easeOutCubic'
    });
    console.log('✨ Ring rotation reset to 0°');
  });

  zoomSlider.addEventListener('input', (e) => {
    const zoomPercent = parseInt(e.target.value);
    window.currentZoom = zoomPercent;
    zoomValue.textContent = zoomPercent;

    if (window.focusedRingElement && window.focusedRingBaseScale) {
      const baseScale = window.focusedRingBaseScale;
      const zoomFactor = 1 + (zoomPercent / 100) * 0.6;
      const newScale = `${baseScale.x * zoomFactor} ${baseScale.y * zoomFactor} ${baseScale.z * zoomFactor}`;
      window.focusedRingElement.setAttribute('scale', newScale);
      console.log(`🔍 Zoom: ${zoomPercent}% → Scale: ${zoomFactor.toFixed(2)}x`);
    }
  });

  closeBtn.addEventListener('click', () => {
    console.log('❌ Close button clicked');
    const scene = document.querySelector('a-scene');
    const state = scene.components['state-manager'];
    if (!state.focusedRing) {
      console.log('⚠️ No focused ring to close');
      return;
    }

    const ring = state.focusedRing;
    const focusComp = ring.components['ring-focus'];

    console.log('🔄 Returning ring to original position...');
    console.log('💾 Original values:', focusComp.originalPosition, focusComp.originalScale);
    ring.removeAttribute('animation__focus_pos');
    ring.removeAttribute('animation__focus_scale');
    ring.removeAttribute('animation__auto-rotate');
    ring.removeAttribute('animation__reset-rotation');
    console.log('🗑️ Cleared focus animations');
    state.isAnimating = true;

    const p = focusComp.originalPosition;
    const posString = typeof p === 'object' ? `${p.x || 0} ${p.y || 0} ${p.z || 0}` : p;
    ring.setAttribute('animation__return_pos', {
      property: 'position',
      from: ring.getAttribute('position'),
      to: posString,
      dur: 1000,
      easing: 'easeOutCubic'
    });
    console.log(`📍 Animating to original position: ${posString}`);
    const s = focusComp.originalScale;
    const scaleString = typeof s === 'object' ? `${s.x || 1} ${s.y || 1} ${s.z || 1}` : s;
    ring.setAttribute('animation__return_scale', {
      property: 'scale',
      from: ring.getAttribute('scale'),
      to: scaleString,
      dur: 1000,
      easing: 'easeOutCubic'
    });
    console.log(`📏 Animating to original scale: ${scaleString}`);

    const r = focusComp.originalRotation;
    const rotString = typeof r === 'object' ? `${r.x || 0} ${r.y || 0} ${r.z || 0}` : r;
    ring.setAttribute('animation__return_rotation', {
      property: 'rotation',
      from: ring.getAttribute('rotation'),
      to: rotString,
      dur: 1000,
      easing: 'easeOutCubic'
    });
    console.log('🔄 Reverse rotation animation started');
    document.getElementById('ui-container').classList.remove('visible');
    console.log('✅ UI hidden, waiting for animation...');
    setTimeout(() => {
      state.isBusy = false;
      state.isAnimating = false;
      state.focusedRing = null;
      console.log('🎬 Return animation complete, scene ready for next interaction');
    }, 1000 + 30);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.getElementById('preloader');
  const scene = document.querySelector('a-scene');

  console.log('🎬 Scene initialized, waiting for asset load...');

  const hidePreloader = () => {
    preloader.classList.add('hidden');
    console.log('✨ Preloader hidden');
  };

  scene.addEventListener('loaded', () => {
    console.log('🎨 Scene loaded event fired');

    setTimeout(hidePreloader, 800);
    const rings = document.querySelectorAll('[ring-focus]');
    console.log(`📿 Loaded ${rings.length} rings (hidden inside box)`);
    
    rings.forEach((ring, idx) => {
      const pos = ring.getAttribute('position');
      const model = ring.getAttribute('src');
      console.log(`   Ring ${idx + 1}: ${model} at (${pos.x}, ${pos.y}, ${pos.z}) - HIDDEN`);
    });
    
    console.log('💡 Click the box lid to open it and reveal the rings inside!');
  });
  setTimeout(() => {
    if (!preloader.classList.contains('hidden')) {
      hidePreloader();
    }
  }, 5000);
});

document.addEventListener('DOMContentLoaded', () => {
  const debugPanel = document.getElementById('debug-panel');
  const debugCloseBtn = document.getElementById('debug-close-btn');
  window.tuneables = window.tuneables || {};
  window.tuneables.metalness = 0.8;
  window.tuneables.roughness = 0.18;
  window.tuneables.focusDistance = 0.9;
  window.tuneables.dragSensitivity = 0.4;
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') {
      debugPanel.classList.toggle('visible');
    }
  });
  debugCloseBtn.addEventListener('click', () => {
    debugPanel.classList.remove('visible');
  });
  const metalSlider = document.getElementById('debug-metalness');
  const metalValue = document.getElementById('metalness-value');
  metalSlider.addEventListener('input', (e) => {
    window.tuneables.metalness = parseFloat(e.target.value);
    metalValue.textContent = window.tuneables.metalness.toFixed(2);
    updateInteriorMaterials();
  });
  const roughSlider = document.getElementById('debug-roughness');
  const roughValue = document.getElementById('roughness-value');
  roughSlider.addEventListener('input', (e) => {
    window.tuneables.roughness = parseFloat(e.target.value);
    roughValue.textContent = window.tuneables.roughness.toFixed(2);
    updateInteriorMaterials();
  });
  const focusSlider = document.getElementById('debug-focus-distance');
  const focusValue = document.getElementById('focus-distance-value');
  focusSlider.addEventListener('input', (e) => {
    window.tuneables.focusDistance = parseFloat(e.target.value);
    focusValue.textContent = window.tuneables.focusDistance.toFixed(2);
  });
  const dragSlider = document.getElementById('debug-drag-sensitivity');
  const dragValue = document.getElementById('drag-sensitivity-value');
  dragSlider.addEventListener('input', (e) => {
    window.tuneables.dragSensitivity = parseFloat(e.target.value);
    dragValue.textContent = window.tuneables.dragSensitivity.toFixed(2);
  });
  function updateInteriorMaterials() {
    const box = document.querySelector('a-box[interior-reflective]');
    const plane = document.querySelector('a-plane[interior-reflective]');

    [box, plane].forEach((el) => {
      if (el && el.object3D) {
        el.object3D.traverse((node) => {
          if (node.material) {
            node.material.metalness = window.tuneables.metalness;
            node.material.roughness = window.tuneables.roughness;
          }
        });
      }
    });
  }
});
