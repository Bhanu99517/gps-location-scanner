import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SVGProps } from "react";
import { toast } from "sonner";

type ScanState = "idle" | "scanning" | "locked" | "error";

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
};

const formatCoordinate = (value?: number) => (typeof value === "number" ? value.toFixed(6) : "--.------");

type IconProps = SVGProps<SVGSVGElement>;

const Icon = ({ className, children }: IconProps & { children: ReactNode }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const Satellite = (props: IconProps) => <Icon {...props}><path d="M13 7 7 13" /><path d="m14 8 2-2 2 2-2 2Z" /><path d="m6 14 4 4" /><path d="m8 12 4 4" /><path d="M16 16a6 6 0 0 0-8-8" /><path d="M19 19A10 10 0 0 0 5 5" /></Icon>;
const Crosshair = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="7" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M2 12h4" /><path d="M18 12h4" /></Icon>;
const RefreshCw = (props: IconProps) => <Icon {...props}><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /></Icon>;
const MapPin = (props: IconProps) => <Icon {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Icon>;
const Copy = (props: IconProps) => <Icon {...props}><rect x="9" y="9" width="11" height="11" rx="2" /><rect x="4" y="4" width="11" height="11" rx="2" /></Icon>;
const LocateFixed = (props: IconProps) => <Icon {...props}><line x1="2" x2="5" y1="12" y2="12" /><line x1="19" x2="22" y1="12" y2="12" /><line x1="12" x2="12" y1="2" y2="5" /><line x1="12" x2="12" y1="19" y2="22" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /></Icon>;

const Index = () => {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [lockedCoords, setLockedCoords] = useState<Coordinates | null>(null);
  const [bestAccuracy, setBestAccuracy] = useState<number | null>(null);
  const [liveTime, setLiveTime] = useState(Date.now());
  const [error, setError] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const hasAnnouncedScanRef = useRef(false);

  const displayCoords = lockedCoords ?? coords;
  const hasOneMeterAccuracy = !!coords && coords.accuracy <= 1;

  const status = useMemo(() => {
    if (scanState === "locked") return "GPS LOCKED";
    if (scanState === "scanning") return hasOneMeterAccuracy ? "±1 M READY" : "SEEKING ±1 M";
    if (scanState === "error") return "SIGNAL BLOCKED";
    return "READY TO SCAN";
  }, [hasOneMeterAccuracy, scanState]);

  const startScan = useCallback(() => {
    if (!navigator.geolocation) {
      setScanState("error");
      setError("GPS is not available on this device or browser.");
      return;
    }

    setScanState("scanning");
    setError("");
    setBestAccuracy(null);
    setLockedCoords(null);
    hasAnnouncedScanRef.current = false;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const handlePosition = (position: GeolocationPosition) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        setCoords(nextCoords);
        setBestAccuracy((currentBest) => (currentBest === null ? nextCoords.accuracy : Math.min(currentBest, nextCoords.accuracy)));
        setScanState("scanning");
        if (!hasAnnouncedScanRef.current) {
          toast.success("Live GPS scanning");
          hasAnnouncedScanRef.current = true;
        }
      };

    navigator.geolocation.getCurrentPosition(handlePosition, () => undefined, { enableHighAccuracy: false, timeout: 2000, maximumAge: 30000 });

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (geoError) => {
        setScanState("error");
        setError(geoError.message || "Unable to read your current GPS position.");
        toast.error("GPS scan failed");
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 },
    );
  }, []);

  useEffect(() => {
    startScan();

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [startScan]);

  useEffect(() => {
    if (scanState !== "scanning") return;

    const timerId = window.setInterval(() => setLiveTime(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [scanState]);

  const lockGps = () => {
    if (!coords) return;
    setLockedCoords(coords);
    setScanState("locked");
    toast.success("GPS coordinates locked instantly");
  };

  const copyCoordinates = async () => {
    if (!displayCoords) return;
    await navigator.clipboard.writeText(`${displayCoords.latitude.toFixed(6)}, ${displayCoords.longitude.toFixed(6)}`);
    toast.success("Latitude and longitude copied");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground radar-grid">
      <div className="absolute inset-0 bg-radar-glow" aria-hidden="true" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md border border-signal/40 bg-signal/10 shadow-signal">
              <Satellite className="h-5 w-5 text-signal" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Geo scanner</p>
              <h1 className="text-xl font-semibold uppercase sm:text-2xl">Latitude / Longitude</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-xs uppercase text-muted-foreground sm:flex">
            <span className="h-2 w-2 rounded-full bg-signal animate-pulse-signal" />
            {status}
          </div>
        </header>

        <div className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative aspect-square min-h-[310px] overflow-hidden rounded-md border border-border bg-panel-shell p-5 shadow-signal">
            <div className="absolute inset-5 rounded-full border border-signal/35" />
            <div className="absolute inset-14 rounded-full border border-signal/20" />
            <div className="absolute inset-[30%] rounded-full border border-accent/30" />
            <div className="absolute left-1/2 top-5 h-[calc(100%-2.5rem)] w-px -translate-x-1/2 bg-border/80" />
            <div className="absolute left-5 top-1/2 h-px w-[calc(100%-2.5rem)] -translate-y-1/2 bg-border/80" />
            {scanState === "scanning" && <div className="scan-mask absolute inset-y-8 w-1/2 animate-sweep blur-sm" aria-hidden="true" />}
            <div className="absolute inset-0 grid place-items-center">
              <button
                type="button"
                onClick={scanState === "locked" ? startScan : lockGps}
                className="group grid h-36 w-36 place-items-center rounded-full border border-signal/60 bg-signal/10 text-signal transition duration-300 hover:scale-105 hover:bg-signal/20 active:scale-95"
                aria-label={scanState === "locked" ? "Resume live GPS scan" : "Lock GPS coordinates"}
              >
                {scanState === "scanning" ? (
                  <RefreshCw className="h-12 w-12 animate-spin" aria-hidden="true" />
                ) : (
                  <Crosshair className="h-12 w-12 transition group-hover:rotate-45" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-md border border-border/80 bg-background/70 px-4 py-3 backdrop-blur">
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Position signal</span>
              <span className="text-sm font-semibold text-signal">{status}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-panel-shell p-5 shadow-signal">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
                  <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                  Live fix
                </div>
                <button
                  type="button"
                  onClick={copyCoordinates}
                  disabled={!displayCoords}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs uppercase text-secondary-foreground transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border/80 bg-background/55 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Latitude</p>
                  <p className="break-all text-3xl font-bold text-signal sm:text-4xl">{formatCoordinate(displayCoords?.latitude)}</p>
                </div>
                <div className="rounded-md border border-border/80 bg-background/55 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Longitude</p>
                  <p className="break-all text-3xl font-bold text-signal sm:text-4xl">{formatCoordinate(displayCoords?.longitude)}</p>
                </div>
              </div>

              {error && <p className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground">{error}</p>}
            </div>

              <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Accuracy</p>
                <p className="mt-2 text-2xl font-semibold">{coords ? `±${coords.accuracy <= 1 ? 1 : Math.round(coords.accuracy)} m` : "--"}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Best lock</p>
                <p className="mt-2 text-2xl font-semibold">{bestAccuracy !== null ? `±${bestAccuracy <= 1 ? 1 : Math.round(bestAccuracy)} m` : "--"}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Live time</p>
                <p className="mt-2 text-2xl font-semibold">{displayCoords ? new Date(scanState === "scanning" ? liveTime : displayCoords.timestamp).toLocaleTimeString() : "--"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Altitude</p>
                <p className="mt-2 text-2xl font-semibold">{displayCoords?.altitude !== null && displayCoords?.altitude !== undefined ? `${Math.round(displayCoords.altitude)} m` : "--"}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Speed</p>
                <p className="mt-2 text-2xl font-semibold">{displayCoords?.speed !== null && displayCoords?.speed !== undefined ? `${displayCoords.speed.toFixed(1)} m/s` : "--"}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={scanState === "locked" ? startScan : lockGps}
              disabled={scanState !== "locked" && !coords}
              className="inline-flex w-full items-center justify-center gap-3 rounded-md bg-primary px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-primary-foreground transition hover:brightness-110 active:scale-[0.99]"
            >
              <LocateFixed className="h-5 w-5" aria-hidden="true" />
              {scanState === "locked" ? "Resume Live Scan" : "GPS Lock"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Index;
