import React from 'react';
import './LCARSLayout.css';

const LCARSLayout = ({ children, title = "LCARS 4755" }) => {
  return (
    <div className="lcars-grid">
      {/* Top Left Elbow */}
      <div className="lcars-elbow">
        <div className="elbow-text">USS ENTERPRISE</div>
      </div>

      {/* Top Bar */}
      <div className="lcars-top-bar">
        <div className="top-bar-fill"></div>
        <div className="top-bar-text">{title}</div>
        <div className="top-bar-end"></div>
      </div>

      {/* Sidebar (Left) */}
      <div className="lcars-sidebar">
        <div className="sidebar-fill"></div>
        <div className="sidebar-buttons">
          {/* Default Sidebar Placeholders if needed */}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="lcars-content">
        <div className="content-inner">
          {children}
        </div>
      </main>
    </div>
  );
};

export default LCARSLayout;
