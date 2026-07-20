import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";
import FormAlert from "../components/FormAlert.jsx";
import { validatePhone, validateEmail, validateName, validateOtp } from "../utils/Validation.js";

export default function CustomerAuth() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [alert, setAlert] = useState({ type: "error", text: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendOtp = async () => {
    setAlert({ type: "error", text: "" });
    const errors = { name: validateName(name), phone: validatePhone(phone), email: validateEmail(email) };
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setAlert({ type: "error", text: "Please fix the highlighted fields before requesting an OTP." });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/otp/send", { phone, email, purpose: "register" });
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

  const submit = async (e) => {
    e.preventDefault();
    const otpErr = validateOtp(otp);
    if (otpErr) {
      setFieldErrors({ ...fieldErrors, otp: otpErr });
      setAlert({ type: "error", text: otpErr });
      return;
    }

    setAlert({ type: "error", text: "" });
    setLoading(true);
    try {
      const res = await api.post("/auth/customer/register", { name, phone, email, otp });
      localStorage.setItem("customerToken", res.data.token);
      localStorage.setItem("customerName", res.data.customer.name);
      navigate("/");
    } catch (err) {
      setAlert({ type: "error", text: err.response?.data?.message || "Could not verify. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const errorClass = (k) => `input-field ${fieldErrors[k] ? "border-rani-500 focus:ring-rani-500" : ""}`;

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <h1 className="font-display font-bold text-xl text-ink mb-4">Customer Login / Register</h1>
      <p className="text-xs text-muted mb-3">Only needed to leave a review after your job is done. Browsing and calling workers doesn't require login.</p>
      <form onSubmit={submit} className="space-y-3 card p-4">
        <div>
          <input placeholder="Your name" value={name} onChange={(e) => { setName(e.target.value); setFieldErrors({ ...fieldErrors, name: "" }); }} className={errorClass("name")} />
          {fieldErrors.name && <p className="text-xs text-rani-600 dark:text-rani-300 mt-1">{fieldErrors.name}</p>}
        </div>
        <div>
          <input placeholder="Phone number (e.g. 03001234567)" value={phone} onChange={(e) => { setPhone(e.target.value); setFieldErrors({ ...fieldErrors, phone: "" }); }} className={errorClass("phone")} />
          {fieldErrors.phone && <p className="text-xs text-rani-600 dark:text-rani-300 mt-1">{fieldErrors.phone}</p>}
        </div>
        <div>
          <input placeholder="Email (for free OTP delivery)" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors({ ...fieldErrors, email: "" }); }} className={errorClass("email")} />
          {fieldErrors.email && <p className="text-xs text-rani-600 dark:text-rani-300 mt-1">{fieldErrors.email}</p>}
        </div>
        <button type="button" onClick={sendOtp} disabled={loading} className="btn-secondary w-full disabled:opacity-60">
          {loading ? "Sending..." : "Send OTP"}
        </button>
        {otpSent && (
          <>
            <div>
              <input placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => { setOtp(e.target.value); setFieldErrors({ ...fieldErrors, otp: "" }); }} className={errorClass("otp")} />
              {fieldErrors.otp && <p className="text-xs text-rani-600 dark:text-rani-300 mt-1">{fieldErrors.otp}</p>}
            </div>
            {devCode && <p className="text-xs text-marigold-600 dark:text-marigold-400">Dev mode OTP: {devCode}</p>}
            <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
          </>
        )}
        <FormAlert type={alert.type}>{alert.text}</FormAlert>
      </form>
    </div>
  );
}
