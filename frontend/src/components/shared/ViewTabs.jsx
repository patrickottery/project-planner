import React from "react";
import { useStore } from "../../store/useStore";
import { LayoutList, BarChart2, LayoutDashboard, ShieldAlert } from "lucide-react";
import "./ViewTabs.css";

const TABS = [
  { id: "tree",      label: "Tasks",     Icon: LayoutList },
  { id: "gantt",     label: "Gantt",     Icon: BarChart2 },
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "risks",     label: "Risks",     Icon: ShieldAlert },
];

export default function ViewTabs() {
  const { activeView, setActiveView } = useStore();
  return (
    <div className="view-tabs">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`view-tab ${activeView === id ? "active" : ""}`}
          onClick={() => setActiveView(id)}
          title={label}
        >
          <Icon size={14} />
          <span className="view-tab-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
