interface MorphLoadingProps {
  variant?: 'morph';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Decorative indicator: keep the operation's readable status beside it. */
export default function MorphLoading({ size = 'md', className = '' }: MorphLoadingProps) {
  return <span className={`morph-loading morph-loading--${size} ${className}`} aria-hidden="true">
    {[0, 1, 2, 3].map(index => <span className="morph-loading-piece" key={index} />)}
  </span>;
}
