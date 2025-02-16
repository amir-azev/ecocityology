import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TerrainCutout } from "../../../api/TerrainCutout";

const RenderCity = ({
  regionWater,
  fullRegionImage,
  boxWidth = 600, // Default width if not provided
  boxHeight = 400, // Default height if not provided
}) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      boxWidth / boxHeight,
      1,
      1000
    );
    camera.position.set(-8, 5, 8).setLength(25);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(boxWidth, boxHeight);
    renderer.setClearColor(0x7f7f7f);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.setScalar(10);
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));

    // Load the image from localStorage
    const base64String = localStorage.getItem('stitchedImage');
    if (base64String) {
      const textureLoader = new THREE.TextureLoader();
      const heightMap = textureLoader.load(base64String);

      const terrainCutout = new TerrainCutout(20, 2, 20, 200, 200, heightMap);
      terrainCutout.material.displacementScale = 5;
      scene.add(terrainCutout);
    } else {
      console.error('No image stored in localStorage');
    }

    const handleResize = () => {
      camera.aspect = boxWidth / boxHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(boxWidth, boxHeight);
    };

    window.addEventListener("resize", handleResize);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Clean up on unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, [boxWidth, boxHeight]);

  return (
    <div
      className="relative border border-gray-300"
      style={{
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
        overflow: "hidden",
        backgroundColor: "#eee",
        position: "relative",
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default RenderCity;
