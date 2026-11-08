import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[color,background-color,box-shadow,transform] duration-100 ease-out motion-safe:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'secondary' && 'bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50',
        variant === 'ghost' && 'text-zinc-700 hover:bg-zinc-200/70',
        variant === 'danger' && 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-zinc-600">
        {label}
        {hint && (
          <span className="font-normal text-zinc-400" aria-hidden="true">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border-0 bg-white px-2.5 py-1.5 text-sm ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600';

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-medium text-zinc-600">
        {label}
        <span className="tabular-nums text-zinc-400">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-zinc-200/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-100 ease-out motion-safe:active:scale-[0.97]',
            value === o.value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-zinc-200 p-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Tracks the content box size of an element. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Object URL for a Blob, revoked automatically. */
export function useObjectUrl(blob: Blob | undefined | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

const paths: Record<string, string> = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  back: 'm15 18-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14',
  upload: 'M12 21V9m0 0-4 4m4-4 4 4M5 3h14',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
};

export function Icon({ name, className = 'size-4', filled }: { name: keyof typeof paths | string; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
