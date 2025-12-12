import React from 'react';
import './LCARSButton.css';

const LCARSButton = ({ 
  children, 
  onClick, 
  color = 'var(--lcars-orange)', 
  rounded = 'left', // 'left', 'right', 'both', 'none'
  block = false,
  className = '' // Add className to props destructuring
}) => {
  const style = {
    backgroundColor: color,
  };

  const classes = [
    'lcars-button',
    `rounded-${rounded}`,
    block ? 'block' : '',
    className // Include in the class list construction
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={classes} 
      style={style} 
      onClick={onClick}
    >
      <span className="button-content">{children}</span>
    </button>
  );
};

export default LCARSButton;
