import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, FilePlus, AlertCircle, CheckCircle2, XCircle, Award, Settings, Menu, X, Shield } from "lucide-react";
import { useState } from "react";
import WalletSummary from "./WalletSummary";
import type { WalletState } from "../lib/wallet";

type Props = {
  activeCount: number;
  verifiedCount: number;
  disputedCount: number;
  wallet: WalletState;
  connecting: boolean;
  userCredits: number;
  onConnect: () => Promise<void>;
  onClearData: () => void;
};

export default function Layout({
  activeCount,
  verifiedCount,
  disputedCount,
  wallet,
  connecting,
  userCredits,
  onConnect,
  onClearData,
}: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: "/", icon: <LayoutDashboard className="h-5 w-5" />, label: "Genel Bakış" },
    { path: "/create", icon: <FilePlus className="h-5 w-5" />, label: "Bildirim Oluştur" },
    { path: "/active", icon: <AlertCircle className="h-5 w-5" />, label: "Aktif Bildirimler", count: activeCount },
    { path: "/verified", icon: <CheckCircle2 className="h-5 w-5" />, label: "Doğrulananlar", count: verifiedCount },
    { path: "/disputed", icon: <XCircle className="h-5 w-5" />, label: "Yanlışlananlar", count: disputedCount },
    { path: "/reputation", icon: <Award className="h-5 w-5" />, label: "İtibar" },
    { path: "/system", icon: <Settings className="h-5 w-5" />, label: "Sistem & Soroban" },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-300/20 bg-indigo-500/15 text-indigo-100">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-base font-black tracking-tight text-slate-50">ProofWitness</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform flex flex-col border-r border-slate-800 bg-slate-950 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="hidden h-16 items-center gap-3 border-b border-slate-800 px-6 lg:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-300/20 bg-indigo-500/15 text-indigo-100">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-50">ProofWitness</span>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-200"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-400"}>
                    {item.icon}
                  </span>
                  {item.label}
                </div>
                {item.count !== undefined && (
                  <span className={`flex h-5 items-center justify-center rounded-full px-2 text-[10px] font-bold ${
                    isActive ? "bg-indigo-500/20 text-indigo-200" : "bg-slate-800 text-slate-400"
                  }`}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 lg:hidden">
           <WalletSummary
            wallet={wallet}
            onConnect={onConnect}
            connecting={connecting}
            userCredits={userCredits}
            onClearData={onClearData}
            variant="card"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-x-hidden">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-end border-b border-slate-800 bg-slate-950/80 px-8 backdrop-blur-xl lg:flex">
          <WalletSummary
            wallet={wallet}
            onConnect={onConnect}
            connecting={connecting}
            userCredits={userCredits}
            onClearData={onClearData}
            variant="topbar"
          />
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
