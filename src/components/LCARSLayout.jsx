import React from 'react';
import './LCARSLayout.css';
import useLCARSSound from '../hooks/useLCARSSound';

const LCARSLayout = ({ 
  children, 
  title = "LCARS 4755",
  activeTab,
  navItems = [],
  onNavClick,
  onLogout
}) => {
  const { playClick } = useLCARSSound();

  // Find the color of the active item to tint the top bar/elbow
  const activeColor = navItems.find(item => item.id === activeTab)?.color || 'var(--lcars-cyan)';

  return (
    <div className="lcars-grid">
      {/* Top Left Elbow */}
      <div className="lcars-elbow" style={{ backgroundColor: activeColor }}>
        <div className="elbow-text" style={{ color: 'var(--lcars-black)' }}>USS CERRITOS</div>
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
                  // Constant 4px border to prevent layout shift.
                  borderTop: `4px solid ${isActive ? 'var(--lcars-bg)' : item.color}`,
                  borderBottom: `4px solid ${isActive ? 'var(--lcars-bg)' : item.color}`
                }}
                onClick={() => {
                    playClick();
                    if (onNavClick) onNavClick(item.id);
                }}
              >
                {item.label}
              </button>
            );
          })}
          
          {/* Spacer: Grows to push content down */}
          <div 
            className="lcars-sidebar-spacer" 
            style={{ 
                flexGrow: 1, 
                backgroundColor: activeColor, 
                width: 'var(--elbow-width)',
                borderTopRightRadius: '30px',
                borderBottomRightRadius: '30px'
            }}
          ></div>

          {/* Logout Button (Pinned Bottom) */}
          {onLogout && (
             <button
                className="lcars-sidebar-button"
                style={{ 
                  backgroundColor: 'var(--lcars-red)',
                  color: 'var(--lcars-black)',
                  borderTop: `4px solid var(--lcars-red)`, 
                  borderBottom: `4px solid var(--lcars-red)`, // Keep solid look
                  marginTop: '0px' 
                }}
                onClick={onLogout}
              >
                LOGOUT
              </button>
          )}

          {/* Bottom Cap: Ends the column with the curve */}
          <div 
             className="lcars-sidebar-bottom"
             style={{
                 height: '60px', // Substantial anchor
                 width: 'var(--elbow-width)',
                 backgroundColor: activeColor,
                 borderTopRightRadius: '30px',
                 borderBottomLeftRadius: 'var(--elbow-radius)' // The classic LCARS curve
             }}
          ></div>

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
