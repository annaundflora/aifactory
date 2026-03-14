interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="block h-0.5 w-6 shrink-0 bg-primary" />
      <span className="text-[11px] font-bold uppercase tracking-[2px] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}
