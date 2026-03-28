import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  Camera,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
} from "lucide-react";
import { authApi } from "../services/api";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

type Message = { type: "success" | "error"; text: string } | null;

const Profile: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState<Message>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState<Partial<typeof formData>>({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setFetching(true);
        const response = await authApi.getMe();
        const user = response.data?.user;

        if (response.success && user) {
          setFormData((prev) => ({
            ...prev,
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
            password: "",
            confirm_password: "",
          }));
          setAvatarPreview(user.profile_image_url || null);
        }
      } catch (err: any) {
        setMessage({
          type: "error",
          text: err?.message || "Failed to load profile.",
        });
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, []);

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

    if (file.size > MAX_IMAGE_SIZE) {
      setMessage({ type: "error", text: "Image must be under 2MB." });
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "Only JPG, PNG, or WEBP images are allowed." });
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors: Partial<typeof formData> = {};

    if (!formData.name.trim()) newErrors.name = "Full name is required.";
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = "Enter a valid 10-digit phone number.";
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters.";
      }
      if (formData.password !== formData.confirm_password) {
        newErrors.confirm_password = "Passwords do not match.";
      }
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
      const payload = new FormData();
      payload.append("name", formData.name.trim());
      payload.append("phone", formData.phone.trim());
      if (formData.password) payload.append("password", formData.password);
      if (avatarFile) payload.append("avatar", avatarFile);

      const response = await authApi.updateProfile(payload);
      const user = response.data?.user;

      if (response.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        setFormData((prev) => ({
          ...prev,
          name: user?.name || prev.name,
          phone: user?.phone || "",
          password: "",
          confirm_password: "",
        }));
        setAvatarFile(null);
        if (user?.profile_image_url) setAvatarPreview(user.profile_image_url);

        window.dispatchEvent(
          new CustomEvent("user-profile-updated", {
            detail: { user },
          }),
        );
      } else {
        setMessage({
          type: "error",
          text: response.message || "Failed to update profile.",
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "An error occurred while saving.",
      });
    } finally {
      setLoading(false);
    }
  };

  const initials = useMemo(
    () =>
      formData.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [formData.name],
  );

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const inputClass = (field: keyof typeof errors) =>
    `w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
      errors[field] ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Profile Settings</h1>
        <p className="text-slate-500 font-bold text-sm mt-1">
          Update your full name, phone, password and profile image.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-rose-50 text-rose-700 border border-rose-100"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <User size={18} className="text-indigo-500" /> Profile Photo
            </h2>
            <p className="text-slate-500 text-xs mt-1">JPG, PNG, WEBP  max 2 MB</p>
          </div>

          <div className="p-6 md:p-8 flex items-center gap-8">
            <div className="relative flex-shrink-0">
              <div
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer ring-4 ring-slate-200 hover:ring-slate-300 transition-all group"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-indigo-600 select-none">
                    {initials || <User size={32} className="text-indigo-400" />}
                  </span>
                )}
                <div className="absolute inset-0 bg-slate-900/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              </div>

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
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div>
              <p className="text-sm font-black text-slate-900">{formData.name || "Your Name"}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{formData.email || "your@email.com"}</p>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="mt-3 text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider transition-colors"
              >
                Change photo
              </button>
              {avatarFile && <p className="text-xs text-emerald-600 font-bold mt-1"> {avatarFile.name} selected</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-lg text-slate-900 tracking-tight">Profile Information</h2>
            <p className="text-slate-500 text-xs mt-1">Email is read-only and cannot be changed.</p>
          </div>

          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User size={12} /> Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={inputClass("name")}
                placeholder="e.g. John Doe"
              />
              {errors.name && (
                <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Phone size={12} /> Phone
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

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Mail size={12} /> Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                readOnly
                disabled
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-bold cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <Lock size={18} className="text-indigo-500" /> Change Password
            </h2>
            <p className="text-slate-500 text-xs mt-1">Leave blank if you do not want to change password.</p>
          </div>

          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Password</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.confirm_password}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
