import AppHeader from "@/components/boards/AppHeader";
import Footer from "@/components/Footer";
import { Nunito_Sans } from "next/font/google";
import DashboardGuard from "@/app/dashboard/DashboardGuard";
import "@/styles/boards.css"; 

import { AntdPatchClient } from "@/app/dashboard/AntdPatchClient";

const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["600", "700"] });

export default function DashboardLayout({ children }) {
  return (
    <AntdPatchClient>
      <div className="boards-theme">
        <div className={nunito.className}>
          <AppHeader />
          <div style={{ height: "56px" }} />
          <DashboardGuard>{children}</DashboardGuard>
          <Footer />
        </div>
      </div>
    </AntdPatchClient>
  );
}
