"use client";

import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import styles from "./MyAccountHeader.module.css";

export default function MyAccountHeader() {
  return <AdminSectionHeader title="My Account" description="Manage your account information and security." className={styles.header} />;
}
