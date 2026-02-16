import React from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md border font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  const variantClasses = {
    primary: 'border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    destructive: 'border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500',
    outline: 'border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // Use twMerge to properly handle conflicting Tailwind classes
  // This allows custom className to override variant defaults
  return (
    <button
      className={twMerge(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}