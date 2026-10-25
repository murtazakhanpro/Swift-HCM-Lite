import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  CalendarCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Wifi,
  WifiOff,
  Shield,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  api,
  type TodayStatusResponse,
  type AttendanceRecord,
  type DailyBoardSummary,
  type AttendanceCorrectionRequest,
  type FaceEnrollmentStatus,
} from "../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    present: "badge-present",
    late: "badge-late",
    half_day: "badge-late",
    absent: "badge-absent",
    missing_checkout: "badge-absent",
    pending: "badge-late",
    approved: "badge-present",
    rejected: "badge-absent",
  };
  return `badge ${map[s] || "badge-leave"}`;
};

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Sub-components ────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, color = "var(--swift-neon)", icon }) => (
  <div className="swift-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {icon}
    </div>
    <div style={{ fontSize: "2rem", fontWeight: 800, color }}>{value}</div>
    {sub && <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sub}</div>}
  </div>
);

// ── Camera Check-In Widget ────────────────────────────────────────────────────
interface CameraWidgetProps {
  onCapture: (faceImage: string) => void;
  onCancel: () => void;
  canCapture?: boolean;
  enrollment?: boolean;
}

const CameraWidget: React.FC<CameraWidgetProps> = ({ onCapture, onCancel, canCapture = true, enrollment = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<"idle" | "scanning" | "detected" | "none">("idle");

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCamError("Camera access denied. Please allow camera in browser settings."));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

  const scanFace = () => {
    if (!canCapture) return;
    setFaceStatus("scanning");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setFaceStatus("none");
      setCamError("Camera is not ready. Please retry.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setFaceStatus("none"); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFaceStatus("scanning");
    onCapture(canvas.toDataURL("image/jpeg", 0.82));
  };

  return (
    <div style={{
      background: "var(--bg-surface-1)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "16px",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Camera size={18} color="var(--swift-neon)" /> {enrollment ? "Face Enrollment" : "Camera Verification"}
        </h3>
        <button className="btn-secondary" onClick={onCancel} style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }}>
          Cancel
        </button>
      </div>

      {camError ? (
        <div style={{ background: "var(--status-absent-bg)", border: "1px solid rgba(255,51,68,0.3)", borderRadius: "10px", padding: "1rem", color: "var(--status-absent)", fontSize: "0.85rem" }}>
          <AlertTriangle size={16} style={{ display: "inline", marginRight: "0.5rem" }} />{camError}
        </div>
      ) : (
        <>
          <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {/* Face scan overlay */}
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none"
            }}>
              <div style={{
                width: "160px", height: "200px",
                border: `2px solid ${faceStatus === "detected" ? "var(--status-present)" : faceStatus === "none" ? "var(--status-absent)" : "rgba(179,255,33,0.6)"}`,
                borderRadius: "80px",
                boxShadow: faceStatus === "detected" ? "0 0 30px rgba(179,255,33,0.5)" : "none",
                transition: "all 0.3s ease",
                animation: faceStatus === "scanning" ? "pulse 1s infinite" : "none",
              }} />
            </div>
            <div style={{
              position: "absolute", bottom: "0.75rem", left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)", padding: "0.3rem 0.75rem", borderRadius: "20px",
              fontSize: "0.75rem", fontWeight: 600, color: faceStatus === "detected" ? "var(--status-present)" : faceStatus === "none" ? "var(--status-absent)" : "var(--swift-neon)",
            }}>
              {faceStatus === "idle" && "Position face in frame"}
              {faceStatus === "scanning" && "Sending to server..."}
              {faceStatus === "detected" && "Image captured"}
              {faceStatus === "none" && "No face detected"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={scanFace}
              disabled={!canCapture || faceStatus === "scanning" || faceStatus === "detected"}
            >
              <Shield size={16} />
              {faceStatus === "scanning" ? "Verifying…" : "Verify Face"}
            </button>
            {faceStatus === "none" && (
              <button className="btn-secondary" style={{ flex: 1 }} onClick={scanFace}>
                <RefreshCw size={16} /> Retry
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Correction Modal ──────────────────────────────────────────────────────────
const CorrectionModal: React.FC<{
  onSubmit: (data: { requested_date: string; requested_check_in: string; requested_check_out?: string; reason: string }) => Promise<void>;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState("09:00");
  const [checkOut, setCheckOut] = useState("18:00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setErr("Reason is required."); return; }
    setLoading(true);
    try {
      await onSubmit({
        requested_date: date,
        requested_check_in: `${date}T${checkIn}:00`,
        requested_check_out: checkOut ? `${date}T${checkOut}:00` : undefined,
        reason,
      });
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem",
    }}>
      <div style={{
        background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
        borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "480px",
      }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Edit3 size={18} color="var(--swift-neon)" /> Request Attendance Correction
        </h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>Date</label>
            <input type="date" className="swift-input" value={date} onChange={(e) => setDate(e.target.value)} required max={new Date().toISOString().slice(0, 10)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>Check-In Time</label>
              <input type="time" className="swift-input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>Check-Out Time</label>
              <input type="time" className="swift-input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>Reason <span style={{ color: "var(--status-absent)" }}>*</span></label>
            <textarea
              className="swift-input"
              rows={3}
              placeholder="Explain why correction is needed…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ resize: "vertical" }}
              required
            />
          </div>
          {err && <div style={{ color: "var(--status-absent)", fontSize: "0.82rem" }}><AlertCircle size={14} style={{ display: "inline", marginRight: "0.3rem" }} />{err}</div>}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? "Submitting…" : "Submit Request"}
            </button>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── EMPLOYEE VIEW ─────────────────────────────────────────────────────────────
const EmployeeAttendanceView: React.FC = () => {
  const [todayStatus, setTodayStatus] = useState<TodayStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "camera" | "enroll">("idle");
  const [faceEnrollment, setFaceEnrollment] = useState<FaceEnrollmentStatus | null>(null);
  const [faceConsent, setFaceConsent] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"checkin" | "history" | "corrections">("checkin");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [status, hist, corr, enrollment] = await Promise.all([
        api.getTodayAttendanceStatus(),
        api.getAttendanceHistory(),
        api.listAttendanceCorrections(),
        api.getFaceEnrollment(),
      ]);
      setTodayStatus(status);
      setHistory(hist);
      setCorrections(corr);
      setFaceEnrollment(enrollment);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getGPS = () => {
    setGpsLoading(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsLoading(false);
      },
      () => {
        setErr("GPS access denied. Please allow location in browser settings.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleWebCheckIn = async () => {
    if (!gps) { getGPS(); return; }
    setActionLoading(true);
    setErr(null);
    try {
      await api.checkIn({ source: "web", latitude: gps.lat, longitude: gps.lng, gps_accuracy: gps.accuracy });
      setSuccess("✓ Check-in recorded successfully!");
      await loadData();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCameraCheckIn = async (faceImage: string) => {
    if (!gps) { setErr("GPS required for camera check-in. Click 'Get Location' first."); setMode("idle"); return; }
    setMode("idle");
    setActionLoading(true);
    setErr(null);
    try {
      await api.faceCheck({
        image: faceImage,
        latitude: gps.lat,
        longitude: gps.lng,
        gps_accuracy: gps.accuracy,
      });
      setSuccess("✓ Camera check-in with face verification successful!");
      await loadData();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFaceEnrollment = async (faceImage: string) => {
    setMode("idle");
    setActionLoading(true);
    setErr(null);
    try {
      const status = await api.enrollFace(faceImage, faceConsent);
      setFaceEnrollment(status);
      setFaceConsent(false);
      setSuccess("Face enrolled. Your photo was processed and discarded; only an encrypted template is retained.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFace = async () => {
    setActionLoading(true);
    try {
      setFaceEnrollment(await api.deleteFaceEnrollment());
      setSuccess("Face enrollment deleted.");
    } catch (e: any) { setErr(e.message); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    setErr(null);
    try {
      await api.checkOut({ latitude: gps?.lat, longitude: gps?.lng });
      setSuccess("✓ Check-out recorded. Have a great day!");
      await loadData();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCorrectionSubmit = async (data: any) => {
    await api.requestAttendanceCorrection(data);
    await loadData();
  };

  // Geofence check (for display only)
  const distanceFromOffice =
    todayStatus && gps
      ? Math.round(haversineMeters(gps.lat, gps.lng, todayStatus.office_lat, todayStatus.office_lng))
      : null;
  const isInRange = distanceFromOffice !== null && todayStatus
    ? distanceFromOffice <= todayStatus.office_radius_meters
    : null;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "var(--text-secondary)" }}>
      <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", marginRight: "0.5rem" }} /> Loading attendance…
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Tab Nav */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0" }}>
        {[
          { key: "checkin", label: "Check-In / Out", icon: <Clock size={15} /> },
          { key: "history", label: "My History", icon: <CalendarCheck size={15} /> },
          { key: "corrections", label: "Corrections", icon: <Edit3 size={15} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.65rem 1rem", fontSize: "0.85rem", fontWeight: 600,
              color: activeTab === key ? "var(--swift-neon)" : "var(--text-secondary)",
              borderBottom: activeTab === key ? "2px solid var(--swift-neon)" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 0.2s",
              marginBottom: "-1px",
            }}
          >{icon}{label}</button>
        ))}
      </div>

      {/* Alerts */}
      {err && (
        <div style={{ background: "var(--status-absent-bg)", border: "1px solid rgba(255,51,68,0.35)", borderRadius: "10px", padding: "0.85rem 1rem", color: "var(--status-absent)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlertCircle size={16} />{err}
        </div>
      )}
      {success && (
        <div style={{ background: "var(--status-present-bg)", border: "1px solid rgba(179,255,33,0.35)", borderRadius: "10px", padding: "0.85rem 1rem", color: "var(--status-present)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle size={16} />{success}
        </div>
      )}

      {/* CHECK-IN TAB */}
      {activeTab === "checkin" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Today Status Card */}
          <div className="swift-card" style={{ gridColumn: todayStatus?.has_checked_in ? undefined : "1/-1" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={18} color="var(--swift-neon)" /> Today's Status
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </h3>

            {todayStatus?.has_checked_in && todayStatus.record ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ background: "var(--bg-surface-0)", padding: "0.85rem", borderRadius: "10px" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>CHECK-IN</div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--swift-neon)", fontFamily: "JetBrains Mono" }}>
                      {fmtTime(todayStatus.record.check_in_time)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      via {todayStatus.record.check_in_source}
                      {todayStatus.record.face_verified && " · Face Verified"}
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-surface-0)", padding: "0.85rem", borderRadius: "10px" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>CHECK-OUT</div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: todayStatus.record.check_out_time ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "JetBrains Mono" }}>
                      {todayStatus.record.check_out_time ? fmtTime(todayStatus.record.check_out_time) : "—"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {todayStatus.record.check_out_time ? `${todayStatus.record.total_hours.toFixed(1)} hrs worked` : "Not yet checked out"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span className={statusBadge(todayStatus.record.status)}>
                    {todayStatus.record.status.replace("_", " ")}
                  </span>
                  {!todayStatus.has_checked_out && (
                    <button className="btn-primary" onClick={handleCheckOut} disabled={actionLoading} style={{ marginLeft: "auto" }}>
                      <Clock size={16} />{actionLoading ? "Processing…" : "Check Out Now"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{
                  background: "linear-gradient(135deg, rgba(179,255,33,0.07), rgba(0,85,255,0.07))",
                  border: "1px solid rgba(179,255,33,0.15)",
                  borderRadius: "12px", padding: "1.5rem", textAlign: "center",
                }}>
                  <Clock size={36} color="var(--swift-neon)" style={{ margin: "0 auto 0.75rem" }} />
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>You haven't checked in yet today</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                    Office hours tracked with GPS geofence + optional face verification
                  </div>
                </div>

                {/* GPS Status */}
                <div style={{ background: "var(--bg-surface-0)", borderRadius: "10px", padding: "0.85rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {gps ? (
                    <>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isInRange ? "var(--status-present)" : "var(--status-absent)", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: isInRange ? "var(--status-present)" : "var(--status-absent)" }}>
                          {isInRange ? `In Range · ${distanceFromOffice}m from office` : `Out of Range · ${distanceFromOffice}m (max ${todayStatus?.office_radius_meters}m)`}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Accuracy: ±{Math.round(gps.accuracy)}m</div>
                      </div>
                      {isInRange ? <Wifi size={16} color="var(--status-present)" /> : <WifiOff size={16} color="var(--status-absent)" />}
                    </>
                  ) : (
                    <>
                      <MapPin size={16} color="var(--text-muted)" />
                      <div style={{ flex: 1, fontSize: "0.82rem", color: "var(--text-secondary)" }}>GPS location not yet acquired</div>
                      <button className="btn-secondary" onClick={getGPS} disabled={gpsLoading} style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                        {gpsLoading ? "…" : "Get Location"}
                      </button>
                    </>
                  )}
                </div>

                {/* Check-In Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <button
                    className="btn-primary"
                    onClick={handleWebCheckIn}
                    disabled={actionLoading}
                  >
                    <MapPin size={16} />
                    {actionLoading ? "Processing…" : "Web Check-In"}
                  </button>
                  <button
                    className="btn-blue"
                    onClick={() => {
                      if (!gps) { getGPS(); setErr("Get location first, then use camera check-in."); return; }
                      setMode("camera");
                    }}
                    disabled={actionLoading || !faceEnrollment?.enabled || !faceEnrollment?.enrolled}
                  >
                    <Camera size={16} /> Camera Check-In
                  </button>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center" }}>
                  Camera check-in requires GPS + face detection · Web check-in requires GPS only
                </div>
              </div>
            )}
          </div>

          {faceEnrollment && (
            <div className="swift-card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <strong>Face verification</strong>
              {!faceEnrollment.enabled ? <span style={{ fontSize: "0.82rem" }}>Face verification is disabled until the backend is configured.</span> : (
                <>
                  <span style={{ fontSize: "0.82rem" }}>{faceEnrollment.enrolled ? "Face enrolled for camera check-in." : "Enroll your face before using camera check-in."}</span>
                  {faceEnrollment.enrolled ? (
                    <button className="btn-secondary" onClick={handleDeleteFace} disabled={actionLoading}>Delete face enrollment</button>
                  ) : (
                    <button className="btn-secondary" onClick={() => { setFaceConsent(false); setMode("enroll"); }} disabled={actionLoading}><Camera size={16} /> Enroll face</button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Camera capture for enrollment or verification */}
          {mode === "enroll" && (
            <p className="swift-card" style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
              By selecting ?I consent?, you agree to local face processing for attendance verification. The captured image is discarded after processing; an encrypted face template is stored until you delete it. You can use web check-in without enrollment.
              <label style={{ display: "block", marginTop: "0.75rem" }}><input type="checkbox" checked={faceConsent} onChange={(e) => setFaceConsent(e.target.checked)} /> I consent to face enrollment</label>
            </p>
          )}
          {mode !== "idle" && (
            <CameraWidget
              onCapture={mode === "enroll" ? handleFaceEnrollment : handleCameraCheckIn}
              onCancel={() => setMode("idle")}
              canCapture={mode !== "enroll" || faceConsent}
              enrollment={mode === "enroll"}
            />
          )}

          {/* Correction Request Quick-Launch */}
          {todayStatus?.has_checked_in && (
            <div className="swift-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Edit3 size={18} color="var(--text-muted)" /> Attendance Correction
              </h3>
              <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", lineHeight: "1.55" }}>
                Need to fix a wrong time or missing record? Submit a correction request for HR review.
              </p>
              <button className="btn-secondary" onClick={() => setShowCorrectionModal(true)}>
                <Edit3 size={16} /> Request Correction
              </button>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="swift-card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CalendarCheck size={16} color="var(--swift-neon)" />
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Attendance History</span>
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>{history.length} records</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-0)" }}>
                  {["Date", "Check-In", "Check-Out", "Hours", "Status", "Source"].map((h) => (
                    <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No attendance records yet.</td></tr>
                ) : history.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: 600, fontFamily: "JetBrains Mono", color: "var(--text-primary)" }}>{r.date}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontFamily: "JetBrains Mono", color: "var(--swift-neon)" }}>{fmtTime(r.check_in_time)}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontFamily: "JetBrains Mono", color: "var(--text-secondary)" }}>{fmtTime(r.check_out_time)}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>{r.total_hours > 0 ? `${r.total_hours.toFixed(1)}h` : "—"}</td>
                    <td style={{ padding: "0.75rem 1rem" }}><span className={statusBadge(r.status)}>{r.status.replace("_", " ")}</span></td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.check_in_source}{r.face_verified ? " · verified" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CORRECTIONS TAB */}
      {activeTab === "corrections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Correction Requests</h3>
            <button className="btn-secondary" onClick={() => setShowCorrectionModal(true)} style={{ fontSize: "0.8rem" }}>
              <Edit3 size={14} /> New Request
            </button>
          </div>
          {corrections.length === 0 ? (
            <div className="swift-card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
              <ClipboardList size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
              <div>No correction requests submitted yet.</div>
            </div>
          ) : corrections.map((c) => (
            <div key={c.id} className="swift-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{c.requested_date}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "0.5rem" }}>
                    {fmtTime(c.requested_check_in)} → {c.requested_check_out ? fmtTime(c.requested_check_out) : "—"}
                  </span>
                </div>
                <span className={statusBadge(c.status)}>{c.status}</span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{c.reason}</div>
              {c.review_comment && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", background: "var(--bg-surface-0)", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  HR Note: {c.review_comment}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Correction Modal */}
      {showCorrectionModal && (
        <CorrectionModal
          onSubmit={handleCorrectionSubmit}
          onClose={() => { setShowCorrectionModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

// ── HR / ADMIN VIEW ───────────────────────────────────────────────────────────
const HRAttendanceView: React.FC = () => {
  const [board, setBoard] = useState<DailyBoardSummary | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"board" | "corrections">("board");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api.getDailyAttendanceBoard(selectedDate),
        api.listAttendanceCorrections(),
      ]);
      setBoard(b);
      setCorrections(c);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReview = async (corrId: number) => {
    setReviewLoading(true);
    try {
      await api.reviewAttendanceCorrection(corrId, { status: reviewStatus, review_comment: reviewComment || undefined });
      setReviewId(null);
      setReviewComment("");
      await loadData();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const absent = board ? board.total_active_employees - board.present_today - board.late_today - board.half_day_today : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Tab Nav */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
        {[
          { key: "board", label: "Daily Board", icon: <Users size={15} /> },
          { key: "corrections", label: `Correction Inbox ${corrections.filter(c => c.status === "pending").length > 0 ? `(${corrections.filter(c => c.status === "pending").length})` : ""}`, icon: <Edit3 size={15} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.65rem 1rem", fontSize: "0.85rem", fontWeight: 600,
              color: activeTab === key ? "var(--swift-neon)" : "var(--text-secondary)",
              borderBottom: activeTab === key ? "2px solid var(--swift-neon)" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 0.2s",
              marginBottom: "-1px",
            }}
          >{icon}{label}</button>
        ))}
      </div>

      {err && (
        <div style={{ background: "var(--status-absent-bg)", border: "1px solid rgba(255,51,68,0.35)", borderRadius: "10px", padding: "0.85rem 1rem", color: "var(--status-absent)", fontSize: "0.85rem" }}>
          <AlertCircle size={14} style={{ display: "inline", marginRight: "0.4rem" }} />{err}
        </div>
      )}

      {activeTab === "board" && (
        <>
          {/* Date Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button className="btn-secondary" style={{ padding: "0.5rem" }} onClick={() => {
                const d = new Date(selectedDate); d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().slice(0, 10));
              }}><ChevronLeft size={16} /></button>
              <input type="date" className="swift-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: "auto" }} max={new Date().toISOString().slice(0, 10)} />
              <button className="btn-secondary" style={{ padding: "0.5rem" }} onClick={() => {
                const d = new Date(selectedDate); d.setDate(d.getDate() + 1);
                const today = new Date().toISOString().slice(0, 10);
                if (d.toISOString().slice(0, 10) <= today) setSelectedDate(d.toISOString().slice(0, 10));
              }}><ChevronRight size={16} /></button>
            </div>
            <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={loadData} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {loading ? "Loading…" : `${board?.records.length || 0} records`}
            </span>
          </div>

          {/* Metric Cards */}
          {board && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem" }}>
              <MetricCard label="Active Employees" value={board.total_active_employees} color="var(--text-primary)" icon={<Users size={16} color="var(--text-muted)" />} />
              <MetricCard label="Present" value={board.present_today} color="var(--status-present)" icon={<CheckCircle size={16} color="var(--status-present)" />} />
              <MetricCard label="Late" value={board.late_today} color="var(--status-late)" icon={<AlertTriangle size={16} color="var(--status-late)" />} />
              <MetricCard label="Half-Day" value={board.half_day_today} color="var(--status-halfday)" icon={<Clock size={16} color="var(--status-halfday)" />} />
              <MetricCard label="Absent" value={absent < 0 ? 0 : absent} color="var(--status-absent)" icon={<XCircle size={16} color="var(--status-absent)" />} />
              {board.missing_checkout_today > 0 && (
                <MetricCard label="Missing Checkout" value={board.missing_checkout_today} color="var(--status-absent)" sub="Previous days" icon={<AlertCircle size={16} color="var(--status-absent)" />} />
              )}
            </div>
          )}

          {/* Attendance Table */}
          <div className="swift-card" style={{ padding: "0", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-0)" }}>
                    {["Employee", "Dept", "Check-In", "Check-Out", "Hours", "Status", "Source"].map((h) => (
                      <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
                  ) : board?.records.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No attendance records for this date.</td></tr>
                  ) : board?.records.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{r.employee_name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono" }}>{r.employee_code}</div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>{r.department_name || "—"}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontFamily: "JetBrains Mono", color: "var(--swift-neon)" }}>{fmtTime(r.check_in_time)}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontFamily: "JetBrains Mono", color: "var(--text-secondary)" }}>{fmtTime(r.check_out_time)}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem" }}>{r.total_hours > 0 ? `${r.total_hours.toFixed(1)}h` : "—"}</td>
                      <td style={{ padding: "0.75rem 1rem" }}><span className={statusBadge(r.status)}>{r.status.replace("_", " ")}</span></td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {r.check_in_source}{r.face_verified ? " · ✓" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "corrections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {corrections.length === 0 ? (
            <div className="swift-card" style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
              <ClipboardList size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
              <div>No correction requests in the system.</div>
            </div>
          ) : corrections.map((c) => (
            <div key={c.id} className="swift-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{c.employee_name} <span style={{ color: "var(--text-muted)", fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>({c.employee_code})</span></div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    {c.requested_date} · {fmtTime(c.requested_check_in)} → {c.requested_check_out ? fmtTime(c.requested_check_out) : "—"}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{c.reason}</div>
                </div>
                <span className={statusBadge(c.status)}>{c.status}</span>
              </div>

              {/* Inline Review Panel (HR only, pending items) */}
              {c.status === "pending" && (
                reviewId === c.id ? (
                  <div style={{ background: "var(--bg-surface-0)", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => setReviewStatus("approved")}
                        style={{
                          flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid",
                          cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s",
                          background: reviewStatus === "approved" ? "rgba(179,255,33,0.15)" : "transparent",
                          borderColor: reviewStatus === "approved" ? "var(--status-present)" : "var(--border-subtle)",
                          color: reviewStatus === "approved" ? "var(--status-present)" : "var(--text-secondary)",
                        }}
                      >✓ Approve</button>
                      <button
                        onClick={() => setReviewStatus("rejected")}
                        style={{
                          flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid",
                          cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s",
                          background: reviewStatus === "rejected" ? "rgba(255,51,68,0.15)" : "transparent",
                          borderColor: reviewStatus === "rejected" ? "var(--status-absent)" : "var(--border-subtle)",
                          color: reviewStatus === "rejected" ? "var(--status-absent)" : "var(--text-secondary)",
                        }}
                      >✗ Reject</button>
                    </div>
                    <input
                      className="swift-input"
                      placeholder="Review comment (optional)"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleReview(c.id)} disabled={reviewLoading}>
                        {reviewLoading ? "Submitting…" : "Confirm Decision"}
                      </button>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setReviewId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn-secondary" onClick={() => { setReviewId(c.id); setReviewStatus("approved"); setReviewComment(""); }} style={{ alignSelf: "flex-start", fontSize: "0.8rem" }}>
                    <Eye size={14} /> Review Request
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Page Root ─────────────────────────────────────────────────────────────────
export const AttendancePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <CalendarCheck size={24} color="var(--swift-neon)" />
          {user?.role === "Employee" ? "My Attendance" : "Attendance Management"}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          {user?.role === "Employee"
            ? "GPS-verified check-in/out · Attendance history · Correction requests"
            : "Daily attendance board · Correction inbox · Geofence & face verification stats"}
        </p>
      </div>

      {/* Role-based views */}
      {user?.role === "Employee" ? <EmployeeAttendanceView /> : <HRAttendanceView />}
    </div>
  );
};
