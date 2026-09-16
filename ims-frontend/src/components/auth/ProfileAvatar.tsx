"use client";

import Image from "next/image";
import { useState } from "react";
import { CircleUserRound } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { profilePictureSrc } from "@/lib/settings";

export default function ProfileAvatar() {
  const user = useAuthStore((state) => state.user);
  const src = profilePictureSrc(user?.profilePictureUrl ?? null);
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9e1d6] text-[#3d3434]">
      {src && src !== failedSrc ? (
        <Image key={src} src={src} alt={`${user?.name ?? "Account"} profile picture`} width={40} height={40} unoptimized className="h-10 w-10 object-cover" onError={() => setFailedSrc(src)} />
      ) : <CircleUserRound size={24} aria-hidden="true" />}
    </div>
  );
}
