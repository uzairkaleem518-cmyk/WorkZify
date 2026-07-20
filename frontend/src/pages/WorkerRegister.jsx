import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";
import FormAlert from "../components/FormAlert.jsx";
import ImageUploadField from "../components/ImageUploadField.jsx";
import {
  validatePhone, validateEmail, validatePassword,
  validateName, validateServiceArea, validateOtp, validateCategory,
} from "../utils/Validation.js";

export default function WorkerRegister() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState(1);
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [alert, setAlert] = useState({ type: "error", text: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", password: "",
    category: "", experienceYears: "", fee: "", languages: "",
    serviceArea: "", bio: "", cnicNumber: "", otp: "", photoUrl: "",
    cnicImage: null, selfieImage: null,
  });

  useEffect(() => {
    api.get("/workers/categories").then((res) => setCategories(res.data));
  }, []);

  const update = (k, v) => {
    setForm({ ...form, [k]: v });
    // Clear that field's error as soon as the user edits it
    if (fieldErrors[k]) setFieldErrors({ ...fieldErrors, [k]: "" });
  };

  // Validate a field on blur so mistakes are caught before submit, not after
  const validators = {
    name: validateName, phone: validatePhone, email: validateEmail,
    password: validatePassword, category: validateCategory,
    serviceArea: validateServiceArea, otp: validateOtp,
  };
  const validateField = (k) => {
    const fn = validators[k];
    if (!fn) return;
    const error = fn(form[k]);
    setFieldErrors((prev) => ({ ...prev, [k]: error }));
  };

  const errorClass = (k) => `input-field ${fieldErrors[k] ? "border-rani-500 focus:ring-rani-500" : ""}`;

  // Below every field we show either its validation error (red) or, if
  // there isn't one, a short example/hint (muted grey). Keeps the visible
  // placeholder text itself short so it doesn't get clipped on narrow
  // screens (~320-360px, common on budget Android phones), while the
  // example format is still available right underneath.
  const FieldNote = ({ fieldKey, hint }) =>
    fieldErrors[fieldKey] ? (
      <p className="text-xs text-rani-600 dark:text-rani-300 mt-1">{fieldErrors[fieldKey]}</p>
    ) : hint ? (
      <p className="text-xs text-muted mt-1">{hint}</p>
    ) : null;

  const sendOtp = async () => {
    setAlert({ type: "error", text: "" });
    const phoneErr = validatePhone(form.phone);
    const emailErr = validateEmail(form.email);
    if (phoneErr || emailErr) {
      setFieldErrors({ ...fieldErrors, phone: phoneErr, email: emailErr });
      setAlert({ type: "error", text: "Please fix the highlighted fields before requesting an OTP." });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/otp/send", { phone: form.phone, email: form.email, purpose: "register" });
      setOtpSent(true);
      if (res.data.devCode) setDevCode(res.data.devCode);
      setAlert({
        type: "success",
        text: "OTP sent" + (res.data.channel === "email" ? " to your email." : " — check server console (dev mode)."),
      });
    } catch (err) {
      setAlert({ type: "error", text: err.response?.data?.message || "Could not send OTP. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const goToStep2 = () => {
    const otpErr = validateOtp(form.otp);
    if (otpErr) {
      setFieldErrors({ ...fieldErrors, otp: otpErr });
      setAlert({ type: "error", text: otpErr });
      return;
    }
    setAlert({ type: "error", text: "" });
    setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault();

    // Full step-2 validation before hitting the API
    const errors = {
      password: validatePassword(form.password),
      category: validateCategory(form.category),
      serviceArea: validateServiceArea(form.serviceArea),
      cnicImage: form.cnicImage ? "" : "CNIC image is required",
      selfieImage: form.selfieImage ? "" : "Selfie image is required",
    };
    const firstError = Object.values(errors).find(Boolean);
    if (firstError) {
      setFieldErrors({ ...fieldErrors, ...errors });
      setAlert({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }

    setAlert({ type: "error", text: "" });
    setLoading(true);
    try {
      const payload = {
        ...form,
        experienceYears: Number(form.experienceYears) || 0,
        languages: form.languages.split(",").map((l) => l.trim()).filter(Boolean),
      };
      await api.post("/auth/worker/register", payload);
      setAlert({ type: "success", text: "Registered! Awaiting admin approval." });
      setTimeout(() => navigate("/worker/login"), 1500);
    } catch (err) {
      setAlert({ type: "error", text: err.response?.data?.message || "Registration failed. Please check your details and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-teal-500" : "bg-border"}`} />
        <span className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-teal-500" : "bg-border"}`} />
        <span className="text-xs text-muted ml-1">Step {step} of 2</span>
      </div>
      <h1 className="font-display font-bold text-xl text-ink mb-4">Join as a Worker</h1>

      {step === 1 && (
        <div className="space-y-3 card p-4">
          <div>
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              onBlur={() => validateField("name")}
              className={errorClass("name")}
              autoComplete="name"
            />
            <FieldNote fieldKey="name" />
          </div>
          <div>
            <input
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              onBlur={() => validateField("phone")}
              className={errorClass("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={15}
            />
            <FieldNote fieldKey="phone" hint="e.g. 03001234567" />
          </div>
          <div>
            <input
              placeholder="Email (for free OTP delivery)"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              onBlur={() => validateField("email")}
              className={errorClass("email")}
              type="email"
              inputMode="email"
              autoComplete="email"
            />
            <FieldNote fieldKey="email" />
          </div>
          <button type="button" onClick={sendOtp} disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Sending..." : "Send OTP"}
          </button>
          {otpSent && (
            <div className="space-y-2">
              <div>
                <input
                  placeholder="6-digit OTP"
                  value={form.otp}
                  onChange={(e) => update("otp", e.target.value.replace(/\D/g, ""))}
                  onBlur={() => validateField("otp")}
                  className={errorClass("otp")}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                <FieldNote fieldKey="otp" />
              </div>
              {devCode && <p className="text-xs text-marigold-600 dark:text-marigold-400">Dev mode OTP: {devCode}</p>}
              <button type="button" onClick={goToStep2} className="btn-secondary w-full">Continue</button>
            </div>
          )}
          <FormAlert type={alert.type}>{alert.text}</FormAlert>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={submit} className="space-y-3 card p-4">
          <div>
            <input
              type="password"
              placeholder="Choose a password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              onBlur={() => validateField("password")}
              className={errorClass("password")}
              autoComplete="new-password"
            />
            <FieldNote fieldKey="password" hint="Min. 8 characters, letters + numbers" />
          </div>
          <div>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              onBlur={() => validateField("category")}
              className={errorClass("category")}
            >
              <option value="">Select trade category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <FieldNote fieldKey="category" />
          </div>
          <input
            placeholder="Years of experience"
            type="number"
            inputMode="numeric"
            min="0"
            max="70"
            value={form.experienceYears}
            onChange={(e) => update("experienceYears", e.target.value)}
            className="input-field"
          />
          <div>
            <input
              placeholder="Fee"
              value={form.fee}
              onChange={(e) => update("fee", e.target.value)}
              className="input-field"
            />
            <FieldNote fieldKey="fee" hint="e.g. PKR 500/hour" />
          </div>
          <div>
            <input
              placeholder="Languages"
              value={form.languages}
              onChange={(e) => update("languages", e.target.value)}
              className="input-field"
            />
            <FieldNote fieldKey="languages" hint="Comma separated, e.g. Urdu, English" />
          </div>
          <div>
            <input
              placeholder="Service area"
              value={form.serviceArea}
              onChange={(e) => update("serviceArea", e.target.value)}
              onBlur={() => validateField("serviceArea")}
              className={errorClass("serviceArea")}
            />
            <FieldNote fieldKey="serviceArea" hint="e.g. your mohalla or union council" />
          </div>
          <textarea
            placeholder="Short bio / skills description"
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            className="input-field"
            rows={3}
            maxLength={500}
          />
          <ImageUploadField
            label="Profile photo (optional)"
            kind="photo"
            value={form.photoUrl}
            onUploaded={(url) => update("photoUrl", url)}
            hint="JPG, PNG, or WEBP; max 5MB."
          />
          <ImageUploadField
            label="CNIC image"
            kind="cnic"
            value={form.cnicImage ? "uploaded" : ""}
            onUploaded={(document) => update("cnicImage", document)}
            endpoint="/uploads/identity"
            extraFields={{ phone: form.phone, otp: form.otp }}
            hint="Required for private admin verification; JPG, PNG, or WEBP; max 5MB."
          />
          <FieldNote fieldKey="cnicImage" />
          <ImageUploadField
            label="Selfie image"
            kind="selfie"
            value={form.selfieImage ? "uploaded" : ""}
            onUploaded={(document) => update("selfieImage", document)}
            endpoint="/uploads/identity"
            extraFields={{ phone: form.phone, otp: form.otp }}
            hint="Required for private admin verification; JPG, PNG, or WEBP; max 5MB."
          />
          <FieldNote fieldKey="selfieImage" />
          <div>
            <input
              placeholder="CNIC number (optional)"
              value={form.cnicNumber}
              onChange={(e) => update("cnicNumber", e.target.value)}
              className="input-field"
              autoComplete="off"
            />
            <FieldNote fieldKey="cnicNumber" hint="For admin verification only, never shown publicly" />
          </div>
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Submitting..." : "Complete Registration"}
          </button>
          <FormAlert type={alert.type}>{alert.text}</FormAlert>
        </form>
      )}
    </div>
  );
}
