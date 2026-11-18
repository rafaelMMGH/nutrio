import { Urbanist } from "next/font/google";

// Geometric sans of the redesigned layout (alt-dashboard P13): only the new shell and dashboard use it.
export const urbanist = Urbanist({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-nt", display: "swap" });
