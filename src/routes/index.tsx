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

type Room = {
  id: RoomId;
  name: string;
  image: string;
  // Direction (yaw) the camera should fly toward when leaving this room
  exits: Record<string, { to: RoomId; yaw: number; pitch: number }>;
};

const rooms: Room[] = [
  {
    id: "living",
    name: "Living Room",
    image: livingAsset.url,
    exits: { kitchen: { to: "kitchen", yaw: 60, pitch: -5 } },
  },
  {
    id: "kitchen",
    name: "Kitchen & Dining",
    image: kitchenAsset.url,
    exits: { living: { to: "living", yaw: -60, pitch: -5 } },
  },
];

function Tour() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const transitioningRef = useRef(false);
  const [currentRoom, setCurrentRoom] = useState<RoomId>("living");
  const [autoRotate, setAutoRotate] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const buildHotspots = (roomId: RoomId) => {
      const room = rooms.find((r) => r.id === roomId)!;
      return Object.values(room.exits).map((exit) => ({
        pitch: exit.pitch,
        yaw: exit.yaw,
        type: "scene",
        sceneId: exit.to,
        clickHandlerFunc: (_e: any, args: any) => walkTo(args.to as RoomId),
        clickHandlerArgs: { to: exit.to },
        cssClass: "tour-hotspot",
        createTooltipFunc: makeHotspot,
        createTooltipArgs: rooms.find((r) => r.id === exit.to)!.name,
      }));
    };

    const init = () => {
      if (cancelled || !containerRef.current) return;
      const pannellum = (window as any).pannellum;
      if (!pannellum) return;

      const sceneConfig: Record<string, any> = {};
      rooms.forEach((r) => {
        sceneConfig[r.id] = {
          type: "equirectangular",
          panorama: r.image,
          pitch: 0,
          yaw: 0,
          hfov: 100,
          hotSpots: buildHotspots(r.id),
        };
      });

      viewerRef.current = pannellum.viewer(containerRef.current, {
        default: {
          firstScene: "living",
          sceneFadeDuration: 1200,
          autoLoad: true,
          showControls: false,
          showFullscreenCtrl: false,
          showZoomCtrl: false,
          keyboardZoom: true,
          mouseZoom: true,
          draggable: true,
          hfov: 100,
          minHfov: 50,
          maxHfov: 120,
          compass: false,
          friction: 0.18,
        },
        scenes: sceneConfig,
      });

      viewerRef.current.on("load", () => {
        if (!cancelled) setLoaded(true);
      });
      viewerRef.current.on("scenechange", (id: string) => {
        if (!cancelled) setCurrentRoom(id as RoomId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-rotate toggle
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    try {
      if (autoRotate) v.startAutoRotate(-2);
      else v.stopAutoRotate();
    } catch {}
  }, [autoRotate, currentRoom]);

  // Smooth "walk into" transition: look toward the doorway, zoom in,
  // fade scene, then settle the camera in the new room facing back.
  const walkTo = (targetId: RoomId) => {
    const v = viewerRef.current;
    if (!v || transitioningRef.current) return;
    const fromId = v.getScene() as RoomId;
    if (fromId === targetId) return;

    const fromRoom = rooms.find((r) => r.id === fromId);
    const exit = fromRoom?.exits[targetId];
    transitioningRef.current = true;
    setTransitioning(true);

    try {
      v.stopAutoRotate();
      // 1. Aim camera at the doorway
      if (exit) {
        v.lookAt(exit.pitch, exit.yaw, 75, 700);
      }
    } catch {}

    // 2. After the look-at finishes, load the next scene facing back
    window.setTimeout(() => {
      const back = rooms.find((r) => r.id === targetId)?.exits[fromId];
      const entryYaw = back ? back.yaw + 180 : 0;
      try {
        v.loadScene(targetId, 0, entryYaw, 100);
      } catch {}
      window.setTimeout(() => {
        transitioningRef.current = false;
        setTransitioning(false);
      }, 1300);
    }, 750);
  };

  const currentName = rooms.find((r) => r.id === currentRoom)?.name ?? "";
  const currentIndex = rooms.findIndex((r) => r.id === currentRoom) + 1;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden text-white">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading veil */}
      {!loaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <p className="text-xs tracking-[0.3em] uppercase text-white/70">Preparing your tour</p>
          </div>
        </div>
      )}

      {/* Transition veil for "walk-in" effect */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-black transition-opacity duration-700 ${
          transitioning ? "opacity-60" : "opacity-0"
        }`}
      />

      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center text-[11px] font-semibold tracking-widest">
            VT
          </div>
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">Virtual Tour</p>
            <p className="text-sm font-medium">Private Residence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 backdrop-blur-md border border-white/10 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live 360°
          </span>
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs border backdrop-blur-md transition ${
              autoRotate
                ? "bg-white text-black border-white"
                : "bg-white/8 text-white border-white/10 hover:bg-white/15"
            }`}
          >
            {autoRotate ? "Pause" : "Auto-rotate"}
          </button>
        </div>
      </header>

      {/* Current room badge */}
      <div className="absolute top-20 sm:top-24 left-4 sm:left-6 z-20">
        <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/45 backdrop-blur-xl border border-white/10 shadow-2xl">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">
            {String(currentIndex).padStart(2, "0")} / {String(rooms.length).padStart(2, "0")}
          </span>
          <span className="h-3 w-px bg-white/20" />
          <span className="text-sm font-medium tracking-wide">{currentName}</span>
        </div>
      </div>

      {/* Hint */}
      <div className="absolute bottom-32 sm:bottom-36 left-1/2 -translate-x-1/2 z-10 text-[10px] uppercase tracking-[0.3em] text-white/40 text-center pointer-events-none">
        Drag to look around · Click <span className="text-white/80">→</span> to walk through
      </div>

      {/* Thumbnail nav */}
      <nav className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2 p-2 rounded-2xl bg-black/55 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[calc(100vw-1.5rem)] overflow-x-auto">
        {rooms.map((room) => {
          const active = room.id === currentRoom;
          return (
            <button
              key={room.id}
              onClick={() => walkTo(room.id)}
              className={`group relative shrink-0 rounded-xl overflow-hidden transition-all duration-300 ${
                active
                  ? "ring-2 ring-white"
                  : "ring-1 ring-white/15 opacity-75 hover:opacity-100 hover:ring-white/40"
              }`}
              style={{ width: 112, height: 72 }}
            >
              <img src={room.image} alt={room.name} className="w-full h-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className="absolute inset-x-0 bottom-1 px-2 text-[10px] font-medium tracking-wide text-left text-white">
                {room.name}
              </span>
              {active && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      <style>{`
        .tour-hotspot {
          height: 64px;
          width: 64px;
          background: transparent;
          margin-left: -32px;
          margin-top: -32px;
        }
        .tour-hotspot-inner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 56px;
          width: 56px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.95);
          color: #111;
          font-size: 24px;
          font-weight: 600;
          box-shadow: 0 8px 28px rgba(0,0,0,0.45);
          animation: tour-pulse 2.4s ease-in-out infinite;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .tour-hotspot-inner::before {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.35);
        }
        .tour-hotspot:hover .tour-hotspot-inner {
          transform: scale(1.08);
          background: #fff;
        }
        .tour-hotspot-label {
          position: absolute;
          top: 68px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(8px);
          color: #fff;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.05em;
          padding: 5px 12px;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.1);
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          pointer-events: none;
        }
        .tour-hotspot:hover .tour-hotspot-label {
          opacity: 1;
          transform: translateX(-50%) translateY(2px);
        }
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 8px 28px rgba(0,0,0,0.45), 0 0 0 0 rgba(255,255,255,0.45); }
          50%      { box-shadow: 0 8px 28px rgba(0,0,0,0.45), 0 0 0 16px rgba(255,255,255,0); }
        }
        .pnlm-container { background: #000 !important; }
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
  label.textContent = `Enter ${args}`;
  inner.appendChild(label);
  hotSpotDiv.appendChild(inner);
}
