import React from 'react';
import './LCARSLayout.css';

const LCARSLayout = ({ 
  children, 
  title = "LCARS 4755",
  activeTab,
  navItems = [],
  onNavClick
}) => {
  // Find the color of the active item to tint the top bar/elbow
  const activeColor = navItems.find(item => item.id === activeTab)?.color || 'var(--lcars-cyan)';

  return (
    <div className="lcars-grid">
      {/* Top Left Elbow */}
      <div className="lcars-elbow" style={{ backgroundColor: activeColor }}>
        <div className="elbow-text" style={{ color: 'var(--lcars-black)' }}>USS ENTERPRISE</div>
      </div>

      {/* Top Bar */}
      <div className="lcars-top-bar" style={{ borderColor: activeColor }}>
        <div className="top-bar-fill" style={{ backgroundColor: activeColor }}></div>
        <div className="top-bar-text" style={{ color: activeColor }}>{title}</div>
        <div className="top-bar-end" style={{ backgroundColor: activeColor }}></div>
      </div>

      {/* Sidebar (Left) */}
      <div className="lcars-sidebar">
        <div className="sidebar-buttons">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`lcars-sidebar-button ${isActive ? 'active' : ''}`}
                style={{ 
                  backgroundColor: item.color,
                  color: 'var(--lcars-black)',
                  borderTop: isActive ? '4px solid var(--lcars-bg)' : 'none',
                  borderBottom: isActive ? '4px solid var(--lcars-bg)' : 'none'
                }}
                onClick={() => onNavClick && onNavClick(item.id)}
              >
                {item.label}
              </button>
            );
          })}
          {/* Fill the rest of the sidebar */}
          <div className="sidebar-fill" style={{ backgroundColor: activeColor, flexGrow: 1 }}></div>
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
