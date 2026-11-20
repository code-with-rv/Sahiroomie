import React from 'react';

export const SAHIROOMIE_LOGO_SRC = '/assets/aistudio/a2966bba-47a0-46c6-98a3-6a540e72213c_8d7f8e6a.webp';

interface SahiroomieLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export const SahiroomieLogo: React.FC<SahiroomieLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  if (!showWordmark) {
    const badgeDims = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden bg-[#F5F5F0] border border-black/10 shadow-sm shrink-0 select-none ${badgeDims} ${className}`}
      >
        <img
          src={SAHIROOMIE_LOGO_SRC}
          alt="Sahiroomie"
          className="w-full h-full object-contain scale-[3.1] translate-y-[22%]"
        />
      </div>
    );
  }

  const fullDims =
    size === 'sm'
      ? 'h-8 w-[76px] rounded-xl'
      : size === 'lg'
        ? 'h-12 w-[112px] rounded-2xl'
        : 'h-10 w-[94px] rounded-xl';

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden bg-[#F5F5F0] border border-black/10 shadow-sm shrink-0 select-none ${fullDims} ${className}`}
    >
      <img
        src={SAHIROOMIE_LOGO_SRC}
        alt="Sahiroomie"
        className="w-full h-full object-contain scale-[1.55]"
      />
    </div>
  );
};
