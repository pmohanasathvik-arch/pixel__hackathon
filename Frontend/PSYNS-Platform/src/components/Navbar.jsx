import React from "react";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
export default function Navbar({ user, onLogout }) {
  return <header className="topbar">
    <div className="brand"><div className="brand-mark"><ShieldCheck size={23}/></div><div><strong>PSYNS</strong><small>Student event approvals</small></div></div>
    <div className="top-actions"><span className="secure"><span className="live-dot"/> Secure workspace</span><button className="icon-btn" title="Notifications"><Bell size={18}/></button><div className="user-chip"><div className="avatar">{user.name.slice(0,1)}</div><div className="user-label"><b>{user.name}</b><small>{user.roleLabel}</small></div></div><button className="icon-btn" title="Sign out" onClick={onLogout}><LogOut size={18}/></button></div>
  </header>;
}