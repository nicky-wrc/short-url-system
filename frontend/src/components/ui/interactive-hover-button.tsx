import { Children, forwardRef, isValidElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

function hasText(children: ReactNode): boolean {
  return Children.toArray(children).some(child => typeof child === 'string' || typeof child === 'number' ||
    (isValidElement<{ children?: ReactNode }>(child) && hasText(child.props.children)));
}
function Content({ children, animate, backward = false }: { children: ReactNode; animate: boolean; backward?: boolean }) {
  if (!animate) return <>{children}</>;
  const Arrow = backward ? ArrowLeft : ArrowRight;
  return <><span className="hover-button-label">{children}</span><span className="hover-button-reveal" aria-hidden="true"><span className="hover-button-reveal-label">{children}</span><Arrow className="hover-button-arrow" size={16} /></span></>;
}
export interface InteractiveHoverButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { text?: string }
export const InteractiveHoverButton = forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  ({ text, children = text ?? 'Button', className = 'button preview-secondary', disabled, ...props }, ref) => {
    const animate = hasText(children) && !disabled && !className.split(' ').includes('advanced-toggle');
    return <button ref={ref} {...props} disabled={disabled} className={`${className} ${animate ? 'interactive-hover-button' : ''}`}><Content animate={animate} backward={className.split(' ').includes('auth-back')}>{children}</Content></button>;
  });
InteractiveHoverButton.displayName = 'InteractiveHoverButton';
// Keep native anchor semantics for downloads, public redirects and new-tab links.
export const InteractiveHoverLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ children, className = 'button preview-secondary', ...props }, ref) => {
    const animate = hasText(children) && !props['aria-disabled'];
    return <a ref={ref} {...props} className={`${className} ${animate ? 'interactive-hover-button' : ''}`}><Content animate={animate}>{children}</Content></a>;
  });
InteractiveHoverLink.displayName = 'InteractiveHoverLink';
