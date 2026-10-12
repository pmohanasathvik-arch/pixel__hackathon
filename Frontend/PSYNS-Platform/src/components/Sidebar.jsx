import React from "react";
import { LayoutDashboard, ClipboardList, Upload, Users, Settings, FileBarChart2, CalendarDays, Mail, GraduationCap } from "lucide-react";
const nav = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, roles: ["student","proctor","incharge"] },
  { id: "requests", label: "Event requests", icon: ClipboardList, roles: ["student","proctor","incharge"] },
  { id: "attendance", label: "Attendance records", icon: Users, roles: ["incharge","proctor"] },
  { id: "import", label: "Import attendance", icon: Upload, roles: ["incharge"] },
  { id: "academicImport", label: "Academic profiles", icon: GraduationCap, roles: ["incharge"] },
  { id: "reports", label: "Reports & exports", icon: FileBarChart2, roles: ["incharge","proctor"] },
  { id: "settings", label: "Eligibility settings", icon: Settings, roles: ["incharge"] },
  { id: "letters", label: "Letters", icon: Mail, roles: ["student","proctor","incharge"] }
];
export default function Sidebar({ role, page, setPage }) {
  return <aside className="sidebar"><div className="side-label">WORKSPACE</div>{nav.filter(n=>n.roles.includes(role)).map(n=>{const Icon=n.icon;return <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}><Icon size={18}/><span>{n.label}</span>{n.id==="requests"&&<span className="nav-arrow">›</span>}</button>})}
    <div className="side-bottom"><div className="help-card"><div className="help-icon">?</div><b>Need help?</b><p>Check your request status or contact your event in-charge.</p><span>PSYNS support ↗</span></div><small className="version">PSYNS Portal · Demo v1.0</small></div>
  </aside>;
}