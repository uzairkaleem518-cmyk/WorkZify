import { useRef, useState } from "react";
import api from "../api/api.js";

// Reusable file picker that uploads immediately to the backend (which relays
// to Cloudinary) and hands the resulting URL back to the parent form via
// onUploaded. Used for worker photo / CNIC image / selfie during registration.
export default function ImageUploadField({ label, kind, value, onUploaded, hint, endpoint = "/uploads", extraFields = {} }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    // Instant local preview while the upload is in flight
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("kind", kind);
      Object.entries(extraFields).forEach(([key, fieldValue]) => formData.append(key, fieldValue));
      // Don't set Content-Type manually here - axios/the browser needs to
      // generate it itself (including the multipart boundary) when given a
      // FormData body. Setting it explicitly without a boundary breaks
      // multer's parsing on the backend.
      const res = await api.post(endpoint, formData);
      onUploaded(res.data.document || res.data.url);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
      setPreview(value || "");
      onUploaded("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm text-ink font-medium mb-1">{label}</label>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-16 h-16 rounded-xl border-2 border-dashed border-border hover:border-teal-500 transition-colors overflow-hidden shrink-0 flex items-center justify-center text-muted disabled:opacity-60"
        >
          {preview ? (
            <img src={preview} alt={label} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">+</span>
          )}
        </button>
        <div className="flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60"
          >
            {uploading ? "Uploading..." : preview ? "Change photo" : "Choose photo"}
          </button>
          {error && <p className="text-xs text-rani-600 dark:text-rani-300 mt-1">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
