import React, { useState } from 'react';
import LCARSButton from '../components/LCARSButton';
import './Library.css';

const DATA = {
  SHIPS: [
    { id: 'ent-d', title: 'USS ENTERPRISE NCC-1701-D', class: 'Galaxy Class', crew: '1014', speed: 'Warp 9.6', desc: 'The flagship of the Federation. Commanded by Captain Jean-Luc Picard.' },
    { id: 'defiant', title: 'USS DEFIANT NX-74205', class: 'Defiant Class', crew: '50', speed: 'Warp 9.5', desc: 'Escort vessel attached to Deep Space 9. Commanded by Captain Benjamin Sisko.' },
    { id: 'voyager', title: 'USS VOYAGER NCC-74656', class: 'Intrepid Class', crew: '141', speed: 'Warp 9.975', desc: 'Lost in the Delta Quadrant. Commanded by Captain Kathryn Janeway.' },
  ],
  PLANETS: [
    { id: 'earth', title: 'EARTH', sector: '001', population: '9 Billion', desc: 'Homeworld of the Human species and capital of the United Federation of Planets.' },
    { id: 'vulcan', title: 'VULCAN', sector: '005', population: '6 Billion', desc: 'Homeworld of the Vulcans. Known for its harsh desert climate and logical inhabitants.' },
    { id: 'qonos', title: 'Q\'ONOS', sector: '221', population: '4 Billion', desc: 'Homeworld of the Klingon Empire. A dark and stormy world.' },
  ]
};

const Library = () => {
  const [category, setCategory] = useState('SHIPS');
  const [selectedItem, setSelectedItem] = useState(DATA['SHIPS'][0]);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setSelectedItem(DATA[cat][0]);
  };

  return (
    <div className="library-container">
      <div className="library-sidebar">
        <LCARSButton 
           onClick={() => handleCategoryChange('SHIPS')} 
           color={category === 'SHIPS' ? 'var(--lcars-orange)' : 'var(--lcars-tan)'} 
           rounded="left" block
        >SHIPS</LCARSButton>
        <LCARSButton 
           onClick={() => handleCategoryChange('PLANETS')} 
           color={category === 'PLANETS' ? 'var(--lcars-orange)' : 'var(--lcars-tan)'} 
           rounded="left" block
        >PLANETS</LCARSButton>
        
        <div className="library-list">
           {DATA[category].map(item => (
             <div 
               key={item.id} 
               className={`library-list-item ${selectedItem.id === item.id ? 'active' : ''}`}
               onClick={() => setSelectedItem(item)}
             >
               {item.title}
             </div>
           ))}
        </div>
      </div>

      <div className="library-content">
        {selectedItem && (
          <>
            <h2 className="library-title">{selectedItem.title}</h2>
            <div className="library-data-grid">
               {Object.entries(selectedItem).map(([key, value]) => {
                 if (key === 'id' || key === 'title' || key === 'desc') return null;
                 return (
                   <div key={key} className="data-row">
                     <span className="data-label">{key.toUpperCase()}:</span>
                     <span className="data-value">{value}</span>
                   </div>
                 );
               })}
            </div>
            <p className="library-desc">{selectedItem.desc}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Library;
