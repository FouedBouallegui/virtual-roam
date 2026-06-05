import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import livingAsset from "@/assets/living.jpeg.asset.json";
import kitchenAsset from "@/assets/kitchen.jpeg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Virtual House Tour — 360°" },
      { name: "description", content: "Explore the home in an immersive 360° virtual tour." },
      { property: "og:title", content: "Virtual House Tour — 360°" },
      { property: "og:description", content: "Explore the home in an immersive 360° virtual tour." },
    ],
    links: [
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css" },
    ],
  }),
  component: Tour,
});

type RoomId = "living" | "kitchen";

const rooms: { id: RoomId; name: string; image: string }[] = [
  { id: "living", name: "Living Room", image: livingAsset.url },
  { id: "kitchen", name: "Kitchen & Dining", image: kitchenAsset.url },
];

function Tour() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomId>("living");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !containerRef.current) return;
      const pannellum = (window as any).pannellum;
      if (!pannellum) return;

      viewerRef.current = pannellum.viewer(containerRef.current, {
        default: {
          firstScene: "living",
          sceneFadeDuration: 800,
          autoLoad: true,
          showControls: false,
          showFullscreenCtrl: false,
          showZoomCtrl: false,
          hfov: 100,
          compass: false,
        },
        scenes: {
          living: {
            type: "equirectangular",
            panorama: livingAsset.url,
            pitch: 0,
            yaw: 0,
            hotSpots: [
              {
                pitch: -5,
                yaw: 60,
                type: "scene",
                sceneId: "kitchen",
                text: "Go to Kitchen",
                cssClass: "tour-hotspot",
                createTooltipFunc: makeHotspot,
                createTooltipArgs: "Kitchen",
              },
            ],
          },
          kitchen: {
            type: "equirectangular",
            panorama: kitchenAsset.url,
            pitch: 0,
            yaw: 0,
            hotSpots: [
              {
                pitch: -5,
                yaw: -60,
                type: "scene",
                sceneId: "living",
                text: "Go to Living Room",
                cssClass: "tour-hotspot",
                createTooltipFunc: makeHotspot,
                createTooltipArgs: "Living Room",
              },
            ],
          },
        },
      });

      viewerRef.current.on("scenechange", (id: string) => {
        setCurrentRoom(id as RoomId);
      });
    };

    if (!(window as any).pannellum) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
      script.async = true;
      script.onload = init;
      document.body.appendChild(script);
    } else {
      init();
    }

    return () => {
      cancelled = true;
      try {
        viewerRef.current?.destroy?.();
      } catch {}
      viewerRef.current = null;
    };
  }, []);

  const jumpTo = (id: RoomId) => {
    viewerRef.current?.loadScene?.(id);
  };

  const currentName = rooms.find((r) => r.id === currentRoom)?.name ?? "";

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Room label */}
      <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-sm font-medium tracking-wide">
        {currentName}
      </div>

      {/* Thumbnail nav */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-3 p-3 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 max-w-[calc(100vw-2rem)] overflow-x-auto">
        {rooms.map((room) => {
          const active = room.id === currentRoom;
          return (
            <button
              key={room.id}
              onClick={() => jumpTo(room.id)}
              className={`group relative shrink-0 rounded-lg overflow-hidden transition-all ${
                active ? "ring-2 ring-white scale-105" : "ring-1 ring-white/20 opacity-70 hover:opacity-100"
              }`}
              style={{ width: 96, height: 64 }}
            >
              <img src={room.image} alt={room.name} className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[10px] font-medium px-1.5 py-1 text-left">
                {room.name}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        .tour-hotspot {
          height: 48px;
          width: 48px;
          background: transparent;
        }
        .tour-hotspot-inner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          width: 48px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.92);
          color: #111;
          font-size: 22px;
          font-weight: 600;
          box-shadow: 0 6px 20px rgba(0,0,0,0.35);
          animation: tour-pulse 2s ease-in-out infinite;
          cursor: pointer;
        }
        .tour-hotspot-label {
          position: absolute;
          top: 56px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 9999px;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        }
        .tour-hotspot:hover .tour-hotspot-label { opacity: 1; }
        @keyframes tour-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 0 rgba(255,255,255,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 12px rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
}

function makeHotspot(hotSpotDiv: HTMLDivElement, args: string) {
  const inner = document.createElement("div");
  inner.className = "tour-hotspot-inner";
  inner.innerHTML = "→";
  const label = document.createElement("span");
  label.className = "tour-hotspot-label";
  label.textContent = args;
  inner.appendChild(label);
  hotSpotDiv.appendChild(inner);
}
