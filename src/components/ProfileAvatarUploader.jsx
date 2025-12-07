// src/components/ProfileAvatarUploader.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import NeutralAvatar from "./NeutralAvatar";
import { FiTrash2 } from "react-icons/fi";

/* --------------------------------- utils --------------------------------- */

function colorForId(uid = "") {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
function withVersion(url, v = Date.now()) {
  if (!url) return url;
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

// Detect WebP support (for nicer compression)
const canUseWebP = (() => {
  try {
    const c = document.createElement("canvas");
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
})();

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Compress to max dimension (longest side) and target quality. Returns a new File. */
async function compressImage(
  file,
  { maxDim = 700, quality = 0.8, prefer = "image/webp" } = {}
) {
  if (!file?.type?.startsWith("image/")) return null;
  // Skip HEIC for now
  if (/image\/heic|\.heic$/i.test(file.type) || /\.heic$/i.test(file.name)) return null;

  // Try ImageBitmap (faster), then fall back to HTMLImageElement
  let source;
  let w = 0,
    h = 0;
  try {
    const bmp = await createImageBitmap(file);
    source = bmp;
    w = bmp.width;
    h = bmp.height;
  } catch {
    const img = await loadImageFromFile(file);
    source = img;
    w = img.naturalWidth || img.width;
    h = img.naturalHeight || img.height;
  }

  // If it's already small and light, skip recompress
  if (Math.max(w, h) <= maxDim && file.size < 200 * 1024) return file;

  // Compute target size preserving aspect ratio
  let tw = w;
  let th = h;
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    tw = Math.round(w * scale);
    th = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, tw, th);

  const mime = prefer === "image/webp" && canUseWebP ? "image/webp" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) return file;

  // Keep original base name, swap extension if needed
  const base = file.name.replace(/\.[^.]+$/, "");
  const ext = mime === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}

/* ------------------------------- component ------------------------------- */

export default function ProfileAvatarUploader({
  userId: userIdProp,
  username,
  profile,
  bucket = "avatars",
  onUploaded, // (basePublicUrl: string) => void
  onChanged,  // legacy callback
  onClose,
}) {
  // Server state
  const [userId, setUserId] = useState(userIdProp || null);
  const [serverUrl, setServerUrl] = useState(
    profile?.avatar_url || profile?.avatarUrl || "" // store the *base* URL from DB (no cache param)
  );

  // Local edit state
  const [selectedFile, setSelectedFile] = useState(null);     // compressed file to upload
  const [previewUrl, setPreviewUrl] = useState("");           // local object URL for preview
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Derived display URL: prefer local preview if present, else server pic (with cache-bust)
  const displayUrl = useMemo(() => {
    if (previewUrl) return previewUrl;
    return serverUrl ? withVersion(serverUrl) : "";
  }, [serverUrl, previewUrl]);

  const hasChanges = !!selectedFile; // only upload when user clicks "Save"

  // Keep in sync if parent sends a new profile object
  useEffect(() => {
    const next = profile?.avatar_url || profile?.avatarUrl || "";
    if (typeof next === "string" && next !== serverUrl) {
      setServerUrl(next);
      // if they opened a new profile, clear any local edits
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.avatar_url, profile?.avatarUrl]);

  // Ensure we have a user id if not provided
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (userIdProp) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) setUserId(user?.id || null);
    })();
    return () => { mounted = false; };
  }, [userIdProp]);

  // If serverUrl empty and we know userId, fetch once from DB
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (serverUrl || !userId) return;
      const byId = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      const row = byId.data || (await supabase.from("profiles").select("avatar_url").eq("user_id", userId).maybeSingle()).data;
      if (!cancel && row?.avatar_url) setServerUrl(row.avatar_url);
    })();
    return () => { cancel = true; };
  }, [userId, serverUrl]);

  // File choose: create compressed preview, DO NOT upload yet
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const compressed = await compressImage(file, { maxDim: 700, quality: 0.78 });
      const final = compressed || file;
      // cleanup previous preview
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(final);
      setPreviewUrl(URL.createObjectURL(final));
    } catch (err) {
      setError(err?.message || "Failed to prepare image.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  // Save: upload selectedFile to stable key, update DB, broadcast + callbacks
  const onSave = async () => {
    if (!selectedFile || !userId) return;
    setBusy(true);
    setError("");
    try {
      const path = `${userId}/avatar`; // stable key (no extension needed)
      const { error: upErr } = await supabase
   .storage
   .from(bucket)
   .upload(path, selectedFile, {
     upsert: true,
     cacheControl: "3600",
     contentType: selectedFile.type
   });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const basePublicUrl = pub?.publicUrl;
      if (!basePublicUrl) throw new Error("No public URL returned.");

      // persist stable base URL
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: basePublicUrl }).eq("id", userId);
      if (updErr) throw updErr;

      // swap to server image; clear local preview
      const version = Date.now();
      setServerUrl(basePublicUrl);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      setSelectedFile(null);

      // notify rest of app (Topbar, Chats, etc.)
      try {
        window.dispatchEvent(
          new CustomEvent("avatar:updated", { detail: { userId, url: basePublicUrl, version } })
        );
      } catch {}

      onUploaded?.(basePublicUrl);
      onChanged?.(basePublicUrl);
    } catch (err) {
      setError(err?.message || "Failed to save profile photo.");
    } finally {
      setBusy(false);
    }
  };

  // Delete: remove file (best-effort) and clear profile.avatar_url
  const onDelete = async () => {
    if (!userId) return;
    const ok = window.confirm("Remove your profile picture?");
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      // best effort: attempt to remove stable key (older keys w/ extensions may remain)
      const path = `${userId}/avatar`;
      await supabase.storage.from(bucket).remove([path]).catch(() => {});

      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (updErr) throw updErr;

      // clear local + server urls
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      setSelectedFile(null);
      setServerUrl("");

      const version = Date.now();
      try {
        window.dispatchEvent(
          new CustomEvent("avatar:updated", { detail: { userId, url: null, version } })
        );
      } catch {}

      onUploaded?.("");
      onChanged?.("");
    } catch (err) {
      setError(err?.message || "Failed to delete profile photo.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------- UI ---------------------------------- */

  const nameTitle = (username || "Profile photo").trim() || "Profile photo";

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        padding: 16,
        borderRadius: 14,
        background: "#FFFFFF",
    
        border: "1px solid rgb(216, 220, 225)",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Profile Photo</div>
        
      </div>

      {/* Centered avatar preview */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <NeutralAvatar
          size={104}
          src={displayUrl || undefined}
          title={nameTitle}
          bg={colorForId(userId || username || "guest")}
          initialsFrom={username || "User"}
          imgProps={{ referrerPolicy: "no-referrer" }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          disabled={busy}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => !busy && inputRef.current?.click()}
          disabled={busy}
          style={{
            background: "#111827",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
            minWidth: 120,
            fontWeight: 600,
          }}
        >
          {busy ? "Working…" : "Choose photo"}
        </button>

        <button
  type="button"
  onClick={onSave}
  disabled={!hasChanges || busy}
  style={{
    background: hasChanges ? "#069C6F" : "#A7F3D0",
    color: hasChanges ? "#fff" : "#064E3B",
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    cursor: !hasChanges || busy ? "not-allowed" : "pointer",
    minWidth: 120,
    fontWeight: 700,
  }}
  title={!hasChanges ? "Pick a photo first" : "Save your new photo"}
>
  Save
</button>

{/* Icon-only delete button, sits right beside Save */}
<button
  type="button"
  onClick={onDelete}
  disabled={busy || (!serverUrl && !previewUrl)}
  aria-label="Delete photo"
  title="Delete photo"
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 10,
    border: "1px solid #FECACA",
    background: "#fff",
    color: "#B91C1C",
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.7 : 1,
  }}
>
  <FiTrash2 size={18} />
</button>


        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: "#fff",
              color: "#111827",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              cursor: busy ? "not-allowed" : "pointer",
              minWidth: 120,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: -4 }}>
        <small style={{ color: "#6B7280" }}>
          Tip: Square images (≥ 512px) look best. We’ll optimize and compress before uploading.
        </small>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            border: "1px solid #FECACA",
            padding: "8px 10px",
            borderRadius: 8,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
