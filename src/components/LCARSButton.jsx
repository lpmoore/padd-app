import React from 'react';
import './LCARSButton.css';
import useLCARSSound from '../hooks/useLCARSSound';

const LCARSButton = ({ 
  children, 
  onClick, 
  color = 'var(--lcars-orange)', 
  rounded = 'left', // 'left', 'right', 'both', 'none'
  block = false,
  className = '', // Add className to props destructuring
  sound = true // Prop to optionally disable sound
}) => {
  const { playClick } = useLCARSSound();

  const handleClick = (e) => {
      if (sound) playClick();
      if (onClick) onClick(e);
  };

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
      onClick={handleClick}
    >
      <span className="button-content">{children}</span>
    </button>
  );
};

export default LCARSButton;
