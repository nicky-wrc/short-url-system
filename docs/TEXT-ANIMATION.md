# Login/Register text animation

`frontend/src/components/ui/text-scroll-animation.tsx` adapts the supplied CharacterV1 concept only. It uses Motion 14 (`motion/react`) with the existing CSS and tokens; no Next.js, Tailwind, shadcn, Lenis, external images or global smooth scrolling.

```tsx
<TextScrollAnimation
  text="One place for your links, QR codes and recorded opens."
  className="auth-description"
  emphasis={['your links']}
/>
```

- Used only for the introductory paragraph below the Login/Register heading. Labels, controls, errors, navigation, tables and statistics remain static.
- Detects the nearest ancestor with real vertical overflow, otherwise the document scrolling element. ResizeObserver and viewport resize remeasure after form/layout changes. An `overflow:auto` ancestor with no overflow does not mask an outer scrolling container.
- On a page without scroll, a 420ms entrance brings characters into place. On a scrolling page, `useScroll` tracks the target inside the detected container, from `start end` to `end 0.85`. Already visible text may already be settled; it never requires scrolling to become readable. Reusable element containers should use `position:relative` (or another non-static position), as required by Motion's offset measurement.
- Uses `MotionValue<number>` and grapheme/word segmentation with `Intl.Segmenter`, preserving Thai combining marks and natural word wrapping. Older browsers without Segmenter receive the whole plain text without character animation.
- Maximum translation is 1.5px and rotation is 4 degrees, independent of string length. No opacity hiding, stagger, delayed form, artificial section height or layout-changing transforms. Existing font, spacing and theme colors remain; only selected phrases use `--accent`.
- Reduced motion renders complete text with progress 1, with no animated entrance or scroll subscription. A CSS guard also removes character transforms. Assistive technology receives one full sentence; the visual character tree is `aria-hidden`.

## Verification, 2026-10-03

Typecheck and production build passed. Browser QA used the production frontend bundle with an isolated read-only session fixture on loopback port 3117: no database/provider requests or authentication writes.

- Login and Register inspected at 1440×900 and 390×844; Login also checked at 768×900. No horizontal overflow. Screenshots reviewed under ignored `tmp/qa-ui/text-*.png`.
- Desktop document measured 900/900 client/scroll height: entrance mode. Mobile Register measured 844/939: natural document scroll mode, with no added page height. Input typing, Tab to email, Continue to password and autofocus stayed functional; there are no animated nodes inside the form.
- A separate development-only harness tested Thai text and a 220px nested scroll container while the document remained 844/844. The container scroll changed character transforms from bounded offsets to none while document scroll stayed zero. Thai graphemes included `จั`, `ลิ`, `ก์`, `คุ`, `ป็`, `บี`, `ช้` and `ง่` in single spans. The initially static-position harness produced Motion's expected positioning warning; setting its container to relative corrected the fixture.
- Reduced-motion behavior was exercised by a main-world matchMedia stub in the development-only HTML fixture, on both Login and Register. Component mode was static and all computed character transforms were none. This was browser fixture emulation, not a Windows accessibility-setting change. A physical device, native screen reader and actual OS reduced-motion setting were not tested.
- This task does not retest login/register submission or the backend integration suite; auth handlers and API contracts were not changed. There is no QA route or media override in shipping source.

References: [Motion useScroll](https://motion.dev/docs/react-use-scroll), [Motion useReducedMotion](https://motion.dev/docs/react-use-reduced-motion).
