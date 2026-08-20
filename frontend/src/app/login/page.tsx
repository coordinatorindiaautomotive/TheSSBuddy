'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

const schema = z.object({
  username: z.string().min(1, 'Please enter your email or username'),
  password: z.string().min(1, 'Please enter your password'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const loggedUser = await login(data.username, data.password);
      
      const isSuper = (loggedUser?.roles || []).some((r: string) => r.toUpperCase().includes('SUPER') || r.toUpperCase().includes('ADMIN')) || 
                      (loggedUser?.role || '').toUpperCase().includes('SUPER') ||
                      loggedUser?.username?.toLowerCase() === 'admin';

      let welcomeName = loggedUser?.fullName || loggedUser?.username || '';
      if (isSuper && (!welcomeName || welcomeName.toLowerCase() === 'admin')) {
        welcomeName = 'Mr. Shailendra Singh';
      } else if (!welcomeName.toLowerCase().startsWith('mr') && !welcomeName.toLowerCase().startsWith('ms')) {
        welcomeName = `Mr. ${welcomeName}`;
      }

      toast.success(`Welcome to TheSSBuddy, ${welcomeName}!`, {
        duration: 4000,
        icon: '👋',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid credentials. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#F7F7F3]">
      {/* Centered White Card */}
      <div className="w-full max-w-[420px] bg-white rounded-3xl p-8 sm:p-10 shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
        
        {/* TheSSBuddy Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/thessbuddy-logo.png"
            alt="TheSSBuddy Logo"
            className="h-20 w-auto object-contain"
            onError={(e) => {
              // fallback to direct server url if needed
              (e.target as HTMLImageElement).src = 'http://172.20.25.7:8080/thessbuddy-logo.png';
            }}
          />
        </div>

        {/* Header Titles */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-black text-[#053D3A] tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Log in to your executive account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email / Username Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Address / Username
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Mail size={16} />
              </div>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A] transition shadow-2xs font-medium"
              />
            </div>
            {errors.username && (
              <p className="text-rose-500 text-xs mt-1 font-medium">{errors.username.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock size={16} />
              </div>
              <input
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A] transition shadow-2xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-0.5"
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-rose-500 text-xs mt-1 font-medium">{errors.password.message}</p>
            )}
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#053D3A] focus:ring-[#053D3A] cursor-pointer accent-[#053D3A]"
              />
              <span className="text-xs text-slate-600 font-medium">Remember me</span>
            </label>

            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast('Please contact your System Administrator to reset your password.', {
                  icon: 'ℹ️',
                });
              }}
              className="text-xs font-bold text-[#053D3A] hover:underline"
            >
              Forgot password?
            </a>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#053D3A] hover:bg-[#074B47] text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* Footer Sign Up Link */}
        <div className="mt-8 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast('Account creation is managed by your Corporate SuperAdmin.', {
                  icon: '🔐',
                });
              }}
              className="text-[#053D3A] font-bold hover:underline ml-0.5"
            >
              Sign up
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
