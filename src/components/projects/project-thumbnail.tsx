"use client";

import { useEffect, useRef, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { getStoredThumbnail, putStoredThumbnail } from "@/src/lib/file-store";
import { isSafeCoverUrl } from "@/src/lib/cover-image";
import type { PrintFile, Project } from "@/src/lib/makershelf-data";

type ProjectThumbnailProps = {
  project: Project;
  file?: PrintFile;
};

const renderableThumbnailTypes = new Set<PrintFile["type"]>(["STL", "OBJ", "3MF", "GCODE"]);
const MAX_AUTO_THUMBNAIL_BYTES = 8 * 1024 * 1024;

function thumbnailCacheKey(file: PrintFile) {
  return [
    "thumbnail",
    file.id,
    file.sizeBytes,
    file.storedPath,
    file.uploadedAt,
  ].join(":");
}

function canvasToWebpBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.82);
  });
}

function ThumbnailModelPreview({ file }: { file: PrintFile }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [cachedThumbnailUrl, setCachedThumbnailUrl] = useState("");
  const { getFileObjectUrl, settings } = useMakershelf();

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "280px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !mountRef.current || !renderableThumbnailTypes.has(file.type)) {
      return;
    }

    const previewLimitBytes = Math.min(settings.maxPreviewFileSizeMb * 1024 * 1024, MAX_AUTO_THUMBNAIL_BYTES);
    if (file.sizeBytes > previewLimitBytes) {
      setFailed(true);
      return;
    }

    let disposed = false;
    let cleanup = () => undefined;

    async function renderThumbnail() {
      const host = mountRef.current;
      if (!host) return;

      host.innerHTML = "";
      setFailed(false);

      let objectUrl = "";
      let cachedUrl = "";
      try {
        const cached = await getStoredThumbnail(thumbnailCacheKey(file));
        if (cached && !disposed) {
          cachedUrl = URL.createObjectURL(cached);
          setCachedThumbnailUrl(cachedUrl);
          cleanup = () => {
            if (cachedUrl.startsWith("blob:")) URL.revokeObjectURL(cachedUrl);
          };
          return;
        }

        objectUrl = await getFileObjectUrl(file.id);
        if (!objectUrl || disposed) {
          setFailed(true);
          return;
        }

        const THREE = await import("three");
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
        const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
        const { GCodeLoader } = await import("three/examples/jsm/loaders/GCodeLoader.js");

        if (disposed || !mountRef.current) return;

        const scene = new THREE.Scene();
        scene.background = null;
        const width = host.clientWidth || 420;
        const height = host.clientHeight || 260;
        const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 4000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight("#ffffff", 1.45);
        const key = new THREE.DirectionalLight("#ffffff", 2);
        key.position.set(90, 120, 80);
        const rim = new THREE.DirectionalLight("#38bdf8", 0.9);
        rim.position.set(-80, 60, -90);
        scene.add(ambient, key, rim);

        const material = new THREE.MeshStandardMaterial({
          color: "#f97316",
          metalness: 0.16,
          roughness: 0.52,
        });

        let object: InstanceType<typeof THREE.Object3D>;
        if (file.type === "STL") {
          const buffer = await fetch(objectUrl, { cache: "no-store" }).then((response) => response.arrayBuffer());
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(geometry, material);
        } else if (file.type === "OBJ") {
          object = await new OBJLoader().loadAsync(objectUrl);
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) child.material = material;
          });
        } else if (file.type === "3MF") {
          const buffer = await fetch(objectUrl, { cache: "no-store" }).then((response) => response.arrayBuffer());
          object = new ThreeMFLoader().parse(buffer);
          object.traverse((child) => {
            if (child instanceof THREE.Mesh && !child.material) child.material = material;
          });
        } else {
          const source = await fetch(objectUrl, { cache: "no-store" }).then((response) => response.text());
          object = new GCodeLoader().parse(source);
        }

        if (disposed) {
          renderer.dispose();
          return;
        }

        const initialBox = new THREE.Box3().setFromObject(object);
        const initialSize = initialBox.getSize(new THREE.Vector3());
        const initialCenter = initialBox.getCenter(new THREE.Vector3());
        const maxSize = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;

        if (!Number.isFinite(maxSize) || maxSize <= 0 || initialBox.isEmpty()) {
          throw new Error("No thumbnail geometry found.");
        }

        object.position.sub(initialCenter);
        const modelRoot = new THREE.Group();
        modelRoot.add(object);
        modelRoot.scale.setScalar(105 / maxSize);
        scene.add(modelRoot);

        const fittedBox = new THREE.Box3().setFromObject(modelRoot);
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
        modelRoot.position.sub(fittedCenter);
        fittedBox.setFromObject(modelRoot);
        const centeredSize = fittedBox.getSize(new THREE.Vector3());
        const centeredCenter = fittedBox.getCenter(new THREE.Vector3());
        const maxDimension = Math.max(centeredSize.x, centeredSize.y, centeredSize.z) || 1;
        const distance = Math.max(
          (maxDimension * 1.15) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2),
          120,
        );
        camera.position.copy(
          centeredCenter.clone().add(new THREE.Vector3(1, 0.74, 1.1).normalize().multiplyScalar(distance)),
        );
        camera.near = Math.max(0.1, distance / 100);
        camera.far = distance * 10;
        camera.lookAt(centeredCenter);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);

        const thumbnailBlob = await canvasToWebpBlob(renderer.domElement);
        if (thumbnailBlob && !disposed) {
          await putStoredThumbnail(thumbnailCacheKey(file), thumbnailBlob).catch(() => {
            // Thumbnail caching is best-effort; rendering should never fail because the cache is full.
          });
        }

        cleanup = () => {
          scene.traverse((child) => {
            const renderChild = child as typeof child & {
              geometry?: { dispose?: () => void };
              material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
            };
            renderChild.geometry?.dispose?.();
            const childMaterial = renderChild.material;
            if (Array.isArray(childMaterial)) {
              childMaterial.forEach((entry) => entry.dispose?.());
            } else {
              childMaterial?.dispose?.();
            }
          });
          renderer.dispose();
          host.innerHTML = "";
          if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
        };
      } catch {
        setFailed(true);
        if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
      }
    }

    void renderThumbnail();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [file, getFileObjectUrl, isVisible, settings.maxPreviewFileSizeMb]);

  if (failed) return null;

  return (
    <div className="absolute inset-0">
      {cachedThumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cachedThumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div ref={mountRef} className="h-full w-full" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(15,23,42,0.08)_45%,rgba(15,23,42,0.48)_100%)]" />
    </div>
  );
}

export function ProjectThumbnail({ project, file }: ProjectThumbnailProps) {
  if (project.coverImage && isSafeCoverUrl(project.coverImage)) {
    return (
      <div
        className="h-full w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${CSS.escape(project.coverImage)})` }}
      />
    );
  }

  return (
    <div className={`relative h-full w-full ${project.coverGradient}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_34%),linear-gradient(180deg,transparent,rgba(15,23,42,0.42))]" />
      {file && renderableThumbnailTypes.has(file.type) ? <ThumbnailModelPreview file={file} /> : null}
      <div className="absolute left-5 top-5 rounded-md bg-black/35 px-3 py-1 text-[11px] font-semibold text-white">
        {file?.type ?? "3D"}
      </div>
      <div className="absolute right-5 top-5 rounded-md bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
        {project.files.length} Dateien
      </div>
      <div className="absolute bottom-5 left-5 right-5">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">
          makershelf
        </p>
        <p className="mt-2 line-clamp-2 text-3xl font-black leading-none tracking-tight text-white">
          {project.title}
        </p>
        {file?.name ? (
          <p className="mt-2 truncate text-xs font-semibold text-white/70">
            Thumbnail: {file.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
