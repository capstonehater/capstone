type TextInputProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

export default function TextInput({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: TextInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xl font-semibold text-black"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full rounded-2xl border-0 bg-[#d9d9d9] px-4 text-lg text-neutral-700 outline-none placeholder:text-neutral-500 focus:outline-none"
      />
    </div>
  );
}