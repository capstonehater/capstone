"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import styles from "./ProductImage.module.css";

export default function ProductImage({ src, name }: { src?: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = src?.startsWith("/product-images/")
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}${src}`
    : src;
  return <div className={styles.frame}>
    {url && failedSrc !== url ? <Image src={url} alt={name} fill unoptimized sizes="(max-width: 640px) 100vw, 400px" className={styles.image} onError={() => setFailedSrc(url)} /> :
      <div className={styles.placeholder}><ImageIcon size={36} strokeWidth={1.25} aria-hidden="true" /><span>No product photo</span></div>}
  </div>;
}
