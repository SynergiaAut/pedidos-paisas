"use client";

import * as React from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

interface DottedSurfaceProps {
  children?: React.ReactNode;
  className?: string;
  dotColor?: string;
  accentColor?: string;
}

export function DottedSurface({
  children,
  className,
  dotColor = "#d8dde6",
  accentColor = "#f6a400",
}: DottedSurfaceProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2.45, 5.25);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const columns = 148;
    const rows = 76;
    const spacing = 0.34;
    const count = columns * rows;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const base = new THREE.Color(dotColor);
    const accent = new THREE.Color(accentColor);

    let index = 0;
    for (let z = 0; z < rows; z += 1) {
      for (let x = 0; x < columns; x += 1) {
        const px = (x - columns / 2) * spacing;
        const pz = (z - rows / 2) * spacing;
        const distance = Math.hypot(px * 0.5, pz);
        const mix = Math.max(0, 1 - distance / 7.4) * 0.12;
        const color = base.clone().lerp(accent, mix);

        positions[index * 3] = px;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = pz;
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
        sizes[index] = 10 + mix * 6;
        index += 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uTime;

        void main() {
          vColor = color;
          vec3 pos = position;
          float wave = sin((pos.x * 0.95) + (pos.z * 1.35) + uTime * 0.75) * 0.18;
          float ripple = cos(length(pos.xz) * 1.05 - uTime * 0.85) * 0.12;
          pos.y = wave + ripple;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (1.15 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          float alpha = smoothstep(0.42, 0.18, dist);
          gl_FragColor = vec4(vColor, alpha * 0.5);
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = -0.94;
    points.position.y = -2.05;
    points.position.z = 0.45;
    scene.add(points);

    let frame = 0;
    let running = true;
    const clock = new THREE.Clock();

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const animate = () => {
      if (!running) return;
      frame = requestAnimationFrame(animate);
      material.uniforms.uTime.value = clock.getElapsedTime();
      points.rotation.z = Math.sin(clock.getElapsedTime() * 0.12) * 0.018;
      renderer.render(scene, camera);
    };

    resize();
    animate();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [accentColor, dotColor]);

  return (
    <div className={cn("relative size-full overflow-hidden", className)}>
      <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      {children}
    </div>
  );
}
