import React, { useState, useRef, useEffect } from "react";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  Camera,
  Eye,
  EyeOff,
  User,
} from "lucide-react";

// ── Replace with your actual API service ─────────────────────────────────────
// import { profileApi } from "../services/api";

const Profile: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState<Partial<typeof formData>>({});

  // ── Fetch existing profile ───────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setFetching(true);
        // const response = await profileApi.getProfile();
        // if (response.success && response.data) {
        //   setFormData(prev => ({ ...prev, ...response.data }));
        //   if (response.data.avatar_url) setAvatarPreview(response.data.avatar_url);
        // }

        // Mock data — remove when wired to real API
        await new Promise((r) => setTimeout(r, 600));
        setFormData({
          name: "Test User",
          email: "test@example.com",
          phone: "9876543210",
          password: "",
          confirm_password: "",
        });
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchProfile();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be under 2MB." });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors: Partial<typeof formData> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required.";
    if (!formData.email.trim()) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Enter a valid email address.";
    if (formData.phone && !/^\d{10}$/.test(formData.phone))
      newErrors.phone = "Enter a valid 10-digit phone number.";
    if (formData.password) {
      if (formData.password.length < 6)
        newErrors.password = "Password must be at least 6 characters.";
      if (formData.password !== formData.confirm_password)
        newErrors.confirm_password = "Passwords do not match.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage(null);

    try {
      // const payload = new FormData();
      // Object.entries(formData).forEach(([k, v]) => v && payload.append(k, v));
      // if (avatarFile) payload.append("avatar", avatarFile);
      // const response = await profileApi.updateProfile(payload);

      await new Promise((r) => setTimeout(r, 800)); // mock delay
      const response = { success: true, message: "" };

      if (response.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        setFormData((prev) => ({
          ...prev,
          password: "",
          confirm_password: "",
        }));
      } else {
        setMessage({
          type: "error",
          text: response.message || "Failed to update profile.",
        });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred while saving." });
    } finally {
      setLoading(false);
    }
  };

  // ── Avatar initials fallback ──────────────────────────────────────────────
  const initials = formData.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // ── Field helper ──────────────────────────────────────────────────────────
  const inputClass = (field: keyof typeof errors) =>
    `w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
      errors[field] ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            My Profile
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-1">
            Manage your account information and password
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Alert message ──────────────────────────────────────────────── */}
        {message && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {message.text}
          </div>
        )}

        {/* ── Avatar card ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <User size={18} className="text-indigo-500" />
              Profile Photo
            </h2>
            <p className="text-slate-500 text-xs mt-1">JPG or PNG · max 2 MB</p>
          </div>

          <div className="p-6 md:p-8 flex items-center gap-8">
            {/* Avatar circle */}
            <div className="relative flex-shrink-0">
              <div
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-2xl overflow-hidden bg-indigo-100 flex items-center justify-center cursor-pointer ring-4 ring-indigo-50 hover:ring-indigo-200 transition-all group"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black text-indigo-600 select-none">
                    {initials || <User size={32} className="text-indigo-400" />}
                  </span>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-slate-900/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              </div>

              {/* Camera badge */}
              <button
                type="button"
                onClick={handleAvatarClick}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 transition-all active:scale-95"
              >
                <Camera size={14} className="text-white" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div>
              <p className="text-sm font-black text-slate-900">
                {formData.name || "Your Name"}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {formData.email || "your@email.com"}
              </p>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="mt-3 text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider transition-colors"
              >
                Change photo
              </button>
              {avatarFile && (
                <p className="text-xs text-emerald-600 font-bold mt-1">
                  ✓ {avatarFile.name} selected
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Personal info card ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-lg text-slate-900 tracking-tight">
              Personal Information
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Update your name, email and phone number
            </p>
          </div>

          <div className="p-6 md:p-8">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">
              Account Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={inputClass("name")}
                  placeholder="e.g. Test User"
                />
                {errors.name && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.name}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={inputClass("phone")}
                  placeholder="9876543210"
                  maxLength={10}
                />
                {errors.phone && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.phone}
                  </p>
                )}
              </div>

              {/* Email — full width */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={inputClass("email")}
                  placeholder="test@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Password card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-lg text-slate-900 tracking-tight">
              Change Password
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Leave blank to keep your current password
            </p>
          </div>

          <div className="p-6 md:p-8">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">
              Security
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* New password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`${inputClass("password")} pr-11`}
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className={`${inputClass("confirm_password")} pr-11`}
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.confirm_password}
                  </p>
                )}
              </div>

              {/* Password strength hint */}
              {formData.password && (
                <div className="md:col-span-2">
                  <div className="flex gap-1.5 mb-1">
                    {[1, 2, 3, 4].map((level) => {
                      const strength =
                        formData.password.length >= 12
                          ? 4
                          : formData.password.length >= 8
                            ? 3
                            : formData.password.length >= 6
                              ? 2
                              : 1;
                      return (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            level <= strength
                              ? strength === 4
                                ? "bg-emerald-500"
                                : strength === 3
                                  ? "bg-indigo-500"
                                  : strength === 2
                                    ? "bg-amber-400"
                                    : "bg-rose-400"
                              : "bg-slate-200"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    {formData.password.length >= 12
                      ? "Strong password"
                      : formData.password.length >= 8
                        ? "Good password"
                        : formData.password.length >= 6
                          ? "Weak password"
                          : "Too short"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Save button ────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} /> Save Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
