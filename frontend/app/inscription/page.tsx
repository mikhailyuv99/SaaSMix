"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InscriptionPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?auth=register");
  }, [router]);
  return null;
}
