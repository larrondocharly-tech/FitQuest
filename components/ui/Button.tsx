import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-violet-600 text-white hover:bg-violet-500 focus-visible:ring-violet-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:ring-slate-300',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800/60 focus-visible:ring-slate-400',
  danger: 'bg-red-700 text-white hover:bg-red-600 focus-visible:ring-red-400'
};

export default function Button({
  children,
  className = '',
  variant = 'primary',
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`min-h-11 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
