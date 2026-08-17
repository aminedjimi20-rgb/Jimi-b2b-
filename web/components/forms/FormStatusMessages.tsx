import { CheckCircle2, AlertCircle } from "lucide-react";

export function SuccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
      <div>
        <p className="font-bold text-emerald-800">{title}</p>
        <p className="mt-1 text-sm text-emerald-700">{message}</p>
      </div>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

export function HoneypotField() {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
      aria-hidden="true"
    />
  );
}
