type PrimaryButtonProps = {
  type?: "button" | "submit";
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export default function PrimaryButton({
  type = "button",
  children,
  onClick,
  className = "",
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`h-12 min-w-[220px] rounded-2xl bg-[#3d3434] px-8 text-lg font-medium text-white transition hover:opacity-90 ${className}`}
    >
      {children}
    </button>
  );
}