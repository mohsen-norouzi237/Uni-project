import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width ?? undefined,
    height: height ?? (variant === 'text' ? '1rem' : undefined),
  };

  return (
    <div
      style={style}
      className={`animate-pulse bg-gray-200 ${variantStyles[variant]} ${className}`}
    />
  );
};

export default Skeleton;