import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const SurfacePlot = ({ 
  regionElevationArray,
            regionMatrixWidth,
            regionMatrixHeight,}) => {
  // data: flat array of elevations with length = width * height


  const data = regionElevationArray
  const width = regionMatrixWidth
  const height = regionMatrixHeight
  console.log(data)
  console.log(width)


  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // === Basic Three.js Setup ===
    const container = containerRef.current;
    const rendererWidth = container.clientWidth;
    const rendererHeight = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, rendererWidth / rendererHeight, 0.1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(rendererWidth, rendererHeight);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // === Build the Geometry from Flat Data ===
    // Here, we assume the grid has:
    //  - 'width' columns (x-direction)
    //  - 'height' rows (z-direction)
    // The elevation is stored in 'data' (a flat array), where:
    //    index = row * width + col
    const vertices = [];
    const indices = [];

    // Create vertices. Map each grid cell to a vertex.
    // x = col, y = elevation, z = row.
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const index = row * width + col;
        const elevation = data[index];
        const x = col;
        const y = elevation;
        const z = row;
        vertices.push(x, y, z);
      }
    }

    // Create indices to form two triangles per grid cell.
    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width - 1; col++) {
        const topLeft = row * width + col;
        const topRight = topLeft + 1;
        const bottomLeft = (row + 1) * width + col;
        const bottomRight = bottomLeft + 1;

        // First triangle
        indices.push(topLeft, bottomLeft, topRight);
        // Second triangle
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    // Create BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Material
    const material = new THREE.MeshPhongMaterial({
      color: 0x66ccff,
      side: THREE.DoubleSide,
      shininess: 80,
    });

    // Create Mesh
    const mesh = new THREE.Mesh(geometry, material);
    // Center the mesh so that the grid is centered around the origin.
    mesh.position.set(-width / 2, 0, -height / 2);
    scene.add(mesh);

    // === Animation Loop ===
    const animate = () => {
      requestAnimationFrame(animate);
      mesh.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    // === Cleanup on Unmount ===
    return () => {
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [data, width, height]);

  return (
    <div
      ref={containerRef}
      style={{ width: '800px', height: '600px', border: '1px solid black' }}
    />
  );
};

export default SurfacePlot;
